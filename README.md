# Warrant — your agent's leash should be a row.

**Repo:** https://github.com/Demiladepy/warrant

An AI purchasing agent normally holds its authority as a **credential** — an API
key in its environment. Once it has that key, nobody can take it back mid-task;
you can only hope the agent's own code checks a kill switch.

Warrant gives the agent its authority as a **row in Appwrite TablesDB** instead.
The agent is its own Appwrite user and spends only by writing to its warrant
row. Revoking it means removing one permission string —
`update("user:agent_02")` — from that row's `$permissions`. Appwrite then
rejects the agent's **very next write**. No restart, no polling, no cooperation
from the agent's code.

## The result

Two agents, same model, same task, two ways of holding authority.

- **Credential lane** — checked warrant status once at startup and cached it.
- **Warrant lane** — every purchase hits the warrant row.

One click revokes both. The credential agent keeps buying. The warrant agent is
rejected by Appwrite on its next write (`401 user_unauthorized`).

On three consecutive scripted races (2026-10-31): warrant **1 committed / 7
rejected** after mid-run revoke; credential **8 committed / 0 rejected**.

## Verify the claims yourself

```bash
cp .env.example .env   # endpoint, project id, server API key
npm install
npm run setup
npm run prove
```

Measured **2026-10-30** against `https://fra.cloud.appwrite.io/v1`:

```
PASS  A  agent spends while live
PASS  B  revoke rejects the next write, same JWT
      removed update("user:agent_02") -> 401 user_unauthorized
PASS  B2 nothing moved after revoke
PASS  C  min:0 holds under 20 parallel $10 spends on a $50 warrant
      5 committed, 15 rejected, final budgetCents 0
PASS  D  naive read-then-write overspends
      $200.00 spent, overspend $150.00
PASS  E  rowId = tool-call id → 409 row_already_exists

7/7 claims passed
```

Error codes to quote:

| Situation | Code | Type |
| --- | --- | --- |
| Write after revoke | 401 | `user_unauthorized` |
| Decrement below min | 400 | `column_limit_exceeded` |
| Duplicate tool-call id | 409 | `row_already_exists` |

## Guarantees

Every guarantee maps to a named TablesDB primitive, not to application code.

| Guarantee | Primitive |
| --- | --- |
| Revoke takes effect on the next write | Row `$permissions`, agent writing as its own user |
| Budget can never go negative | `decrementRowColumn` with `min: 0` ([#13464](https://github.com/appwrite/appwrite/issues/13464)) |
| A retried tool call can't charge twice | `rowId` = tool-call id → `row_already_exists` |
| Nothing committed after revoke, provably | `listRows` on `actions` with `$createdAt > revokedAt` and `outcome = committed` (warrant lane) → **0** |
| The grantor sees everything live | Realtime on `warrants` and `actions` |

## How it works

1. The agent is a real Appwrite user (`agent_02`).
2. A warrant is one row. Its `$permissions` include `update("user:agent_02")`.
3. The agent spends with `decrementRowColumn` **using its own JWT**.
4. Revoke rewrites `$permissions` without that string and sets `revokedAt`.
5. The next decrement is rejected by the database.

Every purchase is a **three-phase write** (Warrant never uses a transaction as a
lock — [#14489](https://github.com/appwrite/appwrite/issues/14489)):

1. Insert `actions` row with `rowId = toolCallId`, `outcome: "pending"`
2. Decrement `budgetCents` (and `actionsLeft`) with `min: 0`
3. Mark `committed` or `rejected`

The proof query counts only `committed`.

## Issue citations

- [#14039](https://github.com/appwrite/appwrite/issues/14039) /
  [#14021](https://github.com/appwrite/appwrite/issues/14021) — Appwrite closed
  this gap for **human sessions** in October. Warrant is the same rule for agents.
- [#14489](https://github.com/appwrite/appwrite/issues/14489) /
  [#14332](https://github.com/appwrite/appwrite/issues/14332) — bugs Warrant
  **avoids**, never relies on.

## Tech stack + open-source libraries

| Library | Licence | Used for |
| --- | --- | --- |
| [node-appwrite](https://github.com/appwrite/sdk-for-node) 31.x | BSD-3-Clause | Server SDK (TablesDB, Users) |
| [appwrite](https://github.com/appwrite/sdk-for-web) 29.x | BSD-3-Clause | Browser SDK (TablesDB, Realtime) |
| [react](https://github.com/facebook/react) 19 | MIT | Dashboard UI |
| [vite](https://github.com/vitejs/vite) | MIT | Frontend build |

Also: Appwrite TablesDB, Appwrite Realtime, optional Appwrite Functions / Sites.

## Run the demo

```bash
# terminal 1 — grant / revoke / startRace
npm run control

# terminal 2 — dashboard (Realtime)
npm run web
# open http://127.0.0.1:5173  →  Run demo

# or CLI race with mid-run revoke
SCRIPTED=1 npm run race -- --revoke-after=2
```

Server API key scopes: `databases`, `tables`, `rows`, `users` (read + write).
Endpoint must match your Cloud region (this project: `fra.cloud.appwrite.io`).

### Deploy notes

- **Dashboard:** `cd web && npm run build` — deploy `web/dist` to Appwrite Sites.
  Set `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`. For a public control
  plane, deploy `functions/warrant-control` and set `VITE_CONTROL_FUNCTION_ID`.
  Recording / local demo uses `npm run control` (see `handoff/06-RISKS.md`).
- **Video shot list:** `handoff/VIDEO-SHOT-LIST.md`

## Limitations

- After revoke the agent can still **read**; the leash is `update`.
- The credential lane caches its authority check — that is what credentials do.
- Revocation is per-row, not a global kill switch.
- Jar / naive numbers come from `handoff/MEASURED.md`, dated 2026-10-30.
- Scripted mode fixes the stage for recording and is **labelled on screen**.
  Never claim the model was fooled by the seeded injection unless it was.

Built for the Appwrite Databases Hackathon (Oct 2026).
