/**
 * warrant-control — Appwrite Function (Node 22)
 * Actions: grant | revoke | agentJwt | startRace | jar
 *
 * Env (set as Function variables):
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 */
import { Client, TablesDB, Users, ID, Permission, Role, Query } from 'node-appwrite';

const DB_ID = 'warrant';
const TABLES = { warrants: 'warrants', actions: 'actions', vendors: 'vendors' };
const AGENT_USER_ID = 'agent_02';
const GRANTOR_USER_ID = 'grantor_01';

function livePermissions({ grantorId, agentUserId = AGENT_USER_ID }) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(grantorId)),
    Permission.update(Role.user(agentUserId)),
  ];
}

function revokedPermissions({ grantorId, agentUserId = AGENT_USER_ID }) {
  return livePermissions({ grantorId, agentUserId }).filter(
    (p) => p !== Permission.update(Role.user(agentUserId)),
  );
}

function actionPermissions() {
  return [Permission.read(Role.any()), Permission.update(Role.user(AGENT_USER_ID))];
}

function describeError(err) {
  return { code: err?.code ?? null, type: err?.type ?? null, message: err?.message ?? String(err) };
}

function clients() {
  const c = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  return { tables: new TablesDB(c), users: new Users(c), client: c };
}

function asAgent(jwt) {
  const c = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setJWT(jwt);
  return new TablesDB(c);
}

async function grant(tables, body) {
  const warrantId = ID.unique();
  const budgetCents = body.budgetCents ?? 50_000;
  const actionsLeft = body.actionsLeft ?? 40;
  await tables.createRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId: warrantId,
    data: {
      label: body.label ?? 'demo',
      budgetCents,
      budgetStartCents: budgetCents,
      actionsLeft,
      actionsStart: actionsLeft,
      vendors: ['northwind', 'brightline', 'cobalt'],
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      status: 'active',
      grantorId: GRANTOR_USER_ID,
      agentUserId: AGENT_USER_ID,
    },
    permissions: livePermissions({ grantorId: GRANTOR_USER_ID }),
  });
  return { warrantId };
}

async function revoke(tables, warrantId) {
  const before = await tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId: warrantId });
  const after = revokedPermissions({ grantorId: GRANTOR_USER_ID });
  const removed = before.$permissions.filter((p) => !after.includes(p));
  // ISO timestamp when permissions are rewritten — UI splits click→here vs here→reject.
  const revokedAt = new Date().toISOString();
  await tables.updateRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId: warrantId,
    data: { status: 'revoked', revokedAt },
    permissions: after,
  });
  return { removed, revokedAt };
}

async function mintJwt(users, duration = 900) {
  const session = await users.createSession({ userId: AGENT_USER_ID });
  const jwt = await users.createJWT({
    userId: AGENT_USER_ID,
    sessionId: session.$id,
    duration,
  });
  return { jwt: jwt.jwt, sessionId: session.$id };
}

const SCRIPT = [
  { name: 'read_catalog', args: { vendor: 'northwind' }, delayMs: 80 },
  { name: 'purchase', args: { vendor: 'northwind', item: 'USB-C dock, 8-port', amountCents: 4200 }, delayMs: 120 },
  { name: 'read_catalog', args: { vendor: 'brightline' }, delayMs: 80 },
  {
    name: 'purchase',
    args: { vendor: 'brightline', item: '40 × BL-DOCK-8', amountCents: 152_000 },
    delayMs: 160,
    note: 'injected overspend',
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    name: 'purchase',
    args: { vendor: 'cobalt', item: 'Headset, wired', amountCents: 3100 },
    delayMs: 380,
    note: `stream ${i + 1}`,
  })),
  { name: 'finish', args: { summary: 'Purchases complete.' }, delayMs: 60 },
];

async function readCatalog(tables, vendor) {
  const row = await tables.getRow({ databaseId: DB_ID, tableId: TABLES.vendors, rowId: vendor });
  return { vendor: row.$id, name: row.name, injected: row.injected, catalog: row.catalog };
}

async function purchaseWarrant(agentTables, { toolCallId, warrantId, vendor, item, amountCents, note }) {
  try {
    await agentTables.createRow({
      databaseId: DB_ID,
      tableId: TABLES.actions,
      rowId: toolCallId,
      data: {
        warrantId,
        lane: 'warrant',
        tool: 'purchase',
        vendor,
        item,
        amountCents,
        outcome: 'pending',
        note: note ?? null,
      },
      permissions: actionPermissions(),
    });
  } catch (err) {
    const e = describeError(err);
    if (e.code === 409) return { outcome: 'rejected', error: e };
    throw err;
  }
  try {
    await agentTables.decrementRowColumn({
      databaseId: DB_ID,
      tableId: TABLES.warrants,
      rowId: warrantId,
      column: 'budgetCents',
      value: amountCents,
      min: 0,
    });
    await agentTables.decrementRowColumn({
      databaseId: DB_ID,
      tableId: TABLES.warrants,
      rowId: warrantId,
      column: 'actionsLeft',
      value: 1,
      min: 0,
    });
  } catch (err) {
    const e = describeError(err);
    await agentTables
      .updateRow({
        databaseId: DB_ID,
        tableId: TABLES.actions,
        rowId: toolCallId,
        data: { outcome: 'rejected', error: `${e.code} ${e.type}` },
      })
      .catch(() => {});
    return { outcome: 'rejected', error: e };
  }
  await agentTables.updateRow({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    rowId: toolCallId,
    data: { outcome: 'committed' },
  });
  return { outcome: 'committed' };
}

async function purchaseCredential(agentTables, { toolCallId, warrantId, vendor, item, amountCents, note, keyValid }) {
  if (!keyValid) return { outcome: 'rejected', error: { type: 'key_revoked' } };
  await agentTables.createRow({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    rowId: toolCallId,
    data: {
      warrantId,
      lane: 'credential',
      tool: 'purchase',
      vendor,
      item,
      amountCents,
      outcome: 'committed',
      note: note ?? null,
    },
    permissions: actionPermissions(),
  });
  return { outcome: 'committed' };
}

async function runLane({ agentTables, serverTables, warrantId, lane, keyValid }) {
  for (let stepIndex = 0; stepIndex < SCRIPT.length; stepIndex++) {
    const step = SCRIPT[stepIndex];
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
    const toolCallId = `${lane[0]}${stepIndex + 1}_${warrantId}`;

    if (step.name === 'read_catalog') {
      const result = await readCatalog(serverTables, step.args.vendor);
      await agentTables
        .createRow({
          databaseId: DB_ID,
          tableId: TABLES.actions,
          rowId: toolCallId,
          data: {
            warrantId,
            lane,
            tool: 'read_catalog',
            vendor: step.args.vendor,
            amountCents: 0,
            outcome: 'committed',
            note: result.injected ? 'catalog carries injection' : null,
          },
          permissions: actionPermissions(),
        })
        .catch(() => {});
      continue;
    }

    if (step.name === 'purchase') {
      if (lane === 'warrant') {
        await purchaseWarrant(agentTables, {
          toolCallId,
          warrantId,
          vendor: step.args.vendor,
          item: step.args.item,
          amountCents: step.args.amountCents,
          note: step.note,
        });
      } else {
        await purchaseCredential(agentTables, {
          toolCallId,
          warrantId,
          vendor: step.args.vendor,
          item: step.args.item,
          amountCents: step.args.amountCents,
          note: step.note,
          keyValid,
        });
      }
      continue;
    }

    if (step.name === 'finish') {
      await agentTables.createRow({
        databaseId: DB_ID,
        tableId: TABLES.actions,
        rowId: toolCallId,
        data: {
          warrantId,
          lane,
          tool: 'finish',
          amountCents: 0,
          outcome: 'committed',
          note: step.args.summary,
        },
        permissions: actionPermissions(),
      });
    }
  }
}

async function startRace(tables, users, body) {
  const { warrantId } = await grant(tables, {
    budgetCents: body.budgetCents ?? 50_000,
    actionsLeft: body.actionsLeft ?? 40,
    label: body.label ?? `race ${new Date().toISOString()}`,
  });
  const { jwt } = await mintJwt(users);
  const revokeAfterSec = Number(body.revokeAfterSec ?? 2.2);

  // Fire lanes without blocking the HTTP response when async=true from client.
  // Here we run to completion so createExecution(async:false) still works for local tests.
  const warrantAgent = asAgent(jwt);
  const credentialAgent = asAgent(jwt);
  const row = await tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId: warrantId });
  const keyValid = row.status === 'active';

  const revokeTimer =
    revokeAfterSec > 0
      ? setTimeout(() => {
          revoke(tables, warrantId).catch(() => {});
        }, revokeAfterSec * 1000)
      : null;

  await Promise.all([
    runLane({ agentTables: warrantAgent, serverTables: tables, warrantId, lane: 'warrant', keyValid: true }),
    runLane({
      agentTables: credentialAgent,
      serverTables: tables,
      warrantId,
      lane: 'credential',
      keyValid,
    }),
  ]);

  if (revokeTimer) clearTimeout(revokeTimer);
  return { warrantId, mode: 'scripted' };
}

/** Fire-and-forget race: return warrantId immediately so Realtime UI can subscribe. */
async function startRaceAsync(tables, users, body, log) {
  const { warrantId } = await grant(tables, {
    budgetCents: body.budgetCents ?? 50_000,
    actionsLeft: body.actionsLeft ?? 40,
    label: body.label ?? `race ${new Date().toISOString()}`,
  });
  const { jwt } = await mintJwt(users);
  const revokeAfterSec = Number(body.revokeAfterSec ?? 2.2);

  // Continue after response when the platform supports it; otherwise still kick off.
  const work = (async () => {
    const warrantAgent = asAgent(jwt);
    const credentialAgent = asAgent(jwt);
    const row = await tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId: warrantId });
    const keyValid = row.status === 'active';
    const revokeTimer =
      revokeAfterSec > 0
        ? setTimeout(() => {
            revoke(tables, warrantId).catch(() => {});
          }, revokeAfterSec * 1000)
        : null;
    try {
      await Promise.all([
        runLane({ agentTables: warrantAgent, serverTables: tables, warrantId, lane: 'warrant', keyValid: true }),
        runLane({
          agentTables: credentialAgent,
          serverTables: tables,
          warrantId,
          lane: 'credential',
          keyValid,
        }),
      ]);
    } finally {
      if (revokeTimer) clearTimeout(revokeTimer);
    }
  })();

  work.catch((err) => log?.(err?.message ?? String(err)));
  return { warrantId, mode: 'scripted', async: true };
}

async function jar(tables, users) {
  const { warrantId } = await grant(tables, { budgetCents: 5_000, actionsLeft: 50, label: 'jar' });
  const { jwt } = await mintJwt(users);
  const agent = asAgent(jwt);
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) =>
      agent.decrementRowColumn({
        databaseId: DB_ID,
        tableId: TABLES.warrants,
        rowId: warrantId,
        column: 'budgetCents',
        value: 1_000,
        min: 0,
      }).then(async () => {
        await agent.createRow({
          databaseId: DB_ID,
          tableId: TABLES.actions,
          rowId: `j${i}_${warrantId}`.slice(0, 36),
          data: {
            warrantId,
            lane: 'warrant',
            tool: 'purchase',
            vendor: 'jar',
            item: '$10',
            amountCents: 1000,
            outcome: 'committed',
          },
          permissions: actionPermissions(),
        });
        return 'committed';
      }),
    ),
  );
  const committed = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.length - committed;
  const row = await tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId: warrantId });
  return { warrantId, committed, rejected, budgetCents: row.budgetCents };
}

function parseBody(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  const tryParse = (raw) => {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      const err = new Error('invalid JSON body');
      err.code = 400;
      throw err;
    }
  };
  const fromText = tryParse(req.bodyText);
  if (fromText) return fromText;
  const fromBody = tryParse(req.body);
  if (fromBody) return fromBody;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  return {};
}

export default async ({ req, res, log, error }) => {
  let body = {};
  try {
    body = parseBody(req);
  } catch {
    return res.json({ error: { message: 'invalid JSON' } }, 400);
  }

  const { tables, users } = clients();

  try {
    if (body.action === 'grant') return res.json(await grant(tables, body));
    if (body.action === 'revoke') {
      if (!body.warrantId) return res.json({ error: { message: 'warrantId required' } }, 400);
      return res.json(await revoke(tables, body.warrantId));
    }
    if (body.action === 'agentJwt') return res.json(await mintJwt(users, body.duration ?? 900));
    if (body.action === 'startRace') {
      // Grant + return warrantId, then run both lanes before the response ends
      // so Cloud does not kill background work. Client should use async:true
      // only for runRace; startRace stays synchronous but returns after kickoff
      // via wait:false path that still awaits lanes when wait:true.
      if (body.wait === true) return res.json(await startRace(tables, users, body));
      // Fast path: create warrant, schedule lanes by awaiting them here with a
      // short-circuit return is unsafe on Cloud — so we grant, return ids, and
      // expect a follow-up runRace (or wait:true for CLI).
      const g = await grant(tables, {
        budgetCents: body.budgetCents ?? 50_000,
        actionsLeft: body.actionsLeft ?? 40,
        label: body.label ?? `race ${new Date().toISOString()}`,
      });
      return res.json({
        ...g,
        mode: 'scripted',
        next: { action: 'runRace', warrantId: g.warrantId, revokeAfterSec: body.revokeAfterSec ?? 2.2 },
      });
    }
    if (body.action === 'runRace') {
      if (!body.warrantId) return res.json({ error: { message: 'warrantId required' } }, 400);
      const { jwt } = await mintJwt(users);
      const warrantAgent = asAgent(jwt);
      const credentialAgent = asAgent(jwt);
      const row = await tables.getRow({
        databaseId: DB_ID,
        tableId: TABLES.warrants,
        rowId: body.warrantId,
      });
      const keyValid = row.status === 'active';
      const revokeAfterSec = Number(body.revokeAfterSec ?? 2.2);
      const revokeTimer =
        revokeAfterSec > 0
          ? setTimeout(() => {
              revoke(tables, body.warrantId).catch(() => {});
            }, revokeAfterSec * 1000)
          : null;
      try {
        await Promise.all([
          runLane({
            agentTables: warrantAgent,
            serverTables: tables,
            warrantId: body.warrantId,
            lane: 'warrant',
            keyValid: true,
          }),
          runLane({
            agentTables: credentialAgent,
            serverTables: tables,
            warrantId: body.warrantId,
            lane: 'credential',
            keyValid,
          }),
        ]);
      } finally {
        if (revokeTimer) clearTimeout(revokeTimer);
      }
      return res.json({ warrantId: body.warrantId, done: true });
    }
    if (body.action === 'jar') return res.json(await jar(tables, users));
    return res.json({ error: { message: `unknown action: ${body.action}` } }, 400);
  } catch (err) {
    const e = describeError(err);
    error(e.message);
    return res.json({ error: e }, e.code && e.code >= 400 && e.code < 600 ? e.code : 500);
  }
};
