/**
 * Grant / revoke / mint — server-key only. Shared by race.mjs and the
 * warrant-control Function so permission strings never get reinvented.
 */
import { ID } from 'node-appwrite';
import { asServer } from './appwrite.mjs';
import { DB_ID, TABLES, AGENT_USER_ID, GRANTOR_USER_ID } from './config.mjs';
import { livePermissions, revokedPermissions } from './schema.mjs';

export async function mintAgentJwt({ duration = 900 } = {}) {
  const { users } = asServer();
  const session = await users.createSession({ userId: AGENT_USER_ID });
  const jwt = await users.createJWT({
    userId: AGENT_USER_ID,
    sessionId: session.$id,
    duration,
  });
  return { jwt: jwt.jwt, sessionId: session.$id };
}

export async function grant({
  budgetCents = 50_000,
  actionsLeft = 40,
  label = 'race',
  vendors = ['northwind', 'brightline', 'cobalt'],
  expiresInMs = 60 * 60_000,
} = {}) {
  const { tables } = asServer();
  const warrantId = ID.unique();
  await tables.createRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId: warrantId,
    data: {
      label,
      budgetCents,
      budgetStartCents: budgetCents,
      actionsLeft,
      actionsStart: actionsLeft,
      vendors,
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      status: 'active',
      grantorId: GRANTOR_USER_ID,
      agentUserId: AGENT_USER_ID,
    },
    permissions: livePermissions({ grantorId: GRANTOR_USER_ID }),
  });
  return { warrantId };
}

export async function revoke(warrantId) {
  const { tables } = asServer();
  const before = await tables.getRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId: warrantId,
  });
  const after = revokedPermissions({ grantorId: GRANTOR_USER_ID });
  const removed = before.$permissions.filter((p) => !after.includes(p));
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
