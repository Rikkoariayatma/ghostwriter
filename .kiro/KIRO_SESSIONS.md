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
| 2 | 2026-11-16 | Kiro IDE | Task 7 — accessibility pass | Audited and fixed `css/styles.css`, `js/app.js`, and `js/reveal.js`. Contrast check passed for all text combinations (WCAG AA). **aria labels**: letter-card Open/Release/Delete buttons and recipient Delete buttons each got a descriptive `aria-label` including the item name, so screen readers distinguish them. **aria-live**: heartbeat status paragraph got `aria-live="polite"` so the days-remaining count is announced after a check-in. **Keyboard file import**: file-import `<label>` got `tabindex="0"` and `role="button"` to enter the tab order; a `keydown` listener opens the hidden file input on Enter or Space; CSS adds a `:focus-within` outline. **Focus outline**: replaced the narrow per-element focus rule with a unified `:focus-visible` block at `outline-offset: 3px` covering all interactive elements. **Focus management**: `renderLock()` calls `.focus()` on the passphrase input after every render (replacing the HTML `autofocus` which only fires on page load); `render()` calls `view.focus()` after every route change; `renderNav()` stamps `aria-current="page"` on the active link. **Ceremony overlay**: added `aria-modal="true"`; focus moves to the close button on open; Tab/Shift+Tab trapped inside the overlay; `previouslyFocused` restored on close. | `0a64cd0` |
| 3 | 2026-11-16 | Kiro IDE | Task 9 — vault search & filter | Added live text search and status filter to the vault view. All logic is in-memory (no extra IndexedDB calls). **State**: added `vaultSearch` and `vaultFilter` to the `state` object; both reset to defaults when navigating away from the vault. **Filtering**: `isDueSoon()` identifies sealed letters whose release window closes within 7 days (heartbeat rule: days-left ≤ 7; date rule: release date within 7 days); `applyVaultFilters()` applies the active status filter and case-insensitive substring search against title and recipient name. **`renderVault()`** rebuilt to render a search input (`type="search"`, `role="search"` on wrapper) and five filter chips (All / Sealed / Released / Drafts / Due soon) with `aria-pressed`. When a filter or query is active, the three-section layout collapses to a flat results list with an `aria-live` count. When idle, the existing grouped layout is preserved exactly. **Event wiring**: `input` on `#vault-search` updates `state.vaultSearch`, calls `renderVault()`, and restores cursor position; filter-chip clicks handled at the top of the main click listener (returns early to avoid unknown-action fall-through), re-focuses the replaced chip by `data-filter` value. **Demo seed** updated: `seedDemo()` now creates two letters — one heartbeat-rule sealed letter and one date-rule sealed letter releasing in 6 days — so "Due soon" and "Sealed" filters are immediately testable. **CSS**: `.vault-search-row`, `.vault-search-input`, `.filter-chips`, `.filter-chip`, `.filter-chip-active`, `.vault-results-count`, `.vault-empty`, `.sr-only` utility class. | pending commit |

## Credits
- Kiro Free tier: 50 credits/month, no card required.
- Hackathon credits: 4,000 one-time credits requested via the Devpost
  Credit Request Form (request by 1 Dec 2026, 12:00 pm PT; redeem by
  4 Dec 2026). Request status: _not yet requested_.
