import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { read } from "../store.js";
import { createQuestionnaire, listForTrainer, getResults, listForTrainee, submitResponse, deadlineOf } from "../services/questionnaires.js";

await ready;
const user = await requireRole(["trainee", "trainer"]);
await renderShell(user, "questionnaires", user.role === "trainer" ? "Questionnaires" : "Assessments");

const $ = id => document.getElementById(id);
const view = $("view");
const offline = () => navigator.onLine ? "" : " Saved on this device; it will sync when you're back online.";
const daysLeft = q => Math.ceil((deadlineOf(q) - Date.now()) / 86400000);
const dueLabel = q => q.closed ? `Closed ${formatDate(q.deadline)}` : daysLeft(q) <= 1 ? "Due today" : `Due ${formatDate(q.deadline)}, ${daysLeft(q)} days left`;

/* =========================================================
   Trainer
   ========================================================= */
async function renderTrainer() {
  $("page-title").textContent = "Questionnaires";
  $("page-sub").textContent = "Set subject-wise MCQ questionnaires for your batches, with a deadline. Each officer gets one attempt.";
  const list = await listForTrainer(user);
  view.innerHTML = `
    <div class="toolbar"><span class="meta-line">${list.length} questionnaire${list.length === 1 ? "" : "s"}</span>
      <button class="btn btn-primary" type="button" id="new-qn">New questionnaire</button></div>
    ${list.length ? list.map(q => `
      <article class="q-card">
        <div class="q-top">
          <div><h3>${escapeHtml(q.title)}</h3><p class="meta-line" style="margin:0">${escapeHtml(q.batch?.name || "")} · ${q.questions.length} questions · pass mark ${q.passMark}%</p></div>
          <div class="q-actions"><span class="pill ${q.closed ? "" : "pill-warn"}">${dueLabel(q)}</span>
            <button class="btn btn-secondary btn-sm" type="button" data-results="${q.id}">Results</button></div>
        </div>
        <div class="grid-3" style="margin-top: var(--sp-3)">
          <div class="bar-cell"><span class="mini-bar"><span style="width:${q.memberCount ? Math.round(100 * q.submitted / q.memberCount) : 0}%"></span></span><span class="meta-line">${q.submitted} of ${q.memberCount} submitted</span></div>
          <span class="meta-line">Average ${q.avgScore ?? "—"}${q.avgScore != null ? "%" : ""}</span>
          <span class="meta-line">Pass rate ${q.passRate ?? "—"}${q.passRate != null ? "%" : ""}</span>
        </div>
        <div id="res-${q.id}"></div>
      </article>`).join("") : `<div class="empty"><p>No questionnaires yet. Create one for a batch and set a deadline.</p></div>`}`;
  $("new-qn").addEventListener("click", openNew);
  view.querySelectorAll("[data-results]").forEach(b => b.addEventListener("click", async () => {
    const box = $(`res-${b.dataset.results}`);
    if (box.innerHTML) { box.innerHTML = ""; return; }
    const r = await getResults(user, b.dataset.results);
    const hardest = [...r.questionStats].map((s, i) => ({ ...s, i })).filter(s => s.total).sort((a, b) => a.correct / a.total - b.correct / b.total)[0];
    box.innerHTML = `
      <div class="table-wrap" style="margin-top: var(--sp-4)"><table>
        <thead><tr><th>Officer</th><th>Score</th><th>Result</th><th>Submitted</th></tr></thead>
        <tbody>${r.rows.map(x => `<tr><td>${escapeHtml(x.officer?.name || "")}</td>
          <td>${x.response ? `${x.response.score}%` : "—"}</td>
          <td>${x.response ? (x.response.passed ? `<span class="pill pill-ok">Passed</span>` : `<span class="pill pill-danger">Below pass mark</span>`) : r.closed ? `<span class="pill pill-danger">Missed</span>` : `<span class="pill">Not yet</span>`}</td>
          <td>${x.response ? formatDate(x.response.submittedAt, true) : "—"}</td></tr>`).join("")}</tbody></table></div>
      ${hardest ? `<p class="meta-line" style="margin-top: var(--sp-3)">Hardest question: "${escapeHtml(hardest.q)}", answered correctly by ${hardest.correct} of ${hardest.total}.</p>` : ""}`;
  }));
}

/* --- new questionnaire dialog --- */
const qBlock = (n) => `<div class="question-edit" data-q>
  <div class="qe-head"><span>Question ${n}</span><button type="button" class="link-btn" data-rmq>Remove</button></div>
  <input class="input" data-text placeholder="Question text" aria-label="Question ${n} text">
  ${[0, 1, 2, 3].map(i => `<label class="opt"><input type="radio" name="ans-${n}-${Date.now()}" value="${i}" ${i === 0 ? "checked" : ""} aria-label="Mark option ${i + 1} as the correct answer"><input class="input" data-opt placeholder="Option ${i + 1}" aria-label="Question ${n}, option ${i + 1}"></label>`).join("")}
  <span class="field-hint">Select the radio button beside the correct option.</span></div>`;
function renumber() { [...$("qn-questions").querySelectorAll("[data-q]")].forEach((q, i) => { q.querySelector(".qe-head span").textContent = `Question ${i + 1}`; }); }
function bindRemoveQ() { $("qn-questions").querySelectorAll("[data-rmq]").forEach(b => { b.onclick = () => { b.closest("[data-q]").remove(); renumber(); }; }); }

async function openNew() {
  const batches = (await read.all("batches")).filter(b => b.trainerId === user.id);
  $("qn-batch").innerHTML = batches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  const d = new Date(); d.setDate(d.getDate() + 7);
  $("qn-deadline").value = d.toISOString().slice(0, 10);
  $("qn-deadline").min = new Date().toISOString().slice(0, 10);
  $("qn-title-input").value = "";
  $("qn-questions").innerHTML = qBlock(1);
  $("qn-error").textContent = "";
  bindRemoveQ();
  $("qn").classList.add("modal-wide");
  $("qn").showModal();
}
if ($("qn-add")) $("qn-add").addEventListener("click", () => {
  $("qn-questions").insertAdjacentHTML("beforeend", qBlock($("qn-questions").querySelectorAll("[data-q]").length + 1));
  bindRemoveQ();
});
$("qn-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const questions = [...$("qn-questions").querySelectorAll("[data-q]")].map(q => ({
    q: q.querySelector("[data-text]").value,
    options: [...q.querySelectorAll("[data-opt]")].map(o => o.value),
    answer: Number(q.querySelector("input[type=radio]:checked")?.value ?? -1)
  }));
  try {
    const created = await createQuestionnaire(user, {
      batchId: $("qn-batch").value, title: $("qn-title-input").value, instructions: $("qn-instr").value,
      deadline: $("qn-deadline").value, passMark: $("qn-pass").value, questions
    });
    $("qn").close();
    toast(`"${created.title}" published to the batch, due ${formatDate(created.deadline)}.${offline()}`, "ok", 5000);
    renderTrainer();
  } catch (err) { $("qn-error").textContent = err.message; }
});

/* =========================================================
   Trainee
   ========================================================= */
async function renderTrainee() {
  $("page-title").textContent = "Assessments";
  $("page-sub").textContent = "Questionnaires your trainers have set for your batches. One attempt each, before the deadline.";
  const list = await listForTrainee(user);
  const STATE = { due: ["pill-warn", q => dueLabel(q)], submitted: ["pill-ok", q => `Submitted, ${q.mine.score}%`], missed: ["pill-danger", () => "Missed the deadline"] };
  view.innerHTML = list.length ? list.map(q => `
    <article class="q-card">
      <div class="q-top">
        <div><h3>${escapeHtml(q.title)}</h3>
          <p class="meta-line" style="margin:0">${escapeHtml(q.module?.code || "")} · set by ${escapeHtml(q.trainer?.name || "")} · ${q.questions.length} questions · pass mark ${q.passMark}%</p></div>
        <div class="q-actions"><span class="pill ${STATE[q.state][0]}">${STATE[q.state][1](q)}</span>
          ${q.state === "due" ? `<button class="btn btn-primary btn-sm" type="button" data-start="${q.id}">Start</button>` : ""}</div>
      </div>
    </article>`).join("") : `<div class="empty"><p>No questionnaires yet. They appear here when a trainer sets one for your batch.</p></div>`;
  view.querySelectorAll("[data-start]").forEach(b => b.addEventListener("click", () => renderAttempt(list.find(q => q.id === b.dataset.start))));
}

function renderAttempt(q) {
  view.innerHTML = `
    <form class="panel attempt" id="attempt-form">
      <div class="panel-title"><h2>${escapeHtml(q.title)}</h2><span class="pill pill-warn">${dueLabel(q)}</span></div>
      <p class="muted">${escapeHtml(q.instructions || "")} Pass mark ${q.passMark}%.</p>
      ${q.questions.map((qq, i) => `<fieldset class="question" data-i="${i}"><legend>${i + 1}. ${escapeHtml(qq.q)}</legend>
        ${qq.options.map((o, j) => `<label class="option" data-o="${j}"><input type="radio" name="a${i}" value="${j}"><span>${escapeHtml(o)}</span></label>`).join("")}</fieldset>`).join("")}
      <p class="field-error" id="attempt-error" role="alert"></p>
      <div class="row"><button class="btn btn-primary" type="submit">Submit answers</button><button class="btn btn-secondary" type="button" id="attempt-cancel">Back</button></div>
    </form>`;
  $("attempt-cancel").onclick = renderTrainee;
  $("attempt-form").addEventListener("submit", async e => {
    e.preventDefault();
    const answers = q.questions.map((_, i) => { const s = view.querySelector(`input[name="a${i}"]:checked`); return s ? Number(s.value) : null; });
    try {
      const res = await submitResponse(user, q.id, answers);
      q.questions.forEach((qq, i) => {
        const fs = view.querySelector(`.question[data-i="${i}"]`);
        fs.querySelectorAll("input").forEach(x => { x.disabled = true; });
        fs.querySelector(`.option[data-o="${qq.answer}"]`).classList.add("is-right");
        if (answers[i] !== qq.answer) fs.querySelector(`.option[data-o="${answers[i]}"]`).classList.add("is-wrong");
      });
      view.querySelector("button[type=submit]").remove();
      $("attempt-cancel").textContent = "Back to assessments";
      toast(`Submitted: ${res.score}% (${res.correct} of ${res.total}). ${res.passed ? "Passed." : "Below the pass mark."}${offline()}`, res.passed ? "ok" : "warn", 6000);
    } catch (err) { $("attempt-error").textContent = err.message; }
  });
}

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
if (user.role === "trainer") await renderTrainer(); else await renderTrainee();
