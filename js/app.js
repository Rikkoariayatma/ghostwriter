// app.js — Ghostwriter main application.
// Hash-routed single page app. All persistent state goes through
// store.js; all crypto through crypto.js. Plaintext letter bodies
// exist only in memory, only while a letter is open.

import {
  bufToB64,
  decryptText,
  deriveKey,
  encryptText,
  generateSalt,
  getSessionKey,
  isUnlocked,
  lock,
  makeUnlockCheck,
  setSessionKey,
  uid,
  verifyUnlockCheck,
} from './crypto.js';
import {
  clearAll,
  delOne,
  exportVault,
  getAll,
  getOne,
  getSettings,
  importVault,
  putOne,
  saveSettings,
  validateVault,
} from './store.js';
import { playReveal } from './reveal.js';

const DAY = 86400000;
const view = document.getElementById('view');
const nav = document.getElementById('nav');

const state = {
  settings: null,
  letters: [],
  recipients: [],
  notice: null,
};

// ---------- helpers ----------
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function now() {
  return Date.now() + (state.settings?.demoOffsetMs || 0);
}

function fmtDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function fmtDateTime(ms) {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function recipientName(id) {
  const r = state.recipients.find((x) => x.id === id);
  return r ? r.name : 'Someone loved';
}

function heartbeatDue() {
  if (!state.settings) return null;
  return state.settings.lastCheckin + state.settings.heartbeatDays * DAY;
}

function daysLeft() {
  const due = heartbeatDue();
  if (due == null) return null;
  return Math.ceil((due - now()) / DAY);
}

function isOverdue() {
  const d = daysLeft();
  return d !== null && d <= 0;
}

function isReleasable(letter) {
  if (letter.status !== 'sealed') return false;
  if (letter.releaseRule === 'date') {
    return letter.releaseDate != null && now() >= letter.releaseDate;
  }
  return isOverdue();
}

function releaseHint(letter) {
  if (letter.status === 'released') return `Released ${fmtDate(letter.releasedAt)}`;
  if (letter.releaseRule === 'date') {
    return `Releases ${fmtDate(letter.releaseDate)}`;
  }
  return isOverdue()
    ? 'Heartbeat missed — ready to release'
    : `Releases if the heartbeat is missed (due ${fmtDate(heartbeatDue())})`;
}

function setNotice(msg, kind = 'info') {
  state.notice = { msg, kind };
}

function noticeHtml() {
  if (!state.notice) return '';
  const n = state.notice;
  state.notice = null;
  return `<div class="notice notice-${esc(n.kind)}" role="status">${esc(n.msg)}</div>`;
}

async function refresh() {
  state.letters = await getAll('letters');
  state.recipients = await getAll('recipients');
  state.letters.sort((a, b) => b.createdAt - a.createdAt);
}

// ---------- lock / setup ----------
function renderLock() {
  const setup = !state.settings;
  nav.innerHTML = '';
  view.innerHTML = `
    <section class="lock card">
      <p class="flame" aria-hidden="true">🕯️</p>
      <h1>Ghostwriter</h1>
      <p class="tagline">Letters from beyond. Written now, kept safe,
      released when the time comes.</p>
      ${noticeHtml()}
      ${
        setup
          ? `<p class="plain">This device has no vault yet. Create a passphrase to
             begin. <strong>There is no recovery.</strong> If you lose it, your
             letters are gone forever — that is the price of real privacy.</p>
             <form id="setup-form">
               <label>Passphrase (at least 8 characters)
                 <input name="pass" id="setup-pass" type="password" autocomplete="new-password" required minlength="8">
               </label>
               <label>Repeat passphrase
                 <input name="pass2" type="password" autocomplete="new-password" required minlength="8">
               </label>
               <button class="btn btn-gold" type="submit">Create my vault</button>
             </form>`
          : `<p class="plain">Your vault is locked. Your letters are encrypted on
             this device — nothing leaves it.</p>
             <form id="unlock-form">
               <label>Passphrase
                 <input name="pass" id="unlock-pass" type="password" autocomplete="current-password" required>
               </label>
               <button class="btn btn-gold" type="submit">Unlock the vault</button>
             </form>
             <p class="small muted">Forgot it? There is no reset. You can
             <button class="linklike" type="button" data-action="wipe">erase this vault and start over</button> —
             everything in it will be lost.</p>`
      }
    </section>`;
  // Move focus to the passphrase input so keyboard users can type immediately.
  const passInput = view.querySelector('#unlock-pass, #setup-pass');
  if (passInput) passInput.focus();
}

async function handleSetup(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const pass = String(f.get('pass') || '');
  const pass2 = String(f.get('pass2') || '');
  if (pass.length < 8) {
    setNotice('Passphrase needs at least 8 characters.', 'error');
    renderLock();
    view.querySelector('#setup-pass')?.focus();
    return;
  }
  if (pass !== pass2) {
    setNotice('The two passphrases do not match.', 'error');
    renderLock();
    view.querySelector('#setup-pass')?.focus();
    return;
  }
  setNotice('Creating your vault…');
  renderLock();
  try {
    const salt = generateSalt();
    const key = await deriveKey(pass, salt);
    const unlockCheck = await makeUnlockCheck(key);
    const settings = {
      salt,
      unlockCheck,
      heartbeatDays: 30,
      lastCheckin: Date.now(),
      demoOffsetMs: 0,
    };
    await saveSettings(settings);
    state.settings = settings;
    setSessionKey(key);
    await refresh();
    setNotice('Vault created. Your first check-in is today — the heartbeat runs from now.');
    location.hash = '#/';
    render();
  } catch (err) {
    setNotice('Could not create the vault: ' + err.message, 'error');
    renderLock();
  }
}

async function handleUnlock(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const pass = String(f.get('pass') || '');
  setNotice('Unlocking…');
  renderLock();
  try {
    const key = await deriveKey(pass, state.settings.salt);
    const ok = await verifyUnlockCheck(key, state.settings.unlockCheck);
    if (!ok) {
      setNotice('That passphrase does not open this vault.', 'error');
      renderLock();
      view.querySelector('#unlock-pass')?.focus();
      return;
    }
    setSessionKey(key);
    await refresh();
    location.hash = '#/';
    render();
  } catch (err) {
    setNotice('Could not unlock: ' + err.message, 'error');
    renderLock();
    view.querySelector('#unlock-pass')?.focus();
  }
}

// ---------- views ----------
function renderNav() {
  const hash = location.hash || '#/';
  const path = hash.slice(2).split('?')[0];
  function isCurrent(slug) {
    if (slug === '/') return path === '' || path === '/';
    return path === slug || path.startsWith(slug + '/');
  }
  nav.innerHTML = `
    <a href="#/" data-nav ${isCurrent('/') ? 'aria-current="page"' : ''}>Vault</a>
    <a href="#/compose" data-nav ${isCurrent('compose') ? 'aria-current="page"' : ''}>Write a letter</a>
    <a href="#/recipients" data-nav ${isCurrent('recipients') ? 'aria-current="page"' : ''}>Recipients</a>
    <a href="#/settings" data-nav ${isCurrent('settings') ? 'aria-current="page"' : ''}>Settings</a>
    <button class="linklike" type="button" data-action="lock">Lock</button>`;
}

function heartbeatCard() {
  const d = daysLeft();
  const due = heartbeatDue();
  const overdue = isOverdue();
  return `
    <section class="card heartbeat ${overdue ? 'heartbeat-overdue' : ''}" aria-label="Heartbeat status">
      <h2>Heartbeat</h2>
      <p class="big ${overdue ? 'danger' : ''}" aria-live="polite">
        ${overdue ? 'Heartbeat missed' : `${d} day${d === 1 ? '' : 's'} left`}
      </p>
      <p class="muted">Next check-in due ${fmtDate(due)}. Sealed letters are
      released only if the heartbeat is missed — checking in keeps them sealed.</p>
      <button class="btn btn-gold" type="button" data-action="checkin">I'm still here</button>
    </section>`;
}

function letterCard(l) {
  const badge =
    l.status === 'released' ? 'released' : l.status === 'sealed' ? 'sealed' : 'draft';
  const safeTitle = esc(l.title) || '(Untitled)';
  return `
    <article class="card letter-card">
      <div class="letter-head">
        <h3><a href="#/letter/${esc(l.id)}">${safeTitle}</a></h3>
        <span class="badge badge-${badge}">${badge}${l.demo ? ' · demo' : ''}</span>
      </div>
      <p class="muted">For ${esc(recipientName(l.recipientId))} · ${esc(releaseHint(l))}</p>
      <div class="row">
        <a class="btn btn-ghost" href="#/letter/${esc(l.id)}" aria-label="Open letter: ${safeTitle}">Open</a>
        ${isReleasable(l) ? `<button class="btn btn-gold" type="button" data-action="release" data-id="${esc(l.id)}" aria-label="Release letter: ${safeTitle}">Release</button>` : ''}
        <button class="btn btn-danger-ghost" type="button" data-action="delete-letter" data-id="${esc(l.id)}" aria-label="Delete letter: ${safeTitle}">Delete</button>
      </div>
    </article>`;
}

function renderVault() {
  const sealed = state.letters.filter((l) => l.status === 'sealed');
  const drafts = state.letters.filter((l) => l.status === 'draft');
  const released = state.letters.filter((l) => l.status === 'released');
  view.innerHTML = `
    ${noticeHtml()}
    ${heartbeatCard()}
    <section>
      <div class="section-head"><h2>Sealed letters</h2><a class="btn btn-gold" href="#/compose">Write a letter</a></div>
      ${sealed.length ? sealed.map(letterCard).join('') : '<p class="muted">No sealed letters yet. Write one — it will wait here, safely, until its time comes.</p>'}
    </section>
    ${released.length ? `<section><h2>Released</h2>${released.map(letterCard).join('')}</section>` : ''}
    ${drafts.length ? `<section><h2>Drafts</h2>${drafts.map(letterCard).join('')}</section>` : ''}`;
}

function renderCompose(prefill = {}) {
  const recipientOptions = state.recipients
    .map((r) => `<option value="${esc(r.id)}" ${prefill.recipientId === r.id ? 'selected' : ''}>${esc(r.name)}${r.relation ? ` — ${esc(r.relation)}` : ''}</option>`)
    .join('');
  view.innerHTML = `
    ${noticeHtml()}
    <section class="card">
      <h2>Write a letter</h2>
      <p class="muted">Sealed letters cannot be edited afterwards. Save a draft
      if you are not ready — drafts stay on this device, encrypted.</p>
      <form id="compose-form">
        <input type="hidden" name="id" value="${esc(prefill.id || '')}">
        <label>Title
          <input name="title" required maxlength="120" value="${esc(prefill.title || '')}" placeholder="For example: For my daughter's wedding day">
        </label>
        <label>For whom?
          <select name="recipientId" required>
            <option value="">Choose a recipient…</option>
            ${recipientOptions}
          </select>
        </label>
        ${state.recipients.length === 0 ? '<p class="small">No recipients yet — <a href="#/recipients">add one first</a>.</p>' : ''}
        <label>Your letter
          <textarea name="body" rows="12" required placeholder="Write as if they were here, listening.">${esc(prefill.body || '')}</textarea>
        </label>
        <fieldset>
          <legend>When should this be released?</legend>
          <label class="radio"><input type="radio" name="releaseRule" value="heartbeat" ${prefill.releaseRule !== 'date' ? 'checked' : ''}> If my heartbeat is missed</label>
          <label class="radio"><input type="radio" name="releaseRule" value="date" ${prefill.releaseRule === 'date' ? 'checked' : ''}> On a future date</label>
          <label class="date-label">Release date
            <input type="date" name="releaseDate" value="${prefill.releaseDate ? new Date(prefill.releaseDate).toISOString().slice(0, 10) : ''}">
          </label>
        </fieldset>
        <div class="row">
          <button class="btn btn-ghost" type="submit" name="intent" value="draft">Save draft</button>
          <button class="btn btn-gold" type="submit" name="intent" value="seal">Seal this letter</button>
        </div>
      </form>
    </section>`;
}

async function handleCompose(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const intent = f.get('intent');
  const title = String(f.get('title') || '').trim();
  const recipientId = String(f.get('recipientId') || '');
  const body = String(f.get('body') || '');
  const releaseRule = f.get('releaseRule') === 'date' ? 'date' : 'heartbeat';
  const dateVal = String(f.get('releaseDate') || '');
  if (!title || !recipientId || !body) {
    setNotice('Title, recipient and letter text are all required.', 'error');
    return render();
  }
  let releaseDate = null;
  if (releaseRule === 'date') {
    if (!dateVal) {
      setNotice('Choose a release date for a date-rule letter.', 'error');
      return render();
    }
    releaseDate = new Date(dateVal + 'T00:00:00').getTime();
    if (Number.isNaN(releaseDate)) {
      setNotice('That release date is not valid.', 'error');
      return render();
    }
  }
  try {
    const key = getSessionKey();
    const enc = await encryptText(key, body);
    const id = String(f.get('id') || '') || uid();
    const existing = state.letters.find((l) => l.id === id);
    const letter = {
      id,
      title,
      recipientId,
      bodyEnc: enc.data,
      iv: enc.iv,
      releaseRule,
      releaseDate,
      status: intent === 'seal' ? 'sealed' : 'draft',
      createdAt: existing?.createdAt ?? Date.now(),
      releasedAt: existing?.releasedAt ?? null,
      demo: existing?.demo ?? false,
    };
    await putOne('letters', letter);
    await refresh();
    setNotice(intent === 'seal' ? 'Letter sealed. It will wait, safely, until its time comes.' : 'Draft saved.');
    location.hash = '#/';
    render();
  } catch (err) {
    setNotice('Could not save the letter: ' + err.message, 'error');
    render();
  }
}

async function renderLetter(id) {
  const letter = state.letters.find((l) => l.id === id);
  if (!letter) {
    view.innerHTML = `${noticeHtml()}<p class="muted">That letter does not exist.</p><p><a href="#/">Back to the vault</a></p>`;
    return;
  }
  let body = '';
  try {
    body = await decryptText(getSessionKey(), letter.iv, letter.bodyEnc);
  } catch {
    view.innerHTML = `${noticeHtml()}<p class="danger">This letter could not be decrypted. It may belong to a vault imported with a different passphrase.</p><p><a href="#/">Back to the vault</a></p>`;
    return;
  }
  const lines = body.split('\n').map((ln) => `<p>${esc(ln) || '&nbsp;'}</p>`).join('');
  view.innerHTML = `
    ${noticeHtml()}
    <article class="card letter-read">
      <p class="kicker">For ${esc(recipientName(letter.recipientId))}</p>
      <h2>${esc(letter.title)}</h2>
      <p class="muted">${esc(releaseHint(letter))} · Written ${fmtDate(letter.createdAt)}</p>
      <div class="letter-body">${lines}</div>
      <div class="row">
        ${letter.status === 'draft' ? `<a class="btn btn-ghost" href="#/compose?edit=${esc(letter.id)}">Edit draft</a>` : ''}
        ${isReleasable(letter) ? `<button class="btn btn-gold" type="button" data-action="release" data-id="${esc(letter.id)}">Release this letter</button>` : ''}
        ${letter.status === 'released' ? `<button class="btn btn-gold" type="button" data-action="replay" data-id="${esc(letter.id)}">Replay the ceremony</button>` : ''}
        <button class="btn btn-danger-ghost" type="button" data-action="delete-letter" data-id="${esc(letter.id)}">Delete</button>
      </div>
    </article>
    <p><a href="#/">← Back to the vault</a></p>`;
}

function renderRecipients() {
  view.innerHTML = `
    ${noticeHtml()}
    <section class="card">
      <h2>Recipients</h2>
      <p class="muted">The people your letters are for. Ghostwriter never
      sends anything — delivery is yours (or your family's) to arrange.
      Recipients are simply who each letter is addressed to.</p>
      ${state.recipients.length
        ? `<ul class="recipient-list">${state.recipients
            .map(
              (r) => `<li>
                <div><strong>${esc(r.name)}</strong>${r.relation ? ` · ${esc(r.relation)}` : ''}
                ${r.note ? `<br><span class="muted">${esc(r.note)}</span>` : ''}</div>
                <button class="btn btn-danger-ghost" type="button" data-action="delete-recipient" data-id="${esc(r.id)}" aria-label="Delete recipient ${esc(r.name)}">Delete</button>
              </li>`
            )
            .join('')}</ul>`
        : '<p class="muted">No recipients yet.</p>'}
      <form id="recipient-form">
        <label>Name <input name="name" required maxlength="80"></label>
        <label>Relation <input name="relation" maxlength="80" placeholder="Sister, friend, daughter…"></label>
        <label>Note (optional) <input name="note" maxlength="160" placeholder="How they will find this letter"></label>
        <button class="btn btn-gold" type="submit">Add recipient</button>
      </form>
    </section>`;
}

async function handleRecipient(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const name = String(f.get('name') || '').trim();
  if (!name) return;
  await putOne('recipients', {
    id: uid(),
    name,
    relation: String(f.get('relation') || '').trim(),
    note: String(f.get('note') || '').trim(),
    createdAt: Date.now(),
  });
  await refresh();
  setNotice(`Added ${name} as a recipient.`);
  render();
}

function renderSettings() {
  const s = state.settings;
  const demoCount = state.letters.filter((l) => l.demo).length;
  view.innerHTML = `
    ${noticeHtml()}
    <section class="card">
      <h2>Heartbeat</h2>
      <p class="muted">Check in every <strong>${s.heartbeatDays} days</strong>.
      Last check-in: ${fmtDateTime(s.lastCheckin)}. Next due: ${fmtDate(heartbeatDue())}.</p>
      <form id="heartbeat-form" class="inline-form">
        <label>Check-in interval (days)
          <input name="days" type="number" min="1" max="365" value="${s.heartbeatDays}" required>
        </label>
        <button class="btn btn-ghost" type="submit">Save interval</button>
      </form>
      <button class="btn btn-gold" type="button" data-action="checkin">I'm still here</button>
    </section>

    <section class="card">
      <h2>Backup</h2>
      <p class="muted">Export downloads your vault as an encrypted file —
      no plaintext ever leaves this device. Import merges another vault
      into this one (it must use the same passphrase, or its letters
      will not open).</p>
      <div class="row">
        <button class="btn btn-ghost" type="button" data-action="export">Export encrypted vault</button>
        <label class="btn btn-ghost file-btn" tabindex="0" role="button" aria-label="Import vault from file">Import vault
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </label>
      </div>
    </section>

    <section class="card">
      <h2>Passphrase</h2>
      <p class="muted">Changing it re-encrypts every letter with a new key.
      Keep the new one safe — there is still no recovery.</p>
      <form id="passphrase-form">
        <label>Current passphrase <input name="current" type="password" required></label>
        <label>New passphrase <input name="next" type="password" required minlength="8"></label>
        <label>Repeat new passphrase <input name="next2" type="password" required minlength="8"></label>
        <button class="btn btn-ghost" type="submit">Change passphrase</button>
      </form>
    </section>

    <section class="card demo-card">
      <h2>Demo tools</h2>
      <p class="muted">For presentations and the demo video only. These are
      clearly labelled and never part of normal use.</p>
      <p class="small">Simulated time: ${s.demoOffsetMs ? `+${Math.round(s.demoOffsetMs / DAY)} days` : 'off'} — "now" is ${fmtDateTime(now())}.</p>
      <div class="row">
        <button class="btn btn-ghost" type="button" data-action="demo-plus" data-days="7">Simulate +7 days</button>
        <button class="btn btn-ghost" type="button" data-action="demo-plus" data-days="30">Simulate +30 days</button>
        <button class="btn btn-ghost" type="button" data-action="demo-reset">Reset simulated time</button>
      </div>
      <div class="row">
        ${demoCount === 0
          ? '<button class="btn btn-ghost" type="button" data-action="demo-seed">Load demo data (1 recipient, 1 sealed letter)</button>'
          : `<button class="btn btn-danger-ghost" type="button" data-action="demo-clear">Remove demo data (${demoCount} letter${demoCount === 1 ? '' : 's'})</button>`}
      </div>
    </section>

    <section class="card">
      <h2>About &amp; limits</h2>
      <p class="muted">Ghostwriter is a single-device app. Letters live only
      here, encrypted. It does not send email, does not sync, and is not a
      legal will. If this device is lost without a backup, the letters are
      lost too — export your vault and keep the file somewhere safe.</p>
      <button class="btn btn-danger-ghost" type="button" data-action="wipe">Erase this vault completely</button>
    </section>`;
}

// ---------- actions ----------
async function releaseLetter(id) {
  const letter = state.letters.find((l) => l.id === id);
  if (!letter || !isReleasable(letter)) return;
  if (!confirm(`Release "${letter.title}" to ${recipientName(letter.recipientId)}? This cannot be undone.`)) return;
  let body = '';
  try {
    body = await decryptText(getSessionKey(), letter.iv, letter.bodyEnc);
  } catch {
    setNotice('That letter could not be decrypted.', 'error');
    return render();
  }
  letter.status = 'released';
  letter.releasedAt = now();
  await putOne('letters', letter);
  await refresh();
  render();
  playReveal({ title: letter.title, body, recipientName: recipientName(letter.recipientId) });
}

async function replayLetter(id) {
  const letter = state.letters.find((l) => l.id === id);
  if (!letter || letter.status !== 'released') return;
  const body = await decryptText(getSessionKey(), letter.iv, letter.bodyEnc);
  playReveal({ title: letter.title, body, recipientName: recipientName(letter.recipientId) });
}

async function changePassphrase(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const current = String(f.get('current') || '');
  const next = String(f.get('next') || '');
  const next2 = String(f.get('next2') || '');
  if (next.length < 8) return setNotice('The new passphrase needs at least 8 characters.', 'error'), render();
  if (next !== next2) return setNotice('The new passphrases do not match.', 'error'), render();
  try {
    // 1. Verify the current passphrase.
    const oldKey = await deriveKey(current, state.settings.salt);
    if (!(await verifyUnlockCheck(oldKey, state.settings.unlockCheck))) {
      setNotice('The current passphrase is wrong.', 'error');
      return render();
    }
    // 2. Decrypt everything with the old key (in memory only).
    const bodies = new Map();
    for (const l of state.letters) {
      bodies.set(l.id, await decryptText(oldKey, l.iv, l.bodyEnc));
    }
    // 3. Derive the new key and re-encrypt everything.
    const salt = generateSalt();
    const newKey = await deriveKey(next, salt);
    const unlockCheck = await makeUnlockCheck(newKey);
    for (const l of state.letters) {
      const enc = await encryptText(newKey, bodies.get(l.id));
      l.bodyEnc = enc.data;
      l.iv = enc.iv;
      await putOne('letters', l);
    }
    state.settings.salt = salt;
    state.settings.unlockCheck = unlockCheck;
    await saveSettings(state.settings);
    setSessionKey(newKey);
    setNotice('Passphrase changed. Every letter was re-encrypted with the new key.');
    render();
  } catch (err) {
    setNotice('Could not change the passphrase: ' + err.message, 'error');
    render();
  }
}

async function seedDemo() {
  const key = getSessionKey();
  const recipient = {
    id: uid(),
    name: 'Maya',
    relation: 'Sister',
    note: 'Demo recipient — remove me in Settings.',
    createdAt: Date.now(),
  };
  const body = [
    'Dear Maya,',
    '',
    'If you are reading this, I have been quiet for longer than I meant to be.',
    'Thank you for every late-night call, every shared meal, every time you',
    'made a hard year feel lighter.',
    '',
    'Look after Mum. Water the plants. And please — finish the novel.',
    '',
    'All my love, always.',
  ].join('\n');
  const enc = await encryptText(key, body);
  await putOne('recipients', recipient);
  await putOne('letters', {
    id: uid(),
    title: 'For Maya, when I am quiet',
    recipientId: recipient.id,
    bodyEnc: enc.data,
    iv: enc.iv,
    releaseRule: 'heartbeat',
    releaseDate: null,
    status: 'sealed',
    createdAt: Date.now(),
    releasedAt: null,
    demo: true,
  });
  await refresh();
  setNotice('Demo data loaded: one recipient and one sealed letter.');
  render();
}

async function clearDemo() {
  for (const l of state.letters.filter((x) => x.demo)) await delOne('letters', l.id);
  const used = new Set(state.letters.map((l) => l.recipientId));
  for (const r of state.recipients) {
    if (!used.has(r.id) && r.note?.includes('Demo recipient')) await delOne('recipients', r.id);
  }
  await refresh();
  setNotice('Demo data removed.');
  render();
}

async function exportNow() {
  try {
    const data = await exportVault();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ghostwriter-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice('Vault exported. Keep the file somewhere safe — and remember your passphrase.');
  } catch (err) {
    setNotice('Export failed: ' + err.message, 'error');
  }
  render();
}

async function importNow(file) {
  try {
    const data = JSON.parse(await file.text());
    const err = validateVault(data);
    if (err) throw new Error(err);
    if (data.salt && data.salt !== state.settings.salt) {
      setNotice('Imported vault uses a different passphrase — its letters may not open here. Imported anyway; check the vault.', 'error');
    }
    const counts = await importVault(data);
    await refresh();
    setNotice(`Imported ${counts.letters} letter(s) and ${counts.recipients} recipient(s).`);
  } catch (err) {
    setNotice('Import failed: ' + err.message, 'error');
  }
  render();
}

async function wipe() {
  if (!confirm('Erase this entire vault — every letter, recipient and setting? This cannot be undone. Export first if you want a backup.')) return;
  lock();
  await clearAll();
  state.settings = null;
  state.letters = [];
  state.recipients = [];
  location.hash = '#/';
  setNotice('Vault erased. You can start fresh.');
  render();
}

// ---------- routing & wiring ----------
async function render() {
  if (!isUnlocked()) {
    renderLock();
    return;
  }
  renderNav();
  const hash = location.hash || '#/';
  const [path, query] = hash.slice(2).split('?');
  const params = new URLSearchParams(query || '');
  if (path === '' || path === '/') renderVault();
  else if (path === 'compose') {
    const editId = params.get('edit');
    if (editId) {
      const letter = state.letters.find((l) => l.id === editId && l.status === 'draft');
      if (letter) {
        const body = await decryptText(getSessionKey(), letter.iv, letter.bodyEnc);
        renderCompose({ ...letter, body });
        view.focus();
        return;
      }
    }
    renderCompose();
  } else if (path.startsWith('letter/')) renderLetter(path.slice('letter/'.length));
  else if (path === 'recipients') renderRecipients();
  else if (path === 'settings') renderSettings();
  else renderVault();
  view.focus();
  window.scrollTo(0, 0);
}

document.addEventListener('submit', (e) => {
  const id = e.target.id;
  if (id === 'setup-form') handleSetup(e);
  else if (id === 'unlock-form') handleUnlock(e);
  else if (id === 'compose-form') handleCompose(e);
  else if (id === 'recipient-form') handleRecipient(e);
  else if (id === 'passphrase-form') changePassphrase(e);
  else if (id === 'heartbeat-form') {
    e.preventDefault();
    const days = Number(new FormData(e.target).get('days'));
    if (Number.isInteger(days) && days >= 1 && days <= 365) {
      state.settings.heartbeatDays = days;
      saveSettings(state.settings).then(() => {
        setNotice(`Check-in interval set to ${days} days.`);
        render();
      });
    }
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'lock') {
    lock();
    location.hash = '#/';
    render();
  } else if (action === 'checkin') {
    state.settings.lastCheckin = Date.now();
    await saveSettings(state.settings);
    setNotice("Checked in. The heartbeat is reset — your letters stay sealed.");
    render();
  } else if (action === 'release') releaseLetter(id);
  else if (action === 'replay') replayLetter(id);
  else if (action === 'delete-letter') {
    const l = state.letters.find((x) => x.id === id);
    if (l && confirm(`Delete "${l.title}" permanently?`)) {
      await delOne('letters', id);
      await refresh();
      setNotice('Letter deleted.');
      location.hash = '#/';
      render();
    }
  } else if (action === 'delete-recipient') {
    const used = state.letters.some((l) => l.recipientId === id);
    if (used) {
      setNotice('That recipient still has letters. Delete or reassign them first.', 'error');
      return render();
    }
    const r = state.recipients.find((x) => x.id === id);
    if (r && confirm(`Delete recipient ${r.name}?`)) {
      await delOne('recipients', id);
      await refresh();
      setNotice('Recipient deleted.');
      render();
    }
  } else if (action === 'export') exportNow();
  else if (action === 'wipe') wipe();
  else if (action === 'demo-seed') seedDemo();
  else if (action === 'demo-clear') clearDemo();
  else if (action === 'demo-plus') {
    state.settings.demoOffsetMs = (state.settings.demoOffsetMs || 0) + Number(btn.dataset.days) * DAY;
    await saveSettings(state.settings);
    setNotice(`Simulated time is now +${Math.round(state.settings.demoOffsetMs / DAY)} days.`);
    render();
  } else if (action === 'demo-reset') {
    state.settings.demoOffsetMs = 0;
    await saveSettings(state.settings);
    setNotice('Simulated time reset.');
    render();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'import-file' && e.target.files?.[0]) {
    importNow(e.target.files[0]);
    e.target.value = '';
  }
});

// Allow the file-import label to be activated by keyboard (Enter or Space).
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('file-btn')) {
    e.preventDefault();
    e.target.querySelector('input[type="file"]')?.click();
  }
});

window.addEventListener('hashchange', render);

// ---------- init ----------
(async function init() {
  try {
    state.settings = await getSettings();
  } catch (err) {
    view.innerHTML = `<p class="danger">Could not open the vault database: ${esc(err.message)}. This app needs IndexedDB — try a modern browser with storage enabled.</p>`;
    return;
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  render();
})();
