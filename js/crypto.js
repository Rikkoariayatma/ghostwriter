// crypto.js — WebCrypto helpers for Ghostwriter.
// PBKDF2 (250,000 iterations, SHA-256) derives an AES-GCM 256 key from
// the passphrase. The key lives in memory only and is wiped on lock.
// This module has no DOM or Node dependencies: base64 is implemented
// by hand so the same file is importable in the browser and in Node
// tests (globalThis.crypto exists in both).

const UNLOCK_PLAINTEXT = 'ghostwriter-unlock-v1';
const PBKDF2_ITERATIONS = 250000;

let sessionKey = null;

// ---- base64 (environment-agnostic) ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function b64ToBuf(str) {
  const clean = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
  const lookup = new Map([...B64].map((ch, i) => [ch, i]));
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup.get(clean[i]) ?? 0;
    const b = lookup.get(clean[i + 1]) ?? 0;
    const c = clean[i + 2] === '=' ? 0 : (lookup.get(clean[i + 2]) ?? 0);
    const d = clean[i + 3] === '=' ? 0 : (lookup.get(clean[i + 3]) ?? 0);
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    bytes.push((n >> 16) & 255);
    if (clean[i + 2] !== '=') bytes.push((n >> 8) & 255);
    if (clean[i + 3] !== '=') bytes.push(n & 255);
  }
  return new Uint8Array(bytes).buffer;
}

// ---- random ----
export function randomBytes(n) {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

export function generateSalt() {
  return bufToB64(randomBytes(16));
}

export function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + bufToB64(randomBytes(9)).replace(/[^A-Za-z0-9]/g, '');
}

// ---- key derivation & session ----
export async function deriveKey(passphrase, saltB64) {
  const enc = new TextEncoder();
  const base = await globalThis.crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBuf(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function setSessionKey(key) { sessionKey = key; }
export function getSessionKey() { return sessionKey; }
export function isUnlocked() { return sessionKey !== null; }
export function lock() { sessionKey = null; }

// ---- encrypt / decrypt ----
export async function encryptText(key, plaintext) {
  const iv = randomBytes(12);
  const data = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv: bufToB64(iv), data: bufToB64(data) };
}

export async function decryptText(key, ivB64, dataB64) {
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(ivB64) },
    key,
    b64ToBuf(dataB64)
  );
  return new TextDecoder().decode(plain);
}

// ---- unlock check ----
// At setup we encrypt a known constant; unlocking decrypts it. A
// failure means the passphrase is wrong, without touching real letters.
export async function makeUnlockCheck(key) {
  return encryptText(key, UNLOCK_PLAINTEXT);
}

export async function verifyUnlockCheck(key, check) {
  try {
    const plain = await decryptText(key, check.iv, check.data);
    return plain === UNLOCK_PLAINTEXT;
  } catch {
    return false;
  }
}
