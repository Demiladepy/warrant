import { Client, TablesDB, Realtime, Functions, Channel, Query, ExecutionMethod } from 'appwrite';

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
export const CONTROL_URL = import.meta.env.VITE_CONTROL_URL || 'http://127.0.0.1:8787';
export const CONTROL_FUNCTION_ID = import.meta.env.VITE_CONTROL_FUNCTION_ID || '';
export const DB_ID = 'warrant';
export const TABLES = { warrants: 'warrants', actions: 'actions', vendors: 'vendors' };

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
export const tables = new TablesDB(client);
export const realtime = new Realtime(client);
const functions = new Functions(client);

export { Query, Channel };

export async function control(action, body = {}, { background = false } = {}) {
  const payload = { action, ...body };

  // Prefer Appwrite Function when configured (Sites / public demo).
  if (CONTROL_FUNCTION_ID) {
    const execution = await functions.createExecution({
      functionId: CONTROL_FUNCTION_ID,
      body: JSON.stringify(payload),
      method: ExecutionMethod.POST,
      headers: { 'Content-Type': 'application/json' },
      async: background,
    });
    if (background) return { queued: true, executionId: execution.$id };
    const raw = execution.responseBody || '{}';
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(raw.slice(0, 200) || 'Function returned non-JSON');
    }
    const code = execution.statusCode ?? execution.responseStatusCode ?? 200;
    if (code >= 400 || data?.error) {
      throw new Error(data?.error?.message || data?.error || `Function ${code}`);
    }
    return data;
  }

  const res = await fetch(CONTROL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.error || res.statusText);
  return data;
}

export async function getWarrant(warrantId) {
  return tables.getRow({ databaseId: DB_ID, tableId: TABLES.warrants, rowId: warrantId });
}

export async function listActions(warrantId) {
  return tables.listRows({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    queries: [Query.equal('warrantId', warrantId), Query.orderAsc('$createdAt'), Query.limit(200)],
  });
}

export async function proofAfterRevoke(warrantId, revokedAt) {
  return tables.listRows({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    queries: [
      Query.equal('warrantId', warrantId),
      Query.equal('outcome', 'committed'),
      Query.equal('lane', 'warrant'),
      Query.greaterThan('$createdAt', revokedAt),
    ],
  });
}

/** Subscribe to actions + warrants rows for a live race. */
export async function subscribeRace(onEvent) {
  const channels = [
    Channel.tablesdb(DB_ID).table(TABLES.actions).row(),
    Channel.tablesdb(DB_ID).table(TABLES.warrants).row(),
  ];
  return realtime.subscribe(channels, onEvent);
}
