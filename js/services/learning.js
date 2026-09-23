/* =========================================================
   services/learning.js — the trainee's learning experience.

   Tick-box prevention rules (enforced here, not in the page):
   - Units open strictly in order.
   - A video counts only for seconds actually played; skipping
     ahead does not count. 90% must be watched.
   - A reading unit needs the officer to reach the end.
   - A quiz needs the pass mark.
   - A practical needs written evidence for mentor review.
   ========================================================= */

import { read, commit, getUnits } from "../store.js";

export const WATCH_THRESHOLD = 0.9;
const MEDIA_CACHE = "cc-media";
const DONE = new Set(["completed", "submitted", "reviewed"]);

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ---------- lesson content (JSON files, cached for offline) ---------- */
const contentCache = new Map();
export async function loadContent(moduleCode) {
  const key = moduleCode.toLowerCase();
  if (contentCache.has(key)) return contentCache.get(key);
  let data = null;
  try {
    const res = await fetch(`content/${key}.json`);
    if (res.ok) data = await res.json();
  } catch { /* offline and not cached */ }
  if (data) contentCache.set(key, data);
  return data;
}

export function mediaUrls(content) {
  if (!content) return [];
  return content.units.filter(u => u.type === "video").flatMap(u => [u.video, u.poster].filter(Boolean));
}

/* ---------- unlock rules ---------- */
function computeStates(units) {
  let prevDone = true;
  return units.map(u => {
    const p = u.progress;
    let state;
    if (p && DONE.has(p.status)) state = p.status === "completed" ? "done" : p.status;   // done | submitted | reviewed
    else if (!prevDone) state = "locked";
    else if (!u.content) state = "unavailable";
    else state = p ? "in-progress" : "available";
    prevDone = !!(p && DONE.has(p.status));
    return { ...u, state };
  });
}

/* ---------- full module view for the player page ---------- */
export async function getModuleView(user, enrollmentId) {
  const enrollment = await read.one("enrollments", enrollmentId);
  assert(enrollment && enrollment.userId === user.id, "This module isn't in your training.");
  const [module, batch, units, allProgress] = await Promise.all([
    read.one("modules", enrollment.moduleId),
    enrollment.batchId ? read.one("batches", enrollment.batchId) : null,
    getUnits(enrollment.moduleId),
    read.by("progress", "userId", user.id)
  ]);
  const trainer = batch ? await read.one("users", batch.trainerId) : null;
  const content = await loadContent(module.code);
  const progress = allProgress.filter(p => p.enrollmentId === enrollmentId);

  const merged = computeStates(units.map(u => ({
    ...u,
    content: content ? content.units.find(c => c.order === u.order) || null : null,
    progress: progress.find(p => p.unitId === u.id) || null
  })));
  const doneCount = merged.filter(u => DONE.has(u.progress?.status)).length;
  return {
    enrollment, module, batch, trainer, content, units: merged,
    doneCount, total: merged.length, pct: merged.length ? doneCount / merged.length : 0,
    media: mediaUrls(content)
  };
}

/* ---------- writing progress ---------- */
async function saveProgress(user, view, unit, patch, { op, audit = false, auditAction, auditDetails } = {}) {
  const existing = unit.progress;
  const record = existing
    ? { id: existing.id, ...patch }
    : { userId: user.id, unitId: unit.id, enrollmentId: view.enrollment.id, moduleId: view.module.id, ...patch };
  return commit({ op: op || "progress", store: "progress", record, actorId: user.id, audit, auditAction, auditDetails });
}

function assertOpen(unit) {
  assert(unit.state !== "locked", "Finish the previous unit first. Units open in order.");
  assert(unit.state !== "unavailable", "This unit's content isn't published yet.");
}

/* Video: `watched` is a string of 0/1, one character per second of video. */
export function mergeWatched(a, b, length) {
  let out = "";
  for (let i = 0; i < length; i++) out += (a && a[i] === "1") || (b && b[i] === "1") ? "1" : "0";
  return out;
}
export function watchedRatio(watched) {
  if (!watched) return 0;
  return (watched.match(/1/g) || []).length / watched.length;
}

export async function saveVideoProgress(user, view, unit, watched) {
  assertOpen(unit);
  const length = unit.content.duration;
  const merged = mergeWatched(unit.progress?.watched, watched, length);
  const ratio = watchedRatio(merged);
  const wasDone = DONE.has(unit.progress?.status);
  const nowDone = wasDone || ratio >= WATCH_THRESHOLD;
  const saved = await saveProgress(user, view, unit, {
    watched: merged, watchedPct: Math.round(ratio * 100),
    status: nowDone ? "completed" : "in-progress",
    ...(nowDone && !wasDone ? { completedAt: new Date().toISOString() } : {})
  }, {
    op: nowDone && !wasDone ? "complete-unit" : "video-progress",
    audit: nowDone && !wasDone,
    auditAction: "completed-unit",
    auditDetails: { module: view.module.code, unit: unit.title, watchedPct: Math.round(ratio * 100) }
  });
  unit.progress = saved;
  return { ratio, justCompleted: nowDone && !wasDone };
}

export async function completeReading(user, view, unit) {
  assertOpen(unit);
  if (DONE.has(unit.progress?.status)) return unit.progress;
  return saveProgress(user, view, unit, { status: "completed", completedAt: new Date().toISOString() }, {
    op: "complete-unit", audit: true, auditAction: "completed-unit",
    auditDetails: { module: view.module.code, unit: unit.title }
  });
}

/** answers: array of ORIGINAL option indexes, one per question. */
export async function submitQuiz(user, view, unit, answers) {
  assertOpen(unit);
  const qs = unit.content.questions;
  assert(answers.length === qs.length && answers.every(a => a !== null && a !== undefined), "Answer every question before submitting.");
  const results = qs.map((q, i) => ({ correct: answers[i] === q.answer, chosen: answers[i], answer: q.answer, explain: q.explain }));
  const score = Math.round(100 * results.filter(r => r.correct).length / qs.length);
  const passMark = unit.content.passMark || 70;
  const passed = score >= passMark;
  const prev = unit.progress || {};
  const alreadyDone = DONE.has(prev.status);
  const saved = await saveProgress(user, view, unit, {
    attempts: (prev.attempts || 0) + 1,
    lastScore: score,
    bestScore: Math.max(prev.bestScore || 0, score),
    status: passed || alreadyDone ? "completed" : "in-progress",
    ...(passed && !alreadyDone ? { completedAt: new Date().toISOString() } : {})
  }, {
    op: "quiz-attempt", audit: true, auditAction: "quiz-attempt",
    auditDetails: { module: view.module.code, score, passed, attempt: (prev.attempts || 0) + 1 }
  });
  unit.progress = saved;
  return { score, passed, passMark, results, justCompleted: passed && !alreadyDone };
}

export async function submitPractical(user, view, unit, { text, photo }) {
  assertOpen(unit);
  const body = (text || "").trim();
  assert(body.length >= 30, "Describe what you did and found in at least 30 characters.");
  const submission = await commit({
    op: "submit-practical", store: "submissions",
    record: { userId: user.id, unitId: unit.id, moduleId: view.module.id, enrollmentId: view.enrollment.id,
      text: body, photo: photo || null, status: "submitted" },
    actorId: user.id, auditAction: "submitted-practical",
    auditDetails: { module: view.module.code, hasPhoto: !!photo }
  });
  await saveProgress(user, view, unit, { status: "submitted", submissionId: submission.id, submittedAt: submission.createdAt }, {
    op: "submit-practical-progress"
  });
  return submission;
}

export async function getSubmission(user, unitId) {
  const subs = (await read.by("submissions", "userId", user.id)).filter(s => s.unitId === unitId);
  return subs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}

/* ---------- private notes ---------- */
export async function getNotes(user, unitId) {
  return (await read.by("notes", "unitId", unitId))
    .filter(n => n.userId === user.id && !n.deleted)
    .sort((a, b) => (a.atSecond ?? 1e9) - (b.atSecond ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
}
export async function addNote(user, unit, moduleId, text, atSecond = null) {
  const body = (text || "").trim();
  assert(body, "Write something before saving the note.");
  return commit({ op: "add-note", store: "notes", record: { userId: user.id, unitId: unit.id, moduleId, text: body, atSecond },
    actorId: user.id, audit: false });
}
export async function deleteNote(user, noteId) {
  const n = await read.one("notes", noteId);
  assert(n && n.userId === user.id, "You can only delete your own notes.");
  return commit({ op: "delete-note", store: "notes", record: { id: noteId, deleted: true }, actorId: user.id, audit: false });
}

/* ---------- discussion with mentor and batch ---------- */
export async function getThread(unitId) {
  const [posts, users] = await Promise.all([read.by("discussions", "unitId", unitId), read.all("users")]);
  const byId = new Map(users.map(u => [u.id, u]));
  return posts.filter(p => !p.deleted)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(p => ({ ...p, author: byId.get(p.authorId) }));
}
export async function postToThread(user, unit, moduleId, text, atSecond = null) {
  const body = (text || "").trim();
  assert(body.length >= 3, "Write your question or reply first.");
  return commit({ op: "post-discussion", store: "discussions",
    record: { moduleId, unitId: unit.id, authorId: user.id, authorRole: user.role, text: body, atSecond },
    actorId: user.id, auditAction: "posted-discussion", auditDetails: { unit: unit.title } });
}

/* ---------- anonymous confusion flags ----------
   The record stores NO user id, and the audit entry uses the actor
   "anonymous". To stop one officer flagging the same spot repeatedly,
   a marker is kept only on this device. */
const FLAG_KEY = "cc.confusionFlags";
function flaggedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(FLAG_KEY) || "[]")); } catch { return new Set(); }
}
export function hasFlagged(userId, unitId, chapterIndex) {
  return flaggedSet().has(`${userId}:${unitId}:${chapterIndex}`);
}
export async function flagConfusion(user, unit, moduleId, second, chapterIndex) {
  const key = `${user.id}:${unit.id}:${chapterIndex}`;
  const set = flaggedSet();
  assert(!set.has(key), "You've already flagged this part of the lesson.");
  await commit({ op: "flag-confusion", store: "confusion",
    record: { unitId: unit.id, moduleId, second: Math.floor(second), chapterIndex },
    actorId: "anonymous", auditAction: "confusion-flagged", auditDetails: { chapterIndex } });
  set.add(key);
  try { localStorage.setItem(FLAG_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

/* ---------- offline downloads (Cache Storage, survives app updates) ---------- */
const abs = u => new URL(u, location.href).href;

export async function isDownloaded(urls) {
  if (!urls.length || !("caches" in window)) return false;
  const cache = await caches.open(MEDIA_CACHE);
  for (const u of urls) if (!(await cache.match(abs(u)))) return false;
  return true;
}

export async function downloadMedia(urls, onProgress = () => {}) {
  assert(navigator.onLine, "Connect to the internet once to download this module.");
  const cache = await caches.open(MEDIA_CACHE);
  let loaded = 0;
  let total = 0;
  const heads = await Promise.all(urls.map(u => fetch(abs(u), { method: "HEAD" }).catch(() => null)));
  heads.forEach(h => { total += Number(h?.headers.get("content-length") || 0); });
  for (const u of urls) {
    const res = await fetch(abs(u), { cache: "no-store" });
    assert(res.ok, `Download failed (${res.status}). Try again when the connection is better.`);
    const type = res.headers.get("content-type") || "application/octet-stream";
    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(total ? Math.min(1, loaded / total) : null, loaded);
    }
    const blob = new Blob(chunks, { type });
    await cache.put(abs(u), new Response(blob, { headers: { "Content-Type": type, "Content-Length": String(blob.size) } }));
  }
  onProgress(1, loaded);
  return loaded;
}

export async function removeDownload(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.all(urls.map(u => cache.delete(abs(u))));
}

export async function downloadSize(urls) {
  let total = 0;
  for (const u of urls) {
    const h = await fetch(abs(u), { method: "HEAD" }).catch(() => null);
    total += Number(h?.headers.get("content-length") || 0);
  }
  return total;
}

/* ---------- summary for the trainee dashboard ---------- */
export async function getTrainingSummary(user) {
  const enrollments = await read.by("enrollments", "userId", user.id);
  const out = [];
  for (const e of enrollments) {
    const view = await getModuleView(user, e.id);
    const next = view.units.find(u => ["available", "in-progress"].includes(u.state));
    const waitingReview = view.units.some(u => u.state === "submitted");
    out.push({
      enrollment: e, module: view.module, batch: view.batch, trainer: view.trainer,
      doneCount: view.doneCount, total: view.total, pct: view.pct,
      hasContent: !!view.content, next, waitingReview,
      downloaded: view.media.length ? await isDownloaded(view.media) : false
    });
  }
  return out.sort((a, b) => (b.batch?.startDate || "").localeCompare(a.batch?.startDate || ""));
}
