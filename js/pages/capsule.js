import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { read } from "../store.js";
import {
  CATEGORIES, CATEGORY_LABEL, STALE_DAYS, getCapsule, getCapsuleOverview, saveEntry, confirmEntry,
  startHandover, getMyHandovers, markRead, acknowledgeHandover
} from "../services/capsule.js";

await ready;
const user = await requireRole(["trainee", "trainer", "admin"]);
await renderShell(user, "capsule", user.role === "admin" ? "Succession capsules" : "Station knowledge");

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const offlineSuffix = () => navigator.onLine ? "" : " Saved on this device; it will sync when you're back online.";

let overview = [];
let stationId = null;
let entries = [];
let filter = "all";
let query = "";
let handover = null;        // open handover addressed to this user, for the station on screen
let editing = null;

/* =========================================================
   Handover spotlight (incoming officer)
   ========================================================= */
async function loadHandover() {
  if (user.role !== "trainee") { handover = null; return; }
  const mine = (await getMyHandovers(user)).filter(h => h.status === "pending");
  handover = mine.find(h => h.stationId === stationId) || null;
  const other = mine.find(h => h.stationId !== stationId);
  const slot = $("handover-slot");
  if (!handover && !other) { slot.innerHTML = ""; return; }
  if (!handover && other) {
    slot.innerHTML = `
      <section class="spotlight"><div>
        <p class="eyebrow">Handover waiting</p>
        <h2>${escapeHtml(other.station.name)}</h2>
        <p>${escapeHtml(other.from?.name || "The outgoing officer")} is handing over to you.</p>
      </div><button class="btn btn-primary btn-lg" type="button" data-open-station="${other.stationId}">Open this capsule</button></section>`;
    slot.querySelector("[data-open-station]").addEventListener("click", e => openStation(e.currentTarget.dataset.openStation));
    return;
  }
  const must = entries.filter(e => handover.mustReadIds.includes(e.id));
  const done = must.filter(e => handover.readIds.includes(e.id)).length;
  slot.innerHTML = `
    <section class="spotlight" aria-labelledby="h-ho">
      <div>
        <p class="eyebrow">Handover from ${escapeHtml(handover.from?.name || "the outgoing officer")}</p>
        <h2 id="h-ho">You're taking over at ${escapeHtml(handover.station.name)}</h2>
        <p>${escapeHtml(handover.note || "Read the must-read entries below, then acknowledge the handover.")}</p>
        <ul class="ho-list">${must.map(e => `<li class="${handover.readIds.includes(e.id) ? "is-read" : ""}">${escapeHtml(e.title)}</li>`).join("")}</ul>
      </div>
      <div class="spot-actions">
        <p class="spot-meta">${done} of ${must.length} must-read entries read</p>
        <button class="btn btn-primary btn-lg" type="button" id="ack-btn" ${done < must.length ? "disabled" : ""}>Acknowledge handover</button>
      </div>
    </section>`;
  $("ack-btn").addEventListener("click", async () => {
    try {
      await acknowledgeHandover(user, handover.id);
      toast(`Handover acknowledged. It's on your training record.${offlineSuffix()}`, "ok", 5500);
      await loadHandover();
      renderEntries();
    } catch (err) { toast(err.message, "warn"); }
  });
}

/* =========================================================
   Administrator overview
   ========================================================= */
function renderOverview() {
  if (user.role !== "admin") return;
  const rows = overview;
  $("overview-slot").innerHTML = `
    <section class="panel" aria-labelledby="h-over">
      <div class="panel-title"><h2 id="h-over">Capsule health by station</h2><span class="small muted">Entries not confirmed for ${STALE_DAYS} days need review</span></div>
      <div class="table-wrap"><table class="overview">
        <thead><tr><th>Station</th><th class="num">Entries</th><th class="num">Must-read</th><th class="num">Need review</th><th>Last confirmed</th><th>Officers leaving</th><th>Handover</th><th></th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.station.name)}</td>
            <td class="num">${r.entries}</td>
            <td class="num">${r.mustRead}</td>
            <td class="num">${r.stale}</td>
            <td>${r.lastUpdated ? formatDate(r.lastUpdated) : "—"}</td>
            <td>${r.leaving.length ? r.leaving.map(o => `<span class="leaving">${escapeHtml(o.name)}</span>, ${formatDate(o.transferDue)}`).join("<br>") : "—"}</td>
            <td>${r.handovers.length ? r.handovers.map(h => `<span class="pill pill-warn">To ${escapeHtml(h.to?.name || "")}</span>`).join(" ") : r.leaving.length && !r.entries ? `<span class="pill pill-danger">No capsule</span>` : "—"}</td>
            <td><button class="btn btn-secondary btn-sm" type="button" data-open="${r.station.id}">Open</button></td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    </section>`;
  $("overview-slot").querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => {
    openStation(b.dataset.open);
    $("capsule-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

/* =========================================================
   Capsule entries
   ========================================================= */
function renderChips() {
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.key, entries.filter(e => e.category === c.key).length]));
  $("chips").innerHTML = [`<button type="button" class="chip" data-f="all" aria-pressed="${filter === "all"}">All (${entries.length})</button>`]
    .concat(CATEGORIES.map(c => `<button type="button" class="chip" data-f="${c.key}" aria-pressed="${filter === c.key}">${escapeHtml(c.label)} (${counts[c.key]})</button>`))
    .join("");
  $("chips").querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; renderChips(); renderEntries(); }));
}

function renderEntries() {
  const q = query.toLowerCase();
  const shown = entries.filter(e => (filter === "all" || e.category === filter) &&
    (!q || `${e.title} ${e.body}`.toLowerCase().includes(q)));
  const inHandover = e => handover && handover.status === "pending" && handover.mustReadIds.includes(e.id);
  $("entries").innerHTML = shown.length ? `<ul class="entry-list">${shown.map(e => {
    const read = handover && handover.readIds.includes(e.id);
    return `
      <li class="entry${read ? " is-read" : ""}">
        <div class="entry-top">
          <span class="cat">${escapeHtml(CATEGORY_LABEL[e.category])}</span>
          ${e.mustRead ? `<span class="must">Must-read</span>` : ""}
          ${e.stale ? `<span class="stale">Not confirmed for over ${Math.round(STALE_DAYS / 30)} months</span>` : ""}
        </div>
        <h3>${escapeHtml(e.title)}</h3>
        <p>${escapeHtml(e.body)}</p>
        <div class="entry-foot">
          <span>Added by ${escapeHtml(e.author?.name || "an officer")}. Confirmed ${formatDate(e.confirmedAt || e.updatedAt)}${e.confirmer && e.confirmer.id !== e.author?.id ? ` by ${escapeHtml(e.confirmer.name)}` : ""}.</span>
          <span class="entry-acts">
            ${inHandover(e) ? `<button class="btn btn-secondary btn-sm read-btn" type="button" data-read="${e.id}" aria-pressed="${!!read}">${read ? "Read" : "Mark as read"}</button>` : ""}
            <button class="btn btn-secondary btn-sm" type="button" data-confirm="${e.id}">Still accurate</button>
            <button class="btn btn-secondary btn-sm" type="button" data-edit="${e.id}">Edit</button>
          </span>
        </div>
      </li>`;
  }).join("")}</ul>`
    : `<div class="empty"><p>${entries.length ? "No entries match this filter." : "This station's capsule is empty. Add what a new officer would need to know in their first week."}</p></div>`;

  $("entries").querySelectorAll("[data-read]").forEach(b => b.addEventListener("click", async () => {
    if (b.getAttribute("aria-pressed") === "true") return;
    try {
      handover = { ...handover, ...(await markRead(user, handover.id, b.dataset.read)) };
      const full = (await getMyHandovers(user)).find(h => h.id === handover.id);
      handover = full;
      await loadHandover();
      renderEntries();
    } catch (err) { toast(err.message, "warn"); }
  }));
  $("entries").querySelectorAll("[data-confirm]").forEach(b => b.addEventListener("click", async () => {
    try {
      await confirmEntry(user, b.dataset.confirm);
      toast("Marked as still accurate.", "ok");
      await loadStation();
    } catch (err) { toast(err.message, "warn"); }
  }));
  $("entries").querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openEntry(entries.find(e => e.id === b.dataset.edit))));
}

async function loadStation() {
  entries = await getCapsule(stationId);
  const station = await read.one("stations", stationId);
  const row = overview.find(r => r.station.id === stationId);
  $("h-capsule").textContent = `${station.name} capsule`;
  $("capsule-meta").textContent = `${entries.length} entr${entries.length === 1 ? "y" : "ies"}, ${entries.filter(e => e.mustRead).length} must-read` +
    (row && row.leaving.length ? `. ${row.leaving.map(o => `${o.name} leaves ${formatDate(o.transferDue)}`).join("; ")}.` : ".");
  $("start-handover").hidden = user.role !== "admin";
  renderChips();
  await loadHandover();
  renderEntries();
}

async function openStation(id) {
  stationId = id;
  $("station-select").value = id;
  const url = new URL(location.href);
  url.searchParams.set("s", id);
  history.replaceState(null, "", url);
  await loadStation();
}

/* =========================================================
   Entry dialog
   ========================================================= */
$("entry-category").innerHTML = CATEGORIES.map(c => `<option value="${c.key}">${escapeHtml(c.label)}</option>`).join("");
const setHint = () => { $("entry-hint").textContent = CATEGORIES.find(c => c.key === $("entry-category").value).hint; };
$("entry-category").addEventListener("change", setHint);

function openEntry(e = null) {
  editing = e;
  const station = overview.find(r => r.station.id === stationId)?.station;
  $("entry-title").textContent = e ? "Edit entry" : "Add to the capsule";
  $("entry-where").textContent = `${station?.name || ""}. Everyone posted here, and everyone who takes over, will see this.`;
  $("entry-category").value = e ? e.category : (filter !== "all" ? filter : "equipment");
  $("entry-heading").value = e ? e.title : "";
  $("entry-body").value = e ? e.body : "";
  $("entry-must").checked = e ? !!e.mustRead : false;
  $("entry-error").textContent = "";
  setHint();
  $("entry-dialog").showModal();
}
$("add-entry").addEventListener("click", () => openEntry());

$("entry-form").addEventListener("submit", async ev => {
  ev.preventDefault();
  try {
    await saveEntry(user, {
      id: editing?.id, stationId, category: $("entry-category").value,
      title: $("entry-heading").value, body: $("entry-body").value, mustRead: $("entry-must").checked
    });
    $("entry-dialog").close();
    toast(`${editing ? "Entry updated" : "Added to the capsule"}.${offlineSuffix()}`, "ok", 4500);
    overview = await getCapsuleOverview(user);
    renderOverview();
    await loadStation();
  } catch (err) { $("entry-error").textContent = err.message; }
});

/* =========================================================
   Handover dialog (administrators)
   ========================================================= */
$("start-handover").addEventListener("click", async () => {
  const row = overview.find(r => r.station.id === stationId);
  const users = (await read.all("users")).filter(u => u.role === "trainee" && (!u.status || u.status === "active"));
  const stations = new Map((await read.all("stations")).map(s => [s.id, s.name]));
  $("handover-where").textContent = `${row.station.name}. ${entries.filter(e => e.mustRead).length} must-read entries will be handed over.`;
  const leavingFirst = [...row.officers].sort((a, b) => (b.transferDue ? 1 : 0) - (a.transferDue ? 1 : 0));
  $("ho-from").innerHTML = `<option value="">No outgoing officer (new post)</option>` + leavingFirst.map(o =>
    `<option value="${o.id}"${o.transferDue && o === leavingFirst[0] ? " selected" : ""}>${escapeHtml(o.name)}${o.transferDue ? `, leaving ${formatDate(o.transferDue)}` : ""}</option>`).join("");
  $("ho-to").innerHTML = users.sort((a, b) => a.name.localeCompare(b.name)).map(u =>
    `<option value="${u.id}">${escapeHtml(u.name)}, ${escapeHtml(stations.get(u.stationId) || "")}</option>`).join("");
  $("ho-note").value = "";
  $("handover-error").textContent = "";
  $("handover-dialog").showModal();
});

$("handover-form").addEventListener("submit", async ev => {
  ev.preventDefault();
  try {
    await startHandover(user, { stationId, fromUserId: $("ho-from").value || null, toUserId: $("ho-to").value, note: $("ho-note").value });
    $("handover-dialog").close();
    const to = await read.one("users", $("ho-to").value);
    toast(`Handover started. ${to?.name || "The officer"} will see it on their dashboard.${offlineSuffix()}`, "ok", 5500);
    overview = await getCapsuleOverview(user);
    renderOverview();
    await loadStation();
  } catch (err) { $("handover-error").textContent = err.message; }
});

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
$("capsule-search").addEventListener("input", e => { query = e.target.value.trim(); renderEntries(); });
$("station-select").addEventListener("change", e => openStation(e.target.value));

/* =========================================================
   Boot
   ========================================================= */
if (user.role === "admin") {
  $("page-title").textContent = "Succession capsules";
  $("page-sub").textContent = "Train the post, not just the person. Keep each station's working knowledge current, and hand it over when an officer moves.";
} else if (user.role === "trainer") {
  $("page-title").textContent = "What each station knows";
  $("page-sub").textContent = "Browse what each station has recorded. Mentors can add and confirm entries too.";
} else {
  $("page-title").textContent = "Know your station";
}

overview = await getCapsuleOverview(user);
$("station-select").innerHTML = overview.map(r => `<option value="${r.station.id}">${escapeHtml(r.station.name)}</option>`).join("");
renderOverview();

const pendingHandover = user.role === "trainee" ? (await getMyHandovers(user)).find(h => h.status === "pending") : null;
const initial = params.get("s") && overview.some(r => r.station.id === params.get("s")) ? params.get("s")
  : pendingHandover ? pendingHandover.stationId
  : user.role === "trainee" ? user.stationId
  : (overview.find(r => r.entries) || overview[0])?.station.id;
if (initial) await openStation(initial);
