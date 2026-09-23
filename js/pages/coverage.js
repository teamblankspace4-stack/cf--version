import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml } from "../ui.js";
import { getStationTree, read } from "../store.js";
import { isDivision } from "../services/training.js";
import {
  getCoverage, getBackupCandidates, getSkillModules, assignBackupTraining,
  SKILL_LABEL, RISK
} from "../services/coverage.js";

await ready;
const user = await requireRole(["admin"]);
await renderShell(user, "coverage");

const $ = id => document.getElementById(id);
const view = $("view");
let data = null;
let current = null;           // the alert row being acted on

const offlineSuffix = () => navigator.onLine ? "" : " Saved on this device; it will sync when you're back online.";

/* ---------- station filter, indented by hierarchy ---------- */
async function buildStationFilter() {
  const tree = await getStationTree();
  const opts = [`<option value="">All regions and stations</option>`];
  const walk = (nodes, depth) => nodes.forEach(n => {
    if (n.type !== "HQ") {
      opts.push(`<option value="${n.id}">${"&nbsp;".repeat(depth * 4)}${escapeHtml(n.name)}</option>`);
    }
    walk(n.children, n.type === "HQ" ? depth : depth + 1);
  });
  walk(tree, 0);
  $("station-filter").innerHTML = opts.join("");
  if (!isDivision(user)) {
    // A station head only sees their own branch.
    $("station-filter").value = user.stationId;
    $("station-filter").disabled = true;
  }
}

/* ---------- rendering ---------- */
function holderText(row) {
  if (!row.holders.length) return `<span class="name">No certified officer</span> at this station.`;
  const names = row.holders.map(h => `<span class="name">${escapeHtml(h.name)}</span>`).join(", ");
  if (row.holders.length === 1) {
    const leaving = row.leavingSoon.length ? ` Transfer due ${row.leavingSoon[0].transferDue}.` : "";
    return `Only ${names} holds this skill here.${leaving}`;
  }
  return `${row.holders.length} officers certified: ${names}.`;
}

function alertItem(row) {
  const r = RISK[row.level];
  const training = row.inTraining.length
    ? `<span class="pill">${row.inTraining.length} in training</span>` : "";
  return `
    <li>
      <div>
        <div class="alert-head">
          <b>${escapeHtml(row.station.name)}</b>
          <span class="muted">${escapeHtml(SKILL_LABEL[row.skill])}${row.parent ? `, under ${escapeHtml(row.parent.name)}` : ""}</span>
          <span class="pill pill-${r.pill}">${r.label}</span>
          ${training}
        </div>
        <p class="alert-detail">${holderText(row)} The station operates ${escapeHtml(row.facility)}.</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-primary" type="button" data-backup="${row.station.id}|${row.skill}">Assign backup training</button>
      </div>
    </li>`;
}

function render() {
  const { rows, summary } = data;
  const filter = $("risk-filter").value;
  const shown = rows.filter(r => filter === "all" ? true : filter === "risk" ? r.level !== "ok" : r.level === filter);

  view.innerHTML = `
    <div class="risk-summary">
      <div class="risk-card is-critical"><b>${summary.critical}</b><span>stations with no cover for a skill they operate</span></div>
      <div class="risk-card is-single"><b>${summary.single}</b><span>single points of failure</span></div>
      <div class="risk-card is-ok"><b>${summary.ok}</b><span>skills with two or more certified officers</span></div>
      <div class="risk-card"><b>${summary.stations}</b><span>stations assessed${summary.unstaffed ? `, ${summary.unstaffed} skipped with no officers on record` : ""}</span></div>
    </div>

    <section class="panel" aria-labelledby="h-alerts">
      <div class="panel-title">
        <h2 id="h-alerts">${filter === "all" ? "Coverage" : "Alerts"}</h2>
        <span class="small muted">${shown.length} of ${rows.length} skill requirements</span>
      </div>
      ${shown.length ? `<ul class="alert-list">${shown.map(alertItem).join("")}</ul>`
        : `<div class="empty"><p>Nothing to show for this filter. Every station in view has at least two certified officers for the skills it operates.</p></div>`}
    </section>

    <section class="panel" aria-labelledby="h-table" style="margin-top: var(--sp-5)">
      <div class="panel-title"><h2 id="h-table">Coverage by station</h2></div>
      <div class="table-wrap"><table class="cov-table">
        <thead><tr><th>Station</th><th>Under</th><th>Skill</th><th class="num">Certified</th><th>Officers with the skill</th><th>Status</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.station.name)}</td>
            <td>${escapeHtml(r.parent?.name || "—")}</td>
            <td class="skill-cell">${escapeHtml(SKILL_LABEL[r.skill])}</td>
            <td class="num">${r.holders.length}</td>
            <td class="holders">${r.holders.map(h => escapeHtml(h.name)).join(", ") || "—"}</td>
            <td><span class="pill pill-${RISK[r.level].pill}">${RISK[r.level].label}</span></td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    </section>`;

  view.querySelectorAll("[data-backup]").forEach(b => b.addEventListener("click", () => {
    const [stationId, skill] = b.dataset.backup.split("|");
    openBackup(rows.find(r => r.station.id === stationId && r.skill === skill));
  }));
}

async function refresh() {
  data = await getCoverage(user, { stationId: $("station-filter").value || null });
  render();
}

/* ---------- assign backup ---------- */
async function openBackup(row) {
  current = row;
  const [candidates, modules] = await Promise.all([getBackupCandidates(row), getSkillModules(row.skill)]);
  $("backup-where").textContent = `${row.station.name}, ${SKILL_LABEL[row.skill]}. ${row.holders.length} officer${row.holders.length === 1 ? "" : "s"} certified today.`;
  $("backup-officer").innerHTML = candidates.length
    ? candidates.map(c => `<option value="${c.id}"${c.busy ? " disabled" : ""}>${escapeHtml(c.name)}, ${escapeHtml(c.designation)}${c.sameStation ? "" : `, ${escapeHtml(c.stationName)}`}${c.busy ? " (already in training)" : ""}</option>`).join("")
    : `<option value="">No officer available at this station</option>`;
  $("backup-module").innerHTML = modules.map(m => `<option value="${m.id}">${escapeHtml(m.code)}: ${escapeHtml(m.title)} (${escapeHtml(m.level)})</option>`).join("");
  $("backup-effect").textContent = isDivision(user)
    ? "Approving here enrols the officer straight into a batch, so cover moves from one officer to two."
    : "This raises a nomination for the Training Division to approve.";
  $("backup-submit").textContent = isDivision(user) ? "Assign and enrol" : "Send nomination";
  $("backup-error").textContent = "";
  $("backup-dialog").showModal();
}

$("backup-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("backup-submit");
  btn.disabled = true;
  try {
    const res = await assignBackupTraining(user, {
      row: current, userId: $("backup-officer").value, moduleId: $("backup-module").value
    });
    $("backup-dialog").close();
    const officer = (await read.one("users", res.nomination.userId))?.name || "The officer";
    toast(res.approved
      ? `${officer} enrolled in ${res.batch.name}. ${current.station.name} will have a backup for ${SKILL_LABEL[current.skill]}.${offlineSuffix()}`
      : `Nomination sent to the Training Division for ${officer}.${offlineSuffix()}`, "ok", 6000);
    await refresh();
  } catch (err) {
    $("backup-error").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
$("station-filter").addEventListener("change", refresh);
$("risk-filter").addEventListener("change", render);

/* ---------- boot ---------- */
$("scope-line").textContent = isDivision(user)
  ? "Every station, by the skills it actually operates. Filter by Regional Met Centre, Met Centre or observatory."
  : "Your region, by the skills each station actually operates.";
await buildStationFilter();
await refresh();
