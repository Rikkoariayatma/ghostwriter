# Ghostwriter — Requirements

## 1. Vault & passphrase
- **R1.1** On first run the user creates a passphrase (min 8 chars,
  strength hint shown). The app states plainly: losing it means losing
  the letters; there is no recovery.
- **R1.2** On later runs the user unlocks with the passphrase. A wrong
  passphrase shows a generic error and does not reveal whether any
  letters exist.
- **R1.3** The derived key lives in memory only. Locking (manual or on
  tab close) wipes it. The passphrase and key are never persisted.

## 2. Letters
- **R2.1** A letter has: title, recipient, body, release rule
  (`heartbeat` or `date`), optional release date, status
  (`draft` / `sealed` / `released`), created/released timestamps.
- **R2.2** Bodies are encrypted with AES-GCM before storage. Metadata
  (title, recipient, dates, status) is stored in cleartext so the vault
  list works without decrypting everything.
- **R2.3** A draft can be edited and deleted. A sealed letter cannot be
  edited (only read by the writer, or released when eligible). A
  released letter is read-only.
- **R2.4** Deleting a letter asks for confirmation and removes it
  permanently.

## 3. Recipients
- **R3.1** Recipients have name, relation, and an optional note.
- **R3.2** A recipient cannot be deleted while a letter references it.
- **R3.3** The app never sends email or messages. Recipients are labels
  for who a letter is for; delivery is the writer's (or their family's)
  job, and the UI says so.

## 4. Heartbeat & release
- **R4.1** The user sets a heartbeat interval (default 30 days) and
  checks in with one tap ("I'm still here"). The vault shows days
  remaining and the exact next-due date.
- **R4.2** When the heartbeat is overdue, sealed heartbeat letters
  become releasable. Releasing one runs the reveal ceremony.
- **R4.3** Date-rule letters become releasable on or after their
  release date.
- **R4.4** Release is irreversible and asks for confirmation.
- **R4.5** A clearly-labelled demo control ("Simulate time passing",
  settings page only) lets a presenter move the clock forward for the
  demo video. It is never used in normal operation and is marked as a
  demo tool in the UI.

## 5. Reveal ceremony
- **R5.1** Releasing a letter opens a full-screen ceremony: embers rise
  on canvas, the letter appears line by line, candle-glow styling.
- **R5.2** With `prefers-reduced-motion`, the ceremony is instant
  (no canvas, no staged animation).
- **R5.3** The ceremony can be replayed for a released letter.

## 6. Backup
- **R6.1** Export downloads a JSON file with the encrypted vault
  (letters ciphertext + metadata + recipients + settings + salt) and a
  version marker. No plaintext bodies leave the device.
- **R6.2** Import reads such a file, validates the version marker,
  and merges it into the vault (same passphrase required). Invalid
  files show a clear error and change nothing.

## 7. PWA & offline
- **R7.1** The app installs as a PWA (manifest + icons) and works
  fully offline after first load (service worker caches the shell).

## 8. Quality
- **R8.1** Property-style tests cover: encrypt/decrypt round-trip for
  random bodies, tamper detection (flipped ciphertext fails), wrong
  passphrase fails, and export/import round-trip. Runnable with plain
  `node`, no framework.
- **R8.2** The app must run by opening `index.html` directly or from
  any static host. No build step, no npm install.

## Non-goals
- No server, no accounts, no sync, no email/SMS delivery, no legal
  will features, no crypto/blockchain.
