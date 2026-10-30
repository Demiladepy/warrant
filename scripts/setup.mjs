/**
 * Creates the Warrant database, its three tables and the seeded vendors.
 * Safe to run repeatedly: every step treats "already exists" as success.
 */
import { asServer, describeError } from '../src/appwrite.mjs';
import { DB_ID, TABLES, AGENT_USER_ID, GRANTOR_USER_ID } from '../src/config.mjs';
import { SCHEMA, VENDOR_SEED } from '../src/schema.mjs';

const { tables, users } = asServer();

const EXISTS = 409;
const ok = (label) => console.log(`  ok    ${label}`);
const skip = (label) => console.log(`  exists ${label}`);

async function idempotent(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (err) {
    if (err?.code === EXISTS) return skip(label);
    console.error(`  FAIL  ${label}`, describeError(err));
    throw err;
  }
}

async function createColumn(tableId, col) {
  const common = { databaseId: DB_ID, tableId, key: col.key, required: !!col.required, array: !!col.array };
  switch (col.type) {
    case 'string':
      return tables.createStringColumn({ ...common, size: col.size });
    case 'integer':
      return tables.createIntegerColumn({ ...common, min: col.min, max: col.max });
    case 'boolean':
      return tables.createBooleanColumn({ ...common, xdefault: col.required ? undefined : col.xdefault });
    case 'datetime':
      return tables.createDatetimeColumn({ ...common });
    default:
      throw new Error(`Unknown column type ${col.type}`);
  }
}

/** Appwrite builds columns asynchronously; rows can't be written until they land. */
async function waitForColumns(tableId, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await tables.listColumns({ databaseId: DB_ID, tableId });
    const cols = res.columns ?? res.attributes ?? [];
    const pending = cols.filter((c) => c.status !== 'available');
    const failed = cols.filter((c) => c.status === 'failed');
    if (failed.length) throw new Error(`Columns failed on ${tableId}: ${failed.map((c) => c.key).join(', ')}`);
    if (!pending.length) return cols.length;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Columns on ${tableId} did not become available in time`);
}

async function main() {
  console.log(`\nWarrant setup -> database "${DB_ID}"\n`);

  await idempotent(`database ${DB_ID}`, () =>
    tables.create({ databaseId: DB_ID, name: 'Warrant' }),
  );

  for (const table of SCHEMA) {
    console.log(`\ntable ${table.id} (rowSecurity: ${table.rowSecurity})`);
    await idempotent(`table ${table.id}`, () =>
      tables.createTable({
        databaseId: DB_ID,
        tableId: table.id,
        name: table.name,
        permissions: table.permissions,
        rowSecurity: table.rowSecurity,
      }),
    );
    // Re-assert on an existing table so a changed schema file always wins.
    await tables.updateTable({
      databaseId: DB_ID,
      tableId: table.id,
      name: table.name,
      permissions: table.permissions,
      rowSecurity: table.rowSecurity,
    });

    for (const col of table.columns) {
      await idempotent(`column ${table.id}.${col.key}`, () => createColumn(table.id, col));
    }
    const count = await waitForColumns(table.id);
    console.log(`  ok    ${count} columns available`);

    for (const index of table.indexes) {
      await idempotent(`index ${table.id}.${index.key}`, () =>
        tables.createIndex({ databaseId: DB_ID, tableId: table.id, ...index }),
      );
    }
  }

  console.log('\nusers');
  for (const [userId, name] of [[GRANTOR_USER_ID, 'Grantor'], [AGENT_USER_ID, 'Agent 02']]) {
    await idempotent(`user ${userId}`, () =>
      users.create({ userId, email: `${userId.replace(/_/g, '-')}@warrant.demo`, password: crypto.randomUUID(), name }),
    );
  }

  console.log('\nvendors');
  for (const vendor of VENDOR_SEED) {
    await tables.upsertRow({
      databaseId: DB_ID,
      tableId: TABLES.vendors,
      rowId: vendor.id,
      data: { name: vendor.name, catalog: vendor.catalog, injected: vendor.injected },
    });
    ok(`vendor ${vendor.id}${vendor.injected ? ' (carries the injection)' : ''}`);
  }

  console.log('\nSetup complete.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nSetup failed:', describeError(err));
  process.exit(1);
});
