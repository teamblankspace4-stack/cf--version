/* =========================================================
   services/mentoring.js — Trainer / Mentor workflows.

   - Review practical work against a rubric → competency score
     (the officer's record shows competency, not just a tick).
   - Approve → certificate issued with a verification hash.
   - Return → officer sees feedback and resubmits.
   - Answer questions left beside lessons.
   - Confusion map: aggregate only, never shown below K flags.
   ========================================================= */

import { read, commit, sha256, getUnits } from "../store.js";
import { loadContent, postToThread } from "./learning.js";

export const ANONYMITY_K = 3;   // a count is only shown once this many officers flag the same part

export const RUBRIC = [
  { key: "procedure", label: "Followed the correct procedure", hint: "Steps done in the right order, per the SOP" },
  { key: "evidence", label: "Evidence is complete and accurate", hint: "Readings, photos or products actually support the claim" },
  { key: "interpretation", label: "Correct interpretation", hint: "Identified and explained what the evidence shows" },
  { key: "record", label: "Clear record or handover", hint: "Another officer could act on what was written" }
];
export const LEVELS = [
  { value: 1, label: "Not yet" },
  { value: 2, label: "Developing" },
  { value: 3, label: "Competent" },
  { value: 4, label: "Proficient" }
];

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ---------- which batches and officers belong to this trainer ---------- */
async function trainerScope(trainer) {
  assert(trainer.role === "trainer", "Only trainers can open the mentor dashboard.");
  const batches = (await read.all("batches")).filter(b => b.trainerId === trainer.id);
  const batchIds = new Set(batches.map(b => b.id));
  const enrollments = (await read.all("enrollments")).filter(e => batchIds.has(e.batchId));
  const moduleIds = new Set(batches.map(b => b.moduleId));
  return { batches, batchIds, enrollments, moduleIds };
}

async function assertTrainerOf(trainer, enrollmentId) {
  const { enrollments } = await trainerScope(trainer);
  assert(enrollments.some(e => e.id === enrollmentId), "This officer isn't in one of your batches.");
}

/* ---------- dashboard ---------- */
export async function getMentorDashboard(trainer) {
  const scope = await trainerScope(trainer);
  const [users, stations, modules, allProgress, submissions, posts, flags, certificates] = await Promise.all([
    read.all("users"), read.all("stations"), read.all("modules"), read.all("progress"),
    read.all("submissions"), read.all("discussions"), read.all("confusion"), read.all("certificates")
  ]);
  const userById = new Map(users.map(u => [u.id, u]));
  const stationById = new Map(stations.map(s => [s.id, s]));
  const moduleById = new Map(modules.map(m => [m.id, m]));
  const enrollIds = new Set(scope.enrollments.map(e => e.id));

  // Units and content for each module this trainer teaches
  const moduleInfo = new Map();
  for (const mid of scope.moduleIds) {
    const m = moduleById.get(mid);
    moduleInfo.set(mid, { module: m, units: await getUnits(mid), content: await loadContent(m.code) });
  }
  const unitById = new Map([...moduleInfo.values()].flatMap(mi => mi.units.map(u => [u.id, { ...u, module: mi.module }])));

  /* practicals waiting for review */
  const reviews = submissions
    .filter(s => s.status === "submitted" && enrollIds.has(s.enrollmentId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(s => ({ ...s, officer: userById.get(s.userId), station: stationById.get(userById.get(s.userId)?.stationId),
      unit: unitById.get(s.unitId), module: moduleById.get(s.moduleId) }));

  /* questions: a trainee post with no mentor reply after it in the same thread */
  const questions = [];
  const byUnit = new Map();
  for (const p of posts.filter(p => scope.moduleIds.has(p.moduleId) && !p.deleted)) {
    if (!byUnit.has(p.unitId)) byUnit.set(p.unitId, []);
    byUnit.get(p.unitId).push(p);
  }
  for (const [unitId, thread] of byUnit) {
    thread.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lastMentor = [...thread].reverse().find(p => p.authorRole === "trainer");
    for (const p of thread) {
      if (p.authorRole !== "trainee") continue;
      if (lastMentor && lastMentor.createdAt > p.createdAt) continue;
      questions.push({ ...p, author: userById.get(p.authorId), unit: unitById.get(unitId), module: moduleById.get(p.moduleId),
        station: stationById.get(userById.get(p.authorId)?.stationId) });
    }
  }
  questions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /* confusion map: per module lesson, per chapter, aggregate only */
  const confusion = [];
  for (const [mid, mi] of moduleInfo) {
    const video = mi.content?.units.find(u => u.type === "video");
    const videoUnit = mi.units.find(u => u.order === 1);
    if (!video || !videoUnit) continue;
    const unitFlags = flags.filter(f => f.unitId === videoUnit.id);
    const chapters = video.chapters.map((ch, i) => {
      const n = unitFlags.filter(f => f.chapterIndex === i).length;
      return { index: i, title: ch.title, start: ch.start, count: n, visible: n >= ANONYMITY_K, some: n > 0 };
    });
    const top = chapters.filter(c => c.visible).sort((a, b) => b.count - a.count)[0] || null;
    confusion.push({ module: mi.module, unitId: videoUnit.id, total: unitFlags.length, chapters, top, max: Math.max(ANONYMITY_K, ...chapters.map(c => c.count)) });
  }

  /* batch rosters */
  const rosters = scope.batches.map(b => {
    const mi = moduleInfo.get(b.moduleId);
    const members = scope.enrollments.filter(e => e.batchId === b.id).map(e => {
      const officer = userById.get(e.userId);
      const prog = allProgress.filter(p => p.enrollmentId === e.id);
      const done = prog.filter(p => ["completed", "submitted", "reviewed"].includes(p.status)).length;
      const quizUnit = mi.units.find(u => u.type === "quiz");
      const pracUnit = mi.units.find(u => u.type === "practical");
      const quiz = quizUnit ? prog.find(p => p.unitId === quizUnit.id) : null;
      const prac = pracUnit ? prog.find(p => p.unitId === pracUnit.id) : null;
      const lastActive = prog.map(p => p.updatedAt).sort().pop() || null;
      const cert = certificates.find(c => c.userId === e.userId && c.moduleId === b.moduleId);
      return {
        enrollment: e, officer, station: stationById.get(officer?.stationId),
        done, total: mi.units.length, quizBest: quiz?.bestScore ?? null,
        practical: pracUnit ? (prac?.status || "not-started") : "none",
        competency: prac?.competencyScore ?? null, lastActive, certificate: cert || null
      };
    }).sort((a, b) => b.done - a.done || a.officer.name.localeCompare(b.officer.name));
    return { batch: b, module: mi.module, members };
  });

  return { reviews, questions, confusion, rosters, officerCount: scope.enrollments.length };
}

/* ---------- practical review ---------- */
export async function getReviewContext(trainer, submissionId) {
  const s = await read.one("submissions", submissionId);
  assert(s, "Submission not found.");
  await assertTrainerOf(trainer, s.enrollmentId);
  const [officer, module, unit] = await Promise.all([read.one("users", s.userId), read.one("modules", s.moduleId), read.one("units", s.unitId)]);
  const content = await loadContent(module.code);
  const practical = content?.units.find(u => u.order === unit.order) || null;
  const station = await read.one("stations", officer.stationId);
  const history = (await read.by("submissions", "userId", s.userId)).filter(x => x.unitId === s.unitId && x.id !== s.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { submission: s, officer, station, module, unit, practical, history };
}

export function competencyFrom(scores) {
  const vals = RUBRIC.map(r => Number(scores[r.key]));
  return Math.round(100 * vals.reduce((a, b) => a + b, 0) / (4 * RUBRIC.length));
}

export async function reviewSubmission(trainer, submissionId, { scores, feedback, decision }) {
  const s = await read.one("submissions", submissionId);
  assert(s && s.status === "submitted", "This submission was already reviewed.");
  await assertTrainerOf(trainer, s.enrollmentId);
  assert(RUBRIC.every(r => [1, 2, 3, 4].includes(Number(scores[r.key]))), "Score every rubric criterion.");
  const note = (feedback || "").trim();
  assert(note.length >= 10, "Write feedback the officer can act on (at least 10 characters).");
  assert(decision === "approve" || decision === "return", "Choose approve or return.");
  if (decision === "approve") {
    assert(RUBRIC.every(r => Number(scores[r.key]) >= 2), "A criterion is marked Not yet. Return the work for rework instead.");
  }
  const competency = competencyFrom(scores);
  const [officer, module] = await Promise.all([read.one("users", s.userId), read.one("modules", s.moduleId)]);
  const now = new Date().toISOString();

  await commit({
    op: decision === "approve" ? "approve-practical" : "return-practical", store: "submissions",
    record: { id: s.id, status: decision === "approve" ? "reviewed" : "returned", rubricScores: scores,
      competencyScore: competency, feedback: note, reviewedBy: trainer.id, reviewedAt: now },
    actorId: trainer.id, auditAction: decision === "approve" ? "approved-practical" : "returned-practical",
    auditDetails: { officer: officer.name, empId: officer.empId, module: module.code, competency }
  });

  const prog = (await read.by("progress", "userId", s.userId)).find(p => p.unitId === s.unitId && p.enrollmentId === s.enrollmentId);
  await commit({
    op: "practical-reviewed", store: "progress",
    record: { id: prog.id, status: decision === "approve" ? "reviewed" : "returned", competencyScore: competency,
      mentorFeedback: note, reviewedAt: now },
    actorId: trainer.id, audit: false
  });

  let certificate = null;
  if (decision === "approve") certificate = await maybeIssueCertificate(trainer, s.enrollmentId);
  return { competency, certificate };
}

/* ---------- certificate: issued when every unit is done and the practical approved ---------- */
async function maybeIssueCertificate(trainer, enrollmentId) {
  const e = await read.one("enrollments", enrollmentId);
  const [units, prog, existing, module, officer] = await Promise.all([
    getUnits(e.moduleId), read.by("progress", "userId", e.userId), read.all("certificates"),
    read.one("modules", e.moduleId), read.one("users", e.userId)
  ]);
  if (existing.some(c => c.userId === e.userId && c.moduleId === e.moduleId)) return null;
  const mine = prog.filter(p => p.enrollmentId === enrollmentId);
  const allDone = units.every(u => mine.some(p => p.unitId === u.id && ["completed", "reviewed"].includes(p.status)));
  if (!allDone) return null;

  const quizUnit = units.find(u => u.type === "quiz");
  const pracUnit = units.find(u => u.type === "practical");
  const quizScore = mine.find(p => p.unitId === quizUnit?.id)?.bestScore ?? null;
  const competency = mine.find(p => p.unitId === pracUnit?.id)?.competencyScore ?? null;
  // Practical competency weighs more than the quiz: doing the job matters more than recalling it.
  const score = competency != null && quizScore != null ? Math.round(0.4 * quizScore + 0.6 * competency) : (competency ?? quizScore ?? 0);

  // Continue the existing series rather than counting records, so numbers
  // never collide with certificates issued before this one.
  const year = new Date().getFullYear();
  const highest = existing.reduce((max, c) => {
    const n = Number(String(c.certNo || "").split("-").pop());
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const certNo = `CC-${year}-${String(highest + 1).padStart(6, "0")}`;
  const issuedAt = new Date().toISOString();
  const verifyHash = await sha256(`${certNo}|${officer.empId}|${module.code}|${issuedAt}|${score}`);

  const cert = await commit({
    op: "issue-certificate", store: "certificates",
    record: { userId: e.userId, moduleId: e.moduleId, enrollmentId, certNo, issuedAt, score, quizScore, competencyScore: competency,
      issuedBy: trainer.id, verifyHash },
    actorId: trainer.id, auditAction: "issued-certificate",
    auditDetails: { officer: officer.name, empId: officer.empId, module: module.code, certNo, score }
  });
  await commit({ op: "complete-enrollment", store: "enrollments", record: { id: e.id, status: "completed", completedAt: issuedAt },
    actorId: trainer.id, audit: false });
  return cert;
}

/* ---------- answering questions ---------- */
export async function replyToQuestion(trainer, question, text) {
  const { moduleIds } = await trainerScope(trainer);
  assert(moduleIds.has(question.moduleId), "You can only answer questions in modules you teach.");
  return postToThread(trainer, { id: question.unitId, title: question.unit?.title || "" }, question.moduleId, text, null);
}

/* ---------- clarification posted to the whole batch ----------
   Lets the mentor answer a confusion hotspot at the exact moment
   of the lesson, without knowing who flagged it. */
export async function postClarification(trainer, { moduleId, unitId, atSecond, chapterTitle, count }, text) {
  const { moduleIds } = await trainerScope(trainer);
  assert(moduleIds.has(moduleId), "You can only post in modules you teach.");
  const body = (text || "").trim();
  assert(body.length >= 10, "Write the clarification in at least 10 characters.");
  return commit({
    op: "post-discussion", store: "discussions",
    record: { moduleId, unitId, authorId: trainer.id, authorRole: "trainer", text: body, atSecond, clarification: true },
    actorId: trainer.id, auditAction: "posted-clarification",
    auditDetails: { chapter: chapterTitle, flags: count }
  });
}
