import { openDB } from './vendor/idb.min.js';

const DB_NAME = 'escaner-plp';
const DB_VERSION = 1;
const STORE = 'scans';

let _db = null;

async function getDB() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'ean' });
        store.createIndex('lastScanned', 'lastScanned');
      },
    });
  }
  return _db;
}

export async function upsertScan(ean) {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  const existing = await tx.store.get(ean);
  const now = Date.now();
  if (existing) {
    await tx.store.put({ ...existing, count: existing.count + 1, lastScanned: now });
  } else {
    await tx.store.put({ ean, count: 1, firstScanned: now, lastScanned: now });
  }
  await tx.done;
}

export async function getAllScans() {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE, 'lastScanned');
  return all.reverse(); // newest first
}

export async function deleteScan(ean) {
  const db = await getDB();
  await db.delete(STORE, ean);
}

export async function clearAllScans() {
  const db = await getDB();
  await db.clear(STORE);
}

export async function getCount() {
  const db = await getDB();
  return db.count(STORE);
}
