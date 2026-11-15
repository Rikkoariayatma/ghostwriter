# Tech Steering — Ghostwriter

## Stack
- **Static web app, zero dependencies, no build step.** Plain HTML, CSS
  and JavaScript (ES modules). It must run by opening `index.html` or
  from any static host (GitHub Pages).
- **Storage:** IndexedDB (via a small promise wrapper in `js/store.js`).
  Letters are stored encrypted; only metadata (title, recipient, dates,
  status) is stored in cleartext.
- **Crypto:** WebCrypto API only. PBKDF2 (250,000 iterations, SHA-256)
  derives an AES-GCM 256 key from the passphrase. Random 96-bit IV per
  letter. The session key lives in memory only and is wiped on lock.
- **PWA:** `manifest.json` + `sw.js` (cache-first for app shell) so the
  app installs and works offline.
- **Tests:** Node.js, no test framework. `tests/crypto.test.mjs` runs
  property-style checks (random round-trips, tamper detection) with
  `node --test` or plain `node`.

## Conventions
- ES modules, one responsibility per file. No frameworks, no bundler,
  no npm. If a feature needs a library, justify it in the spec first.
- All user-facing strings in English (hackathon submission language).
- All dates stored as ISO strings / epoch ms. Never trust the system
  clock for release decisions without showing the user the computed
  dates.
- Accessibility: semantic HTML, visible focus, `prefers-reduced-motion`
  respected (the ember canvas is disabled and the reveal is instant).
- Security rules:
  - Never log plaintext letter bodies or the passphrase.
  - Never store the passphrase or the derived key.
  - Ciphertext is base64; never display raw ciphertext to the user as
    if it were the letter.
  - Export files contain encrypted blobs only, plus a version marker.

## File layout
```
index.html          app shell + views
css/styles.css      the whole design system
js/app.js           view routing, state, event wiring
js/crypto.js        key derivation, encrypt/decrypt, export helpers
js/store.js         IndexedDB wrapper (letters, recipients, settings)
js/reveal.js        release ceremony (canvas embers + staged reveal)
sw.js               service worker (app shell cache)
manifest.json       PWA manifest
tests/              node property-style tests (no framework)
```
