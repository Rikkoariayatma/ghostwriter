# Ghostwriter — Tasks

Status: `[x]` done, `[ ]` open. Each task is one focused change.
Kiro session plan: see `../KIRO_SESSIONS.md` — the tasks marked
**(Kiro)** are the ones to run as genuine spec-driven Kiro sessions
in the Kiro IDE/CLI, so the repo's Kiro usage is real and documented.

## Core
- [x] 1. Scaffold: `index.html` shell, `css/styles.css` design
      system, `manifest.json`, `sw.js`.
- [x] 2. `js/crypto.js`: PBKDF2 derive, AES-GCM encrypt/decrypt,
      base64 helpers, unlock-check constant, lock().
- [x] 3. `js/store.js`: IndexedDB wrapper (letters, recipients,
      settings), export/import validation.
- [x] 4. `js/app.js`: unlock/setup flow, hash routing, vault view,
      compose, letter view, recipients, settings, heartbeat logic.
- [x] 5. `js/reveal.js`: ember canvas + staged reveal ceremony,
      reduced-motion path.
- [x] 6. **(Kiro)** Property-style tests (`tests/crypto.test.mjs`):
      random round-trips, tamper detection, wrong-passphrase failure,
      export/import round-trip. Run with plain `node`.
- [x] 7. **(Kiro)** Accessibility pass: focus order, aria labels on
      icon buttons, keyboard-only unlock + compose flow, contrast
      check on gold-on-black text.
- [x] 8. Demo-data seed (settings page only): one sample recipient +
      one sample sealed letter, removable in one tap, never default
      content. (Implemented with the settings view; clearly labelled.)
- [ ] 9. **(Kiro)** Vault search & filter: text search across titles
      and recipient names + filter by status (sealed / released /
      draft). Must work with the existing render flow and stay
      dependency-free.

## Polish
- [ ] 10. Screenshots for the submission (`assets/`): vault, compose,
      ceremony. Taken from the running app.
- [ ] 11. README: setup, run, deploy to GitHub Pages, how Kiro was
       used (finalised after the Kiro sessions).
- [ ] 12. Final QA: fresh-profile run-through (setup → compose →
       seal → simulate overdue → release ceremony → export/import),
       offline check (service worker), reduced-motion check.
