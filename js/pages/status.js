import { ready } from "../app.js";
import { getCounts, getOutbox, getAudit, verifyAuditChain, commit, resetDemoData, getMeta, onChange, uuid } from "../store.js";
import { getSWInfo, onInstallAvailable, promptInstall, isInstalled } from "../pwa.js";
import { flush, onSyncState } from "../sync.js";
import { toast, formatDate } from "../ui.js";

const $ = id => document.getElementById(id);

const TABLE_LABELS = {
  users: "Officers and staff", stations: "Stations (RMC, MC, observatories)", modules: "Training modules",
  units: "Module units", nominations: "Nominations", batches: "Batches", enrollments: "Enrollments",
  progress: "Progress records", notes: "Notes", discussions: "Discussion posts", confusion: "Confusion flags (anonymous)",
  submissions: "Practical submissions", certificates: "Certificates", capsules: "Succession capsules",
  handovers: "Handovers", questionnaires: "Trainer questionnaires", responses: "Questionnaire responses", library: "Library items", feedback: "Course feedback", announcements: "Announcements", audit: "Audit entries", outbox: "Sync queue"
};

function setPill(el, text, kind) {
  el.textContent = text;
  el.className = "pill" + (kind ? " pill-" + kind : "");
}

async function renderSW() {
  const info = await getSWInfo();
  if (info) {
    setPill($("sw-pill"), "Ready", "ok");
    $("sw-version").textContent = info.version + (info.dev ? " (dev mode)" : "");
    $("sw-files").textContent = `${info.files} files`;
  } else if ("serviceWorker" in navigator) {
    setPill($("sw-pill"), "Setting up", "warn");
    $("sw-version").textContent = "Reload once to finish setup";
  } else {
    setPill($("sw-pill"), "Not supported", "danger");
    $("sw-version").textContent = "This browser can't run offline";
  }
  if (navigator.storage && navigator.storage.estimate) {
    const { usage } = await navigator.storage.estimate();
    $("storage-used").textContent = `${(usage / 1024 / 1024).toFixed(2)} MB`;
  }
  $("installed").textContent = isInstalled() ? "Yes" : "No";
}

function renderNet() {
  setPill($("net-pill"), navigator.onLine ? "Online" : "Offline", navigator.onLine ? "ok" : "warn");
}

async function renderOutbox() {
  const box = await getOutbox();
  const pending = box.filter(o => o.status === "pending");
  $("outbox-pending").textContent = pending.length;
  $("outbox-synced").textContent = box.length - pending.length;
  const last = box[box.length - 1];
  $("outbox-last").textContent = last ? formatDate(last.createdAt, true) : "None yet";
}

async function renderDB() {
  const counts = await getCounts();
  $("db-rows").innerHTML = Object.entries(counts)
    .map(([k, n]) => `<tr><td>${TABLE_LABELS[k] || k}</td><td class="num">${n}</td></tr>`).join("");
  $("seed-version").textContent = `Demo data ${await getMeta("seedVersion") || "not loaded"}`;
}

async function renderAudit() {
  $("audit-count").textContent = (await getAudit()).length;
}

async function renderAll() {
  renderNet();
  await Promise.all([renderSW(), renderOutbox(), renderDB(), renderAudit()]);
}

/* ---------- actions ---------- */
$("test-change").addEventListener("click", async () => {
  await commit({
    op: "system-test",
    store: "meta",
    record: { id: "test-" + uuid(), value: { note: "Offline sync test", at: new Date().toISOString() } },
    actorId: "system",
    auditAction: "system-test-change"
  });
  toast(navigator.onLine ? "Test change saved and syncing." : "Test change saved on this device. It will sync when you're back online.", "ok");
});

$("sync-now").addEventListener("click", async () => {
  if (!navigator.onLine) return toast("You're offline. Sync will run automatically when you reconnect.", "warn");
  await flush();
  renderOutbox();
});

$("verify-audit").addEventListener("click", async () => {
  const r = await verifyAuditChain();
  if (r.ok) {
    setPill($("audit-pill"), `Intact · ${r.checked} checked`, "ok");
    toast(`Audit trail intact. ${r.checked} entries verified.`, "ok");
  } else {
    setPill($("audit-pill"), `Broken at entry ${r.brokenAt}`, "danger");
    toast(`Audit trail was altered at entry ${r.brokenAt}.`, "danger", 6000);
  }
});

$("reset-data").addEventListener("click", async () => {
  if (!confirm("Reset all demo data on this device?")) return;
  await resetDemoData();
  toast("Demo data reset.", "ok");
  renderAll();
});

onInstallAvailable(available => { $("install-btn").hidden = !available; });
$("install-btn").addEventListener("click", async () => {
  const outcome = await promptInstall();
  if (outcome === "accepted") toast("Installed. Open Capacity Connect from your home screen.", "ok");
});

window.addEventListener("online", renderNet);
window.addEventListener("offline", renderNet);
onChange(() => { renderOutbox(); renderDB(); renderAudit(); });
onSyncState(() => renderOutbox());
navigator.serviceWorker?.addEventListener("controllerchange", renderSW);

/* ---------- boot ---------- */
await ready;
await renderAll();
// First visit: the worker may still be installing. Re-check shortly.
if (!navigator.serviceWorker?.controller) setTimeout(renderSW, 1500);
