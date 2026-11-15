# Kiro sessions — log & plan

This file is the honest record of how Kiro was used on this project.
It is filled in as sessions happen. Nothing here is pre-written as if
it already happened.

## How this project was built (truthful summary)
- The project idea, spec (requirements/design/tasks), steering docs,
  and the core app code were written by the entrant's AI assistant
  (Muse) from the entrant's direction. That is the entrant's own work
  product: the entrant owns all rights to it.
- Kiro (the hackathon's required tool) was then used by the entrant in
  genuine spec-driven sessions for the tasks marked **(Kiro)** in
  `.kiro/specs/ghostwriter/tasks.md`. Those sessions are logged below
  with dates, what Kiro did, and the resulting commits.

## Planned sessions (run in the Kiro IDE or CLI, free tier)
1. **Property-based tests** — open the spec, ask Kiro to implement
   `tests/crypto.test.mjs` (task 6): random encrypt/decrypt
   round-trips, tamper detection, wrong-passphrase failure,
   export/import round-trip. Run `node tests/crypto.test.mjs`.
2. **Accessibility pass** — ask Kiro to audit and fix focus order,
   aria labels, keyboard-only flows, and gold-on-black contrast
   (task 7).
3. **Vault search & filter** — ask Kiro to add text search across
   letter titles and recipient names plus a status filter (task 9),
   working with the existing render flow, still dependency-free.

## Session log
| # | Date | Kiro surface | Task | What Kiro did | Commit / notes |
|---|------|--------------|------|---------------|----------------|
| 1 | 2026-11-16 | Kiro IDE | Task 6 — property-style crypto tests | Created `tests/crypto.test.mjs` (plain Node, no framework): base64 round-trip (100 random buffers), encrypt/decrypt round-trip for empty string, ASCII, Unicode (BMP + emoji), 10 000-char strings, IV-uniqueness check; tamper detection for flipped ciphertext byte, flipped IV byte, and truncated ciphertext; wrong-passphrase failure (direct + 5 ciphertexts); unlock-check verification (correct key, wrong key, tampered `.data`, tampered `.iv`); export/import round-trip (re-derive from same salt, decrypt all, unlock-check pass/fail). All 20 tests pass. Keys derived once up-front in parallel to keep runtime reasonable at 250 000 PBKDF2 iterations. | `109f7c1` |
| 2 | — | — | — | _not run yet_ | — |
| 3 | — | — | — | _not run yet_ | — |

## Credits
- Kiro Free tier: 50 credits/month, no card required.
- Hackathon credits: 4,000 one-time credits requested via the Devpost
  Credit Request Form (request by 1 Dec 2026, 12:00 pm PT; redeem by
  4 Dec 2026). Request status: _not yet requested_.
