/* =========================================================
   services/reports.js — admin dashboards (PS: monitoring courses,
   enrollments, certifications, assessments and participation),
   the trainer competency map (PS: "competency mapping for
   identifying suitable trainers"), and the APAR training report.
   ========================================================= */

import { read, getModules, getAudit, verifyAuditChain, getDescendantStationIds } from "../store.js";
import { isDivision, isStationHead, isActiveUser } from "./training.js";
import { LEVELS } from "./mentoring.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const monthKey = iso => (iso || "").slice(0, 7);

/* ---------- admin statistics ---------- */
export async function getStats(actor) {
  assert(actor.role === "admin", "Only administrators see reports.");
  const [users, modules, enrolls, certs, progress, questionnaires, responses, noms, stations, feedback, categories, discussions, submissions] = await Promise.all([
    read.all("users"), getModules(), read.all("enrollments"), read.all("certificates"), read.all("progress"),
    read.all("questionnaires"), read.all("responses"), read.all("nominations"), read.all("stations"), read.all("feedback"),
    read.one("meta", "categories"), read.all("discussions"), read.all("submissions")
  ]);
  let scope = null;
  if (isStationHead(actor)) scope = await getDescendantStationIds(actor.stationId);
  const trainees = users.filter(u => u.role === "trainee" && isActiveUser(u) && (!scope || scope.has(u.stationId)));
  const tIds = new Set(trainees.map(t => t.id));
  const E = enrolls.filter(e => tIds.has(e.userId));
  const C = certs.filter(c => tIds.has(c.userId));
  const P = progress.filter(p => tIds.has(p.userId));
  const R = responses.filter(r => tIds.has(r.userId));
  const quiz = P.filter(p => p.attempts);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  // Participation counts any learning activity: lesson progress, questionnaires,
  // practical submissions, discussion posts and course feedback.
  const activeRecently = new Set([
    ...P.filter(p => (p.updatedAt || "") >= cutoff).map(p => p.userId),
    ...R.filter(r => (r.submittedAt || r.createdAt || "") >= cutoff).map(r => r.userId),
    ...submissions.filter(x => tIds.has(x.userId) && (x.createdAt || "") >= cutoff).map(x => x.userId),
    ...discussions.filter(d => tIds.has(d.authorId) && (d.createdAt || "") >= cutoff).map(d => d.authorId),
    ...feedback.filter(f => tIds.has(f.userId) && (f.updatedAt || "") >= cutoff).map(f => f.userId)
  ]);
  const cats = categories ? categories.value : [];

  // participation by Regional Met Centre
  const sById = new Map(stations.map(s => [s.id, s]));
  const rmcOf = sid => { let s = sById.get(sid); while (s && s.parentId) s = sById.get(s.parentId); return s; };
  const byRmc = new Map();
  for (const t of trainees) {
    const r = rmcOf(t.stationId); if (!r || r.type !== "RMC") continue;
    if (!byRmc.has(r.id)) byRmc.set(r.id, { name: r.name, officers: 0, enrolled: 0, certified: 0 });
    const row = byRmc.get(r.id); row.officers++;
    if (E.some(e => e.userId === t.id)) row.enrolled++;
    if (C.some(c => c.userId === t.id)) row.certified++;
  }

  return {
    headline: {
      officers: trainees.length,
      modules: modules.length,
      enrollments: E.length,
      activeEnrollments: E.filter(e => e.status === "active").length,
      certifications: C.length,
      certsThisMonth: C.filter(c => monthKey(c.issuedAt) === thisMonth).length,
      pendingRequests: noms.filter(n => n.status === "pending" && tIds.has(n.userId)).length,
      pendingAccounts: isDivision(actor) ? users.filter(u => u.status === "pending").length : null,
      participation: pct(activeRecently.size, trainees.length),
      enrolledShare: pct(new Set(E.map(e => e.userId)).size, trainees.length)
    },
    assessments: {
      quizAttempts: quiz.reduce((a, p) => a + p.attempts, 0),
      quizPassRate: pct(quiz.filter(p => (p.bestScore || 0) >= 70).length, quiz.length),
      quizAvg: quiz.length ? Math.round(quiz.reduce((a, p) => a + (p.bestScore || 0), 0) / quiz.length) : null,
      questionnaires: questionnaires.filter(q => !q.deleted).length,
      responses: R.length,
      questionnaireAvg: R.length ? Math.round(R.reduce((a, r) => a + r.score, 0) / R.length) : null
    },
    byModule: modules.map(m => {
      const me = E.filter(e => e.moduleId === m.id);
      const fb = feedback.filter(f => f.moduleId === m.id);
      return { module: m, enrolled: me.length, completed: me.filter(e => e.status === "completed").length,
        certified: C.filter(c => c.moduleId === m.id).length,
        rating: fb.length ? Math.round(10 * fb.reduce((a, f) => a + f.rating, 0) / fb.length) / 10 : null, ratings: fb.length };
    }),
    byCategory: cats.map(c => ({ ...c, certified: C.filter(x => modules.find(m => m.id === x.moduleId)?.category === c.key).length,
      enrolled: E.filter(x => modules.find(m => m.id === x.moduleId)?.category === c.key).length })),
    byRmc: [...byRmc.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}

/* ---------- trainer competency map ---------- */
export async function getTrainerCompetency() {
  const [users, batches, submissions, feedback, discussions, categories] = await Promise.all([
    read.all("users"), read.all("batches"), read.all("submissions"), read.all("feedback"), read.all("discussions"), read.one("meta", "categories")
  ]);
  const cats = categories ? categories.value : [];
  const modules = await getModules();
  const catOf = mid => modules.find(m => m.id === mid)?.category;
  const trainers = users.filter(u => u.role === "trainer" && isActiveUser(u));
  const rows = trainers.map(t => {
    const cells = cats.map(c => {
      const expert = (t.expertise || []).includes(c.key);
      const certified = (t.certifications || []).includes(c.key);
      const taught = batches.filter(b => b.trainerId === t.id && catOf(b.moduleId) === c.key);
      const reviews = submissions.filter(s => s.reviewedBy === t.id && catOf(s.moduleId) === c.key).length;
      const answers = discussions.filter(d => d.authorId === t.id && d.authorRole === "trainer" && catOf(d.moduleId) === c.key).length;
      const fb = feedback.filter(f => taught.some(b => b.moduleId === f.moduleId));
      const rating = fb.length ? fb.reduce((a, f) => a + f.rating, 0) / fb.length : null;
      // Transparent scoring, shown to admins: declared expertise and evidence of teaching.
      const score = Math.min(100, (expert ? 50 : 0) + (certified ? 15 : 0) + Math.min(taught.length, 3) * 8 + Math.min(reviews, 5) * 2 + Math.min(answers, 5) * 1 + (rating ? Math.round((rating - 3) * 5) : 0));
      const level = score >= 70 ? "Lead trainer" : score >= 45 ? "Can teach" : score >= 15 ? "Supporting" : "—";
      return { category: c, expert, certified, batches: taught.length, reviews, answers, rating: rating ? Math.round(rating * 10) / 10 : null, score, level };
    });
    return { trainer: t, cells };
  });
  return { categories: cats, rows };
}

export async function findTrainers(category) {
  const { rows } = await getTrainerCompetency();
  return rows.map(r => ({ trainer: r.trainer, cell: r.cells.find(c => c.category.key === category) }))
    .filter(x => x.cell && x.cell.score > 0).sort((a, b) => b.cell.score - a.cell.score);
}

/* ---------- APAR training report ---------- */
export async function getAparReport(viewer, userId) {
  const officer = await read.one("users", userId);
  assert(officer, "Officer not found.");
  assert(viewer.id === userId || viewer.role === "admin" || viewer.role === "trainer", "You can only open your own report.");
  if (isStationHead(viewer)) assert((await getDescendantStationIds(viewer.stationId)).has(officer.stationId), "This officer is outside your region.");

  const [station, modules, enrolls, certs, progress, subs, responses, questionnaires, handovers, capsules, users, batches] = await Promise.all([
    read.one("stations", officer.stationId), getModules(), read.by("enrollments", "userId", userId), read.by("certificates", "userId", userId),
    read.by("progress", "userId", userId), read.by("submissions", "userId", userId), read.by("responses", "userId", userId),
    read.all("questionnaires"), read.by("handovers", "toUserId", userId), read.all("capsules"), read.all("users"), read.all("batches")
  ]);
  const mById = new Map(modules.map(m => [m.id, m]));
  const uById = new Map(users.map(u => [u.id, u]));
  // reporting year runs April to March
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const period = { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, label: `1 April ${startYear} to 31 March ${startYear + 1}` };

  const trainings = enrolls.map(e => {
    const m = mById.get(e.moduleId);
    const mine = progress.filter(p => p.enrollmentId === e.id);
    const quiz = mine.find(p => p.bestScore != null);
    const sub = subs.filter(s => s.enrollmentId === e.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const cert = certs.find(c => c.moduleId === e.moduleId);
    const batch = batches.find(b => b.id === e.batchId);
    return { module: m, batch, status: cert ? "Certified" : e.status === "completed" ? "Completed" : "In progress",
      quizBest: quiz?.bestScore ?? null, quizAttempts: quiz?.attempts ?? 0,
      practical: sub ? { status: sub.status, score: sub.competencyScore ?? null, reviewer: uById.get(sub.reviewedBy), feedback: sub.feedback || "", scores: sub.rubricScores || sub.scores || null } : null,
      certificate: cert || null, hours: m?.durationHrs || 0 };
  });
  // certificates earned before the enrolment records existed still count
  for (const c of certs) if (!trainings.some(t => t.module?.id === c.moduleId)) {
    const m = mById.get(c.moduleId);
    trainings.push({ module: m, batch: null, status: "Certified", quizBest: null, quizAttempts: 0, practical: null, certificate: c, hours: m?.durationHrs || 0 });
  }
  const qs = responses.map(r => ({ ...r, questionnaire: questionnaires.find(q => q.id === r.questionnaireId) })).filter(r => r.questionnaire);
  const chain = await verifyAuditChain();
  const audit = await getAudit();
  return {
    officer, station, period, trainings,
    totals: {
      hours: trainings.filter(t => t.status !== "In progress").reduce((a, t) => a + t.hours, 0),
      certified: trainings.filter(t => t.status === "Certified").length,
      inProgress: trainings.filter(t => t.status === "In progress").length,
      avgCompetency: (() => { const v = trainings.map(t => t.practical?.score).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })()
    },
    certifiedSkills: officer.certifications || [],
    questionnaires: qs,
    handovers: handovers.map(h => ({ ...h, station: null })),
    capsuleContributions: capsules.filter(c => c.authorId === userId && !c.deleted).length,
    integrity: { ok: chain.ok, entries: chain.checked, head: audit[0]?.hash || null, checkedAt: new Date().toISOString() },
    levels: LEVELS,
    generatedBy: viewer
  };
}
