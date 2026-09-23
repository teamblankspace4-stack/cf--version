import { ready } from "../app.js";
import { requireRole, HOME_BY_ROLE } from "../auth.js";
import { renderShell } from "../shell.js";
import { escapeHtml, formatDate } from "../ui.js";
import { read } from "../store.js";
import { getAparReport } from "../services/reports.js";
import { RUBRIC, LEVELS } from "../services/mentoring.js";

await ready;
const user = await requireRole(["trainee", "trainer", "admin"]);
const targetId = new URLSearchParams(location.search).get("u") || user.id;
await renderShell(user, user.role === "admin" ? "reports" : "profile", "APAR training report");

const $ = id => document.getElementById(id);
const SKILL = { aws: "AWS and surface instruments", radar: "Radar", satellite: "Satellite data analysis", aviation: "Aviation meteorology" };
const levelLabel = v => LEVELS.find(l => l.value === v)?.label || "—";
$("back-link").href = user.role === "admin" ? "reports.html" : targetId === user.id ? "profile.html" : HOME_BY_ROLE[user.role];
$("print-btn").addEventListener("click", () => window.print());

try {
  const r = await getAparReport(user, targetId);
  const o = r.officer;
  let rmc = r.station;
  while (rmc && rmc.parentId) rmc = await read.one("stations", rmc.parentId);
  const practicals = r.trainings.filter(t => t.practical && t.practical.status === "reviewed");
  document.title = `APAR training report · ${o.name} · Capacity Connect`;

  $("view").innerHTML = `
  <article class="apar" aria-label="APAR training report">
    <header class="apar-head">
      <div class="apar-brand"><img src="assets/icons/mark.svg" alt=""><div><b>Capacity Connect</b><span>India Meteorological Department · Ministry of Earth Sciences</span></div></div>
      <div class="apar-title"><h1>Training and competency record</h1><p>For the Annual Performance Appraisal Report · ${escapeHtml(r.period.label)}</p></div>
    </header>

    <h2>A. Officer</h2>
    <div class="apar-grid">
      <div><span>Name</span><b>${escapeHtml(o.name)}</b></div>
      <div><span>Employee ID</span><b>${escapeHtml(o.empId)}</b></div>
      <div><span>Designation</span><b>${escapeHtml(o.designation)}</b></div>
      <div><span>Station</span><b>${escapeHtml(r.station?.name || "")}</b></div>
      <div><span>Regional Met Centre</span><b>${escapeHtml(rmc && rmc.type === "RMC" ? rmc.name : "—")}</b></div>
      <div><span>Certified field skills</span><b>${r.certifiedSkills.map(s => escapeHtml(SKILL[s] || s)).join(", ") || "—"}</b></div>
    </div>

    <h2>B. Summary</h2>
    <div class="apar-stats">
      <div><b>${r.totals.certified}</b><span>modules certified</span></div>
      <div><b>${r.totals.hours}</b><span>training hours completed</span></div>
      <div><b>${r.totals.avgCompetency != null ? r.totals.avgCompetency + "%" : "—"}</b><span>average practical competency</span></div>
      <div><b>${r.totals.inProgress}</b><span>modules in progress</span></div>
    </div>

    <h2>C. Training undertaken</h2>
    ${r.trainings.length ? `<table><thead><tr><th>Module</th><th>Batch</th><th>Status</th><th>Best quiz</th><th>Practical competency</th><th>Certificate</th></tr></thead>
      <tbody>${r.trainings.map(t => `<tr>
        <td><b>${escapeHtml(t.module?.code || "")}</b> ${escapeHtml(t.module?.title || "")}</td>
        <td>${escapeHtml(t.batch?.name || "—")}</td>
        <td>${escapeHtml(t.status)}</td>
        <td>${t.quizBest != null ? `${t.quizBest}% (${t.quizAttempts} attempt${t.quizAttempts === 1 ? "" : "s"})` : "—"}</td>
        <td>${t.practical?.score != null ? `${t.practical.score}%` : t.practical ? escapeHtml(t.practical.status === "submitted" ? "Awaiting review" : t.practical.status === "returned" ? "Returned for rework" : "—") : "—"}</td>
        <td>${t.certificate ? `${escapeHtml(t.certificate.certNo)}<br><span class="remarks">Issued ${formatDate(t.certificate.issuedAt)}, score ${t.certificate.score}%</span>` : "—"}</td>
      </tr>`).join("")}</tbody></table>` : `<p class="none">No training recorded in this period.</p>`}

    <h2>D. Practical competency assessments</h2>
    ${practicals.length ? `<table><thead><tr><th>Module</th>${RUBRIC.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}<th>Competency</th><th>Assessed by</th></tr></thead>
      <tbody>${practicals.map(t => `<tr>
        <td><b>${escapeHtml(t.module?.code || "")}</b></td>
        ${RUBRIC.map(c => `<td>${t.practical.scores ? `${t.practical.scores[c.key]} · ${escapeHtml(levelLabel(t.practical.scores[c.key]))}` : "—"}</td>`).join("")}
        <td><b>${t.practical.score}%</b></td>
        <td>${escapeHtml(t.practical.reviewer?.name || "")}</td>
      </tr>${t.practical.feedback ? `<tr><td colspan="${RUBRIC.length + 3}" class="remarks">Mentor's remarks: ${escapeHtml(t.practical.feedback)}</td></tr>` : ""}`).join("")}</tbody></table>
      <p class="remarks" style="margin-top:6px">Rubric levels: ${LEVELS.map(l => `${l.value} ${escapeHtml(l.label)}`).join(", ")}. Any criterion at "Not yet" is returned for rework, not approved.</p>`
      : `<p class="none">No practical tasks assessed in this period.</p>`}

    <h2>E. Trainer assessments</h2>
    ${r.questionnaires.length ? `<table><thead><tr><th>Questionnaire</th><th>Score</th><th>Result</th><th>Submitted</th></tr></thead>
      <tbody>${r.questionnaires.map(q => `<tr><td>${escapeHtml(q.questionnaire.title)}</td><td>${q.score}%</td>
        <td>${q.passed ? "Passed" : "Below pass mark"}</td><td>${formatDate(q.submittedAt)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="none">No trainer questionnaires submitted in this period.</p>`}

    <h2>F. Contribution to station continuity</h2>
    <p style="margin:0">Station knowledge entries written: <b>${r.capsuleContributions}</b>. Handovers received and acknowledged: <b>${r.handovers.filter(h => h.status === "acknowledged").length}</b>${r.handovers.some(h => h.status === "pending") ? ` (${r.handovers.filter(h => h.status === "pending").length} in progress)` : ""}.</p>

    <h2>G. Record integrity</h2>
    <div class="apar-integrity">
      <p style="margin:0 0 4px">Audit trail check at ${formatDate(r.integrity.checkedAt, true)}: ${r.integrity.ok ? `<span class="ok-text">intact</span>` : `<span class="bad-text">altered</span>`}, ${r.integrity.entries} entries verified.</p>
      <p style="margin:0 0 4px">Latest audit hash: <code>${escapeHtml(r.integrity.head || "—")}</code></p>
      <p style="margin:0">Every nomination, approval, assessment and certificate above is recorded in a SHA-256 hash-chained audit trail. Each certificate also carries a QR code with a digital signature, verifiable on any phone at the portal's verification page.</p>
    </div>

    <div class="apar-sign">
      <div>Officer<span>${escapeHtml(o.name)}</span></div>
      <div>Reporting officer<span>Name, designation and date</span></div>
      <div>Reviewing officer<span>Name, designation and date</span></div>
    </div>
    <p class="apar-note">Generated by Capacity Connect on ${formatDate(new Date().toISOString(), true)} by ${escapeHtml(r.generatedBy.name)}. This is the training section supporting the officer's APAR, compiled from the portal's record. Prototype for Smart India Hackathon 2026; not an official APAR form.</p>
  </article>`;
} catch (err) {
  $("view").innerHTML = `<div class="panel"><div class="empty"><p>${escapeHtml(err.message)}</p></div></div>`;
}
