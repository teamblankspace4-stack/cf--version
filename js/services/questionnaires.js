/* =========================================================
   services/questionnaires.js — trainer-authored MCQ
   questionnaires with deadlines (PS: "create questionnaires with
   deadlines" and "subject-wise MCQ assessments").
   One attempt per officer; closed after the deadline.
   ========================================================= */

import { read, commit } from "../store.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const clean = s => String(s || "").trim();
/** Deadline is the end of the chosen day, local time. */
export const deadlineOf = q => new Date(`${q.deadline}T23:59:59`);
export const isClosed = q => Date.now() > deadlineOf(q).getTime();

export async function createQuestionnaire(trainer, { batchId, title, instructions, deadline, passMark = 60, questions }) {
  assert(trainer.role === "trainer", "Only trainers create questionnaires.");
  const batch = await read.one("batches", batchId);
  assert(batch && batch.trainerId === trainer.id, "Choose one of your own batches.");
  assert(clean(title).length >= 4, "Give the questionnaire a title.");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(deadline || ""), "Choose a deadline.");
  assert(deadlineOf({ deadline }).getTime() > Date.now(), "The deadline must be in the future.");
  const qs = (questions || []).map(q => ({ q: clean(q.q), options: (q.options || []).map(clean), answer: Number(q.answer) }));
  assert(qs.length >= 1, "Add at least one question.");
  qs.forEach((q, i) => {
    assert(q.q.length >= 5, `Question ${i + 1} needs its text.`);
    assert(q.options.filter(Boolean).length >= 2 && q.options.every(Boolean), `Question ${i + 1} needs every option filled in.`);
    assert(q.answer >= 0 && q.answer < q.options.length, `Mark the correct answer for question ${i + 1}.`);
  });
  const pm = Number(passMark);
  assert(pm >= 10 && pm <= 100, "Pass mark should be between 10 and 100.");
  return commit({
    op: "create-questionnaire", store: "questionnaires",
    record: { batchId, moduleId: batch.moduleId, trainerId: trainer.id, title: clean(title), instructions: clean(instructions),
      deadline, passMark: pm, questions: qs, status: "open" },
    actorId: trainer.id, auditAction: "created-questionnaire",
    auditDetails: { title: clean(title), batch: batch.name, deadline, questions: qs.length }
  });
}

async function enrich(q) {
  const [batch, module, responses, enrolls] = await Promise.all([
    read.one("batches", q.batchId), read.one("modules", q.moduleId),
    read.by("responses", "questionnaireId", q.id), read.by("enrollments", "moduleId", q.moduleId)
  ]);
  const members = enrolls.filter(e => e.batchId === q.batchId);
  const scores = responses.map(r => r.score);
  return {
    ...q, batch, module, responses, closed: isClosed(q), memberCount: members.length,
    submitted: responses.length,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    passRate: scores.length ? Math.round(100 * scores.filter(s => s >= q.passMark).length / scores.length) : null
  };
}

export async function listForTrainer(trainer) {
  const all = (await read.by("questionnaires", "trainerId", trainer.id)).filter(q => !q.deleted);
  return (await Promise.all(all.map(enrich))).sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export async function getResults(trainer, questionnaireId) {
  const q = await read.one("questionnaires", questionnaireId);
  assert(q && q.trainerId === trainer.id, "Not your questionnaire.");
  const e = await enrich(q);
  const [enrolls, users] = await Promise.all([read.by("enrollments", "moduleId", q.moduleId), read.all("users")]);
  const byId = new Map(users.map(u => [u.id, u]));
  e.rows = enrolls.filter(x => x.batchId === q.batchId).map(x => {
    const r = e.responses.find(r => r.userId === x.userId);
    return { officer: byId.get(x.userId), response: r || null };
  }).sort((a, b) => (b.response?.score ?? -1) - (a.response?.score ?? -1));
  // which questions the batch found hardest
  e.questionStats = q.questions.map((qq, i) => ({
    q: qq.q, correct: e.responses.filter(r => r.answers[i] === qq.answer).length, total: e.responses.length
  }));
  return e;
}

export async function listForTrainee(user) {
  const enrolls = (await read.by("enrollments", "userId", user.id));
  const batchIds = new Set(enrolls.map(e => e.batchId));
  const all = (await read.all("questionnaires")).filter(q => batchIds.has(q.batchId) && !q.deleted);
  const out = [];
  for (const q of all) {
    const e = await enrich(q);
    const mine = e.responses.find(r => r.userId === user.id) || null;
    out.push({
      ...e, responses: undefined, mine,
      state: mine ? "submitted" : e.closed ? "missed" : "due",
      trainer: await read.one("users", q.trainerId)
    });
  }
  const rank = { due: 0, submitted: 1, missed: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || a.deadline.localeCompare(b.deadline));
}

export async function submitResponse(user, questionnaireId, answers) {
  const q = await read.one("questionnaires", questionnaireId);
  assert(q, "Questionnaire not found.");
  const enrolled = (await read.by("enrollments", "userId", user.id)).some(e => e.batchId === q.batchId);
  assert(enrolled, "This questionnaire is for another batch.");
  assert(!isClosed(q), "The deadline has passed, so this questionnaire is closed.");
  const already = (await read.by("responses", "questionnaireId", q.id)).some(r => r.userId === user.id);
  assert(!already, "You've already submitted this questionnaire.");
  assert(answers.length === q.questions.length && answers.every(a => a !== null && a !== undefined), "Answer every question before submitting.");
  const correct = q.questions.filter((qq, i) => answers[i] === qq.answer).length;
  const score = Math.round(100 * correct / q.questions.length);
  const saved = await commit({
    op: "submit-questionnaire", store: "responses",
    record: { questionnaireId: q.id, userId: user.id, answers, score, passed: score >= q.passMark, submittedAt: new Date().toISOString() },
    actorId: user.id, auditAction: "submitted-questionnaire", auditDetails: { title: q.title, score }
  });
  return { ...saved, correct, total: q.questions.length, questionnaire: q };
}
