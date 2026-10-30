/**
 * Agent tools. purchase() in the warrant lane is the three-phase write from
 * handoff/01-SPEC.md — insert pending, decrement, mark committed/rejected.
 */
import { Permission, Role } from 'node-appwrite';
import { asServer, describeError } from '../appwrite.mjs';
import { DB_ID, TABLES, AGENT_USER_ID } from '../config.mjs';

/** Agent must be able to flip its own action row pending → committed/rejected. */
function actionPermissions() {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(AGENT_USER_ID)),
  ];
}

export async function readCatalog({ vendor }) {
  const { tables } = asServer();
  const row = await tables.getRow({
    databaseId: DB_ID,
    tableId: TABLES.vendors,
    rowId: vendor,
  });
  return {
    vendor: row.$id,
    name: row.name,
    injected: row.injected,
    catalog: row.catalog,
  };
}

/**
 * Warrant-lane purchase. After revoke, decrement throws and we mark rejected.
 * Also decrements actionsLeft with min: 0 — second limit, same mechanism.
 */
export async function purchaseWarrant({
  agent,
  toolCallId,
  warrantId,
  vendor,
  item,
  amountCents,
  note,
}) {
  const tables = agent.tables;

  try {
    await tables.createRow({
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
    if (e.code === 409) {
      return { outcome: 'rejected', error: e, reason: 'duplicate tool-call id' };
    }
    throw err;
  }

  try {
    await tables.decrementRowColumn({
      databaseId: DB_ID,
      tableId: TABLES.warrants,
      rowId: warrantId,
      column: 'budgetCents',
      value: amountCents,
      min: 0,
    });
    await tables.decrementRowColumn({
      databaseId: DB_ID,
      tableId: TABLES.warrants,
      rowId: warrantId,
      column: 'actionsLeft',
      value: 1,
      min: 0,
    });
  } catch (err) {
    const e = describeError(err);
    await tables.updateRow({
      databaseId: DB_ID,
      tableId: TABLES.actions,
      rowId: toolCallId,
      data: { outcome: 'rejected', error: `${e.code} ${e.type}` },
    }).catch(() => {});
    return { outcome: 'rejected', error: e };
  }

  await tables.updateRow({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    rowId: toolCallId,
    data: { outcome: 'committed' },
  });
  return { outcome: 'committed' };
}

/**
 * Credential-lane purchase. Authority was checked once at lane start and
 * cached. Never touches the warrant row — revoke cannot stop it.
 */
export async function purchaseCredential({
  agent,
  toolCallId,
  warrantId,
  vendor,
  item,
  amountCents,
  keyValid,
  note,
}) {
  if (!keyValid) {
    return { outcome: 'rejected', error: { code: null, type: 'key_revoked', message: 'key revoked' } };
  }

  try {
    await agent.tables.createRow({
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
  } catch (err) {
    const e = describeError(err);
    if (e.code === 409) {
      return { outcome: 'rejected', error: e, reason: 'duplicate tool-call id' };
    }
    throw err;
  }
  return { outcome: 'committed' };
}

export async function finish({ agent, toolCallId, warrantId, lane, summary }) {
  await agent.tables.createRow({
    databaseId: DB_ID,
    tableId: TABLES.actions,
    rowId: toolCallId,
    data: {
      warrantId,
      lane,
      tool: 'finish',
      amountCents: 0,
      outcome: 'committed',
      note: summary ?? null,
    },
    permissions: actionPermissions(),
  });
  return { outcome: 'committed', summary };
}
