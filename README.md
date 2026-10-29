# Warrant

**Your agent's leash should be a row.**

Warrant gives an AI purchasing agent its authority as a row in Appwrite TablesDB
instead of as a key in its environment. Revoking the agent means removing one
permission string from that row, and the database rejects its very next write —
no restart, no polling, no cooperation from the agent's own code.

Built for the Appwrite Databases Hackathon (Oct 2026).

---

## The demo

Two agents, same model, same task, two ways of holding authority.

- **Credential lane** — the agent checked a vendor key once at startup. Normal.
- **Warrant lane** — the agent spends only through its warrant row.

One click revokes both. The credential agent keeps buying. The warrant agent is
rejected by Appwrite on its next write.

## Guarantees

Every guarantee below maps to a named TablesDB primitive, not to application code.

| Guarantee | Primitive |
| --- | --- |
| Revoke takes effect on the next write | Row `$permissions`, with the agent writing as its own Appwrite user |
| Budget can never go negative | `decrementRowColumn` with `min: 0` (race-free, [#13464](https://github.com/appwrite/appwrite/issues/13464)) |
| A retried tool call can't charge twice | `rowId` = tool-call id, so a retry gets `row_already_exists` |
| Nothing committed after revoke, provably | `listRows` on `actions` with `$createdAt > revokedAt` and `outcome = committed` returns 0 |
| The grantor sees everything live | Realtime on `warrants` and `actions` |

## Why this is the same rule Appwrite already shipped

Appwrite closed this gap for human sessions in October:
[#14039](https://github.com/appwrite/appwrite/issues/14039) /
[#14021](https://github.com/appwrite/appwrite/issues/14021) — the HTTP API refuses
a deleted session's next request. Warrant applies that rule to agents.

It also avoids an open bug rather than relying on it: Warrant never uses a
transaction as a lock ([#14489](https://github.com/appwrite/appwrite/issues/14489)),
and never stages transaction operations in parallel with a commit
([#14332](https://github.com/appwrite/appwrite/issues/14332)). Parallel tool calls go
straight to `decrementRowColumn`.

## Schema

| Table | Key columns | Permissions |
| --- | --- | --- |
| `warrants` | `budgetCents` (min 0), `actionsLeft` (min 0), `vendors`, `expiresAt`, `status`, `revokedAt` | rowSecurity on; row grants `update` to grantor and agent until revoked |
| `actions` | `warrantId`, `lane`, `tool`, `amountCents`, `outcome`, `error` | rowId = tool-call id |
| `vendors` | `name`, `catalog`, `injected` | read any; one seeded row carries the injection |

## Running it

```bash
cp .env.example .env    # fill in endpoint, project id, server API key
npm install
npm run setup           # database, three tables, seeded vendors, demo users
npm run spike           # proves the five claims above against live Appwrite
```

## Tech stack

- **Appwrite TablesDB** — rowSecurity, `decrementRowColumn`, row `$permissions`
- **Appwrite Functions** (Node 22) — grant/revoke and the agent runner
- **Appwrite Realtime** — the live race dashboard
- **Appwrite Sites** — frontend hosting
- `node-appwrite` 31.x — the only runtime dependency of the backend

## Open-source libraries

| Library | Licence | Used for |
| --- | --- | --- |
| [node-appwrite](https://github.com/appwrite/sdk-for-node) | BSD-3-Clause | Appwrite server SDK |

_(frontend libraries are listed here as they land)_
