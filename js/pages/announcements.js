import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { TYPES, publish, withdraw, listAnnouncements } from "../services/announcements.js";

await ready;
const user = await requireRole(["admin"]);
await renderShell(user, "announcements");

const $ = id => document.getElementById(id);
const view = $("view");

async function render() {
  const all = await listAnnouncements({ includeInactive: true });
  view.innerHTML = `
    <div class="stack-5">
      <form class="panel" id="pub-form">
        <div class="panel-title"><h2>Publish</h2></div>
        <div class="grid-2">
          <div class="field"><label for="pub-type">Type</label><select class="input" id="pub-type">
            ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}</select></div>
          <div class="field"><label for="pub-exp">Show until (optional)</label><input class="input" type="date" id="pub-exp"></div>
        </div>
        <div class="field"><label for="pub-title">Headline</label><input class="input" id="pub-title" maxlength="100" placeholder="e.g. New module: Aerodrome warnings and SIGMET basics"></div>
        <div class="field"><label for="pub-body">Detail</label><textarea class="input" id="pub-body" rows="2" maxlength="400"></textarea></div>
        <label class="row" style="gap: var(--sp-2); font-size: var(--fs-sm); font-weight: 500; margin-bottom: var(--sp-4)"><input type="checkbox" id="pub-home" checked> Show on the homepage</label>
        <p class="field-error" id="pub-error" role="alert"></p>
        <button class="btn btn-primary" type="submit">Publish</button>
        <p class="meta-line" style="margin: var(--sp-3) 0 0">Everything published also appears in every signed-in officer's notifications.</p>
      </form>

      <section class="panel"><div class="panel-title"><h2>Published</h2></div>
        ${all.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Headline</th><th>Type</th><th>Published</th><th>Where</th><th>Status</th><th></th></tr></thead>
          <tbody>${all.map(a => `<tr>
            <td style="white-space:normal;max-width:360px"><b>${escapeHtml(a.title)}</b><br><span class="meta-line">${escapeHtml(a.body)}</span></td>
            <td><span class="tag ${TYPES[a.type]?.tag || ""}">${escapeHtml(TYPES[a.type]?.label || a.type)}</span></td>
            <td>${formatDate(a.publishedAt)}<br><span class="meta-line">${escapeHtml(a.author?.name || "")}</span></td>
            <td>${a.onHomepage ? "Homepage and notifications" : "Notifications only"}</td>
            <td>${a.active ? `<span class="pill pill-ok">Live</span>` : `<span class="pill">${a.withdrawn ? "Withdrawn" : "Expired"}</span>`}</td>
            <td>${a.active ? `<button class="btn btn-secondary btn-sm" data-wd="${a.id}">Withdraw</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
          : `<div class="empty"><p>Nothing published yet.</p></div>`}
      </section>
    </div>`;
  $("pub-exp").min = new Date().toISOString().slice(0, 10);
  $("pub-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await publish(user, { type: $("pub-type").value, title: $("pub-title").value, body: $("pub-body").value,
        onHomepage: $("pub-home").checked, expires: $("pub-exp").value });
      toast(`Published.${$("pub-home").checked ? " It's on the homepage now." : ""}`, "ok", 4500);
      render();
    } catch (err) { $("pub-error").textContent = err.message; }
  });
  view.querySelectorAll("[data-wd]").forEach(b => b.addEventListener("click", async () => {
    try { await withdraw(user, b.dataset.wd); toast("Withdrawn from the homepage and notifications.", "ok"); render(); } catch (err) { toast(err.message, "warn"); }
  }));
}
await render();
