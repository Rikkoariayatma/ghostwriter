# Product Steering — Ghostwriter

## What it is
Ghostwriter is a local-first digital legacy app: **letters from beyond**.
A person writes encrypted letters to loved ones, sets a heartbeat
(check-in) schedule, and if they stop checking in, the sealed letters are
released to their recipients. It also supports letters scheduled for a
future date (birthdays, anniversaries).

## The problem
Everyone has digital accounts, photos, and unsaid words — and almost no
one has a plan for them. Existing "dead man's switch" tools are either
paid SaaS with a server that holds your secrets, or clunky scripts.
Ghostwriter is free, private by design (nothing leaves the device), and
built to be used by non-technical people.

## Who it is for
- Anyone who wants to leave words for family and friends.
- People who care about privacy: no account, no server, no tracking.

## Core promises
1. **Private by design.** Letters are encrypted on the device with a
   passphrase only the writer knows (AES-GCM, key derived with PBKDF2).
   There is no server and no account. If the passphrase is lost, the
   letters cannot be recovered — the app says this plainly.
2. **Honest about limits.** This is a single-device app. Release happens
   on the writer's device (or on a device holding an exported vault).
   The app never claims to deliver email or to run in the cloud.
3. **A ceremony, not a form.** Releasing a letter is a moment. The
   reveal is theatrical (embers, candle-glow, the letter appearing line
   by line) because the moment matters.

## What it is NOT
- Not a messaging app, not email, not cloud storage.
- Not a legal will or a substitute for one. The app says so in the UI.
- No crypto, no blockchain, no tokens.

## Tone
Haunting but warm. Midnight palette, candle-glow accents, elegant serif
type for letters. The UI should feel like a quiet room at night — never
cheap horror, never jump scares.
