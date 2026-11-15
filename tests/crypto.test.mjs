/**
 * Property-style tests for js/crypto.js.
 * Run with: node tests/crypto.test.mjs
 *
 * No test framework — plain Node 20+ (which ships globalThis.crypto).
 *
 * Key derivation (250 000 PBKDF2 iterations) is expensive.  We derive a
 * small fixed set of keys once, up-front and in parallel, then share them
 * across all tests that need them.
 */

import {
  bufToB64,
  b64ToBuf,
  randomBytes,
  generateSalt,
  deriveKey,
  encryptText,
  decryptText,
  makeUnlockCheck,
  verifyUnlockCheck,
} from '../js/crypto.js';

// ── tiny test harness ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message ?? err}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? 'Assertion failed');
}

function assertRejects(promise, msg) {
  return promise.then(
    () => { throw new Error(msg ?? 'Expected rejection but promise resolved'); },
    () => { /* expected */ }
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate n random Unicode strings mixing ASCII, BMP non-ASCII, and
 * supplementary-plane code-points (emoji).
 */
function randomUnicodeStrings(n) {
  const pools = [
    () => String.fromCharCode(0x20 + Math.floor(Math.random() * 95)),
    () => String.fromCodePoint(0x400 + Math.floor(Math.random() * 0x2800)),
    () => String.fromCodePoint(0x1F300 + Math.floor(Math.random() * 0x500)),
  ];
  return Array.from({ length: n }, () => {
    const len = Math.floor(Math.random() * 200);
    let s = '';
    for (let j = 0; j < len; j++) {
      s += pools[Math.floor(Math.random() * pools.length)]();
    }
    return s;
  });
}

/** Flip one bit in a base64-encoded buffer (decoded → flip byte → re-encode). */
function flipBit(b64) {
  const bytes = new Uint8Array(b64ToBuf(b64));
  if (bytes.length === 0) throw new Error('Cannot flip bit in empty buffer');
  const idx = Math.floor(Math.random() * bytes.length);
  bytes[idx] ^= 0x01;
  return bufToB64(bytes.buffer);
}

// ── derive all keys once, in parallel ───────────────────────────────────────
//
// We share one salt for the "right vs wrong" tests so the same salt is used
// on both sides, which mirrors real usage (salt is stored alongside the
// unlock-check and must be reused on import).

console.log('\nDeriving test keys (this takes a moment due to PBKDF2) …');

const sharedSalt = generateSalt();
const exportSalt  = generateSalt();

const [
  primaryKey,
  wrongKey,
  exportOriginalKey,
  exportImportedKey,
  exportWrongKey,
] = await Promise.all([
  deriveKey('primary-passphrase',       sharedSalt),
  deriveKey('wrong-passphrase',         sharedSalt),
  deriveKey('export-import-passphrase', exportSalt),
  deriveKey('export-import-passphrase', exportSalt),   // same → must match
  deriveKey('wrong-export-passphrase',  exportSalt),
]);

console.log('Keys ready.\n');

// ── base64 round-trip ────────────────────────────────────────────────────────

console.log('base64 round-trip');

await test('bufToB64 / b64ToBuf round-trip — 0 bytes', async () => {
  const buf = new Uint8Array(0).buffer;
  const decoded = b64ToBuf(bufToB64(buf));
  assert(new Uint8Array(decoded).length === 0, 'empty round-trip failed');
});

await test('bufToB64 / b64ToBuf round-trip — 100 random byte buffers', async () => {
  for (let i = 0; i < 100; i++) {
    const original = randomBytes(1 + Math.floor(Math.random() * 255));
    const restored = new Uint8Array(b64ToBuf(bufToB64(original)));
    assert(
      original.length === restored.length &&
        original.every((b, j) => b === restored[j]),
      `Mismatch at iteration ${i}`
    );
  }
});

// ── encrypt / decrypt round-trip ─────────────────────────────────────────────

console.log('\nencrypt / decrypt round-trip');

await test('round-trip — empty string', async () => {
  const { iv, data } = await encryptText(primaryKey, '');
  const plain = await decryptText(primaryKey, iv, data);
  assert(plain === '', `Expected "" but got "${plain}"`);
});

await test('round-trip — 20 random ASCII strings', async () => {
  const samples = Array.from({ length: 20 }, () =>
    Math.random().toString(36).repeat(5)
  );
  for (const s of samples) {
    const { iv, data } = await encryptText(primaryKey, s);
    const plain = await decryptText(primaryKey, iv, data);
    assert(plain === s, `Round-trip failed for "${s}"`);
  }
});

await test('round-trip — 20 random Unicode strings', async () => {
  for (const s of randomUnicodeStrings(20)) {
    const { iv, data } = await encryptText(primaryKey, s);
    const plain = await decryptText(primaryKey, iv, data);
    assert(plain === s, `Round-trip failed for string of length ${s.length}`);
  }
});

await test('round-trip — long string (10 000 chars)', async () => {
  const big = 'ñ🌍abcАБВ'.repeat(1200).slice(0, 10000);
  const { iv, data } = await encryptText(primaryKey, big);
  const plain = await decryptText(primaryKey, iv, data);
  assert(plain === big, 'Long-string round-trip failed');
});

await test('each encryption uses a unique IV', async () => {
  const ivs = new Set();
  const results = await Promise.all(
    Array.from({ length: 50 }, () => encryptText(primaryKey, 'same plaintext'))
  );
  for (const { iv } of results) ivs.add(iv);
  assert(ivs.size === 50, `Expected 50 unique IVs but got ${ivs.size}`);
});

// ── tamper detection ──────────────────────────────────────────────────────────

console.log('\ntamper detection');

await test('flipped ciphertext byte must be rejected', async () => {
  const ciphertexts = await Promise.all(
    Array.from({ length: 10 }, (_, i) => encryptText(primaryKey, `tamper-test-${i}`))
  );
  for (const { iv, data } of ciphertexts) {
    await assertRejects(
      decryptText(primaryKey, iv, flipBit(data)),
      'Tampered ciphertext should have been rejected'
    );
  }
});

await test('flipped IV byte must be rejected', async () => {
  const ciphertexts = await Promise.all(
    Array.from({ length: 10 }, (_, i) => encryptText(primaryKey, `tamper-iv-${i}`))
  );
  for (const { iv, data } of ciphertexts) {
    await assertRejects(
      decryptText(primaryKey, flipBit(iv), data),
      'Tampered IV should have been rejected'
    );
  }
});

await test('truncated ciphertext must be rejected', async () => {
  const { iv, data } = await encryptText(primaryKey, 'truncation test');
  const dataBuf = b64ToBuf(data);
  const truncated = bufToB64(dataBuf.slice(0, Math.max(1, Math.floor(dataBuf.byteLength / 2))));
  await assertRejects(
    decryptText(primaryKey, iv, truncated),
    'Truncated ciphertext should have been rejected'
  );
});

// ── wrong passphrase ─────────────────────────────────────────────────────────

console.log('\nwrong-passphrase failure');

await test('decrypting with wrong passphrase must fail', async () => {
  const { iv, data } = await encryptText(primaryKey, 'secret message');
  await assertRejects(
    decryptText(wrongKey, iv, data),
    'Wrong passphrase should not decrypt'
  );
});

await test('decrypting several ciphertexts with wrong passphrase all fail', async () => {
  const ciphertexts = await Promise.all(
    Array.from({ length: 5 }, (_, i) => encryptText(primaryKey, `payload-${i}`))
  );
  for (let i = 0; i < ciphertexts.length; i++) {
    const { iv, data } = ciphertexts[i];
    await assertRejects(
      decryptText(wrongKey, iv, data),
      `Wrong-passphrase test failed for ciphertext ${i}`
    );
  }
});

// ── unlock-check ─────────────────────────────────────────────────────────────

console.log('\nunlock-check verification');

await test('verifyUnlockCheck returns true with the correct key', async () => {
  const check = await makeUnlockCheck(primaryKey);
  const ok = await verifyUnlockCheck(primaryKey, check);
  assert(ok === true, 'Expected verifyUnlockCheck to return true');
});

await test('verifyUnlockCheck returns false with the wrong key', async () => {
  const check = await makeUnlockCheck(primaryKey);
  const ok = await verifyUnlockCheck(wrongKey, check);
  assert(ok === false, 'Expected verifyUnlockCheck to return false for wrong key');
});

await test('verifyUnlockCheck returns false with tampered check.data', async () => {
  const check = await makeUnlockCheck(primaryKey);
  const ok = await verifyUnlockCheck(primaryKey, { iv: check.iv, data: flipBit(check.data) });
  assert(ok === false, 'Expected tampered check.data to fail verification');
});

await test('verifyUnlockCheck returns false with tampered check.iv', async () => {
  const check = await makeUnlockCheck(primaryKey);
  const ok = await verifyUnlockCheck(primaryKey, { iv: flipBit(check.iv), data: check.data });
  assert(ok === false, 'Expected tampered check.iv to fail verification');
});

// ── export / import round-trip ────────────────────────────────────────────────
//
// Simulates: derive a key, encrypt letters, then re-derive the same key from
// the same (persisted) passphrase + salt on another device and verify all
// ciphertexts still decrypt correctly.

console.log('\nexport / import round-trip');

await test('key re-derived from same passphrase + salt decrypts all ciphertexts', async () => {
  const plaintexts = [
    'Dear future me,',
    '¡Hola, mundo! 🌍',
    '',
    ...randomUnicodeStrings(3),
  ];

  const ciphertexts = await Promise.all(
    plaintexts.map(p => encryptText(exportOriginalKey, p))
  );

  // exportImportedKey was derived with the same passphrase + salt — simulates import.
  for (let i = 0; i < plaintexts.length; i++) {
    const { iv, data } = ciphertexts[i];
    const plain = await decryptText(exportImportedKey, iv, data);
    assert(
      plain === plaintexts[i],
      `Import round-trip failed for index ${i}`
    );
  }
});

await test('unlock-check passes after export/import (key re-derivation)', async () => {
  const check = await makeUnlockCheck(exportOriginalKey);
  const ok = await verifyUnlockCheck(exportImportedKey, check);
  assert(ok === true, 'Unlock-check should pass after key re-derivation');
});

await test('wrong passphrase after import fails unlock-check', async () => {
  const check = await makeUnlockCheck(exportOriginalKey);
  const ok = await verifyUnlockCheck(exportWrongKey, check);
  assert(ok === false, 'Wrong passphrase after import should fail unlock-check');
});

await test('wrong passphrase after import cannot decrypt ciphertexts', async () => {
  const { iv, data } = await encryptText(exportOriginalKey, 'sealed letter body');
  await assertRejects(
    decryptText(exportWrongKey, iv, data),
    'Wrong passphrase after import should not decrypt'
  );
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`All ${passed} tests passed.`);
} else {
  console.log(`${passed} passed, ${failed} failed.`);
  process.exit(1);
}
