/* =========================================================
   services/profile.js — professional profiles for trainees and
   trainers: qualifications, work experience, interests, skills,
   plus certificates and certified field skills from the record.
   ========================================================= */

import { read, commit } from "../store.js";
import { isDivision } from "./training.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const clean = s => String(s || "").trim();
const list = arr => (arr || []).map(clean).filter(Boolean).slice(0, 20);

export async function getProfile(viewer, userId) {
  const user = await read.one("users", userId);
  assert(user, "Profile not found.");
  assert(viewer.role !== "trainee" || viewer.id === userId || user.role === "trainer",
    "Trainees can view their own profile and trainers' profiles.");
  const [station, certs, modules, batches] = await Promise.all([
    read.one("stations", user.stationId), read.by("certificates", "userId", userId), read.all("modules"), read.all("batches")
  ]);
  const mById = new Map(modules.map(m => [m.id, m]));
  return {
    user, station,
    profile: { summary: "", qualifications: [], experience: [], interests: [], skills: [], ...(user.profile || {}) },
    certificates: certs.map(c => ({ ...c, module: mById.get(c.moduleId) })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    batchesTaught: user.role === "trainer" ? batches.filter(b => b.trainerId === userId).map(b => ({ ...b, module: mById.get(b.moduleId) })) : [],
    canEdit: viewer.id === userId || isDivision(viewer)
  };
}

export async function saveProfile(viewer, userId, data) {
  assert(viewer.id === userId || isDivision(viewer), "You can only edit your own profile.");
  const quals = (data.qualifications || []).map(q => ({ degree: clean(q.degree), institution: clean(q.institution), year: clean(q.year) }))
    .filter(q => q.degree);
  const exp = (data.experience || []).map(e => ({ role: clean(e.role), organisation: clean(e.organisation), from: clean(e.from), to: clean(e.to) }))
    .filter(e => e.role);
  quals.forEach(q => assert(!q.year || /^\d{4}$/.test(q.year), `Qualification year "${q.year}" should be a four-digit year.`));
  const profile = {
    summary: clean(data.summary).slice(0, 600),
    qualifications: quals.slice(0, 10),
    experience: exp.slice(0, 15),
    interests: list(data.interests),
    skills: list(data.skills)
  };
  return commit({
    op: "update-profile", store: "users", record: { id: userId, profile },
    actorId: viewer.id, auditAction: "updated-profile",
    auditDetails: { qualifications: profile.qualifications.length, experience: profile.experience.length }
  });
}
