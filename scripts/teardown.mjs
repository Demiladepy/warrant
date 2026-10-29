/**
 * Drops the Warrant database. Users and vendors are cheap to rebuild with
 * `npm run setup`. Requires --yes so it can't fire by accident mid-demo.
 */
import { asServer, describeError } from '../src/appwrite.mjs';
import { DB_ID } from '../src/config.mjs';

if (!process.argv.includes('--yes')) {
  console.error(`Refusing to drop database "${DB_ID}" without --yes`);
  process.exit(1);
}

const { tables } = asServer();

try {
  await tables.delete({ databaseId: DB_ID });
  console.log(`Dropped database "${DB_ID}".`);
} catch (err) {
  const e = describeError(err);
  if (e.code === 404) console.log(`Database "${DB_ID}" was already gone.`);
  else {
    console.error('Teardown failed:', e);
    process.exit(1);
  }
}
