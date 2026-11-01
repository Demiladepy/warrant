# Gemini Pro — demo recording brief

Paste this into Gemini as the system/user prompt for VO, shot timing, and on-screen direction.
Target **2:30**, hard cap **3:00**. Live URL: https://warrant-lab.appwrite.network  
Mode: **scripted** (always visible on screen — never claim the model was fooled).

---

## Prompt for Gemini

You are directing a 2:30 hackathon demo for **Warrant** — an Appwrite TablesDB project whose thesis is: *your agent's leash should be a row.*

Write a spoken voiceover script timed to the shot list below. Tone: calm, precise, like explaining a research finding — not a product launch. No hype words ("revolutionary", "game-changing"). Prefer short sentences. Name real Appwrite primitives when they appear on screen.

Constraints:
- Every number must match a real run (credential after revoke climbs; warrant stays **0** purchases after revoke).
- Say "scripted" once early so the label on screen is acknowledged.
- End on the receipt proof, not a sales CTA.
- Output format: timestamped lines as `MM:SS | [SCREEN] | VO: "..."` plus a one-line camera note.

### Shot list (lock to this)

| Time | Screen | Beat |
| --- | --- | --- |
| 0:00 | Race empty / Grant step | Hook: agent can spend my money — what if I tell it to stop? |
| 0:12 | Run demo → slip ACTIVE | Authority is a TablesDB row, not an API key |
| 0:25 | Both lanes buying | Same task, two authority models |
| 0:45 | Brightline overspend attempt | Vendor page pushes more hubs |
| 1:00 | REVOKED bar + scoreboard | Credential keeps buying; warrant hits Appwrite reject |
| 1:20 | X-ray on rejected row | `401 user_unauthorized`; struck `update("user:agent_02")` |
| 1:45 | Jar | `decrementRowColumn` min:0 — 5 of 20, exactly $50 |
| 2:05 | Receipt citations | #14039 / #14021 human sessions; same rule for agents; #14489 avoided |
| 2:20 | Receipt hero **0** | Close on the thesis line |

### Seed VO (edit freely, keep timing)

```
0:00 | [race empty] | VO: "This agent can spend my money. What happens when I tell it to stop?"
0:12 | [Run demo · slip ACTIVE] | VO: "It doesn't get a key. It gets a row in Appwrite TablesDB. Scripted demo."
0:25 | [both lanes] | VO: "Same model. Same shopping list. Two ways of holding authority."
0:45 | [Brightline] | VO: "One vendor page tells it to buy forty more hubs."
1:00 | [REVOKED · scoreboard] | VO: "I revoke once. The credential lane never heard it — it keeps buying. The warrant lane's next write is rejected by the database."
1:20 | [X-ray] | VO: "No kill switch in the agent. Appwrite returns 401 user_unauthorized. The permission string is gone."
1:45 | [jar] | VO: "Twenty parallel ten-dollar spends on a fifty-dollar warrant. Five commit. Fifteen bounce. Exactly fifty dollars. decrementRowColumn with min zero."
2:05 | [receipt citations] | VO: "Appwrite closed this gap for human sessions in October — issues 14039 and 14021. Warrant is the same rule for agents."
2:20 | [receipt 0] | VO: "Zero purchases committed after revocation. Your agent's leash should be a row."
```

### Gemini: also generate

1. A 30-second cold open alternate (if the race is slow to start).
2. A silent lower-third caption list matching each beat (≤6 words each).
3. A YouTube description: repo URL, live URL, one-paragraph thesis, `npm run prove`.
