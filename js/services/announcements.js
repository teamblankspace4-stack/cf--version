/* =========================================================
   services/announcements.js — admins publish notices,
   announcements, achievements and new content to the homepage
   and to every signed-in officer's notifications.
   ========================================================= */

import { read, commit } from "../store.js";

export const TYPES = {
  announcement: { label: "Announcement", tag: "tag-slate" },
  achievement: { label: "Achievement", tag: "tag-amber" },
  "new-content": { label: "New content", tag: "tag-green" },
  notice: { label: "Notice", tag: "tag-slate" }
};
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const clean = s => String(s || "").trim();

export async function publish(user, { type, title, body, onHomepage = true, expires = "" }) {
  assert(user.role === "admin", "Only administrators publish announcements.");
  assert(TYPES[type], "Choose a type.");
  assert(clean(title).length >= 5, "Give it a headline.");
  assert(clean(body).length >= 10, "Write a sentence or two of detail.");
  assert(!expires || /^\d{4}-\d{2}-\d{2}$/.test(expires), "Expiry should be a date.");
  return commit({
    op: "publish-announcement", store: "announcements",
    record: { type, title: clean(title), body: clean(body).slice(0, 400), onHomepage: !!onHomepage, expires: expires || null, authorId: user.id, publishedAt: new Date().toISOString() },
    actorId: user.id, auditAction: "published-announcement", auditDetails: { type, title: clean(title) }
  });
}

export async function withdraw(user, id) {
  assert(user.role === "admin", "Only administrators withdraw announcements.");
  const a = await read.one("announcements", id);
  assert(a, "Not found.");
  return commit({ op: "withdraw-announcement", store: "announcements", record: { id, withdrawn: true },
    actorId: user.id, auditAction: "withdrew-announcement", auditDetails: { title: a.title } });
}

export async function listAnnouncements({ homepageOnly = false, includeInactive = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const [all, users] = await Promise.all([read.all("announcements"), read.all("users")]);
  const uById = new Map(users.map(u => [u.id, u]));
  return all
    .filter(a => includeInactive || (!a.withdrawn && (!a.expires || a.expires >= today)))
    .filter(a => !homepageOnly || a.onHomepage)
    .map(a => ({ ...a, author: uById.get(a.authorId), active: !a.withdrawn && (!a.expires || a.expires >= today) }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
