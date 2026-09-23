import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { escapeHtml } from "../ui.js";
import { getTrainerCompetency, findTrainers } from "../services/reports.js";

await ready;
const user = await requireRole(["trainer", "admin"]);
await renderShell(user, "competency");

const $ = id => document.getElementById(id);
const { categories, rows } = await getTrainerCompetency();
const CLS = { "Lead trainer": "lvl-lead", "Can teach": "lvl-can", "Supporting": "lvl-sup", "—": "lvl-none" };

$("view").innerHTML = `
  <div class="stack-5">
    <section class="panel"><div class="panel-title"><h2>Find a trainer for a subject</h2></div>
      <div class="toolbar" style="justify-content:flex-start">
        <label class="visually-hidden" for="find-cat">Subject</label>
        <select class="input" id="find-cat">${categories.map(c => `<option value="${c.key}">${escapeHtml(c.label)}</option>`).join("")}</select>
      </div>
      <div id="find-results"></div>
    </section>

    <section class="panel"><div class="panel-title"><h2>Trainers by subject</h2></div>
      <div class="table-wrap"><table class="matrix">
        <thead><tr><th>Trainer</th>${categories.map(c => `<th class="cell">${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><a href="profile.html?u=${r.trainer.id}"><b>${escapeHtml(r.trainer.name)}</b></a><br><span class="meta-line">${escapeHtml(r.trainer.designation)}</span></td>
          ${r.cells.map(c => `<td class="cell">${c.level === "—" ? `<span class="lvl lvl-none">—</span>`
            : `<span class="lvl ${CLS[c.level]}" title="Score ${c.score}"><b>${c.score}</b>${c.level}</span>`}</td>`).join("")}
        </tr>`).join("")}</tbody></table></div>
      <p class="meta-line" style="margin-top: var(--sp-4)">How the score works: declared teaching expertise 50, field certification 15, up to 24 for batches taught, up to 10 for practicals reviewed, up to 5 for questions answered, and plus or minus up to 10 from course feedback. Lead trainer 70 and above, can teach 45 and above.</p>
    </section>
  </div>`;

async function showFind() {
  const list = await findTrainers($("find-cat").value);
  $("find-results").innerHTML = list.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Trainer</th><th>Level</th><th class="num">Batches taught</th><th class="num">Practicals reviewed</th><th class="num">Questions answered</th><th>Course rating</th></tr></thead>
    <tbody>${list.map(x => `<tr><td><a href="profile.html?u=${x.trainer.id}">${escapeHtml(x.trainer.name)}</a></td>
      <td><span class="lvl ${CLS[x.cell.level]}"><b>${x.cell.score}</b>${x.cell.level}</span></td>
      <td class="num">${x.cell.batches}</td><td class="num">${x.cell.reviews}</td><td class="num">${x.cell.answers}</td>
      <td>${x.cell.rating ?? "—"}${x.cell.rating ? " / 5" : ""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty"><p>No trainer has a record in this subject yet. Consider approving a trainer's account with this expertise.</p></div>`;
}
$("find-cat").addEventListener("change", showFind);
showFind();
