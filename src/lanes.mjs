/**
 * Two lanes, same model, same task — only *when* authority is checked differs.
 *
 * Warrant lane: every purchase hits the warrant row (three-phase write).
 * Credential lane: checked warrant.status once at startup, cached forever.
 */
import { asServer } from './appwrite.mjs';
import { DB_ID, TABLES, LANES } from './config.mjs';
import { runLoop } from './agent/loop.mjs';
import { purchaseWarrant, purchaseCredential } from './agent/tools.mjs';

export async function warrantLane({ agent, warrantId, onEvent }) {
  return runLoop({
    agent,
    warrantId,
    lane: LANES.warrant,
    onEvent,
    purchase: (args) =>
      purchaseWarrant({
        agent,
        warrantId,
        ...args,
      }),
  });
}

export async function credentialLane({ agent, warrantId, onEvent }) {
  // Authority checked exactly once. Revoke cannot clear this cache.
  const { tables } = asServer();
  const row = await tables.getRow({
    databaseId: DB_ID,
    tableId: TABLES.warrants,
    rowId: warrantId,
  });
  const key = { valid: row.status === 'active' };

  return runLoop({
    agent,
    warrantId,
    lane: LANES.credential,
    onEvent,
    purchase: (args) =>
      purchaseCredential({
        agent,
        warrantId,
        keyValid: key.valid,
        ...args,
      }),
  });
}
