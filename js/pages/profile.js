import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell, initials, roleTitle } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { getProfile, saveProfile } from "../services/profile.js";

await ready;
const user = await requireRole(["trainee", "trainer", "admin"]);
const targetId = new URLSearchParams(location.search).get("u") || user.id;
await renderShell(user, targetId === user.id ? "profile" : "", targetId === user.id ? "My profile" : "Officer profile");

const $ = id => document.getElementById(id);
const view = $("view");
const SKILL = { aws: "AWS and surface instruments", radar: "Radar", satellite: "Satellite data analysis", aviation: "Aviation meteorology" };
let data = null;

function renderView() {
  const { user: u, station, profile: p, certificates, batchesTaught, canEdit } = data;
  $("page-title").textContent = u.id === user.id ? "My profile" : u.name;
  $("page-sub").textContent = u.id === user.id ? "Your professional record: qualifications, experience, skills and certificates." : `${roleTitle(u)} profile.`;
  view.innerHTML = `
    <div class="stack-5">
      <section class="panel">
        <div class="profile-head">
          <span class="avatar" aria-hidden="true">${escapeHtml(initials(u.name))}</span>
          <div style="flex:1;min-width:220px">
            <h2>${escapeHtml(u.name)}</h2>
            <p class="meta-line" style="margin:0">${escapeHtml(u.designation)} · ${escapeHtml(station?.name || "")}</p>
          </div>
          <div class="row">
            ${u.role === "trainee" && (u.id === user.id || user.role !== "trainee") ? `<a class="btn btn-secondary" href="apar.html?u=${u.id}">APAR training report</a>` : ""}
            ${canEdit ? `<button class="btn btn-primary" type="button" id="edit-btn">Edit profile</button>` : ""}
          </div>
        </div>
        <dl class="kv-list" style="margin-top: var(--sp-5)">
          <dt>Employee ID</dt><dd>${escapeHtml(u.empId)}</dd>
          <dt>Role</dt><dd>${escapeHtml(roleTitle(u))}</dd>
          ${u.email ? `<dt>Work email</dt><dd>${escapeHtml(u.email)}</dd>` : ""}
          <dt>Certified field skills</dt><dd>${(u.certifications || []).map(c => escapeHtml(SKILL[c] || c)).join(", ") || "None yet"}</dd>
          ${u.expertise?.length ? `<dt>Teaching expertise</dt><dd>${u.expertise.map(c => escapeHtml(SKILL[c] || c)).join(", ")}</dd>` : ""}
        </dl>
        ${p.summary ? `<p style="margin: var(--sp-5) 0 0">${escapeHtml(p.summary)}</p>` : ""}
      </section>

      <div class="grid-2" style="gap: var(--sp-5)">
        <section class="panel"><div class="panel-title"><h2>Qualifications</h2></div>
          ${p.qualifications.length ? `<ul class="timeline">${p.qualifications.map(q => `<li><span class="when">${escapeHtml(q.year || "")}</span><span><b>${escapeHtml(q.degree)}</b><span class="meta-line">${escapeHtml(q.institution)}</span></span></li>`).join("")}</ul>`
            : `<div class="empty"><p>No qualifications added yet.</p></div>`}
        </section>
        <section class="panel"><div class="panel-title"><h2>Work experience</h2></div>
          ${p.experience.length ? `<ul class="timeline">${p.experience.map(e => `<li><span class="when">${escapeHtml(e.from || "")}${e.to ? `–${escapeHtml(e.to)}` : ""}</span><span><b>${escapeHtml(e.role)}</b><span class="meta-line">${escapeHtml(e.organisation)}</span></span></li>`).join("")}</ul>`
            : `<div class="empty"><p>No work experience added yet.</p></div>`}
        </section>
      </div>

      <div class="grid-2" style="gap: var(--sp-5)">
        <section class="panel"><div class="panel-title"><h2>Skills</h2></div>
          ${p.skills.length ? `<div class="tags">${p.skills.map(s => `<span>${escapeHtml(s)}</span>`).join("")}</div>` : `<p class="muted">No skills added yet.</p>`}
        </section>
        <section class="panel"><div class="panel-title"><h2>Interests</h2></div>
          ${p.interests.length ? `<div class="tags">${p.interests.map(s => `<span>${escapeHtml(s)}</span>`).join("")}</div>` : `<p class="muted">No interests added yet.</p>`}
        </section>
      </div>

      <section class="panel"><div class="panel-title"><h2>Certificates</h2></div>
        ${certificates.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Certificate</th><th>Module</th><th>Score</th><th>Competency</th><th>Issued</th><th></th></tr></thead>
          <tbody>${certificates.map(c => `<tr><td>${escapeHtml(c.certNo)}</td><td>${escapeHtml(c.module?.code || "")}: ${escapeHtml(c.module?.title || "")}</td>
            <td>${c.score}%</td><td>${c.competencyScore != null ? `${c.competencyScore}%` : "—"}</td><td>${formatDate(c.issuedAt)}</td>
            <td><a class="btn btn-secondary btn-sm" href="certificate.html?id=${c.id}">View and verify</a></td></tr>`).join("")}</tbody></table></div>`
          : `<div class="empty"><p>Certificates appear here as modules are completed.</p></div>`}
      </section>

      ${batchesTaught.length ? `<section class="panel"><div class="panel-title"><h2>Batches taught</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Batch</th><th>Module</th><th>Starts</th></tr></thead>
        <tbody>${batchesTaught.map(b => `<tr><td>${escapeHtml(b.name)}</td><td>${escapeHtml(b.module?.title || "")}</td><td>${formatDate(b.startDate)}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
    </div>`;
  $("edit-btn")?.addEventListener("click", renderEdit);
}

/* ---------- edit ---------- */
const qualRow = (q = {}) => `<div class="row-item">
  <label class="field"><span class="lbl">Degree or certificate</span><input class="input" data-k="degree" value="${escapeHtml(q.degree || "")}"></label>
  <label class="field"><span class="lbl">Institution</span><input class="input" data-k="institution" value="${escapeHtml(q.institution || "")}"></label>
  <label class="field"><span class="lbl">Year</span><input class="input" data-k="year" inputmode="numeric" maxlength="4" value="${escapeHtml(q.year || "")}"></label>
  <button type="button" class="icon-btn" data-remove aria-label="Remove">✕</button></div>`;
const expRow = (e = {}) => `<div class="row-item">
  <label class="field"><span class="lbl">Role</span><input class="input" data-k="role" value="${escapeHtml(e.role || "")}"></label>
  <label class="field"><span class="lbl">Organisation or station</span><input class="input" data-k="organisation" value="${escapeHtml(e.organisation || "")}"></label>
  <label class="field"><span class="lbl">From</span><input class="input" data-k="from" value="${escapeHtml(e.from || "")}" placeholder="2022"></label>
  <label class="field"><span class="lbl">To</span><input class="input" data-k="to" value="${escapeHtml(e.to || "")}" placeholder="Present"></label>
  <button type="button" class="icon-btn" data-remove aria-label="Remove">✕</button></div>`;

function renderEdit() {
  const p = data.profile;
  view.innerHTML = `
    <form class="panel" id="profile-form">
      <div class="panel-title"><h2>Edit profile</h2></div>
      <div class="field"><label for="pf-summary">Summary</label>
        <textarea class="input" id="pf-summary" rows="3" maxlength="600" placeholder="Your role, station duties and what you work on.">${escapeHtml(p.summary)}</textarea></div>
      <h3>Qualifications</h3>
      <div class="rows-editor quals" id="quals">${(p.qualifications.length ? p.qualifications : [{}]).map(qualRow).join("")}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="add-qual">Add qualification</button>
      <h3 style="margin-top: var(--sp-5)">Work experience</h3>
      <div class="rows-editor" id="exps">${(p.experience.length ? p.experience : [{}]).map(expRow).join("")}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="add-exp">Add experience</button>
      <div class="grid-2" style="margin-top: var(--sp-5)">
        <div class="field"><label for="pf-skills">Skills</label><input class="input" id="pf-skills" value="${escapeHtml(p.skills.join(", "))}">
          <span class="field-hint">Separate with commas.</span></div>
        <div class="field"><label for="pf-interests">Interests</label><input class="input" id="pf-interests" value="${escapeHtml(p.interests.join(", "))}">
          <span class="field-hint">Separate with commas.</span></div>
      </div>
      <p class="field-error" id="pf-error" role="alert"></p>
      <div class="row"><button class="btn btn-primary" type="submit">Save profile</button><button class="btn btn-secondary" type="button" id="cancel-edit">Cancel</button></div>
    </form>`;
  const bindRemove = () => view.querySelectorAll("[data-remove]").forEach(b => { b.onclick = () => b.closest(".row-item").remove(); });
  bindRemove();
  $("add-qual").onclick = () => { $("quals").insertAdjacentHTML("beforeend", qualRow()); bindRemove(); };
  $("add-exp").onclick = () => { $("exps").insertAdjacentHTML("beforeend", expRow()); bindRemove(); };
  $("cancel-edit").onclick = renderView;
  const rows = id => [...$(id).querySelectorAll(".row-item")].map(r => Object.fromEntries([...r.querySelectorAll("[data-k]")].map(i => [i.dataset.k, i.value])));
  const split = v => v.split(",").map(s => s.trim()).filter(Boolean);
  $("profile-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await saveProfile(user, data.user.id, {
        summary: $("pf-summary").value, qualifications: rows("quals"), experience: rows("exps"),
        skills: split($("pf-skills").value), interests: split($("pf-interests").value)
      });
      toast(navigator.onLine ? "Profile saved." : "Profile saved on this device. It will sync when you're back online.", "ok");
      data = await getProfile(user, targetId);
      renderView();
    } catch (err) { $("pf-error").textContent = err.message; }
  });
}

try {
  data = await getProfile(user, targetId);
  renderView();
} catch (err) {
  view.innerHTML = `<div class="panel"><div class="empty"><p>${escapeHtml(err.message)}</p></div></div>`;
}
