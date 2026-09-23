/* =========================================================
   store.js — THE data layer. Every page talks to this file,
   never to IndexedDB directly.

   Backend-ready rules baked in:
   1. Every record gets a UUID (no auto-increment collisions).
   2. Every record carries createdAt / updatedAt / version.
   3. Every change is queued in the outbox as an OPERATION
      ("nominate", "approve-batch" ...) — what a sync API eats.
   4. Every change appends to a SHA-256 hash-chained audit log.

   Phase B: swap the internals of commit() and the read
   functions to call the server; pages don't change.
   ========================================================= */

import * as db from "./db.js";

/* ---------- utilities ---------- */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // fallback for older browsers
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

export const now = () => new Date().toISOString();

export async function sha256(text) {
  if (!crypto.subtle) throw new Error("Secure context required: open the app via https:// or http://localhost");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Stamp a new record with the backend-ready fields. */
export function stamp(record) {
  const t = now();
  return { id: record.id || uuid(), createdAt: t, updatedAt: t, version: 1, ...record };
}

/* ---------- change events (pages re-render on these) ---------- */
const bus = new EventTarget();
export function onChange(fn) {
  bus.addEventListener("change", e => fn(e.detail));
}
function emit(detail) {
  bus.dispatchEvent(new CustomEvent("change", { detail }));
}

/* ---------- audit trail (hash chained, tamper evident) ---------- */
let auditQueue = Promise.resolve();   // serialise writes so the chain never forks

export function appendAudit({ actorId, action, entity, entityId, details = {} }) {
  auditQueue = auditQueue.then(async () => {
    const entries = await db.getAll("audit");
    const last = entries.sort((a, b) => b.seq - a.seq)[0];
    const seq = last ? last.seq + 1 : 1;
    const prevHash = last ? last.hash : "GENESIS";
    const at = now();
    const body = JSON.stringify({ seq, at, actorId, action, entity, entityId, details, prevHash });
    const hash = await sha256(body);
    return db.put("audit", { id: uuid(), seq, at, actorId, action, entity, entityId, details, prevHash, hash });
  });
  return auditQueue;
}

/** Re-computes every hash. Returns { ok, checked, brokenAt }. */
export async function verifyAuditChain() {
  const entries = (await db.getAll("audit")).sort((a, b) => a.seq - b.seq);
  let prevHash = "GENESIS";
  for (const e of entries) {
    const body = JSON.stringify({ seq: e.seq, at: e.at, actorId: e.actorId, action: e.action,
      entity: e.entity, entityId: e.entityId, details: e.details, prevHash: e.prevHash });
    const expected = await sha256(body);
    if (e.prevHash !== prevHash || e.hash !== expected) {
      return { ok: false, checked: entries.length, brokenAt: e.seq };
    }
    prevHash = e.hash;
  }
  return { ok: true, checked: entries.length, brokenAt: null };
}

export async function getAudit() {
  return (await db.getAll("audit")).sort((a, b) => b.seq - a.seq);
}

/* ---------- outbox ---------- */
async function enqueue(op, entity, entityId, payload) {
  await db.put("outbox", { id: uuid(), op, entity, entityId, payload, status: "pending", createdAt: now(), syncedAt: null });
}

export async function getOutbox() {
  return (await db.getAll("outbox")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function markSynced(opId) {
  const item = await db.get("outbox", opId);
  if (!item) return;
  item.status = "synced";
  item.syncedAt = now();
  await db.put("outbox", item);
}

/* ---------- the one write path ----------
   Every domain action in later parts calls commit(). */
export async function commit({ op, store, record, actorId, auditAction, auditDetails = {}, audit = true, outboxPayload = null }) {
  let saved;
  const existing = record.id ? await db.get(store, record.id) : null;
  if (existing) {
    saved = { ...existing, ...record, updatedAt: now(), version: (existing.version || 1) + 1 };
  } else {
    saved = stamp(record);
  }
  await db.put(store, saved);
  // Large records (uploaded files) queue a light payload; the file itself syncs separately.
  await enqueue(op, store, saved.id, outboxPayload ? { ...outboxPayload, id: saved.id } : saved);
  if (audit) await appendAudit({ actorId, action: auditAction || op, entity: store, entityId: saved.id, details: auditDetails });
  emit({ op, store, id: saved.id });
  return saved;
}

/* ---------- generic reads (used by later parts) ---------- */
export const read = {
  one: (store, id) => db.get(store, id),
  all: (store) => db.getAll(store),
  by: (store, index, value) => db.getAllBy(store, index, value),
  count: (store) => db.count(store)
};

/* ---------- domain reads available from Part 0 ---------- */
export async function getStations() {
  return db.getAll("stations");
}

/** Builds RMC → MC → Field Observatory tree for filters. */
export async function getStationTree() {
  const all = await db.getAll("stations");
  const byParent = new Map();
  for (const s of all) {
    const key = s.parentId || "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(s);
  }
  const build = parentKey => (byParent.get(parentKey) || [])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => ({ ...s, children: build(s.id) }));
  return build("root");
}

/** All station ids at or below a given station (for "filter by RMC"). */
export async function getDescendantStationIds(stationId) {
  const all = await db.getAll("stations");
  const ids = new Set([stationId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of all) {
      if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) { ids.add(s.id); grew = true; }
    }
  }
  return ids;
}

export async function getModules() {
  return (await db.getAll("modules")).sort((a, b) => a.order - b.order);
}

export async function getUnits(moduleId) {
  return (await db.getAllBy("units", "moduleId", moduleId)).sort((a, b) => a.order - b.order);
}

export async function getUsers() {
  return db.getAll("users");
}

export async function getUser(id) {
  return db.get("users", id);
}

/* ---------- meta ---------- */
export async function getMeta(key) {
  const row = await db.get("meta", key);
  return row ? row.value : undefined;
}
export async function setMeta(key, value) {
  return db.put("meta", { id: key, value });
}

/* ---------- counts for the system check page ---------- */
export async function getCounts() {
  const out = {};
  for (const name of db.STORE_NAMES) {
    if (name === "meta") continue;
    out[name] = await db.count(name);
  }
  return out;
}

/* ---------- seeding and reset ---------- */
export async function ensureSeeded() {
  const { SEED_VERSION, buildSeed } = await import("./seed.js");
  const current = await getMeta("seedVersion");
  if (current === SEED_VERSION) return false;
  await db.clearAll();
  const data = await buildSeed(sha256);
  for (const [store, rows] of Object.entries(data)) {
    await db.bulkPut(store, rows);
  }
  await setMeta("seedVersion", SEED_VERSION);
  await appendAudit({ actorId: "system", action: "seed-demo-data", entity: "system", entityId: SEED_VERSION });
  emit({ op: "seed" });
  return true;
}

export async function resetDemoData() {
  await db.clearAll();
  return ensureSeeded();
}
