/* =========================================================
   auth.js — login, session and role guards.

   PROTOTYPE ONLY: credentials are checked in the browser so
   login works offline for the demo. In Phase B, login moves
   to the server (Supabase Auth) and this file only caches the
   session token for offline use.
   ========================================================= */

import { read, sha256, appendAudit, ensureSeeded } from "./store.js";
import { hashPassword } from "./seed.js";

const SESSION_KEY = "cc.session";
const SESSION_HOURS = 12;

export const HOME_BY_ROLE = {
  trainee: "trainee.html",
  trainer: "trainer.html",
  admin: "admin.html"
};

export const ROLE_LABEL = {
  trainee: "Trainee",
  trainer: "Trainer / Mentor",
  admin: "Administrator"
};

function saveSession(user) {
  const session = {
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + SESSION_HOURS * 3600 * 1000
  };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* private mode: session lasts this page only */ }
  return session;
}

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s || s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

/** Returns { ok: true, user } or { ok: false, error }. */
export async function login(empId, password) {
  await ensureSeeded();
  const id = (empId || "").trim();
  if (!id || !password) return { ok: false, error: "Enter your employee ID and password." };
  const users = await read.all("users");
  const user = users.find(u => u.empId.toLowerCase() === id.toLowerCase());
  if (!user) return { ok: false, error: "No officer found with that employee ID. Check the ID on your service card." };
  const hash = await hashPassword(sha256, user.empId, password);
  if (hash !== user.passwordHash) return { ok: false, error: "Password is incorrect. Demo accounts use demo@123." };
  // Accounts created through "Request an account" can't sign in until an administrator approves them.
  if (user.status === "pending") return { ok: false, error: "Your account request is waiting for approval by the Training Division." };
  if (user.status === "rejected") return { ok: false, error: `Your account request was not approved${user.decisionNote ? `: ${user.decisionNote}` : "."}` };
  if (user.status === "inactive") return { ok: false, error: "This account has been deactivated. Contact the Training Division." };
  saveSession(user);
  await appendAudit({ actorId: user.id, action: "login", entity: "users", entityId: user.id });
  return { ok: true, user };
}

/** One-click login for judges: picks the seeded demo account for a role. */
export async function demoLogin(role, adminScope) {
  await ensureSeeded();
  const users = await read.all("users");
  const user = users.find(u => u.demo && u.role === role && (!adminScope || u.adminScope === adminScope));
  if (!user) return { ok: false, error: `No demo account for ${role}.` };
  saveSession(user);
  await appendAudit({ actorId: user.id, action: "demo-login", entity: "users", entityId: user.id });
  return { ok: true, user };
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  location.href = "login.html";
}

export async function currentUser() {
  const s = readSession();
  if (!s) return null;
  await ensureSeeded();
  const user = await read.one("users", s.userId);
  if (!user || (user.status && user.status !== "active")) return null;
  return user;
}

/**
 * Call at the top of every protected page:
 *   const user = await requireRole(["admin"]);
 * Redirects to login if there's no session, or to the user's own
 * dashboard if they open a page their role can't see.
 */
export async function requireRole(roles) {
  const user = await currentUser();
  if (!user) {
    location.replace("login.html");
    return new Promise(() => {});   // halt the page script
  }
  if (roles && !roles.includes(user.role)) {
    location.replace(HOME_BY_ROLE[user.role]);
    return new Promise(() => {});
  }
  return user;
}
