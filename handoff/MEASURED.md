# MEASURED — every number that ships comes from here

Fill this in by running `npm run prove` against the live Appwrite project. If a
figure is not in this file, it does not go in the README, the UI or the video.

Run date: **2026-10-30**  Appwrite region/endpoint: **fra / https://fra.cloud.appwrite.io/v1**  Plan: Cloud

## Claim results

| Claim | Result | Notes |
| --- | --- | --- |
| A — agent spends while live | ☑ PASS ☐ FAIL | budgetCents 19000 after spend |
| B — revoke rejects the next write, same JWT | ☑ PASS ☐ FAIL | **the gate** — removed `update("user:agent_02")` |
| B2 — nothing moved after revoke | ☑ PASS ☐ FAIL | budgetCents stayed 19000 |
| C — min:0 under 20 parallel $10 spends on $50 | ☑ PASS ☐ FAIL | committed: **5** rejected: **15** |
| D — naive read-then-write overspend | measured | charged **20** of 20, overspend **$150.00** |
| E — duplicate tool-call id collides | ☑ PASS ☐ FAIL | 409 row_already_exists; E2 total 1 |

## Exact error codes — quote these verbatim in the X-ray panel and README

| Situation | HTTP code | Appwrite type |
| --- | --- | --- |
| Write after revoke | 401 | user_unauthorized |
| Decrement below min | 400 | column_limit_exceeded |
| Duplicate rowId | 409 | row_already_exists |

Time between the revoke returning and the agent's write being rejected: **38651 ms**

## The headline numbers

- After-revoke committed actions — credential lane: ____  warrant lane: **0**
- The jar: **5** committed, **15** rejected, exactly **$50.00** spent
- Naive read-then-write on the same $50 warrant: **$200.00** spent, overspend **$150.00**

## Run log

Paste the raw `npm run prove` output below, with the date. Do this for every run
you quote — three runs is better than one, and the rival submission publishes
per-run figures.

```
2026-10-30 — npm run prove (attempt 4 after transient 503s; endpoint fra.cloud.appwrite.io)

Warrant spike - five claims

agent JWT minted for agent_02, never re-minted below

PASS  A  agent spends while live
      budgetCents 19000
PASS  B  revoke rejects the next write, same JWT
      removed update("user:agent_02") -> 401 user_unauthorized after 38651ms
PASS  B2 nothing moved after revoke
      budgetCents 19000
PASS  C  min:0 holds under 20 parallel $10 spends on a $50 warrant
      5 committed, 15 rejected, final budgetCents 0; errors: 400 column_limit_exceeded
PASS  D  naive read-then-write overspends (measured, for the jar card)
      20 of 20 charged on a $50 warrant -> $200.00 spent, overspend $150.00; row still reads budgetCents 3000
PASS  E  rowId = tool-call id, so a retry collides
      409 row_already_exists
PASS  E2 exactly one row for one tool-call id
      total 1

7/7 claims passed

Error codes to quote in the README and the X-ray panel:
  revoked write      401 user_unauthorized
  budget floor       400 column_limit_exceeded
  duplicate tool id  409 row_already_exists
  naive overspend    $150.00 on a $50 warrant
```
