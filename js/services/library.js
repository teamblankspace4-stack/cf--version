/* =========================================================
   services/library.js — the trainer library (PS: "upload recorded
   lectures, presentations, and study materials in a trainer
   library accessible to trainees").

   Uploaded files are stored on the device as Blobs, so they open
   offline. Phase B: files go to object storage on the server.
   ========================================================= */

import { read, commit } from "../store.js";
import { isDivision } from "./training.js";

export const MAX_BYTES = 25 * 1024 * 1024;
export const KINDS = {
  lecture: "Recorded lecture",
  presentation: "Presentation",
  notes: "Study material",
  sop: "SOP or manual"
};
const ALLOWED = /\.(pdf|pptx?|docx?|xlsx?|mp4|webm|mp3|m4a|png|jpe?g|txt)$/i;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const clean = s => String(s || "").trim();

export function kindFromFile(name) {
  if (/\.(mp4|webm|mp3|m4a)$/i.test(name)) return "lecture";
  if (/\.pptx?$/i.test(name)) return "presentation";
  return "notes";
}

export async function uploadItem(user, { file, title, description, moduleId, kind }) {
  assert(user.role === "trainer" || isDivision(user), "Only trainers and the Training Division upload to the library.");
  assert(file, "Choose a file to upload.");
  assert(ALLOWED.test(file.name), "Upload a PDF, PowerPoint, Word, Excel, video, audio, image or text file.");
  assert(file.size <= MAX_BYTES, `Files can be up to ${MAX_BYTES / 1024 / 1024} MB in the prototype.`);
  assert(clean(title).length >= 3, "Give the item a title.");
  assert(KINDS[kind], "Choose what kind of material this is.");
  const module = moduleId ? await read.one("modules", moduleId) : null;
  const meta = { title: clean(title), description: clean(description), moduleId: moduleId || null, category: module?.category || "general",
    kind, fileName: file.name, mime: file.type || "application/octet-stream", size: file.size, uploaderId: user.id };
  return commit({
    op: "upload-library-item", store: "library",
    record: { ...meta, blob: file },
    actorId: user.id, auditAction: "uploaded-library-item",
    auditDetails: { title: meta.title, fileName: file.name, sizeKB: Math.round(file.size / 1024) },
    outboxPayload: { ...meta, file: "(uploaded separately)" }
  });
}

export async function listLibrary({ moduleId = null, category = null } = {}) {
  const [items, users, modules] = await Promise.all([read.all("library"), read.all("users"), read.all("modules")]);
  const uById = new Map(users.map(u => [u.id, u]));
  const mById = new Map(modules.map(m => [m.id, m]));
  return items.filter(i => !i.deleted && (!moduleId || i.moduleId === moduleId) && (!category || i.category === category))
    .map(({ blob, ...i }) => ({ ...i, hasFile: !!blob || !!i.url, uploader: uById.get(i.uploaderId), module: mById.get(i.moduleId) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns a URL the browser can open or download. */
export async function openItem(id) {
  const item = await read.one("library", id);
  assert(item && !item.deleted, "This item is no longer in the library.");
  if (item.url) return { url: item.url, item, revoke: () => {} };
  assert(item.blob, "The file for this item isn't on this device yet.");
  const url = URL.createObjectURL(item.blob);
  return { url, item, revoke: () => URL.revokeObjectURL(url) };
}

export async function removeItem(user, id) {
  const item = await read.one("library", id);
  assert(item, "Item not found.");
  assert(item.uploaderId === user.id || isDivision(user), "Only the person who uploaded it, or the Training Division, can remove it.");
  return commit({
    op: "remove-library-item", store: "library", record: { id, deleted: true, blob: null },
    actorId: user.id, auditAction: "removed-library-item", auditDetails: { title: item.title }
  });
}
