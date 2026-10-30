# MEASURED — every number that ships comes from here

Fill this in by running `npm run prove` against the live Appwrite project. If a
figure is not in this file, it does not go in the README, the UI or the video.

Run date: ____________  Appwrite region/endpoint: ____________  Plan: ____________

## Claim results

| Claim | Result | Notes |
| --- | --- | --- |
| A — agent spends while live | ☐ PASS ☐ FAIL | |
| B — revoke rejects the next write, same JWT | ☐ PASS ☐ FAIL | **the gate** |
| B2 — nothing moved after revoke | ☐ PASS ☐ FAIL | |
| C — min:0 under 20 parallel $10 spends on $50 | ☐ PASS ☐ FAIL | committed: ____ rejected: ____ |
| D — naive read-then-write overspend | measured | charged ____ of 20, overspend $______ |
| E — duplicate tool-call id collides | ☐ PASS ☐ FAIL | |

## Exact error codes — quote these verbatim in the X-ray panel and README

| Situation | HTTP code | Appwrite type |
| --- | --- | --- |
| Write after revoke | | |
| Decrement below min | | |
| Duplicate rowId | | |

Time between the revoke returning and the agent's write being rejected: ______ ms

## The headline numbers

- After-revoke committed actions — credential lane: ____  warrant lane: **0**
- The jar: ____ committed, ____ rejected, exactly $______ spent
- Naive read-then-write on the same $50 warrant: $______ spent, overspend $______

## Run log

Paste the raw `npm run prove` output below, with the date. Do this for every run
you quote — three runs is better than one, and the rival submission publishes
per-run figures.

```
(paste here)
```
