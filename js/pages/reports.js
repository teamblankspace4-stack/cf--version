import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { escapeHtml } from "../ui.js";
import { read, getDescendantStationIds } from "../store.js";
import { isStationHead, isActiveUser } from "../services/training.js";
import { getStats } from "../services/reports.js";
import { summarize, ASPECTS } from "../services/feedback.js";

await ready;
const user = await requireRole(["admin"]);
await renderShell(user, "reports");

const $ = id => document.getElementById(id);
const stars = r => r ? `<span class="stars" aria-label="${r} out of 5">${"★".repeat(Math.round(r))}<span class="off">${"★".repeat(5 - Math.round(r))}</span></span> ${r}` : "—";

const s = await getStats(user);
const fb = await summarize();
let officers = (await read.all("users")).filter(u => u.role === "trainee" && isActiveUser(u));
if (isStationHead(user)) { const scope = await getDescendantStationIds(user.stationId); officers = officers.filter(o => scope.has(o.stationId)); }
const stations = new Map((await read.all("stations")).map(x => [x.id, x.name]));
const maxMod = Math.max(1, ...s.byModule.map(m => m.enrolled));
const maxCat = Math.max(1, ...s.byCategory.map(c => Math.max(c.enrolled, c.certified)));

$("page-sub").textContent = isStationHead(user)
  ? "Your region: courses, enrolments, certifications, assessments and participation."
  : "All regions: courses, enrolments, certifications, assessments and participation, updated as officers train.";

$("view").innerHTML = `
  <div class="stack-5">
    <div class="summary">
      <div><b>${s.headline.officers}</b><span>officers</span></div>
      <div><b>${s.headline.enrollments}</b><span>enrolments, ${s.headline.activeEnrollments} active</span></div>
      <div><b>${s.headline.certifications}</b><span>certifications, ${s.headline.certsThisMonth} this month</span></div>
      <div><b>${s.headline.participation}%</b><span>officers active in the last 30 days</span></div>
    </div>

    <div class="grid-2" style="gap: var(--sp-5)">
      <section class="panel"><div class="panel-title"><h2>Assessments</h2></div>
        <dl class="kv-list">
          <dt>Module quiz attempts</dt><dd>${s.assessments.quizAttempts}</dd>
          <dt>Quiz pass rate (70%)</dt><dd>${s.assessments.quizPassRate}%</dd>
          <dt>Average best quiz score</dt><dd>${s.assessments.quizAvg ?? "—"}${s.assessments.quizAvg != null ? "%" : ""}</dd>
          <dt>Trainer questionnaires</dt><dd>${s.assessments.questionnaires}</dd>
          <dt>Questionnaire responses</dt><dd>${s.assessments.responses}</dd>
          <dt>Average questionnaire score</dt><dd>${s.assessments.questionnaireAvg ?? "—"}${s.assessments.questionnaireAvg != null ? "%" : ""}</dd>
        </dl>
      </section>
      <section class="panel"><div class="panel-title"><h2>Pipeline</h2></div>
        <dl class="kv-list">
          <dt>Courses in the catalogue</dt><dd>${s.headline.modules}</dd>
          <dt>Officers enrolled in at least one</dt><dd>${s.headline.enrolledShare}%</dd>
          <dt>Enrolment requests and nominations waiting</dt><dd>${s.headline.pendingRequests}</dd>
          ${s.headline.pendingAccounts != null ? `<dt>Account requests waiting</dt><dd>${s.headline.pendingAccounts}</dd>` : ""}
        </dl>
        <div class="row" style="margin-top: var(--sp-4)"><a class="btn btn-secondary btn-sm" href="admin.html">Open nominations</a>
          ${s.headline.pendingAccounts != null ? `<a class="btn btn-secondary btn-sm" href="users.html">Open account requests</a>` : ""}</div>
      </section>
    </div>

    <section class="panel"><div class="panel-title"><h2>Courses</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Module</th><th>Enrolled</th><th class="num">Completed</th><th class="num">Certified</th><th>Rating</th></tr></thead>
        <tbody>${s.byModule.map(m => `<tr><td><b>${escapeHtml(m.module.code)}</b> ${escapeHtml(m.module.title)}</td>
          <td><span class="bar-cell"><span class="mini-bar"><span style="width:${Math.round(100 * m.enrolled / maxMod)}%"></span></span>${m.enrolled}</span></td>
          <td class="num">${m.completed}</td><td class="num">${m.certified}</td>
          <td>${m.ratings ? `${stars(m.rating)} <span class="meta-line">(${m.ratings})</span>` : "—"}</td></tr>`).join("")}</tbody></table></div>
    </section>

    <div class="grid-2" style="gap: var(--sp-5)">
      <section class="panel"><div class="panel-title"><h2>By subject</h2></div>
        <div class="legend"><span><i style="background: var(--teal-600)"></i>Enrolled</span><span><i style="background: var(--navy-600)"></i>Certified</span></div>
        <ul class="bars">${s.byCategory.map(c => `<li><span>${escapeHtml(c.label)}</span>
          <span class="track" style="flex-direction:column;height:16px"><span style="width:${Math.round(100 * c.enrolled / maxCat)}%;height:50%"></span><span class="b2" style="width:${Math.round(100 * c.certified / maxCat)}%;height:50%"></span></span>
          <span class="val">${c.enrolled} / ${c.certified}</span></li>`).join("")}</ul>
      </section>
      <section class="panel"><div class="panel-title"><h2>Participation by region</h2></div>
        <ul class="bars">${s.byRmc.map(r => `<li><span>${escapeHtml(r.name)}</span>
          <span class="track"><span style="width:${r.officers ? Math.round(100 * r.enrolled / r.officers) : 0}%"></span></span>
          <span class="val">${r.enrolled} of ${r.officers}</span></li>`).join("") || `<li><span class="muted">No regions in view.</span></li>`}</ul>
        <p class="meta-line" style="margin-top: var(--sp-3)">Officers enrolled in at least one module, out of all officers in the region.</p>
      </section>
    </div>

    <section class="panel"><div class="panel-title"><h2>Course feedback</h2><span class="meta-line">Officers' names are not shown</span></div>
      ${fb.length ? fb.map(f => `
        <div style="padding: var(--sp-3) 0; border-top: 1px solid var(--line)">
          <div class="q-top"><b>${escapeHtml(f.module.code)}: ${escapeHtml(f.module.title)}</b><span>${stars(f.rating)} <span class="meta-line">from ${f.count}</span></span></div>
          <p class="meta-line" style="margin: 4px 0">${Object.entries(ASPECTS).map(([k, l]) => `${l}: ${f.aspects[k] ?? "—"}/5`).join(" · ")}</p>
          ${f.comments.slice(0, 3).map(c => `<p style="margin: 4px 0; font-size: var(--fs-sm)">"${escapeHtml(c.text)}"</p>`).join("")}
        </div>`).join("") : `<div class="empty"><p>No feedback yet.</p></div>`}
    </section>

    <section class="panel"><div class="panel-title"><h2>APAR training reports</h2></div>
      <p class="muted small">Each officer's training and competency record for the appraisal year, ready to print or save as PDF.</p>
      <div class="toolbar"><label class="visually-hidden" for="apar-search">Find an officer</label>
        <input class="input" id="apar-search" type="search" placeholder="Find an officer by name, ID or station"></div>
      <div class="table-wrap"><table><thead><tr><th>Officer</th><th>Station</th><th></th></tr></thead>
        <tbody id="apar-rows"></tbody></table></div>
    </section>
  </div>`;

function renderApar(q = "") {
  const rows = officers.filter(o => !q || `${o.name} ${o.empId} ${stations.get(o.stationId)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
  $("apar-rows").innerHTML = rows.map(o => `<tr><td><b>${escapeHtml(o.name)}</b> <span class="meta-line">${escapeHtml(o.empId)}</span></td>
    <td>${escapeHtml(stations.get(o.stationId) || "")}</td><td><a class="btn btn-secondary btn-sm" href="apar.html?u=${o.id}">Open report</a></td></tr>`).join("")
    || `<tr><td colspan="3" class="muted">No officers match.</td></tr>`;
}
$("apar-search").addEventListener("input", e => renderApar(e.target.value));
renderApar();
