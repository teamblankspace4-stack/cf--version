import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { formatTime } from "../search.js";
import {
  getMentorDashboard, getReviewContext, reviewSubmission, replyToQuestion, postClarification,
  RUBRIC, LEVELS, ANONYMITY_K, competencyFrom
} from "../services/mentoring.js";

await ready;
const user = await requireRole(["trainer"]);
await renderShell(user, "batches");

const $ = id => document.getElementById(id);
const view = $("view");
let data = null;
let reviewing = null;
let clarifying = null;
let decision = "approve";

const offlineSuffix = () => navigator.onLine ? "" : " Saved on this device; it will sync when you're back online.";
const PRACTICAL_LABEL = {
  "not-started": "Not started", "in-progress": "In progress", submitted: "Waiting for review",
  returned: "Returned for rework", reviewed: "Approved", none: "—", completed: "Done"
};

/* =========================================================
   Render
   ========================================================= */
function render() {
  const { reviews, questions, confusion, rosters, officerCount } = data;
  const first = user.name.replace(/^(Dr\.|Capt\.)\s*/i, "").split(" ")[0];
  $("page-title").textContent = `Welcome back, ${first}.`;
  $("page-sub").textContent = `Here's how your trainees are doing. ${user.designation}, ${rosters.length} batch${rosters.length === 1 ? "" : "es"}, ${officerCount} officer${officerCount === 1 ? "" : "s"}.`;

  view.innerHTML = `
    <div class="mentor-grid">
      <div class="summary" role="group" aria-label="Summary">
        <div><b>${reviews.length}</b><span>practicals to review</span></div>
        <div><b>${questions.length}</b><span>questions waiting for a reply</span></div>
        <div><b>${officerCount}</b><span>officers in your batches</span></div>
      </div>
      ${mentorSpotlight()}

      <section class="panel" aria-labelledby="h-reviews">
        <div class="panel-title"><h2 id="h-reviews">Practical work to review</h2></div>
        ${reviews.length ? `<ul class="queue">${reviews.map(r => `
          <li>
            <div class="q-head">
              <b>${escapeHtml(r.officer?.name || "")}</b>
              <span class="muted">${escapeHtml(r.station?.name || "")}, ${escapeHtml(r.module?.code || "")}</span>
              <span class="pill pill-warn">Submitted ${formatDate(r.createdAt)}</span>
            </div>
            <p class="q-text">${escapeHtml(r.text.length > 240 ? r.text.slice(0, 240) + "…" : r.text)}</p>
            <div class="q-actions">
              <span class="small muted">${r.photo ? "Photo attached" : "No photo"}</span>
              <button class="btn btn-primary" data-review="${r.id}" type="button">Review and score</button>
            </div>
          </li>`).join("")}</ul>`
          : `<div class="empty"><p>Nothing waiting. Practical submissions from your batches appear here.</p></div>`}
      </section>

      <section class="panel" aria-labelledby="h-questions">
        <div class="panel-title"><h2 id="h-questions">Questions from trainees</h2></div>
        ${questions.length ? `<ul class="queue">${questions.map(q => `
          <li>
            <div class="q-head">
              <b>${escapeHtml(q.author?.name || "")}</b>
              <span class="muted">${escapeHtml(q.station?.name || "")}, ${escapeHtml(q.module?.code || "")}: ${escapeHtml(q.unit?.title || "")}</span>
              ${q.atSecond != null ? `<span class="pill">At ${formatTime(q.atSecond)} in the lesson</span>` : ""}
              <span class="muted">${formatDate(q.createdAt, true)}</span>
            </div>
            <p class="q-text">${escapeHtml(q.text)}</p>
            <div class="q-actions"><button class="btn btn-secondary" data-reply="${q.id}" type="button">Reply</button></div>
            <div class="reply-box" id="reply-${q.id}">
              <label class="visually-hidden" for="reply-text-${q.id}">Your reply</label>
              <textarea class="input" id="reply-text-${q.id}" rows="3" placeholder="Answer so the whole batch can read it"></textarea>
              <button class="btn btn-primary" data-send="${q.id}" type="button">Post reply</button>
            </div>
          </li>`).join("")}</ul>`
          : `<div class="empty"><p>No unanswered questions. Replies you post appear beside the lesson for the whole batch.</p></div>`}
      </section>

      <section class="panel" aria-labelledby="h-confusion">
        <div class="panel-title"><h2 id="h-confusion">Where officers get stuck</h2></div>
        <p class="muted small">Officers flag a moment of a lesson anonymously. A moment appears here only once ${ANONYMITY_K} or more officers flag it, so no one can be identified.</p>
        ${confusion.length ? confusion.map(c => `
          <div class="confusion-module">
            <h3>${escapeHtml(c.module.code)}: ${escapeHtml(c.module.title)}</h3>
            <p class="muted small">${c.total} flag${c.total === 1 ? "" : "s"} across this lesson.</p>
            <ul class="chapter-bars">${c.chapters.map(ch => `
              <li>
                <span class="time">${formatTime(ch.start)}</span>
                <span class="cbar${c.top && ch.index === c.top.index ? " is-hot" : ""}">
                  <span style="width:${ch.visible ? Math.round(100 * ch.count / c.max) : 0}%"></span>
                  <em>${escapeHtml(ch.title)}</em>
                </span>
                <span class="count">${ch.visible ? `${ch.count} flags` : ch.some ? "below threshold" : ""}</span>
              </li>`).join("")}</ul>
            ${c.top ? `
              <div class="hotspot">
                <p><b>${escapeHtml(c.top.title)}</b> at ${formatTime(c.top.start)} is the hardest part for this batch, flagged by ${c.top.count} officers. Re-teach it in the next session, or post a clarification now.</p>
                <button class="btn btn-primary" type="button" data-clarify="${c.module.id}|${c.top.index}">Post a clarification</button>
              </div>` : `<p class="anon-note">No moment has reached ${ANONYMITY_K} flags yet, so nothing is shown for this lesson.</p>`}
          </div>`).join("")
          : `<div class="empty"><p>No lessons with confusion flags yet.</p></div>`}
      </section>

      <section class="panel" aria-labelledby="h-roster">
        <div class="panel-title"><h2 id="h-roster">Your batches</h2></div>
        ${rosters.length ? rosters.map(r => `
          <div class="roster">
            <h3>${escapeHtml(r.batch.name)}</h3>
            <p class="muted">${escapeHtml(r.module.title)}. Starts ${formatDate(r.batch.startDate)}.</p>
            <div class="table-wrap"><table>
              <thead><tr><th>Officer</th><th>Station</th><th>Progress</th><th>Quiz</th><th>Practical</th><th>Competency</th><th>Certificate</th></tr></thead>
              <tbody>${r.members.map(m => `
                <tr>
                  <td><b>${escapeHtml(m.officer.name)}</b><br><span class="small muted">${escapeHtml(m.officer.empId)}</span></td>
                  <td>${escapeHtml(m.station?.name || "")}</td>
                  <td><span class="mini-bar"><span style="width:${Math.round(100 * m.done / m.total)}%"></span></span>${m.done} of ${m.total}</td>
                  <td>${m.quizBest != null ? `${m.quizBest}%` : "—"}</td>
                  <td>${escapeHtml(PRACTICAL_LABEL[m.practical] || m.practical)}</td>
                  <td>${m.competency != null ? `${m.competency}%` : "—"}</td>
                  <td>${m.certificate ? `<a href="certificate.html?id=${m.certificate.id}">${escapeHtml(m.certificate.certNo)}</a>` : "—"}</td>
                </tr>`).join("")}
              </tbody>
            </table></div>
          </div>`).join("")
          : `<div class="empty"><p>No batches assigned yet. The Training Division assigns you when it approves a batch.</p></div>`}
      </section>
    </div>`;
  bind();
}

const WARN_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>`;

function mentorSpotlight() {
  const top = data.confusion.map(c => c.top ? { ...c.top, module: c.module } : null).filter(Boolean).sort((a, b) => b.count - a.count)[0];
  if (top) {
    return `
      <section class="spotlight" aria-labelledby="h-spot">
        <div class="spotlight-row">
          <span class="icon-ring">${WARN_ICON}</span>
          <div>
            <p class="eyebrow is-warn">Where your batch is getting stuck</p>
            <h2 id="h-spot">${escapeHtml(top.title)} at ${formatTime(top.start)}, flagged by ${top.count} officers</h2>
            <p>${escapeHtml(top.module.code)}: ${escapeHtml(top.module.title)}. Flags are anonymous and only shown once ${ANONYMITY_K} or more officers mark the same moment.</p>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" type="button" data-clarify="${top.module.id}|${top.index}">Post a clarification</button>
      </section>`;
  }
  if (data.reviews.length) {
    return `
      <section class="spotlight" aria-labelledby="h-spot">
        <div>
          <p class="eyebrow">Needs your review</p>
          <h2 id="h-spot">${data.reviews.length} practical submission${data.reviews.length === 1 ? "" : "s"} waiting</h2>
          <p>Scoring them on the rubric puts a competency level on each officer's record and issues the certificate.</p>
        </div>
        <button class="btn btn-primary btn-lg" type="button" data-review="${data.reviews[0].id}">Review the first one</button>
      </section>`;
  }
  return "";
}

function bind() {
  view.querySelectorAll("[data-review]").forEach(b => b.addEventListener("click", () => openReview(b.dataset.review)));

  view.querySelectorAll("[data-reply]").forEach(b => b.addEventListener("click", () => {
    const box = $(`reply-${b.dataset.reply}`);
    box.classList.toggle("is-open");
    if (box.classList.contains("is-open")) box.querySelector("textarea").focus();
  }));

  view.querySelectorAll("[data-send]").forEach(b => b.addEventListener("click", async () => {
    const q = data.questions.find(x => x.id === b.dataset.send);
    b.disabled = true;
    try {
      await replyToQuestion(user, q, $(`reply-text-${q.id}`).value);
      toast(`Reply posted for ${q.author?.name || "the officer"}.${offlineSuffix()}`, "ok", 4500);
      await refresh();
    } catch (err) {
      toast(err.message, "warn");
      b.disabled = false;
    }
  }));

  view.querySelectorAll("[data-clarify]").forEach(b => b.addEventListener("click", () => {
    const [moduleId, index] = b.dataset.clarify.split("|");
    openClarify(moduleId, Number(index));
  }));
}

async function refresh() {
  data = await getMentorDashboard(user);
  render();
}

/* =========================================================
   Review a practical
   ========================================================= */
function readScores() {
  const scores = {};
  RUBRIC.forEach(r => {
    const sel = document.querySelector(`input[name="rub-${r.key}"]:checked`);
    if (sel) scores[r.key] = Number(sel.value);
  });
  return scores;
}

function updateCompetency() {
  const scores = readScores();
  const el = $("competency-live");
  if (Object.keys(scores).length !== RUBRIC.length) {
    el.textContent = "Score every line to see the competency result.";
    return;
  }
  const pct = competencyFrom(scores);
  const lowest = LEVELS.find(l => l.value === Math.min(...Object.values(scores)));
  el.innerHTML = `Competency score: <b>${pct}%</b>, lowest criterion "${escapeHtml(lowest.label)}". This goes on the officer's training record.`;
}

async function openReview(submissionId) {
  const ctx = await getReviewContext(user, submissionId);
  reviewing = ctx;
  $("review-who").textContent = `${ctx.officer.name}, ${ctx.officer.designation}, ${ctx.station?.name || ""}. ${ctx.module.code}: ${ctx.module.title}.`;
  $("review-submission").innerHTML = `
    ${ctx.practical ? `<p class="task-recap"><b>Task:</b> ${escapeHtml(ctx.practical.task)}</p>` : ""}
    ${ctx.history.length ? `<p class="task-recap">Resubmission ${ctx.history.length + 1}. Your previous feedback: ${escapeHtml(ctx.history[0].feedback || "")}</p>` : ""}
    <div class="submission-box">
      <h4>Submitted ${formatDate(ctx.submission.createdAt, true)}</h4>
      <p class="submission-text">${escapeHtml(ctx.submission.text)}</p>
      ${ctx.submission.photo ? `<img src="${ctx.submission.photo}" alt="Evidence photo submitted by the officer">` : `<p class="small muted">No photo attached.</p>`}
    </div>`;

  $("rubric").innerHTML = RUBRIC.map(r => `
    <div class="rubric-row">
      <b>${escapeHtml(r.label)}</b><span class="hint">${escapeHtml(r.hint)}</span>
      <div class="levels">${LEVELS.map(l => `
        <label class="level"><input type="radio" name="rub-${r.key}" value="${l.value}"> ${l.value}, ${escapeHtml(l.label)}</label>`).join("")}</div>
    </div>`).join("") + `<p class="competency-live" id="competency-live"></p>`;
  $("rubric").querySelectorAll("input").forEach(i => i.addEventListener("change", updateCompetency));
  updateCompetency();

  $("review-feedback").value = "";
  $("review-error").textContent = "";
  $("review-dialog").showModal();
}

$("approve-btn").addEventListener("click", () => { decision = "approve"; });
$("return-btn").addEventListener("click", () => { decision = "return"; });

$("review-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const res = await reviewSubmission(user, reviewing.submission.id, {
      scores: readScores(), feedback: $("review-feedback").value, decision
    });
    $("review-dialog").close();
    if (decision === "approve") {
      toast(res.certificate
        ? `Approved at ${res.competency}%. Module complete, certificate ${res.certificate.certNo} issued.`
        : `Approved at ${res.competency}%. It's on the officer's training record.${offlineSuffix()}`, "ok", 6000);
    } else {
      toast(`Returned for rework. ${reviewing.officer.name} sees your feedback and can resubmit.${offlineSuffix()}`, "ok", 5500);
    }
    await refresh();
  } catch (err) {
    $("review-error").textContent = err.message;
  }
});

/* =========================================================
   Clarification to the batch
   ========================================================= */
function openClarify(moduleId, chapterIndex) {
  const c = data.confusion.find(x => x.module.id === moduleId);
  const chapter = c.chapters[chapterIndex];
  clarifying = { moduleId, unitId: c.unitId, chapter };
  $("clarify-where").textContent = `${c.module.code}, "${chapter.title}" at ${formatTime(chapter.start)}. Flagged by ${chapter.count} officers.`;
  $("clarify-text").value = "";
  $("clarify-error").textContent = "";
  $("clarify-dialog").showModal();
}

$("clarify-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await postClarification(user, {
      moduleId: clarifying.moduleId, unitId: clarifying.unitId, atSecond: clarifying.chapter.start,
      chapterTitle: clarifying.chapter.title, count: clarifying.chapter.count
    }, $("clarify-text").value);
    $("clarify-dialog").close();
    toast(`Clarification posted at ${formatTime(clarifying.chapter.start)} in the lesson.${offlineSuffix()}`, "ok", 5000);
    await refresh();
  } catch (err) {
    $("clarify-error").textContent = err.message;
  }
});

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

await refresh();
