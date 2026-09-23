/* =========================================================
   db.js — thin promise wrapper over IndexedDB.
   RULE: only js/store.js imports this file. Pages never do.
   When the backend arrives, IndexedDB stays as the offline
   cache and store.js decides what goes to the server.
   ========================================================= */

const DB_NAME = "capacity-connect";
const DB_VERSION = 3;   // v2: handovers · v3: questionnaires, library, feedback, announcements

/* Every table the full product needs, defined now so later parts
   never need a schema migration. keyPath is always "id" (UUID). */
const SCHEMA = {
  users:        ["role", "stationId"],
  stations:     ["type", "parentId"],          // RMC / MC / Field Observatory hierarchy
  modules:      ["category"],
  units:        ["moduleId"],
  nominations:  ["status", "moduleId", "userId", "nominatedBy"],
  batches:      ["status", "moduleId"],
  enrollments:  ["userId", "moduleId"],
  progress:     ["userId", "unitId", "enrollmentId"],
  notes:        ["userId", "unitId"],
  discussions:  ["moduleId", "unitId"],
  confusion:    ["unitId"],                     // anonymous: no userId stored
  submissions:  ["userId", "unitId", "status"],
  certificates: ["userId", "moduleId"],
  capsules:     ["stationId"],                  // succession capsule entries
  handovers:    ["stationId", "toUserId", "status"],
  questionnaires: ["batchId", "trainerId", "moduleId"],
  responses:    ["questionnaireId", "userId"],
  library:      ["moduleId", "category", "uploaderId"],
  feedback:     ["moduleId", "userId"],
  announcements: ["type"],
  audit:        ["seq"],                        // hash-chained audit trail
  outbox:       ["status"],                     // queued ops for sync
  meta:         []                              // key-value: seed version etc.
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, indexes] of Object.entries(SCHEMA)) {
        if (db.objectStoreNames.contains(name)) continue;
        const os = db.createObjectStore(name, { keyPath: "id" });
        for (const idx of indexes) os.createIndex(idx, idx, { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Database is open in another tab with an older version. Close other tabs and reload."));
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeNames, mode = "readonly") {
  const db = await openDB();
  return db.transaction(storeNames, mode);
}

export async function get(store, id) {
  const t = await tx(store);
  return wrap(t.objectStore(store).get(id));
}

export async function getAll(store) {
  const t = await tx(store);
  return wrap(t.objectStore(store).getAll());
}

export async function getAllBy(store, index, value) {
  const t = await tx(store);
  return wrap(t.objectStore(store).index(index).getAll(value));
}

export async function count(store) {
  const t = await tx(store);
  return wrap(t.objectStore(store).count());
}

export async function put(store, record) {
  const t = await tx(store, "readwrite");
  await wrap(t.objectStore(store).put(record));
  return record;
}

export async function bulkPut(store, records) {
  const t = await tx(store, "readwrite");
  const os = t.objectStore(store);
  for (const r of records) os.put(r);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(records.length);
    t.onerror = () => reject(t.error);
  });
}

export async function remove(store, id) {
  const t = await tx(store, "readwrite");
  return wrap(t.objectStore(store).delete(id));
}

export async function clearAll() {
  const db = await openDB();
  const names = Array.from(db.objectStoreNames);
  const t = db.transaction(names, "readwrite");
  for (const n of names) t.objectStore(n).clear();
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export const STORE_NAMES = Object.keys(SCHEMA);
