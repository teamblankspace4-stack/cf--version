import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { getModules } from "../store.js";
import { isDivision } from "../services/training.js";
import { KINDS, listLibrary, uploadItem, openItem, removeItem, kindFromFile } from "../services/library.js";

await ready;
const user = await requireRole(["trainee", "trainer", "admin"]);
await renderShell(user, "library", user.role === "trainee" ? "Library" : "Trainer library");

const $ = id => document.getElementById(id);
const view = $("view");
const canUpload = user.role === "trainer" || isDivision(user);
const modules = await getModules();
let kind = "all";
let query = "";

const size = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
function badge(item) {
  const ext = (item.fileName.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return `<span class="file-ic pdf">PDF</span>`;
  if (ext.startsWith("ppt")) return `<span class="file-ic ppt">PPT</span>`;
  if (/mp4|webm|mp3|m4a/.test(ext)) return `<span class="file-ic vid">${ext === "mp3" || ext === "m4a" ? "AUD" : "VID"}</span>`;
  if (ext.startsWith("doc")) return `<span class="file-ic doc">DOC</span>`;
  return `<span class="file-ic">${escapeHtml(ext.slice(0, 3).toUpperCase() || "FILE")}</span>`;
}

async function render() {
  const items = await listLibrary();
  const q = query.toLowerCase();
  const shown = items.filter(i => (kind === "all" || i.kind === kind) && (!q || `${i.title} ${i.description} ${i.module?.code || ""}`.toLowerCase().includes(q)));
  view.innerHTML = `
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filter by type">
        <button type="button" class="chip" data-k="all" aria-pressed="${kind === "all"}">All (${items.length})</button>
        ${Object.entries(KINDS).map(([k, l]) => `<button type="button" class="chip" data-k="${k}" aria-pressed="${kind === k}">${l}s (${items.filter(i => i.kind === k).length})</button>`).join("")}
      </div>
      <div class="row">
        <label class="visually-hidden" for="lib-search">Search the library</label>
        <input class="input" id="lib-search" type="search" placeholder="Search the library" value="${escapeHtml(query)}">
        ${canUpload ? `<button class="btn btn-primary" type="button" id="upload-btn">Upload</button>` : ""}
      </div>
    </div>
    ${shown.length ? `<div class="card-grid">${shown.map(i => `
      <article class="card">
        <div class="card-head">${badge(i)}<div><h3>${escapeHtml(i.title)}</h3>
          <span class="meta-line">${escapeHtml(KINDS[i.kind] || "")}${i.module ? ` · ${escapeHtml(i.module.code)}` : ""} · ${size(i.size || 0)}</span></div></div>
        <p>${escapeHtml(i.description || "")}</p>
        <p class="meta-line">Uploaded by ${escapeHtml(i.uploader?.name || "a trainer")}, ${formatDate(i.createdAt)}</p>
        <div class="card-foot">
          <span class="row" style="gap: var(--sp-2)">
            <button class="btn btn-primary btn-sm" type="button" data-open="${i.id}">Open</button>
            <button class="btn btn-secondary btn-sm" type="button" data-dl="${i.id}">Download</button>
          </span>
          ${(i.uploaderId === user.id || isDivision(user)) ? `<button class="link-btn" type="button" data-rm="${i.id}">Remove</button>` : ""}
        </div>
      </article>`).join("")}</div>` : `<div class="empty"><p>${items.length ? "Nothing matches this filter." : "The library is empty."}</p></div>`}`;

  view.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => { kind = b.dataset.k; render(); }));
  $("lib-search").addEventListener("input", e => { query = e.target.value; const pos = e.target.selectionStart; render().then(() => { const s = $("lib-search"); s.focus(); s.setSelectionRange(pos, pos); }); });
  $("upload-btn")?.addEventListener("click", openUpload);
  view.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => open(b.dataset.open, false)));
  view.querySelectorAll("[data-dl]").forEach(b => b.addEventListener("click", () => open(b.dataset.dl, true)));
  view.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Remove this item from the library?")) return;
    try { await removeItem(user, b.dataset.rm); toast("Removed from the library.", "ok"); render(); } catch (err) { toast(err.message, "warn"); }
  }));
}

async function open(id, download) {
  try {
    const { url, item, revoke } = await openItem(id);
    const a = document.createElement("a");
    a.href = url;
    if (download) a.download = item.fileName; else a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(revoke, 60000);
  } catch (err) {
    toast(navigator.onLine ? err.message : "This file isn't saved on this device yet. Open it once while online.", "warn", 5000);
  }
}

/* ---------- upload ---------- */
function openUpload() {
  $("up-kind").innerHTML = Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  $("up-module").innerHTML = `<option value="">General (not tied to a module)</option>` + modules.map(m => `<option value="${m.id}">${escapeHtml(m.code)}: ${escapeHtml(m.title)}</option>`).join("");
  $("up-file").value = ""; $("up-name").value = ""; $("up-desc").value = ""; $("up-error").textContent = "";
  $("up").showModal();
}
$("up-file")?.addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  if (!$("up-name").value) $("up-name").value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  $("up-kind").value = kindFromFile(f.name);
});
$("up-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("up-submit"); btn.disabled = true;
  try {
    const item = await uploadItem(user, { file: $("up-file").files[0], title: $("up-name").value, description: $("up-desc").value,
      moduleId: $("up-module").value || null, kind: $("up-kind").value });
    $("up").close();
    toast(`"${item.title}" is in the library.${navigator.onLine ? "" : " Saved on this device; it will sync when you're back online."}`, "ok", 5000);
    render();
  } catch (err) { $("up-error").textContent = err.message; }
  finally { btn.disabled = false; }
});
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

if (user.role === "trainee") $("page-sub").textContent = "Recorded lectures, presentations and study materials from your trainers. Files open offline once they're on this device.";
else $("page-sub").textContent = "Upload recorded lectures, presentations and study materials. Trainees can open them from their Library, offline too.";
await render();
