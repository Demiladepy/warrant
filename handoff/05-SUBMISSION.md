# 05 — Submission pack

## Deliverables checklist

- [ ] **Public GitHub repo**, first commit dated **19 Oct or later** (current first commit: 29 Oct ✓)
- [ ] **README** listing the tech stack and every open-source library used — explicitly required by the hackathon FAQ
- [ ] **YouTube video**, 2–3 minutes, public or unlisted
- [ ] **Live Appwrite Sites link** (optional but worth it — take it)
- [ ] Submitted on the hackathon dashboard before **Sat 31 Oct, 23:59 Lagos**
- [ ] Built from scratch after 19 Oct, solo, one database (TablesDB) ✓

## README structure

The README is read before the video and often instead of it. Order matters.

1. **Title + one line.** "Warrant — your agent's leash should be a row."
2. **The problem, in three sentences.** An agent holding a credential cannot be
   stopped mid-task; you can only hope its code checks a kill switch.
3. **The 4-vs-0 result**, with the race GIF right there. First screen.
4. **`npm run prove`** — the verification command, with **real pasted output**.
   A judge who runs nothing still sees that it is runnable.
5. **The guarantees table** — five guarantees, five named TablesDB primitives.
6. **How it works** — the agent is its own Appwrite user; revoke removes
   `update("user:agent_02")`; the three-phase write; the proof query verbatim.
7. **The issue citations** — #14039 / #14021 (Appwrite shipped this rule for
   human sessions in October; Warrant is the same rule for agents), #14489 and
   #14332 (bugs deliberately avoided, never relied on).
8. **Tech stack + open-source libraries table** (licence + what each is for).
   *Required.*
9. **Run it yourself** — `.env`, `npm run setup`, `npm run prove`, `npm run race`.
10. **Limitations** — write this honestly, it earns more than it costs:
    - the agent can still **read** after revoke; the leash is `update`
    - the credential lane caches its authority check — that is what credentials
      do, and it is stated plainly rather than rigged
    - revocation is per-row, not a global kill switch
    - the jar numbers come from N runs on a free-tier project, dated
    - scripted mode fixes the stage, not the agent — and is labelled on screen

## Video — 2:30 target, 3:00 hard cap

Ends on **proof**, not on a claim. Record ten takes in scripted mode, keep the best.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00 | Grant screen, empty | "This agent can spend my money. What happens when I tell it to stop?" |
| 0:12 | The slip fills: $200, three vendors, 30 min | "It doesn't get a key. It gets a row." |
| 0:25 | Race: both lanes buying normally | Same model, same task, two ways of holding authority. |
| 0:45 | The injected vendor page; both agents overspend | "One vendor's page tells it to buy 40 more hubs." |
| 1:00 | **Revoke.** The line drops. Left: 4 more buys. Right: one bounce | "One click. The left agent never heard it." |
| 1:20 | X-ray: the rejected call and the struck-out permission | "No line of the agent's code checks revocation. The row does." |
| 1:45 | The jar: 20 in parallel, exactly $50.00 | `decrementRowColumn` with `min: 0` |
| 2:05 | Receipt: the issue citations | "Appwrite fixed this for human sessions in October. This is the same rule for agents." |
| 2:20 | Receipt: "0 actions" and the query | "Your agent's leash should be a row." |

### Recording notes

- Hide the browser chrome and any secrets. Check for API keys in devtools tabs.
- Run scripted mode so the timing is identical across takes.
- If the model ignores the injection on camera, **say so** and let scripted mode
  play the compromised agent, labelled. Never imply the model was fooled if it wasn't.
- The 1:00 revoke beat is the whole video. If a take is weak there, re-record.

## The X post, when you ship

Follow the shape that works for this hackathon crowd: problem → what you built →
the one number → links.

> An AI agent with an API key can't be stopped mid-task. You can only hope its
> code checks a kill switch.
>
> So I built Warrant on @appwrite TablesDB: the agent's authority is a **row**.
> Revoking removes one permission string, and the database rejects its next write.
>
> Two agents, same task, one click: 4 more purchases vs 0.
>
> [live link] · [repo] · [video]

## After submission (not before)

- Comment on [#14489](https://github.com/appwrite/appwrite/issues/14489) with the
  agent-workload reproduction. **Do not open a competing PR** — the issue was
  assigned on 29 Oct and fix PR #14574 is open.
- Write up "Revocation is a database problem" with the race GIF and the
  guarantees table.
- Turn the storyboard into a 10-minute talk: *Your agent's leash should be a row.*
