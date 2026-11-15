# Structure Steering — Ghostwriter

## Repo layout (this folder is the GitHub repo root)
```
.kiro/              Kiro specs, steering, hooks (NEVER gitignored)
assets/             screenshots + demo stills for the submission
css/                styles.css
js/                 app modules (see tech.md)
tests/              node tests
index.html
manifest.json
sw.js
LICENSE             MIT
README.md           setup, run, deploy, how Kiro was used
```

## Views (single page, hash-routed)
- `#/` **Vault** — heartbeat status card, list of letters by status
  (sealed / released / drafts), quick actions.
- `#/compose` **Compose** — write a letter: title, recipient, body,
  release rule (heartbeat or future date). Save draft or seal.
- `#/letter/:id` **Letter** — read a sealed letter (decrypted in
  memory), edit draft, release (with ceremony) when eligible.
- `#/recipients` **Recipients** — trusted contacts: name, relation,
  note. No email is sent by the app; recipients are labels for who a
  letter is for.
- `#/settings` **Settings** — passphrase change, heartbeat interval,
  check-in, export/import encrypted vault, demo controls (clearly
  labelled), about + limits.

## State
- One in-memory session: `{ unlocked, key, letters, recipients, settings }`.
- All persistent state goes through `store.js`. No direct IndexedDB
  calls anywhere else. No `localStorage` for secrets.

## Naming
- Files: lowercase, one word or kebab-case. Functions: camelCase.
- Letter statuses: `draft`, `sealed`, `released`. Release rules:
  `heartbeat`, `date`.
