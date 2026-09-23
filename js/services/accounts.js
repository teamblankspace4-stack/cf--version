/* =========================================================
   services/accounts.js — signup with approval, role management.

   Officers request an account; it stays "pending" and cannot sign
   in until the Training Division approves it and confirms the role.
   Enrolment in training still goes through nomination or an
   enrolment request, so no one gets training access by signing up.
   ========================================================= */

import { read, commit, sha256 } from "../store.js";
import { hashPassword } from "../seed.js";
import { isDivision } from "./training.js";

const ROLES = ["trainee", "trainer", "admin"];
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const norm = s => String(s || "").trim();

export async function requestAccount({ empId, name, email, designation, stationId, role, password, reason }) {
  const id = norm(empId).toUpperCase();
  assert(/^[A-Z]-?\d{3,6}$/.test(id), "Enter your employee ID as on your service card, for example T-4101.");
  assert(norm(name).length >= 3, "Enter your full name.");
  assert(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm(email)), "Enter a valid work email address.");
  assert(norm(designation).length >= 3, "Enter your designation.");
  assert(stationId, "Choose your station.");
  assert(ROLES.includes(role), "Choose the role you need.");
  const pw = String(password || "");
  assert(pw.length >= 8 && /\d/.test(pw) && /[A-Za-z]/.test(pw), "Use a password of at least 8 characters with letters and numbers.");
  const users = await read.all("users");
  assert(!users.some(u => u.empId.toUpperCase() === id), "An account with this employee ID already exists or is waiting for approval.");
  assert(!users.some(u => (u.email || "").toLowerCase() === norm(email).toLowerCase()), "An account with this email already exists.");
  return commit({
    op: "request-account", store: "users",
    record: {
      empId: id, name: norm(name), email: norm(email), designation: norm(designation), stationId,
      role, requestedRole: role, status: "pending", requestReason: norm(reason), certifications: [],
      passwordHash: await hashPassword(sha256, id, pw), profile: {}
    },
    actorId: "self-signup", auditAction: "requested-account",
    auditDetails: { empId: id, requestedRole: role },
    outboxPayload: { op: "request-account", empId: id, role }
  });
}

export async function listUsers(actor) {
  assert(isDivision(actor), "Only the Training Division manages accounts.");
  const [users, stations] = await Promise.all([read.all("users"), read.all("stations")]);
  const sName = new Map(stations.map(s => [s.id, s.name]));
  return users.map(u => ({ ...u, stationName: sName.get(u.stationId) || "", status: u.status || "active" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function approveAccount(actor, userId, { role, adminScope }) {
  assert(isDivision(actor), "Only the Training Division approves accounts.");
  const u = await read.one("users", userId);
  assert(u && u.status === "pending", "This request was already decided.");
  assert(ROLES.includes(role), "Choose a role.");
  return commit({
    op: "approve-account", store: "users",
    record: { id: userId, status: "active", role, adminScope: role === "admin" ? (adminScope || "station") : undefined,
      decidedBy: actor.id, decidedAt: new Date().toISOString() },
    actorId: actor.id, auditAction: "approved-account", auditDetails: { empId: u.empId, role }
  });
}

export async function rejectAccount(actor, userId, note) {
  assert(isDivision(actor), "Only the Training Division rejects accounts.");
  const u = await read.one("users", userId);
  assert(u && u.status === "pending", "This request was already decided.");
  assert(norm(note).length >= 5, "Give a reason the officer will see when they try to sign in.");
  return commit({
    op: "reject-account", store: "users",
    record: { id: userId, status: "rejected", decisionNote: norm(note), decidedBy: actor.id, decidedAt: new Date().toISOString() },
    actorId: actor.id, auditAction: "rejected-account", auditDetails: { empId: u.empId, reason: norm(note) }
  });
}

export async function changeRole(actor, userId, { role, adminScope }) {
  assert(isDivision(actor), "Only the Training Division changes roles.");
  assert(userId !== actor.id, "You can't change your own role.");
  assert(ROLES.includes(role), "Choose a role.");
  const u = await read.one("users", userId);
  assert(u, "Account not found.");
  return commit({
    op: "change-role", store: "users",
    record: { id: userId, role, adminScope: role === "admin" ? (adminScope || "station") : undefined },
    actorId: actor.id, auditAction: "changed-role", auditDetails: { empId: u.empId, from: u.role, to: role }
  });
}

export async function setActive(actor, userId, active) {
  assert(isDivision(actor), "Only the Training Division deactivates accounts.");
  assert(userId !== actor.id, "You can't deactivate your own account.");
  const u = await read.one("users", userId);
  assert(u && (u.status || "active") !== "pending", "Decide the account request first.");
  return commit({
    op: active ? "reactivate-account" : "deactivate-account", store: "users",
    record: { id: userId, status: active ? "active" : "inactive" },
    actorId: actor.id, auditAction: active ? "reactivated-account" : "deactivated-account", auditDetails: { empId: u.empId }
  });
}
