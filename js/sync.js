/* =========================================================
   sync.js — drains the outbox when the device is online.

   PROTOTYPE: pushToServer() simulates a server round-trip.
   PHASE B:   replace pushToServer() with a real API call
              (e.g. Supabase insert/upsert). Nothing else here
              changes — the outbox already stores operations.
   ========================================================= */

import { getOutbox, markSynced, onChange } from "./store.js";
import { setConnectionBanner } from "./ui.js";

let running = false;
let cameFromOffline = !navigator.onLine;   // only announce syncing after a real reconnect
const listeners = new Set();

export function onSyncState(fn) { listeners.add(fn); }
function notify(state) { listeners.forEach(fn => fn(state)); }

async function pushToServer(op) {
  // Simulated latency of a low-bandwidth field connection.
  await new Promise(r => setTimeout(r, 350));
  if (!navigator.onLine) throw new Error("offline");
  return { ok: true, id: op.id };
}

export async function pendingCount() {
  return (await getOutbox()).filter(o => o.status === "pending").length;
}

export async function flush() {
  if (running || !navigator.onLine) return;
  const pending = (await getOutbox()).filter(o => o.status === "pending");
  if (!pending.length) {
    if (cameFromOffline) { setConnectionBanner("online"); cameFromOffline = false; }
    return;
  }
  running = true;
  const announce = cameFromOffline;
  if (announce) setConnectionBanner("syncing", pending.length);
  notify({ state: "syncing", pending: pending.length });
  try {
    for (const op of pending) {
      await pushToServer(op);
      await markSynced(op.id);
    }
    if (announce) setConnectionBanner("synced");
    cameFromOffline = false;
    notify({ state: "synced", pending: 0 });
  } catch {
    cameFromOffline = true;
    const left = await pendingCount();
    setConnectionBanner("offline", left);
    notify({ state: "offline", pending: left });
  } finally {
    running = false;
  }
}

export function startSync() {
  window.addEventListener("offline", async () => {
    cameFromOffline = true;
    const n = await pendingCount();
    setConnectionBanner("offline", n);
    notify({ state: "offline", pending: n });
  });
  window.addEventListener("online", () => flush());

  // A change made while offline updates the banner's pending count.
  onChange(async () => {
    if (!navigator.onLine) {
      const n = await pendingCount();
      setConnectionBanner("offline", n);
      notify({ state: "offline", pending: n });
    } else {
      flush();
    }
  });

  if (navigator.onLine) flush();
  else pendingCount().then(n => { setConnectionBanner("offline", n); notify({ state: "offline", pending: n }); });

  setInterval(() => flush(), 20000);
}
