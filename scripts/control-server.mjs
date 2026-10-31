/**
 * Local warrant-control HTTP server.
 * Actions: grant | revoke | agentJwt | startRace | runRace | jar | status
 *
 *   npm run control
 */
import http from 'node:http';
import { asAgent, describeError } from '../src/appwrite.mjs';
import { grant, revoke, mintAgentJwt } from '../src/control.mjs';
import { warrantLane, credentialLane } from '../src/lanes.mjs';

const PORT = Number(process.env.CONTROL_PORT || 8787);

/** In-flight races keyed by warrantId — dashboard can revoke while they run. */
const races = new Map();

async function handle(body) {
  const action = body?.action;

  if (action === 'grant') {
    return grant({
      budgetCents: body.budgetCents ?? 50_000,
      actionsLeft: body.actionsLeft ?? 40,
      label: body.label ?? 'demo',
    });
  }

  if (action === 'revoke') {
    if (!body.warrantId) throw Object.assign(new Error('warrantId required'), { code: 400 });
    return revoke(body.warrantId);
  }

  if (action === 'agentJwt') {
    return mintAgentJwt({ duration: body.duration ?? 900 });
  }

  if (action === 'startRace') {
    process.env.SCRIPTED = '1';
    const revokeAfterSec = Number(body.revokeAfterSec ?? 2.2);
    const { warrantId } = await grant({
      budgetCents: body.budgetCents ?? 50_000,
      actionsLeft: body.actionsLeft ?? 40,
      label: body.label ?? `race ${new Date().toISOString()}`,
    });
    // Auto-kick lanes locally so one-button demo still works without a second call.
    setImmediate(() => {
      handle({ action: 'runRace', warrantId, revokeAfterSec }).catch((err) =>
        console.error('race failed', describeError(err)),
      );
    });
    return {
      warrantId,
      mode: 'scripted',
      next: { action: 'runRace', warrantId, revokeAfterSec },
    };
  }

  if (action === 'runRace') {
    process.env.SCRIPTED = '1';
    const warrantId = body.warrantId;
    if (!warrantId) throw Object.assign(new Error('warrantId required'), { code: 400 });
    const revokeAfterSec = Number(body.revokeAfterSec ?? 2.2);
    const { jwt } = await mintAgentJwt();
    races.set(warrantId, { startedAt: Date.now() });
    const warrantAgent = asAgent(jwt);
    const credentialAgent = asAgent(jwt);
    let revokeTimer;
    if (revokeAfterSec > 0) {
      revokeTimer = setTimeout(() => {
        revoke(warrantId).catch((err) => console.error('auto-revoke', describeError(err)));
      }, revokeAfterSec * 1000);
    }
    try {
      await Promise.all([
        warrantLane({ agent: warrantAgent, warrantId }),
        credentialLane({ agent: credentialAgent, warrantId }),
      ]);
    } finally {
      if (revokeTimer) clearTimeout(revokeTimer);
      races.delete(warrantId);
    }
    return { warrantId, done: true };
  }

  if (action === 'jar') {
    process.env.SCRIPTED = '1';
    const { warrantId } = await grant({ budgetCents: 5_000, actionsLeft: 50, label: 'jar' });
    const { jwt } = await mintAgentJwt();
    const agent = asAgent(jwt);
    const { DB_ID, TABLES } = await import('../src/config.mjs');
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        agent.tables.decrementRowColumn({
          databaseId: DB_ID,
          tableId: TABLES.warrants,
          rowId: warrantId,
          column: 'budgetCents',
          value: 1_000,
          min: 0,
        }),
      ),
    );
    const committed = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.length - committed;
    const { asServer } = await import('../src/appwrite.mjs');
    const row = await asServer().tables.getRow({
      databaseId: DB_ID,
      tableId: TABLES.warrants,
      rowId: warrantId,
    });
    return { warrantId, committed, rejected, budgetCents: row.budgetCents };
  }

  if (action === 'status') {
    return { races: [...races.keys()] };
  }

  throw Object.assign(new Error(`unknown action: ${action}`), { code: 400 });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON' }));
    return;
  }

  try {
    const result = await handle(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const e = describeError(err);
    const code = typeof e.code === 'number' && e.code >= 400 && e.code < 600 ? e.code : 500;
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`warrant-control on http://127.0.0.1:${PORT}`);
  console.log('actions: grant | revoke | agentJwt | startRace | runRace | jar | status');
});
