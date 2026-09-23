import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell, roleTitle } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { isDivision } from "../services/training.js";
import { listUsers, approveAccount, rejectAccount, changeRole, setActive } from "../services/accounts.js";

await ready;
const user = await requireRole(["admin"]);
if (!isDivision(user)) location.replace("admin.html");
await renderShell(user, "users");

const $ = id => document.getElementById(id);
const view = $("view");
let users = [];
let filter = "all";
let query = "";
let target = null;
const STATUS = { active: ["Active", "ok"], pending: ["Waiting for approval", "warn"], rejected: ["Rejected", "danger"], inactive: ["Deactivated", ""] };

function render() {
  const pending = users.filter(u => u.status === "pending");
  const q = query.toLowerCase();
  const rest = users.filter(u => u.status !== "pending" && (filter === "all" || u.role === filter) &&
    (!q || `${u.name} ${u.empId} ${u.stationName} ${u.designation}`.toLowerCase().includes(q)));
  view.innerHTML = `
    <div class="stack-5">
      <div class="summary">
        <div><b>${pending.length}</b><span>account requests waiting</span></div>
        <div><b>${users.filter(u => u.status === "active" && u.role === "trainee").length}</b><span>active trainees</span></div>
        <div><b>${users.filter(u => u.status === "active" && u.role === "trainer").length}</b><span>active trainers</span></div>
        <div><b>${users.filter(u => u.status === "active" && u.role === "admin").length}</b><span>administrators</span></div>
      </div>

      <section class="panel"><div class="panel-title"><h2>Account requests</h2></div>
        ${pending.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Officer</th><th>Station</th><th>Requested role</th><th>Reason</th><th>Requested</th><th></th></tr></thead>
          <tbody>${pending.map(u => `<tr>
            <td><b>${escapeHtml(u.name)}</b><br><span class="meta-line">${escapeHtml(u.empId)} · ${escapeHtml(u.email || "")}</span></td>
            <td>${escapeHtml(u.stationName)}<br><span class="meta-line">${escapeHtml(u.designation)}</span></td>
            <td>${escapeHtml(roleTitle({ ...u, role: u.requestedRole || u.role }))}</td>
            <td style="white-space:normal;max-width:280px">${escapeHtml(u.requestReason || "")}</td>
            <td>${formatDate(u.createdAt)}</td>
            <td><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn btn-primary btn-sm" data-approve="${u.id}">Approve</button><button class="btn btn-secondary btn-sm" data-reject="${u.id}">Reject</button></span></td>
          </tr>`).join("")}</tbody></table></div>`
          : `<div class="empty"><p>No account requests waiting. New requests from the sign-up page appear here.</p></div>`}
      </section>

      <section class="panel"><div class="panel-title"><h2>All accounts</h2></div>
        <div class="toolbar">
          <div class="chips" role="group" aria-label="Filter by role">
            ${[["all", "All"], ["trainee", "Trainees"], ["trainer", "Trainers"], ["admin", "Administrators"]].map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}
          </div>
          <label class="visually-hidden" for="user-search">Search accounts</label>
          <input class="input" id="user-search" type="search" placeholder="Search by name, ID or station" value="${escapeHtml(query)}">
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Officer</th><th>Station</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>${rest.map(u => `<tr>
            <td><b>${escapeHtml(u.name)}</b><br><span class="meta-line">${escapeHtml(u.empId)}</span></td>
            <td>${escapeHtml(u.stationName)}</td>
            <td>${escapeHtml(roleTitle(u))}</td>
            <td><span class="pill ${STATUS[u.status][1] ? "pill-" + STATUS[u.status][1] : ""}">${STATUS[u.status][0]}</span></td>
            <td><span class="row" style="gap:6px;flex-wrap:nowrap">
              <a class="btn btn-secondary btn-sm" href="profile.html?u=${u.id}">Profile</a>
              ${u.id !== user.id && u.status !== "rejected" ? `<button class="btn btn-secondary btn-sm" data-role="${u.id}">Change role</button>
              <button class="btn btn-secondary btn-sm" data-active="${u.id}">${u.status === "inactive" ? "Reactivate" : "Deactivate"}</button>` : ""}
            </span></td></tr>`).join("")}</tbody></table></div>
      </section>
    </div>`;

  view.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; render(); }));
  $("user-search").addEventListener("input", e => { query = e.target.value; const pos = e.target.selectionStart; render(); const s = $("user-search"); s.focus(); s.setSelectionRange(pos, pos); });
  view.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", () => {
    target = users.find(u => u.id === b.dataset.approve);
    $("appr-who").textContent = `${target.name} (${target.empId}), ${target.designation}, ${target.stationName}. Requested: ${roleTitle({ ...target, role: target.requestedRole })}.`;
    $("appr-role").value = target.requestedRole || "trainee"; toggleScope("appr");
    $("appr-error").textContent = ""; $("appr").showModal();
  }));
  view.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", () => {
    target = users.find(u => u.id === b.dataset.reject);
    $("rej-who").textContent = `${target.name} (${target.empId}).`; $("rej-note").value = ""; $("rej-error").textContent = ""; $("rej").showModal();
  }));
  view.querySelectorAll("[data-role]").forEach(b => b.addEventListener("click", () => {
    target = users.find(u => u.id === b.dataset.role);
    $("role-who").textContent = `${target.name} (${target.empId}), currently ${roleTitle(target)}.`;
    $("role-role").value = target.role; $("role-scope").value = target.adminScope || "station"; toggleScope("role");
    $("role-error").textContent = ""; $("role").showModal();
  }));
  view.querySelectorAll("[data-active]").forEach(b => b.addEventListener("click", async () => {
    const u = users.find(x => x.id === b.dataset.active);
    const activate = u.status === "inactive";
    if (!activate && !confirm(`Deactivate ${u.name}? They won't be able to sign in until reactivated.`)) return;
    try { await setActive(user, u.id, activate); toast(`${u.name} ${activate ? "reactivated" : "deactivated"}.`, "ok"); await load(); } catch (err) { toast(err.message, "warn"); }
  }));
}

function toggleScope(prefix) { $(`${prefix}-scope-field`).hidden = $(`${prefix}-role`).value !== "admin"; }
$("appr-role").addEventListener("change", () => toggleScope("appr"));
$("role-role").addEventListener("change", () => toggleScope("role"));

async function run(dialog, fn, msg) {
  try { await fn(); $(dialog).close(); toast(msg, "ok", 4500); await load(); }
  catch (err) { $(`${dialog}-error`).textContent = err.message; }
}
$("appr-form").addEventListener("submit", e => { e.preventDefault(); run("appr", () => approveAccount(user, target.id, { role: $("appr-role").value, adminScope: $("appr-scope").value }), `${target.name} approved. They can sign in now.`); });
$("rej-form").addEventListener("submit", e => { e.preventDefault(); run("rej", () => rejectAccount(user, target.id, $("rej-note").value), `Request from ${target.name} rejected.`); });
$("role-form").addEventListener("submit", e => { e.preventDefault(); run("role", () => changeRole(user, target.id, { role: $("role-role").value, adminScope: $("role-scope").value }), `${target.name}'s role updated.`); });
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

async function load() { users = await listUsers(user); render(); }
await load();
