/* =========================================================
   services/training.js — nomination → approval → batch →
   enrollment workflow (IMD officer feedback: staff don't
   self-enrol; station heads nominate, Training Division
   approves the batch).

   Permission checks live HERE, not in the pages, so the
   same rules move to the server in Phase B.
   ========================================================= */

import { read, commit, getModules, getDescendantStationIds } from "../store.js";

/* ---------- roles ---------- */
export const isDivision = u => u && u.role === "admin" && u.adminScope === "division";
export const isStationHead = u => u && u.role === "admin" && u.adminScope === "station";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/* ---------- lookups ---------- */
export async function getLookup() {
  const [users, stations, modules, batches, categories] = await Promise.all([
    read.all("users"), read.all("stations"), getModules(), read.all("batches"),
    read.one("meta", "categories")
  ]);
  const map = arr => new Map(arr.map(x => [x.id, x]));
  return {
    users: map(users), stations: map(stations), modules: map(modules), batches: map(batches),
    userList: users, stationList: stations, moduleList: modules,
    categories: categories ? categories.value : []
  };
}

export function categoryLabel(lookup, key) {
  const c = lookup.categories.find(x => x.key === key);
  return c ? c.label : key;
}

/* ---------- who can be nominated ---------- */
/**
 * Trainees inside the actor's jurisdiction, each with a status for
 * the chosen module: available | pending | enrolled | certified.
 */
export async function getNominationCandidates(actor, moduleId) {
  assert(isStationHead(actor) || isDivision(actor), "Only station heads and the Training Division can nominate.");
  const scope = isDivision(actor) ? null : await getDescendantStationIds(actor.stationId);
  const [users, noms, enrolls, certs, stations] = await Promise.all([
    read.all("users"), read.all("nominations"), read.all("enrollments"), read.all("certificates"), read.all("stations")
  ]);
  const stationName = new Map(stations.map(s => [s.id, s.name]));

  return users
    .filter(u => u.role === "trainee" && isActiveUser(u) && (!scope || scope.has(u.stationId)))
    .map(u => {
      let status = "available";
      if (certs.some(c => c.userId === u.id && c.moduleId === moduleId)) status = "certified";
      else if (enrolls.some(e => e.userId === u.id && e.moduleId === moduleId && e.status === "active")) status = "enrolled";
      else if (noms.some(n => n.userId === u.id && n.moduleId === moduleId && n.status === "pending")) status = "pending";
      return { ...u, stationName: stationName.get(u.stationId) || "", status };
    })
    .sort((a, b) => a.stationName.localeCompare(b.stationName) || a.name.localeCompare(b.name));
}

/* ---------- nominate ---------- */
export async function nominate(actor, { userIds, moduleId, reason }) {
  assert(isStationHead(actor) || isDivision(actor), "Only station heads and the Training Division can nominate.");
  assert(moduleId, "Choose a module.");
  assert(userIds && userIds.length, "Select at least one officer.");
  const why = (reason || "").trim();
  assert(why.length >= 10, "Add a reason of at least 10 characters so the Training Division can prioritise.");

  const module = await read.one("modules", moduleId);
  const candidates = await getNominationCandidates(actor, moduleId);
  const created = [];
  const skipped = [];
  for (const uid of userIds) {
    const c = candidates.find(x => x.id === uid);
    if (!c || c.status !== "available") { skipped.push(c ? c.name : uid); continue; }
    const rec = await commit({
      op: "nominate",
      store: "nominations",
      record: { userId: uid, moduleId, nominatedBy: actor.id, status: "pending", batchId: null, reason: why },
      actorId: actor.id,
      auditAction: "nominated-officer",
      auditDetails: { officer: c.name, empId: c.empId, module: module.code, reason: why }
    });
    created.push(rec);
  }
  return { created, skipped };
}

/* ---------- read nominations ---------- */
export async function getNominationsFor(actor) {
  assert(actor.role === "admin", "Not allowed.");
  const [noms, lookup] = await Promise.all([read.all("nominations"), getLookup()]);
  let visible = noms;
  if (isStationHead(actor)) {
    const scope = await getDescendantStationIds(actor.stationId);
    visible = noms.filter(n => n.nominatedBy === actor.id || scope.has(lookup.users.get(n.userId)?.stationId));
  }
  return visible
    .map(n => ({
      ...n,
      officer: lookup.users.get(n.userId),
      module: lookup.modules.get(n.moduleId),
      nominator: lookup.users.get(n.nominatedBy),
      station: lookup.stations.get(lookup.users.get(n.userId)?.stationId),
      batch: n.batchId ? lookup.batches.get(n.batchId) : null
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- trainers and batches ---------- */
export async function getTrainersFor(category) {
  // Ranked by the competency map: declared expertise plus evidence of teaching.
  const users = (await read.all("users")).filter(u => u.role === "trainer" && isActiveUser(u));
  const { findTrainers } = await import("./reports.js");
  const cells = new Map((await findTrainers(category)).map(r => [r.trainer.id, r.cell]));
  return users
    .map(u => ({ ...u, matches: (u.expertise || []).includes(category), competency: cells.get(u.id) || null }))
    .sort((a, b) => (b.competency?.score || 0) - (a.competency?.score || 0) || a.name.localeCompare(b.name));
}

export async function getBatchesForModule(moduleId) {
  return (await read.by("batches", "moduleId", moduleId))
    .filter(b => b.status === "approved")
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function getAllBatches() {
  const [batches, enrolls, lookup] = await Promise.all([read.all("batches"), read.all("enrollments"), getLookup()]);
  return batches
    .map(b => ({
      ...b,
      module: lookup.modules.get(b.moduleId),
      trainer: lookup.users.get(b.trainerId),
      size: enrolls.filter(e => e.batchId === b.id).length
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function batchName(module, startDate) {
  const d = new Date(startDate + "T00:00:00");
  const month = d.toLocaleString("en-IN", { month: "long" });
  return `${module.code} · ${month} ${d.getFullYear()} batch`;
}

/* ---------- approve / reject (Training Division only) ---------- */
export async function approveNominations(actor, { nominationIds, batchId, newBatch }) {
  assert(isDivision(actor), "Only the Training Division can approve nominations.");
  assert(nominationIds && nominationIds.length, "Select at least one nomination.");

  const noms = await Promise.all(nominationIds.map(id => read.one("nominations", id)));
  assert(noms.every(n => n && n.status === "pending"), "One or more nominations were already decided. Refresh and try again.");
  const moduleId = noms[0].moduleId;
  assert(noms.every(n => n.moduleId === moduleId), "Approve one module at a time.");
  const module = await read.one("modules", moduleId);

  let batch;
  if (batchId) {
    batch = await read.one("batches", batchId);
    assert(batch && batch.moduleId === moduleId, "That batch is for a different module.");
  } else {
    assert(newBatch && newBatch.startDate, "Choose a start date for the new batch.");
    assert(newBatch.trainerId, "Assign a trainer to the new batch.");
    batch = await commit({
      op: "create-batch",
      store: "batches",
      record: {
        moduleId, name: batchName(module, newBatch.startDate), status: "approved",
        approvedBy: actor.id, approvedAt: new Date().toISOString(),
        startDate: newBatch.startDate, trainerId: newBatch.trainerId
      },
      actorId: actor.id,
      auditAction: "created-batch",
      auditDetails: { module: module.code, startDate: newBatch.startDate }
    });
  }

  const users = await read.all("users");
  for (const n of noms) {
    const officer = users.find(u => u.id === n.userId);
    await commit({
      op: "approve-nomination",
      store: "nominations",
      record: { id: n.id, status: "approved", batchId: batch.id, decidedBy: actor.id, decidedAt: new Date().toISOString() },
      actorId: actor.id,
      auditAction: "approved-nomination",
      auditDetails: { officer: officer?.name, empId: officer?.empId, module: module.code, batch: batch.name }
    });
    await commit({
      op: "enroll",
      store: "enrollments",
      record: { userId: n.userId, moduleId, batchId: batch.id, status: "active", source: "nomination", nominationId: n.id },
      actorId: actor.id,
      auditAction: "enrolled-officer",
      auditDetails: { officer: officer?.name, module: module.code, batch: batch.name }
    });
  }
  return batch;
}

export async function rejectNomination(actor, { nominationId, reason }) {
  assert(isDivision(actor), "Only the Training Division can reject nominations.");
  const why = (reason || "").trim();
  assert(why.length >= 5, "Give the station head a reason, so they know what to change.");
  const n = await read.one("nominations", nominationId);
  assert(n && n.status === "pending", "This nomination was already decided.");
  const [officer, module] = await Promise.all([read.one("users", n.userId), read.one("modules", n.moduleId)]);
  return commit({
    op: "reject-nomination",
    store: "nominations",
    record: { id: n.id, status: "rejected", decisionNote: why, decidedBy: actor.id, decidedAt: new Date().toISOString() },
    actorId: actor.id,
    auditAction: "rejected-nomination",
    auditDetails: { officer: officer?.name, module: module?.code, reason: why }
  });
}

/* ---------- trainee and trainer views ---------- */
export async function getTraineeOverview(user) {
  const [enrolls, noms, certs, lookup] = await Promise.all([
    read.by("enrollments", "userId", user.id),
    read.by("nominations", "userId", user.id),
    read.by("certificates", "userId", user.id),
    getLookup()
  ]);
  return {
    enrollments: enrolls.map(e => {
      const batch = lookup.batches.get(e.batchId);
      return { ...e, module: lookup.modules.get(e.moduleId), batch, trainer: batch ? lookup.users.get(batch.trainerId) : null };
    }).sort((a, b) => (b.batch?.startDate || "").localeCompare(a.batch?.startDate || "")),
    nominations: noms.filter(n => n.status !== "approved").map(n => ({
      ...n, module: lookup.modules.get(n.moduleId), nominator: lookup.users.get(n.nominatedBy)
    })),
    certificates: certs.map(c => ({ ...c, module: lookup.modules.get(c.moduleId) })),
    lookup
  };
}

export async function getTrainerOverview(user) {
  const all = await getAllBatches();
  return all.filter(b => b.trainerId === user.id);
}

/* =========================================================
   Course catalogue and enrolment requests (PS: "enroll in
   courses"). A trainee's request joins the same approval queue
   as a station head's nomination, so approval rules still apply.
   ========================================================= */
export const isActiveUser = u => !u.status || u.status === "active";

export async function getCatalog(user) {
  const [modules, noms, enrolls, certs, content] = await Promise.all([
    getModules(), read.by("nominations", "userId", user.id), read.by("enrollments", "userId", user.id),
    read.by("certificates", "userId", user.id), read.one("meta", "categories")
  ]);
  return {
    categories: content ? content.value : [],
    modules: modules.map(m => {
      let status = "available";
      if (certs.some(c => c.moduleId === m.id)) status = "certified";
      else if (enrolls.some(e => e.moduleId === m.id && e.status === "active")) status = "enrolled";
      else if (enrolls.some(e => e.moduleId === m.id && e.status === "completed")) status = "certified";
      else if (noms.some(n => n.moduleId === m.id && n.status === "pending")) status = "requested";
      const rejected = noms.filter(n => n.moduleId === m.id && n.status === "rejected").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const enrollment = enrolls.find(e => e.moduleId === m.id);
      return { ...m, status, rejectedNote: status === "available" && rejected ? rejected.decisionNote : null, enrollmentId: enrollment?.id || null };
    })
  };
}

export async function requestEnrollment(user, { moduleId, reason }) {
  assert(user.role === "trainee", "Only trainees request enrolment.");
  const why = (reason || "").trim();
  assert(why.length >= 10, "Say briefly why you need this module (at least 10 characters).");
  const { modules } = await getCatalog(user);
  const m = modules.find(x => x.id === moduleId);
  assert(m, "Module not found.");
  assert(m.status === "available", m.status === "requested" ? "You've already requested this module." : "You're already enrolled in or certified for this module.");
  return commit({
    op: "request-enrollment", store: "nominations",
    record: { userId: user.id, moduleId, nominatedBy: user.id, selfRequested: true, status: "pending", batchId: null, reason: why },
    actorId: user.id, auditAction: "requested-enrollment", auditDetails: { module: m.code, reason: why }
  });
}
