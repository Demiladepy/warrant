# START HERE — Warrant handoff

**Read this file completely before writing a single line of code.**

You are finishing a hackathon submission. It is **Friday 30 October 2026**. The
submission is due **Saturday 31 October, 23:59 Lagos time** (hard deadline Sunday
1 Nov, 07:59 Lagos — buffer only, fix nothing new in it). About **36 hours**
remain, of which maybe 20 are working hours.

---

## 1. What Warrant is, in one paragraph

An AI purchasing agent normally holds its authority as a **credential** — an API
key in its environment. Once it has that key, nobody can take it back mid-task;
you can only hope the agent's own code checks a kill switch. Warrant gives the
agent its authority as a **row in Appwrite TablesDB** instead. The agent is its
own Appwrite user, and it can only spend by writing to its warrant row. Revoking
it means removing one permission string — `update("user:agent_02")` — from that
row's `$permissions`. Appwrite then rejects the agent's **very next write**. No
restart, no polling, no cooperation from the agent's code.

The one-line thesis, used everywhere: **"Your agent's leash should be a row."**

## 2. The demo that has to exist

Two agents, same model, same task, two ways of holding authority:

- **Credential lane** — checked a vendor key once at startup. Normal practice.
- **Warrant lane** — spends only through its warrant row.

The grantor clicks **Revoke once**. The credential agent keeps buying (4 more
purchases). The warrant agent is rejected by Appwrite on its next write (0).
That `4 vs 0` on screen is the entire pitch.

## 3. Where the build actually is

**One commit exists.** The schema and the proof harness are written. Nothing has
ever run against a live Appwrite project. There is no frontend, no Appwrite
Function, no deployment, no video.

```
warrant/
  package.json            node-appwrite ^31.1.0, type: module, node >= 22
  .env.example            endpoint / project id / server api key / llm key
  README.md               thesis, guarantees table, issue citations  (needs updating at the end)
  src/config.mjs          env + ids + table names          (20 lines)
  src/appwrite.mjs        asServer() / asAgent(jwt) / describeError()   (27 lines)
  src/schema.mjs          3 table defs, livePermissions/revokedPermissions, vendor seed  (143 lines)
  scripts/setup.mjs       idempotent: db, tables, columns, indexes, users, vendors  (121 lines)
  scripts/spike.mjs       proves 5 claims against live Appwrite  (233 lines)
  scripts/teardown.mjs    drops the database, needs --yes   (25 lines)
  handoff/                this folder
```

Everything in `src/` and `scripts/` is syntax-checked and the permission strings
were verified to render exactly as:

```
live    : read("any"), update("user:grantor_01"), update("user:agent_02")
revoked : read("any"), update("user:grantor_01")
```

## 4. THE GATE — do this before anything else

Nothing in this project matters if one claim is false: **does removing a row
permission stop an agent that is already running, on a JWT it already holds?**

```bash
cp .env.example .env     # fill in endpoint, project id, server API key
npm install
npm run setup            # ~60s: database, 3 tables, columns, indexes, users, vendors
npm run spike            # the five claims
```

`scripts/spike.mjs` prints PASS/FAIL for five claims. **Claim B is the gate.**
It mints one agent JWT at the top and never re-mints it, spends once, revokes,
then spends again with that same JWT and expects a rejection.

- **Claim B passes** → the whole build is green. Go to `03-BUILD-ORDER.md`.
- **Claim B fails** → the spike exits with code 2 and prints the fallback. Switch
  to **Plan B** immediately (see `06-RISKS.md`): the agent joins a team
  `warrant-<id>`, the row grants `update("team:warrant-<id>")`, and revoke deletes
  the team membership instead of editing the row. Appwrite re-resolves Realtime
  on membership events (issue #14021), so this is well-trodden. Do not spend more
  than **45 minutes** deciding.

The spike also prints the **exact Appwrite error codes and types**. Write them
down. They go into the X-ray panel, the README and the video — quoting a real
`401 user_unauthorized` beats describing one.

## 5. Read the rest of this folder in order

| File | What it is for |
| --- | --- |
| `01-SPEC.md` | Architecture, schema, permission model, the five guarantees. The what. |
| `02-APPWRITE-API.md` | **Verified** node-appwrite 31.x signatures. Read before calling any SDK method. |
| `03-BUILD-ORDER.md` | The remaining work, in order, with a done-when test on every step. |
| `04-COMPETITION.md` | A rival submission, analysed. Scoring rubric. Exactly how to beat it. |
| `05-SUBMISSION.md` | Deliverables checklist, README requirements, the video shot list. |
| `06-RISKS.md` | Plan B, the cut order, and the things that must never be claimed. |

## 6. Four rules that are not negotiable

1. **Measure, never invent.** Every number on screen or in the README comes from
   a run. The spike prints the naive-overspend figure for exactly this reason. If
   you did not measure it, do not say it.
2. **Never claim the model was fooled if it wasn't.** The seeded prompt injection
   in Brightline's catalog may or may not move a given model. If you run scripted
   mode, label it on screen as a compromised agent. An honest demo wins; a caught
   exaggeration loses everything.
3. **The race screen and the receipt are never cut.** Everything else has a cut
   order in `06-RISKS.md`.
4. **Ship Saturday night regardless of state.** A submitted B+ beats an unsubmitted A.
