/* =========================================================
   services/coverage.js — skill coverage and single points of
   failure across the station hierarchy.

   A station needs a skill because of what it operates: a radar
   station needs radar-certified officers, an aerodrome office
   needs aviation. Coverage counts officers who hold that skill
   at that station, and flags:
     critical  — nobody at the station holds the skill
     single    — exactly one officer holds it (a transfer, leave
                 or retirement leaves the station uncovered)
   ========================================================= */

import { read, getDescendantStationIds, getModules } from "../store.js";
import { isDivision, isStationHead, getBatchesForModule, getTrainersFor } from "./training.js";

/** Which facility at a station implies which skill. */
export const FACILITY_SKILL = {
  AWS: "aws",
  Radar: "radar",
  Satellite: "satellite",
  Aviation: "aviation"
};

export const SKILL_LABEL = {
  aws: "AWS and surface instruments",
  radar: "Radar",
  satellite: "Satellite data analysis",
  aviation: "Aviation meteorology"
};

export const RISK = {
  critical: { label: "No cover", pill: "danger", rank: 0 },
  single: { label: "Single point of failure", pill: "warn", rank: 1 },
  ok: { label: "Covered", pill: "ok", rank: 2 }
};

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Officers at a station holding a skill, from certifications or issued certificates. */
function holdersOf(skill, officers, certsByUser, moduleById) {
  return officers.filter(o => {
    if ((o.certifications || []).includes(skill)) return true;
    return (certsByUser.get(o.id) || []).some(c => moduleById.get(c.moduleId)?.category === skill);
  });
}

/**
 * Coverage rows for every station in scope that needs a skill.
 * stationId narrows to one branch of the hierarchy (RMC, MC or observatory).
 */
export async function getCoverage(actor, { stationId = null } = {}) {
  assert(actor.role === "admin", "Only administrators can see skill coverage.");
  const [stations, users, certificates, modules, enrollments, nominations] = await Promise.all([
    read.all("stations"), read.all("users"), read.all("certificates"), getModules(),
    read.all("enrollments"), read.all("nominations")
  ]);
  const moduleById = new Map(modules.map(m => [m.id, m]));
  const stationById = new Map(stations.map(s => [s.id, s]));

  const certsByUser = new Map();
  for (const c of certificates) {
    if (!certsByUser.has(c.userId)) certsByUser.set(c.userId, []);
    certsByUser.get(c.userId).push(c);
  }

  // jurisdiction: the whole department, or a station head's own branch
  let allowed = null;
  if (isStationHead(actor)) allowed = await getDescendantStationIds(actor.stationId);
  let inScope = stations.filter(s => s.type !== "HQ" && (!allowed || allowed.has(s.id)));
  if (stationId) {
    const branch = await getDescendantStationIds(stationId);
    inScope = inScope.filter(s => branch.has(s.id));
  }

  const rows = [];
  let unstaffed = 0;
  for (const station of inScope) {
    const officers = users.filter(u => u.stationId === station.id && u.role === "trainee" && (!u.status || u.status === "active"));
    // A station with no officers on record is missing data, not a skill gap.
    if (!officers.length) { unstaffed += 1; continue; }
    for (const facility of station.facilities || []) {
      const skill = FACILITY_SKILL[facility];
      if (!skill) continue;
      const holders = holdersOf(skill, officers, certsByUser, moduleById);
      const level = holders.length === 0 ? "critical" : holders.length === 1 ? "single" : "ok";
      // someone already being trained for this skill softens the risk
      const inTraining = officers.filter(o =>
        enrollments.some(e => e.userId === o.id && e.status === "active" && moduleById.get(e.moduleId)?.category === skill) ||
        nominations.some(n => n.userId === o.id && n.status === "pending" && moduleById.get(n.moduleId)?.category === skill));
      rows.push({
        station, parent: station.parentId ? stationById.get(station.parentId) : null,
        skill, facility, holders, level, inTraining,
        leavingSoon: holders.filter(h => h.transferDue),
        officerCount: officers.length
      });
    }
  }

  rows.sort((a, b) =>
    RISK[a.level].rank - RISK[b.level].rank ||
    a.station.name.localeCompare(b.station.name) ||
    a.skill.localeCompare(b.skill));

  const summary = {
    critical: rows.filter(r => r.level === "critical").length,
    single: rows.filter(r => r.level === "single").length,
    ok: rows.filter(r => r.level === "ok").length,
    stations: inScope.length - unstaffed,
    unstaffed
  };
  return { rows, summary };
}

/** Officers who could be trained as the backup for this station and skill. */
export async function getBackupCandidates(row) {
  const [users, stations, enrollments, nominations, modules] = await Promise.all([
    read.all("users"), read.all("stations"), read.all("enrollments"), read.all("nominations"), getModules()
  ]);
  const moduleById = new Map(modules.map(m => [m.id, m]));
  const stationName = new Map(stations.map(s => [s.id, s.name]));
  const holderIds = new Set(row.holders.map(h => h.id));

  // Officers at the station first, then the parent station's own officers.
  const stationIds = [row.station.id, row.station.parentId].filter(Boolean);
  return users
    .filter(u => u.role === "trainee" && (!u.status || u.status === "active") && stationIds.includes(u.stationId) && !holderIds.has(u.id))
    .map(u => {
      const busy = enrollments.some(e => e.userId === u.id && e.status === "active" && moduleById.get(e.moduleId)?.category === row.skill)
        || nominations.some(n => n.userId === u.id && n.status === "pending" && moduleById.get(n.moduleId)?.category === row.skill);
      return {
        ...u, stationName: stationName.get(u.stationId) || "",
        sameStation: u.stationId === row.station.id, busy
      };
    })
    .sort((a, b) => (b.sameStation - a.sameStation) || (a.busy - b.busy) || a.name.localeCompare(b.name));
}

/** Foundation module first: a backup officer starts at the beginning. */
export async function getSkillModules(skill) {
  return (await getModules()).filter(m => m.category === skill)
    .sort((a, b) => (a.level === "Foundation" ? -1 : 1) - (b.level === "Foundation" ? -1 : 1) || a.order - b.order);
}

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/**
 * One click from an alert to a trained backup.
 * Training Division: nominates AND approves into a batch straight away.
 * Station head: raises the nomination for the Division to approve.
 */
export async function assignBackupTraining(actor, { row, userId, moduleId }) {
  assert(isDivision(actor) || isStationHead(actor), "Not allowed.");
  const { nominate, approveNominations } = await import("./training.js");
  const reason = `Backup cover for ${SKILL_LABEL[row.skill]} at ${row.station.name}` +
    (row.level === "critical" ? ", which currently has no certified officer." : ", which depends on one certified officer.");

  const { created, skipped } = await nominate(actor, { userIds: [userId], moduleId, reason });
  assert(created.length, `${skipped[0] || "That officer"} is already nominated or trained for this skill.`);

  if (!isDivision(actor)) return { nomination: created[0], batch: null, approved: false };

  const open = await getBatchesForModule(moduleId);
  const upcoming = open.find(b => b.startDate >= new Date().toISOString().slice(0, 10)) || open[0];
  const module = (await getModules()).find(m => m.id === moduleId);
  const trainers = await getTrainersFor(module.category);
  const batch = await approveNominations(actor, {
    nominationIds: [created[0].id],
    batchId: upcoming ? upcoming.id : null,
    newBatch: upcoming ? null : { startDate: nextMonday(), trainerId: trainers[0]?.id }
  });
  return { nomination: created[0], batch, approved: true };
}
