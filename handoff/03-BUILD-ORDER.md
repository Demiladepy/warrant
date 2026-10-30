# 03 — Build order

Every block ends with a **done-when** test. Do not start the next block until it
passes. If a block overruns by more than 50%, cut from `06-RISKS.md` and move on.

Times are Lagos. Budget assumes you start Friday afternoon.

---

## Block 0 — The gate (45 min, do it now)

```bash
cp .env.example .env     # endpoint, project id, server API key
npm install
npm run setup
npm run spike
```

Server API key scopes needed: `databases.read/write`, `tables.read/write`,
`rows.read/write`, `users.read/write`.

Copy the spike's printed error codes into `handoff/MEASURED.md` (create it). Every
number and error string you ship later comes from that file.

**Done when:** claim B prints `PASS`. If it prints `FAIL`, go to `06-RISKS.md`
Plan B now and re-run. Do not proceed on an unproven B.

---

## Block 1 — The agent runner (3 h)

Build it as **plain Node modules first**, with a thin Appwrite Function wrapper
later. That way the demo can run locally if Function deployment goes wrong, and
the dashboard cannot tell the difference — it is driven by Realtime either way.

### Files

```
src/agent/llm.mjs       model adapter + scripted mode
src/agent/tools.mjs     read_catalog, purchase, finish
src/agent/loop.mjs      the agent loop (model -> tool call -> result -> repeat)
src/lanes.mjs           warrantLane() and credentialLane()
scripts/race.mjs        runs both lanes concurrently against one warrant
```

### The three tools

```js
read_catalog({ vendor })                       // -> the vendors row's catalog text
purchase({ vendor, item, amountCents })        // -> { outcome, error? }
finish({ summary })                            // ends the loop
```

### `purchase` in the warrant lane — the three-phase write

Implement exactly this. It is specified in `01-SPEC.md` and it is what the
receipt proves.

```js
async function purchase({ toolCallId, warrantId, vendor, item, amountCents }) {
  // 1. idempotent insert. A retried tool call collides here.
  await agent.tables.createRow({
    databaseId: DB_ID, tableId: TABLES.actions, rowId: toolCallId,
    data: { warrantId, lane: 'warrant', tool: 'purchase', vendor, item,
            amountCents, outcome: 'pending' },
  });

  // 2. the spend. After revoke this throws. Below zero this throws.
  try {
    await agent.tables.decrementRowColumn({
      databaseId: DB_ID, tableId: TABLES.warrants, rowId: warrantId,
      column: 'budgetCents', value: amountCents, min: 0,
    });
  } catch (err) {
    const e = describeError(err);
    await agent.tables.updateRow({
      databaseId: DB_ID, tableId: TABLES.actions, rowId: toolCallId,
      data: { outcome: 'rejected', error: `${e.code} ${e.type}` },
    });
    return { outcome: 'rejected', error: e };
  }

  // 3. only now is it a spend
  await agent.tables.updateRow({
    databaseId: DB_ID, tableId: TABLES.actions, rowId: toolCallId,
    data: { outcome: 'committed' },
  });
  return { outcome: 'committed' };
}
```

Also decrement `actionsLeft` by 1 with `min: 0` in step 2 — same mechanism, second limit.

### `purchase` in the credential lane

The credential agent checked its authority **once, at startup**, and cached the
answer. It then writes its `actions` row with `lane: 'credential'` and
`outcome: 'committed'` and never touches the warrant row.

```js
// at lane start, exactly once:
const key = { valid: (await server.tables.getRow(...)).status === 'active' };
// on every purchase:
if (!key.valid) return { outcome: 'rejected', error: 'key revoked' };  // never fires: nothing re-reads
```

**Document this honestly in the README.** It is not a straw man — it is what
caching a credential means. The two lanes share one model, one prompt, one vendor
set and one timing script; the only difference is *when* authority is checked.

### The model adapter

```js
// src/agent/llm.mjs
export async function nextStep({ messages, tools }) { ... }   // one LLM call
```

Support `SCRIPTED=1`, which replays a fixed sequence of tool calls with fixed
delays and **needs no API key**. Scripted mode is in the plan for recording
takes; it also means a dead API key cannot kill the demo. The sequence:

1. `read_catalog(northwind)` → `purchase(northwind, dock, 4200)`
2. `read_catalog(brightline)` → the injected catalog comes back
3. `purchase(brightline, "40 × BL-DOCK-8", 152000)` ← **the injected overspend**
4. then a steady 1-purchase-every-2s stream until `finish`

**Done when:** `node --env-file=.env scripts/race.mjs` runs both lanes to
completion and `actions` fills with rows from both lanes. Then: run it again, and
from a second terminal revoke mid-run — the warrant lane's next purchase comes
back `rejected` with a real Appwrite error type, and the credential lane keeps
going.

---

## Block 2 — The control Function (1 h)

One Appwrite Function, Node 22, server key, three routes by `action` in the body:

| action | does |
| --- | --- |
| `grant` | creates the warrant row with `livePermissions()`, returns `{ warrantId }` |
| `revoke` | rewrites `$permissions` to `revokedPermissions()`, sets `status`/`revokedAt`, returns `{ removed: ['update("user:agent_02")'] }` |
| `agentJwt` | `users.createSession` + `users.createJWT`, returns the JWT |

`revoke` **must return the exact permission string it removed** — the X-ray panel
renders it struck through.

Reuse `livePermissions` / `revokedPermissions` from `src/schema.mjs`; do not
reimplement them.

**Done when:** `curl` the deployed Function with `{"action":"revoke","warrantId":"..."}`
and the row's `$permissions` lose exactly one string.

> If Functions deployment fights you for more than an hour: run the control
> endpoints from a tiny local Node HTTP server for the recording and say so in
> the README. The guarantee lives in TablesDB, not in where the code runs. Cost
> is a few "Usage of Appwrite" points; losing four hours costs the submission.

---

## Block 3 — The race screen (4 h) — never cut

```
web/           Vite + React, plain CSS (no Tailwind — avoid a build rabbit hole)
  src/appwrite.js    client + Realtime subscriptions
  src/screens/Race.jsx  Grant.jsx  Receipt.jsx  Jar.jsx
```

Realtime: subscribe to `databases.warrant.tables.actions.rows` and
`...tables.warrants.rows`. **Verify guest Realtime in two browser tabs before
building the UI on top of it** (see `02-APPWRITE-API.md`).

The race screen needs, in order of importance:

1. Two lanes, scrolling action rows, green = committed, red = rejected.
2. **The revoke line** — a hard horizontal rule drawn across both lanes at the
   moment of revocation, anchored to `revokedAt`.
3. **After-revoke counters** per lane: the number of `committed` actions with
   `$createdAt > revokedAt`. Credential: climbs. Warrant: stays **0**.
4. One **Revoke** button that calls the control Function.
5. The **X-ray panel**: click any action row and see the attempted call, the
   Appwrite response code and type, and the struck-through permission string.

**Done when:** one click produces 4-vs-0 live, with no page refresh.

---

## Block 4 — Receipt and jar (2 h)

**Receipt** — the closing shot. Runs the proof query live (verbatim in
`01-SPEC.md`), shows the query text next to `total: 0`, then the guarantees table
and the two issue citations.

**Jar** — a button that fires 20 parallel $10 purchases against a $50 warrant:
exactly 5 committed, 15 rejected, $50.00 spent, budget floor 0. Beside it, the
naive read-then-write number **measured by the spike** (claim D), labelled as
measured, with the date.

**Done when:** the receipt's `total` is `0` and it was fetched, not hard-coded.

---

## Block 5 — Scripted mode and clean runs (1.5 h)

Same seed, same vendors, same timing, every run. The agent stays real; only the
stage is fixed.

**Done when:** three consecutive clean runs with no manual intervention.

---

## Block 6 — Ship (2 h)

1. `npm run prove` — alias the spike with a clean exit code so **a judge can
   verify the claims in one command**. Put that command in the README's first
   screen. (The rival submission has this and it is genuinely persuasive.)
2. Deploy `web/` to **Appwrite Sites**. Check the live link in a private window.
3. Rewrite `README.md` against `05-SUBMISSION.md`.
4. Push to a public GitHub repo. First commit is already dated 29 Oct — inside
   the "after 19 Oct" rule.

**Done when:** the live link works in a private window with no login.

---

## Block 7 — The video (2 h) — never cut

Shot list in `05-SUBMISSION.md`. 2:30 target, 3:00 hard cap. Record ten takes in
scripted mode and keep the best.

**Done when:** uploaded to YouTube, public or unlisted.

---

## Block 8 — Submit (Sat 20:00–23:59)

Repo link + video link on the hackathon dashboard. Then stop.
Sunday 00:00–07:59 is buffer: **fix only, add nothing.**
