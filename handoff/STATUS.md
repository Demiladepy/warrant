# Warrant — what exists now (31 Oct 2026)

## One-line

An AI agent’s authority is a TablesDB row. Revoke removes `update("user:agent_02")`;
Appwrite rejects the next write. Live: https://warrant-lab.appwrite.network

## Done

### Block 0 — Gate
- Appwrite Cloud project (fra), schema setup, vendors seeded
- `npm run prove` — **7/7 PASS** including claim B (`401 user_unauthorized`)
- Numbers in `handoff/MEASURED.md`

### Block 1 — Agent
- `src/agent/{llm,tools,loop}.mjs`, `src/lanes.mjs`, `scripts/race.mjs`
- Three-phase warrant purchase; credential lane caches once
- Scripted mode (no LLM required); OpenAI optional when key present

### Block 2 — Control
- Local `npm run control` + Appwrite Function `warrant-control`
- Actions: grant, revoke, agentJwt, startRace, runRace, jar
- Live jar: **5 committed / 15 rejected / budget 0**

### Block 3–4 — UI
- Vite + React: Race, Grant, Receipt, Jar
- Scoreboard (after-revoke counters), revoke line, X-ray panel
- Realtime on warrants + actions

### Block 5–6 — Ship
- Three consecutive clean CLI races
- Function + Sites deployed
- Domain: **https://warrant-lab.appwrite.network**
- Repo: https://github.com/Demiladepy/warrant (homepage set to live URL)

## Still on you before 23:59 Lagos

1. Record video — `handoff/VIDEO-SHOT-LIST.md` (~2:30)
2. Submit repo + video + live link on the hackathon dashboard
3. If you have unpushed local commits: `git push origin main`

## Commands judges care about

```bash
npm run prove          # falsifiable claims
SCRIPTED=1 npm run race -- --revoke-after=2
```

Open https://warrant-lab.appwrite.network → **Run demo** → watch credential climb, warrant stay **0**.
