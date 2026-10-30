# 06 — Risks, fallbacks and the cut order

## The one risk that can sink the demo

**Does removing a row permission stop an agent that is already running?** Claim B
in `scripts/spike.mjs`. Nothing else in this project matters until it is answered.

### Plan B — the team role

If claim B fails (the agent's next write still succeeds on its existing JWT):

1. Create a team per warrant: `warrant-<rowId>`.
2. Add `agent_02` as a member.
3. The row grants `update("team:warrant-<rowId>")` instead of
   `update("user:agent_02")`.
4. **Revoke deletes the team membership** rather than editing the row.

Appwrite already re-resolves Realtime on membership events
([#14021](https://github.com/appwrite/appwrite/issues/14021)), so this path is
well-trodden. `Role.team(id, role?)` is in the SDK — see `02-APPWRITE-API.md`.

The pitch does not change at all: authority still lives in the database, and
revocation is still a permission change rather than a message the agent must
choose to obey. Only the sentence "removes one permission string from the row"
becomes "removes the agent from the warrant's team".

**Give this decision 45 minutes, no more.**

## Other risks

| Risk | Fallback |
| --- | --- |
| The grantor's browser can't write permissions for the agent's role | It never does. Grant and revoke run in a Function with a server key; the button calls the Function. Already specified. |
| `decrementRowColumn` and the `actions` insert can't share one atomic step | They don't. Three-phase write: insert `pending` with an idempotent id, decrement, then mark `committed` or `rejected`. The proof query counts only `committed`. |
| Appwrite Functions deployment eats hours | Run the agent runner and control endpoints locally for the recording; the dashboard is Realtime-driven and looks identical. Say so in the README. Costs a few points, saves the submission. |
| The LLM is slow or flaky on camera | Scripted mode, low temperature, ten takes. |
| The LLM API key is missing or out of credit | `SCRIPTED=1` needs no key at all. Build it in Block 1, not at midnight. |
| The model ignores the injected instruction | Scripted mode plays the injected purchase as a compromised agent and **labels it on screen**. Never claim the model was fooled if it wasn't. |
| Guest Realtime doesn't deliver row events | Create an anonymous session in the dashboard and add that user to the row's read permissions. Test this in two tabs **before** building the UI. |
| Free-tier execution limits throttle the demo | Run the jar locally, or pre-record it. Note the rival's lab needs a one-minute cooldown — do not inherit that problem. |
| Time runs out | Follow the cut order. Submit Saturday night regardless. |

## Cut order — cut in this order, item 1 first

1. X-ray panel polish (keep a plain error line instead)
2. Jar naive-comparison card (keep the jar itself)
3. Grant screen styling (a plain form is fine)
4. The jar
5. Scripted mode (record live and keep the best take)

**The race screen and the receipt are never cut.** They carry the two criteria
that decide this: the idea, and the proof.

## Scope fence — the idea is locked

**In:** one agent per lane, one purchasing domain with mock vendors, grant,
revoke, race, jar, receipt, scripted mode, README, video.

**Out, until after submission:** multiple agents, delegation chains or
sub-warrants, an LTL engine, MCP Events, OAuth via Appwrite, real payments,
revoke from a phone via QR, and any core Appwrite PR before submission.

Anything not listed under **In** waits.

## Things that must never be said

- Any number you did not measure. Every figure traces to `handoff/MEASURED.md`.
- "The model was fooled by the injection" — unless it was, on that take.
- "Appwrite is broken" — #14489 is a bug Warrant **avoids**, not one it exploits,
  and the fix is already assigned.
- "Revocation is instant everywhere" — it is enforced on the **next write**. That
  is the precise, defensible claim, and it is stronger than a vague one.
