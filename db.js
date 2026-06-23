import { openDB } from './vendor/idb.min.js';

const DB_NAME = 'escaner-plp';
const DB_VERSION = 2;

let _db = null;

async function getDB() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('scans', { keyPath: 'ean' });
          store.createIndex('lastScanned', 'lastScanned');
        }
        if (oldVersion < 2) {
          db.createObjectStore('catalog', { keyPath: 'ean' });
        }
      },
    });
  }
  return _db;
}

// ── Scans ──────────────────────────────────────────────────────────────────

export async function upsertScan(ean, product = null) {
  const db = await getDB();
  const tx = db.transaction('scans', 'readwrite');
  const existing = await tx.store.get(ean);
  const now = Date.now();
  if (existing) {
    await tx.store.put({
      ...existing,
      count: existing.count + 1,
      lastScanned: now,
      // Enrich with product info if we didn't have it yet
      ...(product && !existing.nombre ? { nombre: product.nombre, precio: product.precio } : {}),
    });
  } else {
    await tx.store.put({
      ean,
      count: 1,
      firstScanned: now,
      lastScanned: now,
      nombre: product?.nombre ?? null,
      precio: product?.precio ?? null,
    });
  }
  await tx.done;
}

export async function getAllScans() {
  const db = await getDB();
  const all = await db.getAllFromIndex('scans', 'lastScanned');
  return all.reverse();
}

export async function deleteScan(ean) {
  const db = await getDB();
  await db.delete('scans', ean);
}

export async function clearAllScans() {
  const db = await getDB();
  await db.clear('scans');
}

export async function getCount() {
  const db = await getDB();
  return db.count('scans');
}

// ── Catalog ────────────────────────────────────────────────────────────────

export async function putCatalog(products) {
  const db = await getDB();
  const tx = db.transaction('catalog', 'readwrite');
  await tx.store.clear();
  for (const p of products) tx.store.put(p);
  await tx.done;
}

export async function lookupProduct(ean) {
  const db = await getDB();
  return (
    (await db.get('catalog', ean)) ??
    (await db.get('catalog', ean.padStart(13, '0'))) ??
    null
  );
}

export async function getCatalogCount() {
  const db = await getDB();
  return db.count('catalog');
}
