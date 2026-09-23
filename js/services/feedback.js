/* =========================================================
   services/feedback.js — course and content feedback (PS:
   "provide feedback on courses and training content").
   One entry per officer per module, editable. Trainers and
   admins see ratings and comments without the officer's name.
   ========================================================= */

import { read, commit } from "../store.js";

export const ASPECTS = {
  content: "Content was accurate and useful",
  relevance: "Relevant to my station duties",
  pace: "The pace was right"
};
function assert(cond, msg) { if (!cond) throw new Error(msg); }

export async function getMyFeedback(user, moduleId) {
  return (await read.by("feedback", "moduleId", moduleId)).find(f => f.userId === user.id) || null;
}

export async function submitFeedback(user, moduleId, { rating, aspects = {}, comment }) {
  const enrolled = (await read.by("enrollments", "userId", user.id)).some(e => e.moduleId === moduleId);
  assert(enrolled, "You can give feedback on modules you're enrolled in.");
  const r = Number(rating);
  assert(r >= 1 && r <= 5, "Choose a rating from 1 to 5 stars.");
  const asp = Object.fromEntries(Object.keys(ASPECTS).map(k => [k, Math.max(0, Math.min(5, Number(aspects[k]) || 0))]));
  const existing = await getMyFeedback(user, moduleId);
  const module = await read.one("modules", moduleId);
  return commit({
    op: existing ? "update-feedback" : "submit-feedback", store: "feedback",
    record: { ...(existing ? { id: existing.id } : { userId: user.id, moduleId }), rating: r, aspects: asp, comment: String(comment || "").trim().slice(0, 800) },
    actorId: user.id, auditAction: "gave-feedback", auditDetails: { module: module?.code, rating: r }
  });
}

/** Aggregates without names: what trainers and administrators see. */
export async function summarize(moduleIds = null) {
  const [all, modules] = await Promise.all([read.all("feedback"), read.all("modules")]);
  const out = [];
  for (const m of modules) {
    if (moduleIds && !moduleIds.includes(m.id)) continue;
    const f = all.filter(x => x.moduleId === m.id);
    if (!f.length) continue;
    const avg = key => {
      const vals = f.map(x => key ? x.aspects?.[key] : x.rating).filter(v => v > 0);
      return vals.length ? Math.round(10 * vals.reduce((a, b) => a + b, 0) / vals.length) / 10 : null;
    };
    out.push({
      module: m, count: f.length, rating: avg(null),
      aspects: Object.fromEntries(Object.keys(ASPECTS).map(k => [k, avg(k)])),
      comments: f.filter(x => x.comment).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(x => ({ text: x.comment, rating: x.rating, at: x.updatedAt }))
    });
  }
  return out.sort((a, b) => b.count - a.count);
}
