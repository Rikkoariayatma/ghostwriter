# Ghostwriter — Design

## Architecture
Static single-page app. No server, no build step, no dependencies.

```
Browser
  index.html            shell, views, templates
  css/styles.css        design system (midnight + candle-glow)
  js/app.js             routing, state, wiring
  js/crypto.js          WebCrypto: PBKDF2 + AES-GCM, base64 helpers
  js/store.js           IndexedDB wrapper (letters, recipients, settings)
  js/reveal.js          ceremony canvas + staged reveal
  sw.js / manifest.json PWA shell
  tests/*.mjs           node property-style tests (WebCrypto via node:crypto)
```

## Data model (IndexedDB, db `ghostwriter`, version 1)
- `letters`: `{ id, title, recipientId, bodyEnc, iv, releaseRule,
  releaseDate, status, createdAt, releasedAt }`
  - `bodyEnc`: base64 AES-GCM ciphertext of the UTF-8 body.
  - `iv`: base64 96-bit IV.
- `recipients`: `{ id, name, relation, note, createdAt }`
- `settings`: single row `{ id: 'main', heartbeatDays,
  lastCheckin, salt, demoOffsetMs }`
  - `salt`: base64, generated once at first run.
  - `demoOffsetMs`: added to `Date.now()` everywhere the app reads
    the clock (demo control only; 0 in normal use).

## Crypto design
- Passphrase + salt → PBKDF2 (250k iterations, SHA-256) → AES-GCM
  256-bit key (extractable: false, usages: encrypt/decrypt).
- Each letter: fresh random 96-bit IV; `crypto.subtle.encrypt`.
- Unlock check: encrypt a known constant ("ghostwriter-unlock-v1")
  at setup, store it as `unlockCheck`; unlock decrypts it — failure
  means wrong passphrase. This avoids decrypting a real letter to
  test the passphrase.
- Key held in a module-level variable in `crypto.js`; `lock()` sets
  it to null. Nothing persists the key or passphrase.

## Heartbeat logic
- `now = Date.now() + demoOffsetMs`.
- `dueAt = lastCheckin + heartbeatDays * 86400000`.
- `daysLeft = ceil((dueAt - now) / 86400000)`.
- Overdue when `now >= dueAt`. A heartbeat letter is releasable when
  overdue; a date letter when `now >= releaseDate`.

## Reveal ceremony
- Full-screen overlay. Canvas particle system: ~90 embers rising with
  flicker + drift, warm gold on near-black. The letter text is staged
  in: title, then body lines fade/slide in sequence (staggered).
- Reduced motion: skip canvas and staging; show the letter at once.
- Ceremony state is UI-only; the letter's `status` flips to
  `released` (with `releasedAt`) before the ceremony starts, so a
  refresh mid-ceremony never loses the release.

## Design system
- Palette: near-black `#0b0a10`, deep violet `#171423`, bone
  `#ece7dc`, candle gold `#e8b34b`, ember orange `#d96f32`, muted
  violet `#8b84a8`.
- Type: Georgia/"Iowan Old Style" serif for letters and headings;
  system sans for controls. (No webfont downloads — offline-first.)
- Signature elements: thin gold rules, soft candle-glow shadows,
  a small flame mark (inline SVG), generous whitespace.
- Layout: centered column (max 720px), cards with 1px borders and
  soft glow on focus/hover. Mobile-first.

## Error handling
- Every async store/crypto call is wrapped; failures surface as a
  calm inline notice (never a stack trace, never a silent failure).
- Import validates JSON shape + version before touching the store.
