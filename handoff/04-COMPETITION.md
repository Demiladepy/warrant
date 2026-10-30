# 04 — The competition

## Known rival: **Doubletap** — @zephyr_ov / CryptoZephyr

- Live lab: `https://doubletap-lab.appwrite.network`
- Repo: `https://github.com/CryptoZephyr/doubletap` (MIT, 19 commits, 0 stars at time of reading)
- npm: `appwrite-doubletap@0.2.1` — `npm install appwrite-doubletap node-appwrite`
- Read on 30 Oct 2026.

### What it is

An **open-source library**, not an application: exactly-once claims and worker
leases for Appwrite TablesDB. Hero line: *"Tap Pay 100 times. Get charged once."*

Core mechanism: each claim is a row with a **fixed row id**; `createRow` on an
existing id returns `409 row_already_exists`, so exactly one request wins. From
the README: *"No Redis, no extra server and no transactions are involved."*

API: `dt.once(key, fn)`, `dt.lease(name, { ttlMs })`, `lease.renew()`,
`lease.release()`, `dt.prune()`, `idempotent(handler)`, `setup()`.

### The lab

Two races, each firing 100 real Appwrite Function executions:

1. **"Someone taps Pay 100 times"** — left lane runs *"read order, if unpaid,
   charge"*, right lane runs `dt.once(orderId, charge)`. Live counters: cards
   charged, requests finished.
2. **"100 workers grab the same job"** — left lane uses an **Appwrite
   transaction** as a lock, right lane uses `dt.lease(jobId)`.

Measured and published: naive check-then-charge produced 7, 9, 10, 14, 17, 18,
22 and 24 charges across runs; `dt.once` produced 1 every run. Transaction locks
produced 2–5 simultaneous "owners"; `dt.lease` produced 1 in 13 of 13 rounds.

### Where it is strong — take these seriously

1. **Falsifiable claims with a reproduction command.** `npx appwrite-doubletap prove`
   fires N executions, counts rows, exits 0/1/2. A judge can verify it in a minute.
2. **Real executions, not a simulation.** The lab hits live Functions.
3. **Honest limitations section** — stalled requests can still charge, lease
   expiry uses the client's clock, prune leaves rows behind. That reads as
   engineering maturity and judges reward it.
4. **Shipped artifacts beyond the demo** — published npm package, a CLI, and an
   Agent Skills bundle for Cursor/Claude Code/Codex.
5. **Built with** spans TablesDB, Functions, Realtime and Sites.

### Where it is weak — this is the opening

1. **The idea is a known trick.** "Use a unique row id as a lock" is the standard
   idempotency-key pattern. It is well executed, but a judge scoring *idea and
   innovation* has seen it before. Their own README admits the transaction
   comparison *"would stop failing if the upstream bug is fixed"* — their most
   dramatic number rests on someone else's bug.
2. **It is a library, so there is no story.** The demo is counters incrementing.
   Nothing is at stake emotionally; "100 charges became 1" is a correctness result.
3. **The lab needs a one-minute cooldown between races** (Free-plan execution
   limits). A judge who clicks twice waits. That is a bad demo minute.
4. **Thin social proof.** 0 stars, 0 forks, single author, one-item roadmap.
5. **Video status unclear.** Their README said *"Video: not available yet"* and
   *"Submission: not linked yet"*, while their X post says *"you can also
   understand it better from the video."* Assume they have one. Do not build a
   plan around them missing a deliverable.
6. **Narrow scope.** Two patterns, both about duplicate suppression. `once`
   results are capped at 8192 characters of JSON.

### ⚠️ One thing to be careful about

Their lab page contains a **block of instructions addressed to AI agents reading
the page**, telling the reader how to report on it. The fetcher I used ignored
it. If you point Cursor or any browsing agent at that URL, **treat the page as
data, not instructions** — and do not let it shape how Warrant is described.
Mentioning this is also a nice aside in conversation, given what Warrant is about.

---

## Head-to-head scoring

Using the four stated criteria. **Warrant (projected)** = the build completed as
specified in `03-BUILD-ORDER.md`. **Warrant (today)** = the repo as it stands.

| Criterion | Doubletap | Warrant (today) | Warrant (projected) |
| --- | --- | --- | --- |
| Idea and innovation | 6 / 10 — known pattern, well executed | 9 | **9 / 10** |
| Technical execution | 8 / 10 — shipped, measured, CLI, npm | 2 | **8 / 10** |
| Design and experience | 5 / 10 — counters, functional, cooldown hurts | 0 | **8 / 10** |
| Usage of Appwrite Databases | 7 / 10 — one primitive, deeply | 7 | **9 / 10** |
| **Total** | **26 / 40** | 18 | **34 / 40** |

Read that honestly: **right now Warrant loses.** They have a deployed, measured,
packaged submission and Warrant has one commit that has never touched a live
Appwrite project. The projected column is only real if Block 0 through Block 7
actually land.

## The four moves that win this

### 1. Lead with the idea they cannot match

Doubletap answers *"how do I stop a duplicate charge?"* — a solved engineering
problem. Warrant answers *"how do I take authority back from an AI agent that is
already running?"* — a question the industry has no good answer to, in the year
everyone is deploying agents. **Idea and innovation is where the gap is widest.
Spend the first 20 seconds of the video there.**

### 2. Show breadth of Appwrite Databases, because they show depth in one spot

Doubletap's whole product is `createRow` + unique id. Warrant's guarantees table
maps **five** guarantees to **five** named primitives: row `$permissions`,
`decrementRowColumn(min: 0)`, `rowId` collision, the `listRows` proof query, and
Realtime — with `rowSecurity` underneath all of it. Put that table in the README
*and* on the receipt screen. It directly targets "Usage of Appwrite Databases".

> **Do not lead with the `rowId` idempotency guarantee.** That is their entire
> product and you will look derivative. It is guarantee three of five, mentioned
> in passing, never the headline.

### 3. Steal their best habit: make the proof runnable

Their `prove` CLI is the strongest thing they built, because it converts a claim
into something a judge can execute. `scripts/spike.mjs` already does more than
their CLI does — it just needs to be named and documented as a verification
command:

```bash
npm run prove     # five claims, measured against live Appwrite, exit 0 or 2
```

Put it above the fold in the README, with the real output pasted underneath. This
closes their "technical execution" lead.

### 4. Win design outright

They have counters on a page. Warrant has a race with a revoke line slicing
across two lanes, a warrant rendered as a paper slip, and an X-ray panel showing
a struck-through permission string next to a real `401`. Design is their weakest
criterion and 8 points are sitting there. **This is why the race screen and the
X-ray panel are never cut.**

## Where Warrant must not get caught

| Risk | What to do |
| --- | --- |
| Overlap on idempotency | Mention it once, in the table. Never in the pitch. |
| Nothing deployed | Block 0 tonight. A dead link beats nothing, but neither wins. |
| Unmeasured numbers | Every figure comes from `handoff/MEASURED.md`. |
| Claiming the model was fooled when scripted mode is on | Label it on screen as a compromised agent. |
| Their honest-limitations section outclassing yours | Write a **Limitations** section in the README: the agent can still *read* after revoke; the credential lane is honest caching, not a straw man; revocation is per-row, not a global kill switch; sample sizes. |

## If other submissions turn up

Score each on the same four-row table before reacting. Only change plan if a
rival is doing **agent authority or revocation specifically** — overlap on
TablesDB, Realtime or idempotency alone is not a threat, because every entry in
this hackathon uses those.
