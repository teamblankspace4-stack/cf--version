import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import {
  isDivision, isStationHead, getLookup, categoryLabel, getNominationCandidates, nominate,
  getNominationsFor, getTrainersFor, getBatchesForModule, getAllBatches, approveNominations, rejectNomination
} from "../services/training.js";
import { getCoverage, SKILL_LABEL } from "../services/coverage.js";

await ready;
const user = await requireRole(["admin"]);
await renderShell(user, "nominations");

const view = document.getElementById("view");
const $ = id => document.getElementById(id);
let lookup = await getLookup();

const SKILL_SHORT = { aws: "AWS", radar: "Radar", satellite: "Satellite", aviation: "Aviation" };
const NOM_STATUS = {
  pending: ["Waiting for approval", "warn"],
  approved: ["Approved", "ok"],
  rejected: ["Rejected", "danger"]
};
const CANDIDATE_STATUS = {
  pending: "Already nominated",
  enrolled: "In training",
  certified: "Certified"
};

const offlineSuffix = () => navigator.onLine ? "" : " Saved on this device; it will sync when you're back online.";
const pill = (text, kind) => `<span class="pill pill-${kind}">${escapeHtml(text)}</span>`;
const skillsHtml = (certs, highlight) => `<span class="skills">${(certs || []).map(c =>
  `<span class="skill${c === highlight ? " is-match" : ""}">${SKILL_SHORT[c] || c}</span>`).join("") || '<span class="skill">None yet</span>'}</span>`;
const officerCell = u => `<div class="officer-cell"><b>${escapeHtml(u.name)}</b><span>${escapeHtml(u.empId)}, ${escapeHtml(u.designation)}</span></div>`;

const WARN_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>`;

/* Skill-gap alert, the same numbers the Skill coverage page shows */
async function coverageSpotlight() {
  const { rows, summary } = await getCoverage(user);
  const worst = rows.find(r => r.level === "critical") || rows.find(r => r.level === "single");
  if (!worst) return "";
  const stations = new Set(rows.filter(r => r.level !== "ok").map(r => r.station.id)).size;
  const example = worst.level === "critical"
    ? `${worst.station.name} operates ${worst.facility} but has no officer certified in ${SKILL_LABEL[worst.skill]}.`
    : `At ${worst.station.name}, only ${worst.holders[0].name} holds ${SKILL_LABEL[worst.skill]}.`;
  return `
    <section class="spotlight" aria-labelledby="h-spot">
      <div class="spotlight-row">
        <span class="icon-ring">${WARN_ICON}</span>
        <div>
          <p class="eyebrow is-warn">${isDivision(user) ? "Department-wide" : "Your region"} skill gap alert</p>
          <h2 id="h-spot">${summary.critical + summary.single} duty-critical skills across ${stations} stations rely on one officer or none</h2>
          <p>${escapeHtml(example)} Assign backup training before the next transfer cycle.</p>
        </div>
      </div>
      <a class="btn btn-primary btn-lg" href="coverage.html">Review skill coverage</a>
    </section>`;
}

function moduleOptions() {
  return lookup.categories.map(cat => {
    const mods = lookup.moduleList.filter(m => m.category === cat.key);
    return `<optgroup label="${escapeHtml(cat.label)}">${mods.map(m =>
      `<option value="${m.id}">${escapeHtml(m.code)}: ${escapeHtml(m.title)}</option>`).join("")}</optgroup>`;
  }).join("");
}

/* =========================================================
   STATION HEAD: nominate officers
   ========================================================= */
async function renderStationHead() {
  const station = lookup.stations.get(user.stationId);
  $("page-title").textContent = "Nominate officers";
  $("scope-line").textContent = `${station.name} and the stations under it. The Training Division approves each nomination.`;

  const spot = await coverageSpotlight();
  view.innerHTML = `
    <div class="admin-grid">
      ${spot}
      <section class="panel" aria-labelledby="h-nominate">
        <div class="panel-title"><h2 id="h-nominate">Nominate officers for training</h2></div>
        <div class="field">
          <label for="module-select">Module</label>
          <select class="input" id="module-select">
            <option value="">Choose the skill your station needs</option>
            ${moduleOptions()}
          </select>
        </div>
        <p class="module-info" id="module-info" hidden></p>
        <div id="candidates"></div>
        <div id="nominate-rest" hidden>
          <div class="field" style="margin-top: var(--sp-4)">
            <label for="reason">Why does the station need this?</label>
            <textarea class="input" id="reason" rows="2" placeholder="e.g. Only one officer can run the DWR; backup needed before cyclone season."></textarea>
            <span class="field-hint">The Training Division sees this when prioritising batches.</span>
          </div>
          <div class="form-foot">
            <p class="field-error" id="nominate-error" role="alert"></p>
            <button class="btn btn-primary" id="nominate-btn" disabled>Nominate officers</button>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="h-mine">
        <div class="panel-title"><h2 id="h-mine">Nominations from your region</h2></div>
        <div id="my-noms"></div>
      </section>
    </div>`;

  const select = $("module-select");
  const selected = new Set();

  const updateButton = () => {
    const n = selected.size;
    const btn = $("nominate-btn");
    btn.textContent = n ? `Nominate ${n} officer${n > 1 ? "s" : ""}` : "Nominate officers";
    btn.disabled = !n;
  };

  async function renderCandidates() {
    selected.clear();
    const moduleId = select.value;
    const info = $("module-info");
    if (!moduleId) {
      $("candidates").innerHTML = "";
      info.hidden = true;
      $("nominate-rest").hidden = true;
      return;
    }
    const m = lookup.modules.get(moduleId);
    info.hidden = false;
    info.textContent = `${categoryLabel(lookup, m.category)}, ${m.level}, about ${m.durationHrs} hours${m.requiresPractical ? ", includes a practical task" : ""}. ${m.description}`;

    const rows = await getNominationCandidates(user, moduleId);
    const available = rows.filter(r => r.status === "available");
    $("candidates").innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th class="check"><input type="checkbox" id="select-all" aria-label="Select all available officers" ${available.length ? "" : "disabled"}></th>
            <th>Officer</th><th>Station</th><th>Current skills</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.status !== "available" ? "is-disabled" : ""}" data-id="${r.id}">
                <td class="check"><input type="checkbox" class="pick" value="${r.id}" aria-label="Select ${escapeHtml(r.name)}" ${r.status !== "available" ? "disabled" : ""}></td>
                <td>${officerCell(r)}</td>
                <td>${escapeHtml(r.stationName)}</td>
                <td>${skillsHtml(r.certifications, m.category)}</td>
                <td>${r.status === "available" ? '<span class="muted small">Can be nominated</span>' : escapeHtml(CANDIDATE_STATUS[r.status])}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    $("nominate-rest").hidden = false;
    updateButton();

    const picks = [...document.querySelectorAll(".pick:not(:disabled)")];
    picks.forEach(cb => cb.addEventListener("change", () => {
      cb.checked ? selected.add(cb.value) : selected.delete(cb.value);
      cb.closest("tr").classList.toggle("is-selected", cb.checked);
      $("select-all").checked = selected.size === picks.length;
      updateButton();
    }));
    $("select-all").addEventListener("change", e => {
      picks.forEach(cb => { cb.checked = e.target.checked; cb.dispatchEvent(new Event("change")); });
    });
  }

  select.addEventListener("change", renderCandidates);

  $("nominate-btn").addEventListener("click", async () => {
    const err = $("nominate-error");
    err.textContent = "";
    try {
      const { created, skipped } = await nominate(user, {
        userIds: [...selected], moduleId: select.value, reason: $("reason").value
      });
      const m = lookup.modules.get(select.value);
      toast(`Nominated ${created.length} officer${created.length > 1 ? "s" : ""} for ${m.code}.${offlineSuffix()}`, "ok", 5000);
      if (skipped.length) toast(`Skipped ${skipped.join(", ")}: already nominated or trained.`, "warn", 6000);
      $("reason").value = "";
      await renderCandidates();
      await renderMyNominations();
    } catch (e) {
      err.textContent = e.message;
    }
  });

  async function renderMyNominations() {
    const noms = await getNominationsFor(user);
    $("my-noms").innerHTML = noms.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Officer</th><th>Module</th><th>Submitted</th><th>Status</th><th>Outcome</th></tr></thead>
        <tbody>${noms.map(n => `
          <tr>
            <td>${officerCell(n.officer)}</td>
            <td>${escapeHtml(n.module.code)}</td>
            <td>${formatDate(n.createdAt)}</td>
            <td>${pill(...NOM_STATUS[n.status])}</td>
            <td class="reason">${n.status === "approved" && n.batch ? `Joined ${escapeHtml(n.batch.name)}, starts ${formatDate(n.batch.startDate)}`
              : n.status === "rejected" ? escapeHtml(n.decisionNote || "") : '<span class="muted">Waiting for the Training Division</span>'}</td>
          </tr>`).join("")}
        </tbody></table></div>`
      : `<div class="empty"><p>No nominations yet. Choose a module above to nominate officers.</p></div>`;
  }

  await renderMyNominations();
}

/* =========================================================
   TRAINING DIVISION: approval queue
   ========================================================= */
let approveContext = null;
let rejectContext = null;

async function renderDivision() {
  $("page-title").textContent = "Nominations and batches";
  $("scope-line").textContent = "All regions. Approve nominations into batches and assign trainers.";

  const [noms, batches] = await Promise.all([getNominationsFor(user), getAllBatches()]);
  const pending = noms.filter(n => n.status === "pending");
  const decided = noms.filter(n => n.status !== "pending").sort((a, b) => (b.decidedAt || b.updatedAt).localeCompare(a.decidedAt || a.updatedAt));
  const inTraining = batches.reduce((s, b) => s + b.size, 0);

  // group pending by module
  const groups = new Map();
  for (const n of pending) {
    if (!groups.has(n.moduleId)) groups.set(n.moduleId, []);
    groups.get(n.moduleId).push(n);
  }

  view.innerHTML = `
    <div class="admin-grid">
      <div class="summary" role="group" aria-label="Summary">
        <div><b>${pending.length}</b><span>waiting for approval</span></div>
        <div><b>${batches.length}</b><span>batches formed</span></div>
        <div><b>${inTraining}</b><span>officers in training</span></div>
      </div>
      ${await coverageSpotlight()}

      <section class="panel" aria-labelledby="h-queue">
        <div class="panel-title"><h2 id="h-queue">Waiting for approval</h2></div>
        ${groups.size ? [...groups.entries()].map(([moduleId, list]) => {
          const m = lookup.modules.get(moduleId);
          return `
          <div class="queue-group" data-module="${moduleId}">
            <div class="queue-head">
              <h3>${escapeHtml(m.code)}: ${escapeHtml(m.title)}</h3>
              <span class="muted">${escapeHtml(categoryLabel(lookup, m.category))}, ${list.length} nominated</span>
            </div>
            <div class="table-wrap"><table>
              <thead><tr>
                <th class="check"><input type="checkbox" class="group-all" aria-label="Select all for ${escapeHtml(m.code)}"></th>
                <th>Officer</th><th>Station</th><th>Nominated by</th><th>Reason</th><th>Submitted</th><th></th>
              </tr></thead>
              <tbody>${list.map(n => `
                <tr>
                  <td class="check"><input type="checkbox" class="q-pick" value="${n.id}" aria-label="Select ${escapeHtml(n.officer.name)}"></td>
                  <td>${officerCell(n.officer)}</td>
                  <td>${escapeHtml(n.station?.name || "")}</td>
                  <td>${n.selfRequested ? `<span class="pill">Officer's own request</span>` : escapeHtml(n.nominator?.name || "")}</td>
                  <td class="reason">${escapeHtml(n.reason)}</td>
                  <td>${formatDate(n.createdAt)}</td>
                  <td><button class="btn btn-secondary q-reject" data-id="${n.id}">Reject</button></td>
                </tr>`).join("")}
              </tbody>
            </table></div>
            <div class="queue-foot"><button class="btn btn-primary q-approve" disabled>Approve selected</button></div>
          </div>`;
        }).join("") : `<div class="empty"><p>No nominations waiting. New ones appear here when station heads nominate officers.</p></div>`}
      </section>

      <section class="panel" aria-labelledby="h-batches">
        <div class="panel-title"><h2 id="h-batches">Batches</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Batch</th><th>Module</th><th>Trainer</th><th>Starts</th><th class="num">Officers</th></tr></thead>
          <tbody>${batches.map(b => `
            <tr><td>${escapeHtml(b.name)}</td><td>${escapeHtml(b.module?.title || "")}</td>
            <td>${escapeHtml(b.trainer?.name || "Not assigned")}</td><td>${formatDate(b.startDate)}</td><td class="num">${b.size}</td></tr>`).join("")}
          </tbody>
        </table></div>
      </section>

      <section class="panel" aria-labelledby="h-decided">
        <div class="panel-title"><h2 id="h-decided">Recent decisions</h2></div>
        ${decided.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Officer</th><th>Module</th><th>Decision</th><th>Detail</th><th>Decided</th></tr></thead>
          <tbody>${decided.slice(0, 10).map(n => `
            <tr><td>${officerCell(n.officer)}</td><td>${escapeHtml(n.module.code)}</td><td>${pill(...NOM_STATUS[n.status])}</td>
            <td class="reason">${n.status === "approved" ? escapeHtml(n.batch?.name || "") : escapeHtml(n.decisionNote || "")}</td>
            <td>${formatDate(n.decidedAt || n.updatedAt)}</td></tr>`).join("")}
          </tbody></table></div>` : `<div class="empty"><p>Approved and rejected nominations will be listed here.</p></div>`}
      </section>
    </div>`;

  // selection per group
  view.querySelectorAll(".queue-group").forEach(group => {
    const picks = [...group.querySelectorAll(".q-pick")];
    const btn = group.querySelector(".q-approve");
    const all = group.querySelector(".group-all");
    const refresh = () => {
      const n = picks.filter(p => p.checked).length;
      btn.disabled = !n;
      btn.textContent = n ? `Approve ${n} selected` : "Approve selected";
      all.checked = n === picks.length;
      picks.forEach(p => p.closest("tr").classList.toggle("is-selected", p.checked));
    };
    picks.forEach(p => p.addEventListener("change", refresh));
    all.addEventListener("change", () => { picks.forEach(p => { p.checked = all.checked; }); refresh(); });
    btn.addEventListener("click", () => openApprove(group.dataset.module, picks.filter(p => p.checked).map(p => p.value)));
  });

  view.querySelectorAll(".q-reject").forEach(b => b.addEventListener("click", () => {
    const n = pending.find(x => x.id === b.dataset.id);
    openReject(n);
  }));
}

function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

async function openApprove(moduleId, nominationIds) {
  const m = lookup.modules.get(moduleId);
  const [batches, trainers] = await Promise.all([getBatchesForModule(moduleId), getTrainersFor(m.category)]);
  approveContext = { moduleId, nominationIds };

  $("approve-title").textContent = `Approve ${nominationIds.length} nomination${nominationIds.length > 1 ? "s" : ""}`;
  $("approve-module").textContent = `${m.code}: ${m.title}`;
  $("approve-error").textContent = "";

  const existing = $("existing-choice");
  existing.hidden = !batches.length;
  $("existing-batch").innerHTML = batches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}, starts ${formatDate(b.startDate)}</option>`).join("");
  document.querySelector(`input[name="batchMode"][value="${batches.length ? "existing" : "new"}"]`).checked = true;

  $("batch-start").value = nextMonday();
  $("batch-start").min = new Date().toISOString().slice(0, 10);
  $("batch-trainer").innerHTML = trainers.map(t =>
    `<option value="${t.id}">${escapeHtml(t.name)}${t.competency && t.competency.level !== "—" ? ` (${t.competency.level}, competency ${t.competency.score})` : ""}</option>`).join("");

  $("approve-dialog").showModal();
}

function openReject(n) {
  rejectContext = n;
  $("reject-who").textContent = `${n.officer.name}, ${n.module.code}: ${n.module.title}. Nominated by ${n.nominator?.name || "station head"}.`;
  $("reject-reason").value = "";
  $("reject-error").textContent = "";
  $("reject-dialog").showModal();
}

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

// Clicking a field inside a choice selects that choice.
document.querySelectorAll(".choice").forEach(c => c.addEventListener("focusin", e => {
  if (e.target.type !== "radio") c.querySelector('input[type="radio"]').checked = true;
}));

$("approve-form").addEventListener("submit", async e => {
  e.preventDefault();
  const mode = document.querySelector('input[name="batchMode"]:checked').value;
  const btn = $("approve-submit");
  btn.disabled = true;
  try {
    const batch = await approveNominations(user, {
      nominationIds: approveContext.nominationIds,
      batchId: mode === "existing" ? $("existing-batch").value : null,
      newBatch: mode === "new" ? { startDate: $("batch-start").value, trainerId: $("batch-trainer").value } : null
    });
    $("approve-dialog").close();
    const n = approveContext.nominationIds.length;
    toast(`Approved ${n} officer${n > 1 ? "s" : ""} into ${batch.name}.${offlineSuffix()}`, "ok", 5000);
    lookup = await getLookup();
    await renderDivision();
  } catch (err) {
    $("approve-error").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$("reject-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await rejectNomination(user, { nominationId: rejectContext.id, reason: $("reject-reason").value });
    $("reject-dialog").close();
    toast(`Rejected. ${rejectContext.nominator?.name || "The station head"} will see your reason.${offlineSuffix()}`, "ok", 5000);
    await renderDivision();
  } catch (err) {
    $("reject-error").textContent = err.message;
  }
});

/* ---------- boot ---------- */
if (isDivision(user)) await renderDivision();
else if (isStationHead(user)) await renderStationHead();
