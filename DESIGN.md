# DESIGN — Warrant visual direction

Refero MCP unavailable (subscription expired). Patterns drawn from craft knowledge of fintech/security product UIs (spend controls, key revoke, activity timelines, confirmation receipts).

1. **Ramp / Brex spend controls** — Budget as a live-draining gauge + hard limit object; status stamp (ACTIVE/REVOKED) is the authority signal, not a form field.
2. **Stripe / GitHub API keys** — Destructive revoke is one primary danger action; removed permission string is shown struck-through in mono, so the effect is readable without voiceover.
3. **Linear activity / audit timeline** — Two parallel feeds with a full-width REVOKED bar; later “leaked” rows highlight in the leak colour; rejected rows stamp the real Appwrite error.

**Look:** Dark ink ground, light paper slip for the warrant artefact; teal = warrant/enforced, warm coral = credential/leaked — distinguished by lightness, not hue alone; Instrument Serif + JetBrains Mono; 8px grid.
