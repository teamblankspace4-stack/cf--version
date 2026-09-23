import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { escapeHtml, formatDate } from "../ui.js";
import { getTraineeOverview, categoryLabel } from "../services/training.js";
import { getTrainingSummary } from "../services/learning.js";
import { getMyHandovers } from "../services/capsule.js";
import { listForTrainee, deadlineOf } from "../services/questionnaires.js";

await ready;
const user = await requireRole(["trainee"]);
await renderShell(user, "training");

const [{ nominations, certificates, lookup }, summary] = await Promise.all([getTraineeOverview(user), getTrainingSummary(user)]);
const station = lookup.stations.get(user.stationId);
document.getElementById("page-title").textContent = `Welcome back, ${user.name.split(" ")[0]}.`;
document.getElementById("page-sub").textContent = `Here's where your training stands. ${user.designation}, ${station ? station.name : ""}.`;

/* Trainer questionnaires still open for this officer */
const dueQs = (await listForTrainee(user)).filter(q => q.state === "due");
function dueList() {
  if (!dueQs.length) return "";
  return `
    <section class="panel" aria-labelledby="h-due">
      <div class="panel-title"><h2 id="h-due">Assessments due</h2><a class="btn btn-secondary btn-sm" href="questionnaires.html">All assessments</a></div>
      <div class="table-wrap"><table><thead><tr><th>Questionnaire</th><th>Module</th><th>Set by</th><th>Deadline</th><th></th></tr></thead>
      <tbody>${dueQs.map(q => { const days = Math.ceil((deadlineOf(q) - Date.now()) / 86400000); return `<tr>
        <td><b>${escapeHtml(q.title)}</b></td><td>${escapeHtml(q.module?.code || "")}</td><td>${escapeHtml(q.trainer?.name || "")}</td>
        <td><span class="pill pill-warn">${days <= 1 ? "Due today" : `${days} days left`}</span></td>
        <td><a class="btn btn-primary btn-sm" href="questionnaires.html">Start</a></td></tr>`; }).join("")}</tbody></table></div>
    </section>`;
}

/* A handover addressed to this officer comes first */
const pendingHandover = (await getMyHandovers(user)).find(h => h.status === "pending");
function handoverSpotlight() {
  if (!pendingHandover) return "";
  const h = pendingHandover;
  const left = h.mustReadIds.length - h.readIds.length;
  return `
    <section class="spotlight" aria-labelledby="h-handover">
      <div>
        <p class="eyebrow is-warn">Handover waiting for you</p>
        <h2 id="h-handover">You're taking over at ${escapeHtml(h.station?.name || "")}</h2>
        <p>${escapeHtml(h.from?.name || "The outgoing officer")} has left ${h.mustReadIds.length} must-read notes about the station. ${left ? `${left} still to read.` : "All read; acknowledge to finish."}</p>
      </div>
      <a class="btn btn-primary btn-lg" href="capsule.html?s=${h.stationId}">Open the handover</a>
    </section>`;
}

/* Stat cards and the "continue where you left off" spotlight */
const unitsDone = summary.reduce((a, s) => a + s.doneCount, 0);
const unitsTotal = summary.reduce((a, s) => a + s.total, 0);
const resume = summary.find(s => s.hasContent && s.next && s.doneCount > 0) || summary.find(s => s.hasContent && s.next);

function spotlight() {
  if (!resume) return "";
  const pct = Math.round(resume.pct * 100);
  const href = `module.html?e=${resume.enrollment.id}${resume.next ? `&u=${resume.next.id}` : ""}`;
  return `
    <section class="spotlight" aria-labelledby="h-resume">
      <div>
        <p class="eyebrow">${resume.doneCount ? "Continue where you left off" : "Ready to start"}</p>
        <h2 id="h-resume">${escapeHtml(resume.module.title)}</h2>
        <p>Next up: ${escapeHtml(resume.next.title)}. Units open in order, and your progress saves on this device even without a network.</p>
        <div class="spot-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <p class="spot-meta">${pct}% complete · ${resume.doneCount} of ${resume.total} units done</p>
        <div class="row" style="margin-top: var(--sp-5)">
          <a class="btn btn-primary btn-lg" href="${href}">${resume.doneCount ? "Resume" : "Start"} ${escapeHtml(resume.module.code)}</a>
          ${resume.downloaded ? `<span class="pill pill-ok">Available offline</span>` : ""}
        </div>
      </div>
      <dl class="spot-facts">
        <div><dt>Module</dt><dd>${escapeHtml(resume.module.code)}</dd></div>
        <div><dt>Next unit</dt><dd>${escapeHtml(resume.next.type ? { video: "Video lesson", reading: "Reading", quiz: "Quiz", practical: "Practical task" }[resume.next.type] || "" : "")}</dd></div>
        <div><dt>Units done</dt><dd>${resume.doneCount} of ${resume.total}</dd></div>
        <div><dt>Mentor</dt><dd>${escapeHtml(resume.trainer?.name || "To be assigned")}</dd></div>
      </dl>
    </section>`;
}

function startsIn(dateStr) {
  const days = Math.ceil((new Date(dateStr + "T00:00:00") - new Date()) / 86400000);
  return days > 1 ? `Batch starts in ${days} days` : days === 1 ? "Batch starts tomorrow" : null;
}

function courseCard(s) {
  const m = s.module;
  const pct = Math.round(s.pct * 100);
  const href = `module.html?e=${s.enrollment.id}`;
  let status, action;
  if (!s.hasContent) {
    status = `<span class="pill">Content being prepared</span>`;
    action = `<button class="btn btn-secondary" disabled>Open module</button>`;
  } else if (s.doneCount === s.total && !s.waitingReview) {
    status = `<span class="pill pill-ok">Complete</span>`;
    action = `<a class="btn btn-secondary" href="${href}">Review</a>`;
  } else if (s.waitingReview && !s.next) {
    status = `<span class="pill pill-warn">Practical with mentor</span>`;
    action = `<a class="btn btn-secondary" href="${href}">Open module</a>`;
  } else {
    const soon = s.batch ? startsIn(s.batch.startDate) : null;
    status = soon ? `<span class="pill pill-warn">${soon}</span>`
      : s.doneCount ? `<span class="pill pill-ok">In progress</span>`
      : `<span class="pill">Ready to start</span>`;
    action = `<a class="btn btn-primary" href="${href}">${s.doneCount ? "Continue" : "Start"}</a>`;
  }
  return `
  <article class="course">
    <div>
      <span class="course-code">${escapeHtml(m.code)}, ${escapeHtml(categoryLabel(lookup, m.category))}</span>
      <h3>${escapeHtml(m.title)}</h3>
      <p class="course-meta">Mentor: ${escapeHtml(s.trainer?.name || "to be assigned")}. ${escapeHtml(s.batch?.name || "")}.</p>
      <div class="course-progress">
        <div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <span>${s.doneCount} of ${s.total} units</span>
      </div>
      ${s.next ? `<p class="course-next">Next: ${escapeHtml(s.next.title)}</p>` : ""}
    </div>
    <div class="course-side">
      ${status}
      ${s.downloaded ? `<span class="pill pill-ok">Available offline</span>` : ""}
      ${action}
    </div>
  </article>`;
}

document.getElementById("view").innerHTML = `
  <div class="dash-grid">
    <div class="summary" role="group" aria-label="Your training at a glance">
      <div><b>${unitsDone} / ${unitsTotal}</b><span>units completed</span></div>
      <div><b>${certificates.length}</b><span>certificates earned</span></div>
      <div><b>${summary.filter(s => s.doneCount < s.total || s.waitingReview).length}</b><span>modules in progress</span></div>
    </div>
    ${handoverSpotlight()}
    ${spotlight()}
    ${dueList()}
    <section class="panel" aria-labelledby="h-training">
      <div class="panel-title"><h2 id="h-training">Your training</h2></div>
      ${summary.length ? `<div class="course-list">${summary.map(courseCard).join("")}</div>`
        : `<div class="empty"><p>You're not in any training yet. Your station head nominates you for modules your station needs.</p></div>`}
    </section>

    ${nominations.length ? `
    <section class="panel" aria-labelledby="h-noms">
      <div class="panel-title"><h2 id="h-noms">Nominations</h2></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Module</th><th>Nominated by</th><th>Status</th><th>Note</th></tr></thead>
        <tbody>${nominations.map(n => `
          <tr><td>${escapeHtml(n.module.code)}: ${escapeHtml(n.module.title)}</td>
          <td>${escapeHtml(n.nominator?.name || "")}</td>
          <td>${n.status === "pending" ? '<span class="pill pill-warn">Waiting for approval</span>' : '<span class="pill pill-danger">Not approved</span>'}</td>
          <td style="white-space:normal">${escapeHtml(n.decisionNote || "")}</td></tr>`).join("")}
        </tbody></table></div>
    </section>` : ""}

    <section class="panel" aria-labelledby="h-certs">
      <div class="panel-title"><h2 id="h-certs">Certificates</h2></div>
      ${certificates.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Certificate</th><th>Module</th><th>Score</th><th>Competency</th><th>Issued</th><th></th></tr></thead>
        <tbody>${certificates.map(c => `
          <tr><td>${escapeHtml(c.certNo)}</td><td>${escapeHtml(c.module.code)}: ${escapeHtml(c.module.title)}</td>
          <td>${c.score}%</td><td>${c.competencyScore != null ? c.competencyScore + "%" : "—"}</td><td>${formatDate(c.issuedAt)}</td>
          <td><a class="btn btn-secondary btn-sm" href="certificate.html?id=${c.id}">View and verify</a></td></tr>`).join("")}
        </tbody></table></div>` : `<div class="empty"><p>Certificates appear here when you complete a module.</p></div>`}
    </section>
  </div>`;
