# Warrant — agent instructions

**Before doing anything, read `handoff/00-START-HERE.md`, then the rest of
`handoff/` in order.** It contains the full project plan, the spec, the verified
API surface, the remaining build order, the competitive analysis and the
submission requirements. It is the source of truth; this file is only a pointer.

## One-paragraph context

Warrant is an Appwrite Databases Hackathon submission, due **Sat 31 Oct 2026,
23:59 Lagos**. An AI purchasing agent's authority lives in a TablesDB row rather
than in a credential: the agent is its own Appwrite user and can only spend by
writing to its warrant row, so revoking it means removing
`update("user:agent_02")` from that row's `$permissions` and Appwrite rejects the
agent's very next write. Thesis: *your agent's leash should be a row.*

## Hard rules for anyone writing code here

1. **It is `TablesDB`, not `Databases`.** Tables/rows/columns, never
   collections/documents/attributes. Every SDK method takes **one object**. If
   you are about to write `databases.createDocument(...)`, stop and read
   `handoff/02-APPWRITE-API.md`.
2. **Never guess an SDK signature.** Read it out of
   `node_modules/node-appwrite/dist/services/*.d.ts`. The grep recipe is in
   `handoff/02-APPWRITE-API.md`. Row methods are generic, so search `createRow<`
   not `createRow(`.
3. **Never use a transaction as a lock** (upstream issue #14489). Parallel tool
   calls go straight to `decrementRowColumn` with `min: 0`.
4. **Measure, never invent.** Every number that ships traces to
   `handoff/MEASURED.md`, which is filled in by running `npm run prove`.
5. **Reuse `livePermissions` / `revokedPermissions` from `src/schema.mjs`.** The
   difference between those two arrays is the entire product. Do not reimplement
   permission strings inline anywhere.
6. **Do not weaken the demo to make it pass.** If something fails, that is a
   finding — record it and use the fallback in `handoff/06-RISKS.md`.

## Current state

One commit. Schema, idempotent setup and a five-claim proof harness exist and are
syntax-clean. **Nothing has run against a live Appwrite project yet.** No
frontend, no Functions, no deployment, no video.

The gate before all other work:

```bash
cp .env.example .env     # endpoint, project id, server API key
npm install && npm run setup && npm run prove
```

If claim B fails, switch to Plan B in `handoff/06-RISKS.md` within 45 minutes.

## Layout

```
src/config.mjs     env, ids, table names
src/appwrite.mjs   asServer() / asAgent(jwt) / describeError()
src/schema.mjs     table defs, livePermissions/revokedPermissions, vendor seed
scripts/setup.mjs  idempotent provisioning
scripts/spike.mjs  the five claims  (npm run prove)
handoff/           the plan, spec, API reference, build order, competition, submission
```

Still to build, in this order: `src/agent/*` and `scripts/race.mjs`, the
`warrant-control` Function, `web/` (Vite + React, plain CSS), deployment, README,
video. Full detail with done-when gates: `handoff/03-BUILD-ORDER.md`.
