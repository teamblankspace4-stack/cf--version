/* =========================================================
   services/capsule.js — succession capsules.
   "Train the post, not just the person."

   Each station keeps a capsule of working knowledge that isn't
   in any manual: equipment quirks, procedures that differ at
   this site, the seasonal and crop calendar, lessons from past
   advisories, and who to call locally. When a post turns over,
   a handover asks the incoming officer to read the must-read
   entries and acknowledge them, on the record.
   ========================================================= */

import { read, commit, getDescendantStationIds } from "../store.js";

export const CATEGORIES = [
  { key: "equipment", label: "Equipment and site", hint: "Quirks of the instruments and site that a new officer would trip over." },
  { key: "procedure", label: "Procedures that differ here", hint: "Where this station does something differently from the standard SOP, and why." },
  { key: "seasonal", label: "Seasonal and crop calendar", hint: "What changes through the year, including agromet advisories for local crops." },
  { key: "advisory", label: "Past advisories and lessons", hint: "What happened in past events and what to do differently." },
  { key: "contacts", label: "Local contacts", hint: "Offices and roles to reach. Use role titles, not personal numbers." }
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));

/** An entry nobody has confirmed for this long is flagged as possibly out of date. */
export const STALE_DAYS = 180;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const daysSince = iso => (Date.now() - new Date(iso).getTime()) / 86400000;
export const isStale = e => daysSince(e.confirmedAt || e.updatedAt) > STALE_DAYS;

/* ---------- who may do what ---------- */
async function canEdit(user, stationId) {
  if (user.role === "admin") {
    if (user.adminScope === "division") return true;
    return (await getDescendantStationIds(user.stationId)).has(stationId);
  }
  if (user.role === "trainee") {
    if (user.stationId === stationId) return true;
    // an officer being posted in can read and add from the day the handover starts
    return (await read.by("handovers", "toUserId", user.id)).some(h => h.stationId === stationId);
  }
  return user.role === "trainer";
}

/* ---------- reading ---------- */
export async function getCapsule(stationId) {
  const [entries, users] = await Promise.all([read.by("capsules", "stationId", stationId), read.all("users")]);
  const byId = new Map(users.map(u => [u.id, u]));
  return entries.filter(e => !e.deleted)
    .map(e => ({ ...e, author: byId.get(e.authorId), confirmer: e.confirmedBy ? byId.get(e.confirmedBy) : null, stale: isStale(e) }))
    .sort((a, b) => (b.mustRead - a.mustRead) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

/** Stations the user can open, with capsule health for the overview. */
export async function getCapsuleOverview(user) {
  const [stations, entries, handovers, users] = await Promise.all([
    read.all("stations"), read.all("capsules"), read.all("handovers"), read.all("users")
  ]);
  let allowed = null;
  if (user.role === "admin" && user.adminScope !== "division") allowed = await getDescendantStationIds(user.stationId);
  if (user.role === "trainee") allowed = new Set([user.stationId, ...handovers.filter(h => h.toUserId === user.id).map(h => h.stationId)]);
  const byId = new Map(users.map(u => [u.id, u]));
  return stations
    .filter(s => s.type !== "HQ" && (!allowed || allowed.has(s.id)))
    .map(s => {
      const mine = entries.filter(e => e.stationId === s.id && !e.deleted);
      const officers = users.filter(u => u.stationId === s.id && u.role === "trainee" && (!u.status || u.status === "active"));
      const open = handovers.filter(h => h.stationId === s.id && h.status === "pending")
        .map(h => ({ ...h, from: byId.get(h.fromUserId), to: byId.get(h.toUserId) }));
      const lastUpdated = mine.map(e => e.confirmedAt || e.updatedAt).sort().pop() || null;
      return {
        station: s, entries: mine.length, mustRead: mine.filter(e => e.mustRead).length,
        stale: mine.filter(isStale).length, lastUpdated, officers,
        leaving: officers.filter(o => o.transferDue), handovers: open
      };
    })
    .sort((a, b) => (b.leaving.length - a.leaving.length) || (b.handovers.length - a.handovers.length) || a.station.name.localeCompare(b.station.name));
}

/* ---------- writing entries ---------- */
export async function saveEntry(user, { id, stationId, category, title, body, mustRead }) {
  assert(await canEdit(user, stationId), "You can only add to the capsule of a station you work at or oversee.");
  assert(CATEGORY_LABEL[category], "Choose a category.");
  const t = (title || "").trim();
  const b = (body || "").trim();
  assert(t.length >= 4, "Give the entry a short title.");
  assert(b.length >= 20, "Write at least a couple of sentences so the next officer has enough to act on.");
  const station = await read.one("stations", stationId);
  return commit({
    op: id ? "edit-capsule-entry" : "add-capsule-entry", store: "capsules",
    record: { ...(id ? { id } : { authorId: user.id }), stationId, category, title: t, body: b, mustRead: !!mustRead,
      confirmedAt: new Date().toISOString(), confirmedBy: user.id },
    actorId: user.id, auditAction: id ? "edited-capsule-entry" : "added-capsule-entry",
    auditDetails: { station: station?.name, title: t }
  });
}

/** "Still accurate": keeps the capsule from going stale. */
export async function confirmEntry(user, entryId) {
  const e = await read.one("capsules", entryId);
  assert(e && await canEdit(user, e.stationId), "Not allowed.");
  return commit({
    op: "confirm-capsule-entry", store: "capsules",
    record: { id: entryId, confirmedAt: new Date().toISOString(), confirmedBy: user.id },
    actorId: user.id, audit: false
  });
}

/* ---------- handovers ---------- */
export async function startHandover(user, { stationId, fromUserId, toUserId, note }) {
  assert(user.role === "admin", "Only station heads and the Training Division start handovers.");
  assert(await canEdit(user, stationId), "That station is outside your region.");
  assert(toUserId, "Choose the incoming officer.");
  assert(fromUserId !== toUserId, "The incoming and outgoing officer must be different people.");
  const existing = (await read.by("handovers", "stationId", stationId)).find(h => h.toUserId === toUserId && h.status === "pending");
  assert(!existing, "That officer already has an open handover for this station.");
  const entries = (await getCapsule(stationId)).filter(e => e.mustRead);
  assert(entries.length, "Mark at least one capsule entry as must-read before starting a handover.");
  const [station, to, from] = await Promise.all([read.one("stations", stationId), read.one("users", toUserId), fromUserId ? read.one("users", fromUserId) : null]);
  return commit({
    op: "start-handover", store: "handovers",
    record: { stationId, fromUserId: fromUserId || null, toUserId, startedBy: user.id, status: "pending",
      note: (note || "").trim(), mustReadIds: entries.map(e => e.id), readIds: [] },
    actorId: user.id, auditAction: "started-handover",
    auditDetails: { station: station?.name, from: from?.name || null, to: to?.name, mustRead: entries.length }
  });
}

export async function getMyHandovers(user) {
  const [mine, stations, users] = await Promise.all([read.by("handovers", "toUserId", user.id), read.all("stations"), read.all("users")]);
  const sName = new Map(stations.map(s => [s.id, s]));
  const uName = new Map(users.map(u => [u.id, u]));
  return mine.map(h => ({ ...h, station: sName.get(h.stationId), from: uName.get(h.fromUserId), starter: uName.get(h.startedBy) }))
    .sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));
}

export async function markRead(user, handoverId, entryId) {
  const h = await read.one("handovers", handoverId);
  assert(h && h.toUserId === user.id, "This handover isn't addressed to you.");
  if (h.readIds.includes(entryId)) return h;
  return commit({
    op: "handover-read", store: "handovers", record: { id: h.id, readIds: [...h.readIds, entryId] },
    actorId: user.id, audit: false
  });
}

export async function acknowledgeHandover(user, handoverId) {
  const h = await read.one("handovers", handoverId);
  assert(h && h.toUserId === user.id, "This handover isn't addressed to you.");
  assert(h.status === "pending", "This handover is already complete.");
  const unread = h.mustReadIds.filter(id => !h.readIds.includes(id));
  assert(!unread.length, `Read the remaining ${unread.length} must-read entr${unread.length === 1 ? "y" : "ies"} first.`);
  const station = await read.one("stations", h.stationId);
  return commit({
    op: "acknowledge-handover", store: "handovers",
    record: { id: h.id, status: "acknowledged", acknowledgedAt: new Date().toISOString() },
    actorId: user.id, auditAction: "acknowledged-handover",
    auditDetails: { station: station?.name, entriesRead: h.mustReadIds.length }
  });
}
