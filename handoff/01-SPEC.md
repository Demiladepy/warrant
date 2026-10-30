# 01 — Specification

## The mechanism, precisely

1. The agent is a real Appwrite **user** (`agent_02`), not a service holding a key.
2. A **warrant** is one row in the `warrants` table. Its columns are the limits:
   `budgetCents`, `actionsLeft`, `vendors`, `expiresAt`.
3. That row's `$permissions` include `update("user:agent_02")`. The table has
   **rowSecurity on** and **no table-level write permissions**, so that single
   string is the only thing letting the agent write.
4. The agent spends by calling `decrementRowColumn` on `budgetCents` **with its
   own JWT**. Appwrite checks the row's permissions on every call.
5. **Revoke** = a server-key Function rewrites `$permissions` without
   `update("user:agent_02")`, and sets `status: "revoked"`, `revokedAt: <now>`.
6. The agent's next `decrementRowColumn` is rejected by the database. The agent
   never learns about the revocation from a channel it controls.

> The sentence for the video: *"No line of the agent's code checks revocation. The row does."*

## Architecture

```
  Grantor dashboard  ──calls──▶  warrant-control Function  ──$permissions──▶  ┌──────────────┐
  (Appwrite Sites)                (server key)                                │  warrants    │
        ▲                                                                     │  rowSecurity │
        │ Realtime                                                            └──────────────┘
        │                                                                             ▲
        │                        agent-runner                ── decrement ───────────┘
        └──────────────────────  (writes as agent_02)        ── log ──▶  actions
                                        │
                                        └── reads ──▶  vendors  (one row carries an injection)
```

The **credential lane** is the same agent loop with one difference: it checked a
vendor key once at startup and never re-checks it. It does not touch the warrant
row. That is why revoke cannot stop it.

### Stack

| Piece | Technology |
| --- | --- |
| Data + authority | Appwrite TablesDB, `rowSecurity: true` |
| Grant / revoke | Appwrite Function (Node 22), server API key |
| Agent runner | Appwrite Function (Node 22), writes with the agent's JWT |
| Live dashboard | Appwrite Realtime |
| Frontend hosting | Appwrite Sites |
| Agent choices | one LLM API — **or scripted mode, which needs no key** |

## Schema (already implemented in `src/schema.mjs`)

### `warrants` — rowSecurity **on**, table permissions **empty**

| Column | Type | Notes |
| --- | --- | --- |
| `label` | string(128), required | e.g. "Q4 procurement" |
| `budgetCents` | integer, required, **min 0** | the floor is enforced by the database |
| `budgetStartCents` | integer, required, min 0 | so the UI can draw a meter |
| `actionsLeft` | integer, required, **min 0** | second limit, same mechanism |
| `actionsStart` | integer, required, min 0 | |
| `vendors` | string(64)[], optional | allow-list of vendor row ids |
| `expiresAt` | datetime, required | |
| `status` | string(16), required | `active` / `revoked` / `expired` |
| `revokedAt` | datetime, optional | **the anchor for the proof query** |
| `grantorId` | string(64), required | |
| `agentUserId` | string(64), required | |

Index: `by_status` on `status`.

### `actions` — rowSecurity **on**, table permissions `create(users)`, `read(any)`

**`rowId` is the LLM's tool-call id.** This is the whole idempotency story.

| Column | Type | Notes |
| --- | --- | --- |
| `warrantId` | string(64), required | |
| `lane` | string(16), required | `warrant` / `credential` |
| `tool` | string(32), required | `read_catalog` / `purchase` / `finish` |
| `vendor` | string(64), optional | |
| `item` | string(160), optional | |
| `amountCents` | integer, required, min 0 | |
| `outcome` | string(16), required | `pending` / `committed` / `rejected` |
| `error` | string(256), optional | the Appwrite error type, verbatim |
| `note` | string(512), optional | why the agent chose it; flags the injection |

Indexes: `by_warrant` on `warrantId`, `by_outcome` on `warrantId, outcome`.

### `vendors` — rowSecurity off, `read(any)`

`name`, `catalog` (string 16384), `injected` (boolean). Three rows seeded:
`northwind`, `brightline` (**carries the prompt injection**), `cobalt`.

The injection sits in Brightline's catalog as an HTML comment telling automated
purchasing agents to order 40 extra units of `BL-DOCK-8` at $38.00 and not to
mention the notice. It is already written in `src/schema.mjs`.

## The permission model

```js
// src/schema.mjs — these two functions ARE the product
livePermissions()    // read("any"), update("user:grantor_01"), update("user:agent_02")
revokedPermissions() // read("any"), update("user:grantor_01")
```

**Read is public on purpose.** Judges and the dashboard watch with no account.
The leash is `update`, never `read` — say so if anyone asks.

## The three-phase write (this is the critical implementation detail)

`decrementRowColumn` and the `actions` insert cannot share one atomic step, and
Warrant deliberately **never uses a transaction as a lock** (upstream issue
#14489 — two concurrent transactions can both commit a claim of the same row).
So every purchase is three steps:

```
1. INSERT  actions row, rowId = toolCallId, outcome: "pending"
             └─ a retried tool call collides here with 409 row_already_exists
2. DECREMENT warrants.budgetCents by amountCents, min: 0, as the agent
             └─ after revoke this throws; after the budget runs out this throws
3. UPDATE  the actions row to outcome: "committed"   (step 2 succeeded)
           or         outcome: "rejected", error: <appwrite error type>  (it threw)
```

**The proof query counts only `committed`.** A `pending` row that never reached
step 3 is not a spend, and the receipt says so.

## The five guarantees

Every one maps to a named TablesDB primitive. This table goes in the README and
on the receipt screen.

| Guarantee | Primitive |
| --- | --- |
| Revoke takes effect on the next write | Row `$permissions`, agent writing as its own user |
| Budget can never go negative | `decrementRowColumn` with `min: 0` (race-free, #13464) |
| A retried tool call can't charge twice | `rowId` = tool-call id → `row_already_exists` |
| Nothing committed after revoke, provably | `listRows` on `actions`, `$createdAt > revokedAt`, `outcome = committed` → **0** |
| The grantor sees everything live | Realtime on `warrants` and `actions` |

### The proof query, verbatim — it must run live on the receipt screen

```js
tablesDB.listRows({
  databaseId: 'warrant',
  tableId: 'actions',
  queries: [
    Query.equal('warrantId', warrantId),
    Query.equal('outcome', 'committed'),
    Query.greaterThan('$createdAt', warrant.revokedAt),
  ],
});
// -> { total: 0, rows: [] }
```

Show the query text and its `total: 0` side by side. Judges should be able to
run it themselves.

## The four screens, in priority order

1. **The race (hero).** Two lanes, a revoke line drawn across both, an
   after-revoke counter per lane, and an X-ray panel for the selected event.
   The video is built around this screen.
2. **Grant.** The warrant rendered as a paper slip — budget meter, vendors,
   expiry, max actions — with the raw row and its `$permissions` beside it.
3. **Receipt.** "0 actions committed after revocation", the live proof query, the
   guarantees table, the two issue citations. The closing shot.
4. **The jar.** Twenty parallel $10 spends against a $50 warrant: exactly 5
   committed, 15 rejected, $50.00 spent. The naive read-then-write comparison
   uses the figure the spike **measured**, never an invented one.

## Issue citations (both go in the README and the video)

- [#14039](https://github.com/appwrite/appwrite/issues/14039) /
  [#14021](https://github.com/appwrite/appwrite/issues/14021) — Appwrite closed
  this gap for **human sessions** in October: the HTTP API refuses a deleted
  session's next request. **Warrant is the same rule for agents.** Not a new
  feature — the point is that Appwrite already decided this is correct.
- [#14489](https://github.com/appwrite/appwrite/issues/14489) — open: two
  concurrent transactions can both commit a claim of the same row. Warrant
  **never uses a transaction as a lock**, so it is not exposed to this.
- [#14332](https://github.com/appwrite/appwrite/issues/14332) — never stage
  transaction operations in parallel with a commit. Parallel tool calls go
  straight to `decrementRowColumn`.
