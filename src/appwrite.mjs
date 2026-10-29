import { Client, TablesDB, Users } from 'node-appwrite';
import { ENDPOINT, PROJECT_ID, API_KEY } from './config.mjs';

function base() {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
}

/** Admin client. Bypasses row permissions — only the grant/revoke Function uses it. */
export function asServer() {
  const client = base().setKey(API_KEY);
  return { client, tables: new TablesDB(client), users: new Users(client) };
}

/** The agent. Every write it makes is checked against the warrant row's $permissions. */
export function asAgent(jwt) {
  const client = base().setJWT(jwt);
  return { client, tables: new TablesDB(client) };
}

/** Appwrite errors carry .code (HTTP) and .type (machine-readable string). */
export function describeError(err) {
  return {
    code: err?.code ?? null,
    type: err?.type ?? null,
    message: err?.message ?? String(err),
  };
}
