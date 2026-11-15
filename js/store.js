// store.js — IndexedDB wrapper for Ghostwriter.
// Single place that touches IndexedDB. Everything else goes through
// these functions. Letters are stored encrypted; only metadata is
// cleartext. No secrets are ever written here (no passphrase, no key).

const DB_NAME = 'ghostwriter';
const DB_VERSION = 1;
export const VAULT_VERSION = 1;

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('letters')) {
        db.createObjectStore('letters', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('recipients')) {
        db.createObjectStore('recipients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        let result;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        t.oncomplete = () => resolve(result?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const getAll = (store) => tx(store, 'readonly', (s) => s.getAll());
export const getOne = (store, id) => tx(store, 'readonly', (s) => s.get(id));
export const putOne = (store, obj) => tx(store, 'readwrite', (s) => s.put(obj));
export const delOne = (store, id) => tx(store, 'readwrite', (s) => s.delete(id));

// ---- settings (single row, id 'main') ----
export async function getSettings() {
  const row = await getOne('settings', 'main');
  return row || null;
}

export function saveSettings(settings) {
  return putOne('settings', { ...settings, id: 'main' });
}

// ---- export / import ----
export async function exportVault() {
  const [letters, recipients, settings] = await Promise.all([
    getAll('letters'),
    getAll('recipients'),
    getSettings(),
  ]);
  return {
    vault: 'ghostwriter',
    version: VAULT_VERSION,
    exportedAt: new Date().toISOString(),
    salt: settings?.salt ?? null,
    unlockCheck: settings?.unlockCheck ?? null,
    letters,
    recipients,
    settings: settings
      ? {
          heartbeatDays: settings.heartbeatDays,
          lastCheckin: settings.lastCheckin,
        }
      : null,
  };
}

export function validateVault(data) {
  if (!data || typeof data !== 'object') return 'Not a Ghostwriter vault file.';
  if (data.vault !== 'ghostwriter') return 'Not a Ghostwriter vault file.';
  if (data.version !== VAULT_VERSION) return `Unsupported vault version: ${data.version}.`;
  if (!Array.isArray(data.letters) || !Array.isArray(data.recipients)) {
    return 'Vault file is missing letters or recipients.';
  }
  for (const l of data.letters) {
    if (!l.id || typeof l.bodyEnc !== 'string' || typeof l.iv !== 'string') {
      return 'A letter in this vault is malformed.';
    }
  }
  return null; // valid
}

export async function importVault(data) {
  const err = validateVault(data);
  if (err) throw new Error(err);
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction(['letters', 'recipients'], 'readwrite');
    const ls = t.objectStore('letters');
    const rs = t.objectStore('recipients');
    for (const l of data.letters) ls.put(l);
    for (const r of data.recipients) rs.put(r);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  return { letters: data.letters.length, recipients: data.recipients.length };
}

export async function clearAll() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction(['letters', 'recipients', 'settings'], 'readwrite');
    t.objectStore('letters').clear();
    t.objectStore('recipients').clear();
    t.objectStore('settings').clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
