# 02 — Verified Appwrite API surface

**This project uses `node-appwrite@31.1.0` and Appwrite's TablesDB API.** Models
reliably hallucinate the older `databases.createDocument(...)` / positional-argument
style here. Everything below was read out of
`node_modules/node-appwrite/dist/services/*.d.ts` in this repo. Trust it over
your memory and over blog posts.

## The two rules

1. **It is `TablesDB`, not `Databases`.** Tables, rows and columns — not
   collections, documents and attributes.
2. **Every method takes a single object.** Positional overloads exist but are
   deprecated; use the object form throughout.

```js
import { Client, TablesDB, Users, ID, Query, Permission, Role, TablesDBIndexType } from 'node-appwrite';
```

## Verifying anything not listed here

Do not guess. Read the types:

```bash
# all methods on a service
grep -oE "^\s{4}[a-zA-Z]+(<[^>]*>)?\(params" node_modules/node-appwrite/dist/services/tables-db.d.ts | sort -u

# one method's exact parameter object
grep -n -A 12 "createIndex(params" node_modules/node-appwrite/dist/services/tables-db.d.ts
```

Row methods are generic (`createRow<Row extends ...>(params: {...})`), so a grep
for `    createRow(` finds nothing — search for `createRow<` instead.

## Client

```js
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)   // e.g. https://nyc.cloud.appwrite.io/v1
  .setProject(process.env.APPWRITE_PROJECT_ID);

client.setKey(apiKey);   // server: bypasses row permissions. Grant/revoke only.
client.setJWT(jwt);      // the agent: every write is checked against row $permissions.
```

Available setters: `setEndpoint setProject setKey setJWT setSession setBearer
setCookie setLocale setSelfSigned setOrganization setForwardedUserAgent
setImpersonateUserId setImpersonateUserEmail setImpersonateUserPhone`.

## TablesDB — the methods this project uses

```ts
create(params: { databaseId, name, enabled?, description?, specification?, replicas?, syncMode? })

createTable(params: {
  databaseId, tableId, name,
  permissions?: string[] | null,
  rowSecurity?: boolean,
  enabled?, columns?, indexes?, description?
})

updateTable(params: { databaseId, tableId, name?, permissions?, rowSecurity?, enabled?, purge?, description? })

createStringColumn(params:   { databaseId, tableId, key, size, required, xdefault?, array?, encrypt?, description? })
createIntegerColumn(params:  { databaseId, tableId, key, required, min?, max?, xdefault?, array?, description? })
createBooleanColumn(params:  { databaseId, tableId, key, required, xdefault?, array?, description? })
createDatetimeColumn(params: { databaseId, tableId, key, required, xdefault?, array?, description? })

createIndex(params: { databaseId, tableId, key, type: TablesDBIndexType, columns: string[], orders?, lengths?, description? })

createRow<Row>(params: { databaseId, tableId, rowId, data, permissions?, transactionId? })
upsertRow<Row>(params: { databaseId, tableId, rowId, data?, permissions?, transactionId? })
updateRow<Row>(params: { databaseId, tableId, rowId, data?, permissions?, transactionId? })
getRow<Row>(params:    { databaseId, tableId, rowId, queries?, transactionId? })
deleteRow(params:      { databaseId, tableId, rowId, transactionId? })
listRows<Row>(params:  { databaseId, tableId, queries?, transactionId?, total?, ttl? })

decrementRowColumn<Row>(params: { databaseId, tableId, rowId, column, value?, min?, transactionId? })
incrementRowColumn<Row>(params: { databaseId, tableId, rowId, column, value?, max?, transactionId? })
```

Also present and **deliberately unused**: `createTransaction`, `createOperations`,
`updateTransaction`, `deleteTransaction`. See `01-SPEC.md` — Warrant never uses a
transaction as a lock (issue #14489).

`TablesDBIndexType` values: `Key`, `Fulltext`, `Unique`, `Spatial`, `Trigram`.

### The call that carries the project

```js
await tablesDB.decrementRowColumn({
  databaseId: 'warrant',
  tableId: 'warrants',
  rowId: warrantId,
  column: 'budgetCents',
  value: amountCents,
  min: 0,                 // the database holds the floor, not the agent
});
```

## Permissions and roles

```js
Permission.read(role)  Permission.write(role)  Permission.create(role)
Permission.update(role)  Permission.delete(role)

Role.any()  Role.user(id, status?)  Role.users(status?)  Role.guests()
Role.team(id, role?)  Role.member(id)  Role.label(name)
```

Rendered strings (confirmed by running it):

```
read("any")
update("user:agent_02")
update("team:warrant-0042")
```

Permissions are a **whole array, replaced on write** — `updateRow({ permissions })`
sets the complete list. To revoke, compute the new array and send it; there is no
"remove one permission" call.

## Users (server key only)

```ts
users.create(params: { userId, email?, phone?, password?, name? })
users.createSession(params: { userId })
users.createJWT(params: { userId, sessionId?, duration? })   // duration in seconds
users.delete(params: { userId })
users.listSessions(params: { userId })
users.deleteSessions(params: { userId })
```

**`createJWT` needs a session.** Create the session first and pass its `$id`.
From the SDK docs: *"The JWT secret will become invalid if the session it uses
gets deleted."* That is the behaviour Warrant is built on — and it is exactly
what issues #14039 / #14021 fixed for human sessions.

## Queries

```js
Query.equal('outcome', 'committed')
Query.greaterThan('$createdAt', revokedAtIso)
Query.orderDesc('$createdAt')
Query.limit(100)
```

Confirm the full set the same way: `grep -oE "static [a-zA-Z]+" node_modules/node-appwrite/dist/query.d.ts`.

## Error shape

Appwrite SDK errors carry `.code` (HTTP status) and `.type` (a stable
machine-readable string). `src/appwrite.mjs` already exposes `describeError(err)`
returning `{ code, type, message }`.

Expected types — **replace these with what the spike actually prints**:

| Situation | Expect roughly |
| --- | --- |
| Write after revoke | `401` with a `user_unauthorized`-style type |
| Decrement below `min` | a `4xx` constraint/validation type |
| Duplicate `rowId` | `409 row_already_exists` |
| Table/row missing | `404 row_not_found` / `table_not_found` |

`scripts/spike.mjs` prints all of these under *"Error codes to quote in the
README and the X-ray panel"*. **Paste the real output into the README and into
the X-ray panel.** Do not ship the guesses above.

## Columns are built asynchronously

After `createStringColumn` etc. a column is `processing` before it is
`available`, and rows cannot be written until then. `scripts/setup.mjs` already
polls `listColumns` and waits. If you add a column, reuse `waitForColumns()` —
do not `sleep`.

## Frontend SDK — NOT yet verified

The browser uses the **`appwrite`** package, not `node-appwrite`. Its TablesDB
and Realtime surface is close but **not identical**, and it has no `setKey`.
Before writing frontend data code:

```bash
cd web && npm i appwrite
grep -oE "^\s{4}[a-zA-Z]+(<[^>]*>)?\(params" node_modules/appwrite/dist/services/tables-db.d.ts | sort -u
grep -n -A 10 "subscribe" node_modules/appwrite/dist/client.d.ts
```

Realtime channels to expect (confirm against the types/docs before relying on them):

```
databases.warrant.tables.warrants.rows
databases.warrant.tables.actions.rows
databases.warrant.tables.warrants.rows.<rowId>
```

A guest with `read("any")` on the row receives these events — which is why the
dashboard needs no login. **Verify this with a two-tab test early** (step 4 in
`03-BUILD-ORDER.md`); if guest Realtime does not deliver, create an anonymous
session in the dashboard and add that user to the row's read permissions.
