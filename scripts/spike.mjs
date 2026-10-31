/**
 * Thursday spike. Five claims, measured, no hand-waving.
 *
 *   A  the agent can spend while the warrant is live
 *   B  revoke rejects the agent's very next write, same JWT, no restart
 *   C  decrementRowColumn(min: 0) holds the floor under 20 parallel spends
 *   D  the naive read-then-write lane overspends - by how much, measured
 *   E  rowId = tool-call id, so a retried call collides instead of charging twice
 *
 * Done when B passes. If it does not, Plan B (team role) goes in tonight.
 */
import { ID, Query } from 'node-appwrite';
import { asServer, asAgent, describeError } from '../src/appwrite.mjs';
import { DB_ID, TABLES, AGENT_USER_ID, GRANTOR_USER_ID } from '../src/config.mjs';
import { livePermissions, revokedPermissions } from '../src/schema.mjs';

const server = asServer();
const findings = [];

function record(claim, passed, detail) {
  findings.push({ claim, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${claim}`);
  if (detail) console.log(`      ${detail}`);
}

async function mintAgentJwt() {
  const session = await server.users.createSession({ userId: AGENT_USER_ID });
  const jwt = await server.users.createJWT({ userId: AGENT_USER_ID, sessionId: session.$id, duration: 900 });
  return { jwt: jwt.jwt, sessionId: session.$id };
}

async function grant({ budgetCents, actionsLeft = 50, label = 'spike' }) {
  const rowId = ID.unique();
  await server.tables.createRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId,
    data: {
      label,
      budgetCents,
      budgetStartCents: budgetCents,
      actionsLeft,
      actionsStart: actionsLeft,
      vendors: ['northwind', 'brightline', 'cobalt'],
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      status: 'active',
      grantorId: GRANTOR_USER_ID,
      agentUserId: AGENT_USER_ID,
    },
    permissions: livePermissions({ grantorId: GRANTOR_USER_ID }),
  });
  return rowId;
}

/** The revoke. One permission string leaves the row. Nothing else changes. */
async function revoke(rowId) {
  const before = await server.tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId });
  const after = revokedPermissions({ grantorId: GRANTOR_USER_ID });
  const removed = before.$permissions.filter((p) => !after.includes(p));
  await server.tables.updateRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId,
    data: { status: 'revoked', revokedAt: new Date().toISOString() },
    permissions: after,
  });
  return removed;
}

const spend = (agent, rowId, cents) =>
  agent.tables.decrementRowColumn({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId,
    column: 'budgetCents',
    value: cents,
    min: 0,
  });

// ---------------------------------------------------------------- A and B

async function claimsAandB(agent) {
  const rowId = await grant({ budgetCents: 20_000, label: 'spike A/B' });

  const first = await spend(agent, rowId, 1_000);
  record('A  agent spends while live', first.budgetCents === 19_000, `budgetCents ${first.budgetCents}`);

  const removed = await revoke(rowId);
  const revokedAt = Date.now();

  let blocked = null;
  try {
    await spend(agent, rowId, 1_000);
  } catch (err) {
    blocked = describeError(err);
  }
  const elapsed = Date.now() - revokedAt;

  record(
    'B  revoke rejects the next write, same JWT',
    blocked !== null,
    blocked
      ? `removed ${removed.join(', ')} -> ${blocked.code} ${blocked.type} after ${elapsed}ms`
      : 'the write went through - switch to Plan B (team role) tonight',
  );

  const final = await server.tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId });
  record('B2 nothing moved after revoke', final.budgetCents === 19_000, `budgetCents ${final.budgetCents}`);
  return { rowId, blocked, removed };
}

// -------------------------------------------------------------------- C

async function claimC(agent) {
  const rowId = await grant({ budgetCents: 5_000, label: 'the jar' });
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => spend(agent, rowId, 1_000)),
  );
  const committed = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.filter((r) => r.status === 'rejected');
  const row = await server.tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId });
  const errs = [...new Set(rejected.map((r) => `${r.reason?.code} ${r.reason?.type}`))];

  record(
    'C  min:0 holds under 20 parallel $10 spends on a $50 warrant',
    committed === 5 && row.budgetCents === 0,
    `${committed} committed, ${rejected.length} rejected, final budgetCents ${row.budgetCents}; errors: ${errs.join(' | ') || 'none'}`,
  );
  return { committed, rejected: rejected.length, errors: errs };
}

// -------------------------------------------------------------------- D

async function claimD(agent) {
  const rowId = await grant({ budgetCents: 5_000, label: 'naive read-then-write' });
  const naive = async () => {
    const row = await agent.tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId });
    if (row.budgetCents < 1_000) throw new Error('insufficient');
    return agent.tables.updateRow({
      databaseId: DB_ID,
      tableId: TABLES.warrants,
      rowId,
      data: { budgetCents: row.budgetCents - 1_000 },
    });
  };
  const results = await Promise.allSettled(Array.from({ length: 20 }, naive));
  const charged = results.filter((r) => r.status === 'fulfilled').length;
  const row = await server.tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId });
  const overspendCents = charged * 1_000 - 5_000;

  record(
    'D  naive read-then-write overspends (measured, for the jar card)',
    true,
    `${charged} of 20 charged on a $50 warrant -> $${(charged * 10).toFixed(2)} spent, ` +
      `overspend $${(overspendCents / 100).toFixed(2)}; row still reads budgetCents ${row.budgetCents}`,
  );
  return { charged, overspendCents, residual: row.budgetCents };
}

// -------------------------------------------------------------------- E

async function claimE(agent) {
  const warrantId = await grant({ budgetCents: 10_000, label: 'idempotency' });
  const toolCallId = `call_${Date.now()}`;
  const write = () =>
    agent.tables.createRow({
      databaseId: DB_ID,
      tableId: TABLES.actions,
      rowId: toolCallId,
      data: {
        warrantId,
        lane: 'warrant',
        tool: 'purchase',
        vendor: 'northwind',
        item: 'USB-C dock, 8-port',
        amountCents: 4_200,
        outcome: 'pending',
      },
    });

  await write();
  let dup = null;
  try {
    await write();
  } catch (err) {
    dup = describeError(err);
  }
  record(
    'E  rowId = tool-call id, so a retry collides',
    dup !== null,
    dup ? `${dup.code} ${dup.type}` : 'the retry inserted a second row - idempotency is not free',
  );

  const after = await server.tables.listRows({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    queries: [Query.equal('warrantId', warrantId)],
  });
  record('E2 exactly one row for one tool-call id', after.total === 1, `total ${after.total}`);
  return dup;
}

async function main() {
  console.log('\nWarrant spike - five claims\n');
  const { jwt } = await mintAgentJwt();
  const agent = asAgent(jwt);
  console.log(`agent JWT minted for ${AGENT_USER_ID}, never re-minted below\n`);

  const ab = await claimsAandB(agent);
  const c = await claimC(agent);
  const d = await claimD(agent);
  const e = await claimE(agent);

  const passed = findings.filter((f) => f.passed).length;
  console.log(`\n${passed}/${findings.length} claims passed\n`);

  console.log('Error codes to quote in the README and the X-ray panel:');
  console.log(`  revoked write      ${ab.blocked ? `${ab.blocked.code} ${ab.blocked.type}` : 'n/a'}`);
  console.log(`  budget floor       ${c.errors.join(' | ') || 'n/a'}`);
  console.log(`  duplicate tool id  ${e ? `${e.code} ${e.type}` : 'n/a'}`);
  console.log(`  naive overspend    $${(d.overspendCents / 100).toFixed(2)} on a $50 warrant\n`);

  if (!findings.find((f) => f.claim.startsWith('B  '))?.passed) {
    console.log('Claim B failed. Switch to Plan B: agent joins team warrant-<id>, row grants');
    console.log('update(team:...), revoke deletes the membership.\n');
    process.exit(2);
  }

  const failed = findings.some((f) => !f.passed);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSpike crashed:', describeError(err));
  process.exit(1);
});

