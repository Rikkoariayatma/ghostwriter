# Ghostwriter — Letters from Beyond

> Write encrypted letters to the people you love. They are released
> when your heartbeat is missed — or on a date you choose.
> Private by design: no server, no account, no tracking.

Built for **Kiroween 2026** (Devpost, AWS), entered in the
**Costume Contest** category.

## The problem
Everyone has unsaid words — and almost no one has a plan for them.
Existing "dead man's switch" tools are paid SaaS that holds your
secrets on a server, or clunky scripts. Ghostwriter is free, keeps
everything encrypted on your own device, and treats the release of a
letter as the moment it is.

## Features
- **Encrypted vault** — letters are encrypted on-device with AES-GCM;
  the key is derived from your passphrase with PBKDF2 (250,000
  iterations). Nothing leaves the device. Lose the passphrase and the
  letters are unrecoverable — the app says so plainly.
- **Heartbeat** — check in every N days (default 30). Miss the window
  and your sealed letters become releasable.
- **Future letters** — schedule a letter for a birthday or anniversary.
- **Reveal ceremony** — releasing a letter is a full-screen moment:
  rising embers, candle-glow, the letter appearing line by line.
  Instant and calm with `prefers-reduced-motion`.
- **Recipients** — the people your letters are for. (The app never
  sends anything — delivery is yours to arrange, and the UI says so.)
- **Encrypted backup** — export/import the vault as an encrypted file.
- **PWA** — installs and works fully offline.

## Run it
No build step, no dependencies, no npm.

```sh
# any static server, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` directly in a modern browser. Deployed version:
GitHub Pages (see below).

## Deploy (GitHub Pages, free)
1. Push this folder to a public GitHub repo.
2. Repo Settings → Pages → Source: Deploy from a branch → `main`, `/ (root)`.
3. Your app is live at `https://<username>.github.io/<repo>/`.

## Tests
```sh
node tests/crypto.test.mjs
```
Property-style checks, no framework: random encrypt/decrypt
round-trips, tamper detection, wrong-passphrase failure, and
export/import round-trip. (Implemented in a Kiro session — see below.)

## How Kiro was used
Kiro is the required tool for this hackathon, and it was genuinely
used — see `.kiro/KIRO_SESSIONS.md` for the session log. In short:

- **Spec-driven development** — the spec in `.kiro/specs/ghostwriter/`
  (requirements, design, tasks) was written first; Kiro implemented
  from it.
- **Steering docs** — `.kiro/steering/` (product, tech, structure)
  kept every session aligned on the product and the stack.
- **Hooks** — `.kiro/hooks/` re-runs the crypto tests and syntax
  checks on save.
- **Kiro sessions** (in the Kiro IDE, free tier): the property-style
  test suite, the accessibility pass, and vault search & filter —
  each logged in `.kiro/KIRO_SESSIONS.md`.

The project scaffolding and core app were written by the entrant's AI
assistant (Muse) under the entrant's direction; the entrant owns all
rights to the work. Kiro's contributions above are real, documented,
and reviewable in the commit history.

## Honest limits
- Single-device app. No sync, no email delivery, no cloud.
- If the device is lost without an exported backup, the letters are
  lost. Export your vault and keep the file somewhere safe.
- Not a legal will, and not a substitute for one.

## License
MIT — see `LICENSE`.
