import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml } from "../ui.js";
import { getCatalog, requestEnrollment } from "../services/training.js";
import { summarize } from "../services/feedback.js";

await ready;
const user = await requireRole(["trainee"]);
await renderShell(user, "courses");

const $ = id => document.getElementById(id);
const view = $("view");
let catalog = null;
let ratings = new Map();
let filter = "all";
let query = "";
let chosen = null;

const STATUS = {
  available: null,
  requested: ["Request sent", "warn"],
  enrolled: ["Enrolled", "ok"],
  certified: ["Certified", "ok"]
};
const stars = r => r ? `<span class="stars" aria-label="${r} out of 5">${"★".repeat(Math.round(r))}<span class="off">${"★".repeat(5 - Math.round(r))}</span></span> ${r}` : "";

function render() {
  const cats = catalog.categories;
  const q = query.toLowerCase();
  const shown = catalog.modules.filter(m => (filter === "all" || m.category === filter) &&
    (!q || `${m.code} ${m.title} ${m.description}`.toLowerCase().includes(q)));
  view.innerHTML = `
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filter by subject">
        <button type="button" class="chip" data-f="all" aria-pressed="${filter === "all"}">All subjects</button>
        ${cats.map(c => `<button type="button" class="chip" data-f="${c.key}" aria-pressed="${filter === c.key}">${escapeHtml(c.label)}</button>`).join("")}
      </div>
      <label class="visually-hidden" for="course-search">Search courses</label>
      <input class="input" id="course-search" type="search" placeholder="Search courses" value="${escapeHtml(query)}">
    </div>
    ${shown.length ? `<div class="card-grid">${shown.map(m => {
      const st = STATUS[m.status];
      const r = ratings.get(m.id);
      return `
      <article class="card">
        <span class="code">${escapeHtml(m.code)} · ${escapeHtml(cats.find(c => c.key === m.category)?.label || "")}</span>
        <h3>${escapeHtml(m.title)}</h3>
        <p>${escapeHtml(m.description)}</p>
        <p class="meta-line">${escapeHtml(m.level)} · about ${m.durationHrs} hours${m.requiresPractical ? " · includes a practical task" : ""}</p>
        ${r ? `<p class="meta-line">${stars(r.rating)} from ${r.count} officer${r.count === 1 ? "" : "s"}</p>` : ""}
        ${m.rejectedNote ? `<p class="meta-line" style="color: var(--danger)">Last request not approved: ${escapeHtml(m.rejectedNote)}</p>` : ""}
        <div class="card-foot">
          ${st ? `<span class="pill pill-${st[1]}">${st[0]}</span>` : `<span></span>`}
          ${m.status === "available" ? `<button class="btn btn-primary btn-sm" type="button" data-enrol="${m.id}">Request enrolment</button>`
            : m.status === "enrolled" && m.enrollmentId ? `<a class="btn btn-secondary btn-sm" href="module.html?e=${m.enrollmentId}">Open module</a>` : ""}
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty"><p>No courses match.</p></div>`}`;
  view.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; render(); }));
  $("course-search").addEventListener("input", e => { query = e.target.value; const pos = e.target.selectionStart; render(); const s = $("course-search"); s.focus(); s.setSelectionRange(pos, pos); });
  view.querySelectorAll("[data-enrol]").forEach(b => b.addEventListener("click", () => {
    chosen = catalog.modules.find(m => m.id === b.dataset.enrol);
    $("enrol-where").textContent = `${chosen.code}: ${chosen.title}. The request goes to the Training Division, like a nomination from your station head.`;
    $("enrol-reason").value = "";
    $("enrol-error").textContent = "";
    $("enrol").showModal();
  }));
}

$("enrol-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await requestEnrollment(user, { moduleId: chosen.id, reason: $("enrol-reason").value });
    $("enrol").close();
    toast(`Enrolment requested for ${chosen.code}.${navigator.onLine ? "" : " Saved on this device; it will sync when you're back online."}`, "ok", 5000);
    catalog = await getCatalog(user);
    render();
  } catch (err) { $("enrol-error").textContent = err.message; }
});
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

catalog = await getCatalog(user);
ratings = new Map((await summarize()).map(s => [s.module.id, s]));
render();
