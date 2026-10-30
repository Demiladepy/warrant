/**
 * Appwrite Function wrapper (Node 22). Deploy when ready; local demo uses
 * scripts/control-server.mjs instead. Body: { action, warrantId?, ... }.
 *
 * Env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 */
import { Client, TablesDB, Users, ID, Permission, Role } from 'node-appwrite';

const DB_ID = 'warrant';
const TABLES = { warrants: 'warrants' };
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

function client() {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}

export default async ({ req, res, log, error }) => {
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  } catch (e) {
    return res.json({ error: 'invalid JSON' }, 400);
  }

  const c = client();
  const tables = new TablesDB(c);
  const users = new Users(c);

  try {
    if (body.action === 'grant') {
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
      return res.json({ warrantId });
    }

    if (body.action === 'revoke') {
      const before = await tables.getRow({
        databaseId: DB_ID,
        tableId: TABLES.warrants,
        rowId: body.warrantId,
      });
      const after = revokedPermissions({ grantorId: GRANTOR_USER_ID });
      const removed = before.$permissions.filter((p) => !after.includes(p));
      const revokedAt = new Date().toISOString();
      await tables.updateRow({
        databaseId: DB_ID,
        tableId: TABLES.warrants,
        rowId: body.warrantId,
        data: { status: 'revoked', revokedAt },
        permissions: after,
      });
      return res.json({ removed, revokedAt });
    }

    if (body.action === 'agentJwt') {
      const session = await users.createSession({ userId: AGENT_USER_ID });
      const jwt = await users.createJWT({
        userId: AGENT_USER_ID,
        sessionId: session.$id,
        duration: body.duration ?? 900,
      });
      return res.json({ jwt: jwt.jwt, sessionId: session.$id });
    }

    return res.json({ error: `unknown action: ${body.action}` }, 400);
  } catch (err) {
    error(err?.message ?? String(err));
    return res.json(
      { error: { code: err?.code ?? 500, type: err?.type ?? null, message: err?.message } },
      err?.code && err.code >= 400 ? err.code : 500,
    );
  }
};
