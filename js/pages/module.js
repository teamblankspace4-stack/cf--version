import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { getLookup, categoryLabel } from "../services/training.js";
import * as L from "../services/learning.js";
import { buildIndex, searchLesson, formatTime } from "../search.js";
import { ASPECTS, getMyFeedback, submitFeedback } from "../services/feedback.js";

await ready;
const user = await requireRole(["trainee"]);
await renderShell(user, "training");

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const enrollmentId = params.get("e");
const lookup = await getLookup();

const TYPE_LABEL = { video: "Video lesson", reading: "Reading", quiz: "Quiz", practical: "Practical task" };
const LOCK_SVG = `<svg class="lock-icon" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.2" width="8" height="6" rx="1" fill="currentColor"/><path d="M4 5.2V3.6a2 2 0 0 1 4 0v1.6" stroke="currentColor" fill="none" stroke-width="1.4"/></svg>`;
const CHECK_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.2l2.6 2.6L11 4.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let view = null;
let current = null;
let onLeave = null;          // saves video progress when switching unit or leaving

/* =========================================================
   Loading and head
   ========================================================= */
async function load() {
  view = await L.getModuleView(user, enrollmentId);
}

function renderHead() {
  const m = view.module;
  $("module-head").innerHTML = `
    <div class="module-head">
      <div>
        <span class="module-code">${escapeHtml(m.code)}, ${escapeHtml(categoryLabel(lookup, m.category))}</span>
        <h1>${escapeHtml(m.title)}</h1>
        <p class="module-meta">${escapeHtml(view.batch?.name || "")}. Mentor: ${escapeHtml(view.trainer?.name || "to be assigned")}. About ${m.durationHrs} hours.</p>
      </div>
      <div class="download" id="download"></div>
      <div class="module-progress">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${view.total}" aria-valuenow="${view.doneCount}" aria-label="Module progress"><span style="width:${Math.round(view.pct * 100)}%"></span></div>
        <span>${view.doneCount} of ${view.total} units complete</span>
      </div>
    </div>`;
  document.title = `${m.code} · Capacity Connect`;
  renderDownload();
}

async function renderDownload() {
  const box = $("download");
  if (!box) return;
  if (!view.media.length) { box.innerHTML = ""; return; }
  if (await L.isDownloaded(view.media)) {
    box.innerHTML = `<span class="pill pill-ok">Available offline</span><button class="link-btn" id="dl-remove" type="button">Remove download</button>`;
    $("dl-remove").addEventListener("click", async () => {
      await L.removeDownload(view.media);
      toast("Download removed from this device.");
      renderDownload();
    });
    return;
  }
  if (!navigator.onLine) {
    box.innerHTML = `<span class="pill pill-warn">Not downloaded</span><span class="small">Connect once to download for offline use.</span>`;
    return;
  }
  box.innerHTML = `<button class="btn btn-secondary" id="dl-btn" type="button">Download for offline</button><span class="small" id="dl-note">Keeps the lesson video on this device</span>`;
  L.downloadSize(view.media).then(bytes => {
    const note = $("dl-note");
    if (bytes && note) note.textContent = `${(bytes / 1048576).toFixed(1)} MB. Keeps the lesson video on this device.`;
  });
  $("dl-btn").addEventListener("click", async () => {
    const btn = $("dl-btn");
    btn.disabled = true;
    try {
      await L.downloadMedia(view.media, r => { btn.textContent = r == null ? "Downloading…" : `Downloading ${Math.round(r * 100)}%`; });
      toast("Downloaded. This module now works with no network.", "ok", 4500);
    } catch (e) {
      toast(e.message, "danger", 6000);
    }
    renderDownload();
  });
}
window.addEventListener("online", renderDownload);
window.addEventListener("offline", renderDownload);

/* =========================================================
   Unit list
   ========================================================= */
function unitSub(u) {
  const p = u.progress;
  switch (u.state) {
    case "done":
      return u.type === "quiz" && p?.bestScore != null ? `Completed, best score ${p.bestScore}%` : "Completed";
    case "submitted": return "Waiting for mentor review";
    case "reviewed": return "Reviewed by mentor";
    case "locked": return "Opens after the previous unit";
    case "unavailable": return "Content being prepared";
    case "in-progress":
      if (u.type === "video") return `Watched ${p?.watchedPct || 0}%`;
      if (u.type === "quiz") return `Last score ${p?.lastScore ?? 0}%, pass mark ${u.content?.passMark || 70}%`;
      return "In progress";
    default:
      return `${TYPE_LABEL[u.type]}, about ${u.minutes} min`;
  }
}

function renderNav() {
  $("unit-nav").innerHTML = `<ol>${view.units.map((u, i) => {
    const cls = { done: "is-done", reviewed: "is-done", submitted: "is-submitted", locked: "is-locked", unavailable: "is-locked" }[u.state] || "is-open";
    const mark = cls === "is-done" ? CHECK_SVG : cls === "is-locked" ? LOCK_SVG : i + 1;
    return `<li><button type="button" class="unit-link ${cls}" data-id="${u.id}" ${current && current.id === u.id ? 'aria-current="step"' : ""}>
      <span class="unit-mark">${mark}</span>
      <span><span class="unit-title">${escapeHtml(u.title)}</span><span class="unit-sub">${escapeHtml(unitSub(u))}</span></span>
    </button></li>`;
  }).join("")}</ol>`;

  $("unit-nav").querySelectorAll(".unit-link").forEach(b => b.addEventListener("click", () => {
    const u = view.units.find(x => x.id === b.dataset.id);
    if (u.state === "locked") {
      const prev = view.units[view.units.indexOf(u) - 1];
      return toast(`Finish "${prev.title}" first. Units open in order, so training can't be skipped.`, "warn", 5000);
    }
    openUnit(u.id);
  }));
}

/* =========================================================
   Opening units
   ========================================================= */
function pickDefaultUnit() {
  const wanted = view.units.find(u => u.id === params.get("u") && u.state !== "locked");
  return wanted
    || view.units.find(u => ["available", "in-progress"].includes(u.state))
    || view.units.find(u => u.state === "submitted")
    || view.units[0];
}

async function openUnit(id) {
  if (onLeave) { await onLeave(); onLeave = null; }
  current = view.units.find(u => u.id === id);
  const url = new URL(location.href);
  url.searchParams.set("u", id);
  history.replaceState(null, "", url);
  renderNav();
  window.scrollTo({ top: 0 });

  if (current.state === "unavailable" || !current.content) {
    $("unit-view").innerHTML = `<div class="unit-card"><div class="empty"><p>The Training Division is still preparing this unit. You can start it as soon as it's published.</p></div></div>`;
    return;
  }
  const renderers = { video: renderVideo, reading: renderReading, quiz: renderQuiz, practical: renderPractical };
  await renderers[current.type](current);
}

/** After a unit is completed: refresh data, head and list without re-rendering the unit itself. */
async function afterComplete() {
  await load();
  current = view.units.find(u => u.id === current.id);
  renderHead();
  renderNav();
  const holder = $("next-holder");
  if (holder) { holder.innerHTML = nextBanner(current); bindNext(); }
}

function nextBanner(u) {
  if (!["done", "submitted", "reviewed"].includes(u.state)) return "";
  const i = view.units.indexOf(u);
  const next = view.units[i + 1];
  if (next && next.state !== "locked") {
    return `<div class="next-step"><p>Unit complete. Next: <b>${escapeHtml(next.title)}</b></p>
      <button class="btn btn-primary" id="next-btn" data-id="${next.id}" type="button">Continue</button></div>`;
  }
  if (!next) {
    const waiting = view.units.some(x => x.state === "submitted");
    return `<div class="next-step"><p>${waiting ? "All units done. Your practical task is with your mentor for review; your certificate is issued after it's approved." : "Module complete."}</p>
      <a class="btn btn-primary" href="trainee.html">Back to my training</a></div>`;
  }
  return "";
}
function bindNext() {
  const b = $("next-btn");
  if (b) b.addEventListener("click", () => openUnit(b.dataset.id));
}

/* =========================================================
   Tabs, notes and discussion (shared by every unit type)
   ========================================================= */
const TAB_LABEL = { transcript: "Transcript", notes: "My notes", discussion: "Discussion" };

function tabsHtml(keys) {
  return `<div class="tabs" role="tablist">${keys.map((k, i) =>
    `<button type="button" class="tab" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${TAB_LABEL[k]}<span class="count" id="count-${k}"></span></button>`).join("")}</div>
    ${keys.map((k, i) => `<div class="tab-panel" role="tabpanel" id="panel-${k}" aria-labelledby="tab-${k}"${i === 0 ? "" : " hidden"}></div>`).join("")}`;
}

function setupTabs() {
  const tabs = [...document.querySelectorAll(".tab")];
  const select = tab => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); select(next);
    });
  });
}

async function renderNotes(u, getTime, seekTo) {
  const panel = $("panel-notes");
  const notes = await L.getNotes(user, u.id);
  $("count-notes").textContent = notes.length ? `(${notes.length})` : "";
  panel.innerHTML = `
    <form class="composer" id="note-form">
      <label class="visually-hidden" for="note-text">Your note</label>
      <textarea class="input" id="note-text" rows="2" placeholder="Private note. Only you can see it."></textarea>
      <div class="composer-foot">
        <span class="small muted">Saved on this device and synced to your account.</span>
        <button class="btn btn-primary" type="submit" id="note-save">${getTime ? `Save note at ${formatTime(getTime())}` : "Save note"}</button>
      </div>
    </form>
    <ul class="item-list">${notes.length ? notes.map(n => `
      <li class="item">
        <div class="item-head">
          ${n.atSecond != null ? `<button type="button" class="time-link" data-t="${n.atSecond}">${formatTime(n.atSecond)}</button>` : ""}
          <span class="muted">${formatDate(n.createdAt, true)}</span>
          <button type="button" class="link-btn" data-del="${n.id}">Delete</button>
        </div>
        <p>${escapeHtml(n.text)}</p>
      </li>`).join("") : `<li class="small muted">No notes yet.</li>`}</ul>`;

  $("note-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await L.addNote(user, u, view.module.id, $("note-text").value, getTime ? Math.floor(getTime()) : null);
      toast("Note saved.", "ok");
      renderNotes(u, getTime, seekTo);
    } catch (err) { toast(err.message, "warn"); }
  });
  panel.querySelectorAll("[data-t]").forEach(b => b.addEventListener("click", () => seekTo && seekTo(Number(b.dataset.t))));
  panel.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => {
    await L.deleteNote(user, b.dataset.del);
    renderNotes(u, getTime, seekTo);
  }));
}

async function renderDiscussion(u, getTime, seekTo) {
  const panel = $("panel-discussion");
  const posts = await L.getThread(u.id);
  $("count-discussion").textContent = posts.length ? `(${posts.length})` : "";
  panel.innerHTML = `
    <form class="composer" id="post-form">
      <label class="visually-hidden" for="post-text">Your question</label>
      <textarea class="input" id="post-text" rows="2" placeholder="Ask your mentor or batch about this unit"></textarea>
      <div class="composer-foot">
        ${getTime ? `<label><input type="checkbox" id="post-at" checked> Link to <span id="post-at-t">${formatTime(getTime())}</span> in the lesson</label>` : "<span></span>"}
        <button class="btn btn-primary" type="submit">Post question</button>
      </div>
    </form>
    <ul class="item-list">${posts.length ? posts.map(p => `
      <li class="item">
        <div class="item-head">
          <b>${escapeHtml(p.author?.name || "Officer")}</b>
          ${p.authorRole === "trainer" ? `<span class="role-tag">Mentor</span>` : ""}
          <span class="muted">${formatDate(p.createdAt, true)}</span>
          ${p.atSecond != null ? `<button type="button" class="time-link" data-t="${p.atSecond}">at ${formatTime(p.atSecond)}</button>` : ""}
        </div>
        <p>${escapeHtml(p.text)}</p>
      </li>`).join("") : `<li class="small muted">No questions yet. Ask one and your mentor will see it on their dashboard.</li>`}</ul>`;

  $("post-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const at = getTime && $("post-at")?.checked ? Math.floor(getTime()) : null;
      await L.postToThread(user, u, view.module.id, $("post-text").value, at);
      toast(navigator.onLine ? "Question posted." : "Question saved. It will post when you're back online.", "ok");
      renderDiscussion(u, getTime, seekTo);
    } catch (err) { toast(err.message, "warn"); }
  });
  panel.querySelectorAll("[data-t]").forEach(b => b.addEventListener("click", () => seekTo && seekTo(Number(b.dataset.t))));
}

/* =========================================================
   Video lesson
   ========================================================= */
async function renderVideo(u) {
  const c = u.content;
  const D = c.duration;
  const index = buildIndex(c.chapters);

  $("unit-view").innerHTML = `
    <div id="next-holder">${nextBanner(u)}</div>
    <div class="unit-card">
      <span class="unit-type">Video lesson, ${formatTime(D)}</span>
      <h2>${escapeHtml(u.title)}</h2>
      <div class="player-wrap" id="player-wrap">
        <video id="player" controls playsinline preload="metadata" poster="${c.poster}" src="${c.video}"></video>
      </div>
      <div class="watch" id="watch"><div class="bar"><span id="watch-bar"></span></div><span id="watch-text"></span></div>

      <div class="lesson-tools">
        <form class="find" id="find-form" role="search">
          <label for="find-q">Find in this lesson</label>
          <div class="find-row">
            <input class="input" id="find-q" placeholder="e.g. aliasing, bright band, shift handover" autocomplete="off">
            <button class="btn btn-secondary" type="submit">Find</button>
          </div>
        </form>
        <button class="btn btn-secondary confused" id="confused-btn" type="button">I'm confused at this point</button>
        <ol class="find-results" id="find-results"></ol>
      </div>

      ${tabsHtml(["transcript", "notes", "discussion"])}
    </div>`;
  bindNext();
  setupTabs();

  const player = $("player");
  const chapterAt = t => { let i = 0; c.chapters.forEach((ch, k) => { if (t >= ch.start) i = k; }); return i; };
  const seekTo = (t, play = true) => {
    player.currentTime = t;
    if (play) player.play().catch(() => {});
    const r = player.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight) player.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ---- transcript ---- */
  $("panel-transcript").innerHTML = `<ol class="transcript">${c.chapters.map((ch, i) => `
    <li><button type="button" class="chapter" data-i="${i}" data-t="${ch.start}">
      <span class="find-time">${formatTime(ch.start)}</span>
      <span><b>${escapeHtml(ch.title)}</b><p>${escapeHtml(ch.text)}</p></span>
    </button></li>`).join("")}</ol>`;
  const chapterEls = [...document.querySelectorAll(".chapter")];
  chapterEls.forEach(b => b.addEventListener("click", () => seekTo(Number(b.dataset.t))));
  let shownChapter = -1;
  const highlight = t => {
    const i = chapterAt(t);
    if (i === shownChapter) return;
    shownChapter = i;
    chapterEls.forEach((el, k) => el.classList.toggle("is-current", k === i));
  };
  highlight(0);

  renderNotes(u, () => player.currentTime, seekTo);
  renderDiscussion(u, () => player.currentTime, seekTo);

  /* ---- watch tracking: only seconds actually played count ---- */
  const stored = u.progress?.watched;
  const local = stored && stored.length === D ? [...stored].map(x => x === "1") : new Array(D).fill(false);
  if (u.state === "done" && !stored) local.fill(true);
  let last = null;
  let dirty = false;
  let saving = false;
  let lastSave = Date.now();

  const ratio = () => local.filter(Boolean).length / D;
  const updateWatch = () => {
    // A save can finish after the officer has moved to another unit.
    if (!$("watch-bar") || !current || current.id !== u.id) return;
    const pct = Math.round(ratio() * 100);
    $("watch-bar").style.width = `${pct}%`;
    const done = ["done", "reviewed"].includes(current.state);
    $("watch").classList.toggle("is-done", done);
    $("watch-text").textContent = done
      ? `Lesson complete. You watched ${pct}%.`
      : `Watched ${pct}%. Watch at least ${Math.round(L.WATCH_THRESHOLD * 100)}% to open the next unit. Skipping ahead doesn't count.`;
  };
  updateWatch();

  async function save() {
    if (saving || !dirty) return;
    saving = true;
    dirty = false;
    lastSave = Date.now();
    try {
      const res = await L.saveVideoProgress(user, view, current, local.map(x => (x ? "1" : "0")).join(""));
      if (res.justCompleted) {
        await afterComplete();
        updateWatch();
        if (current && current.id === u.id) toast("Lesson complete. The next unit is now open.", "ok", 4500);
      }
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      saving = false;
    }
  }

  player.addEventListener("play", () => { last = player.currentTime; });
  player.addEventListener("seeking", () => { last = null; });
  player.addEventListener("seeked", () => { last = player.paused ? null : player.currentTime; });
  player.addEventListener("pause", save);
  player.addEventListener("ended", save);

  let shownSecond = -1;
  player.addEventListener("timeupdate", () => {
    const t = player.currentTime;
    if (!player.paused && !player.seeking && last !== null && t >= last && t - last < 2.5) {
      for (let s = Math.floor(last); s <= Math.floor(t) && s < D; s++) {
        if (!local[s]) { local[s] = true; dirty = true; }
      }
    }
    if (!player.seeking) last = t;
    highlight(t);
    if (Math.floor(t) !== shownSecond) {
      shownSecond = Math.floor(t);
      updateWatch();
      const ns = $("note-save"); if (ns) ns.textContent = `Save note at ${formatTime(t)}`;
      const pa = $("post-at-t"); if (pa) pa.textContent = formatTime(t);
    }
    if (dirty && (Date.now() - lastSave > 8000 || (ratio() >= L.WATCH_THRESHOLD && current.state !== "done"))) save();
  });

  const showPlayerMsg = offline => {
    const wrap = $("player-wrap");
    if (!wrap || wrap.querySelector(".player-msg")) return;
    const msg = document.createElement("div");
    msg.className = "player-msg";
    msg.innerHTML = `<div><p>${offline
      ? "You're offline and this lesson video isn't downloaded yet. Connect once and choose Download for offline, then it plays anywhere."
      : "The lesson video couldn't load. Check your connection and try again."}</p>
      <p>The full transcript is still available below.</p></div>`;
    wrap.appendChild(msg);
  };
  player.addEventListener("error", () => showPlayerMsg(!navigator.onLine));
  // Don't wait for playback to fail: tell the officer straight away.
  const checkOffline = async () => {
    if (!navigator.onLine && !(await L.isDownloaded(view.media))) { player.pause(); showPlayerMsg(true); }
  };
  checkOffline();
  window.addEventListener("offline", checkOffline);

  onLeave = async () => { player.pause(); await save(); };

  /* ---- find in lesson ---- */
  $("find-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = $("find-q").value.trim();
    const list = $("find-results");
    if (!q) { list.innerHTML = ""; return; }
    const hits = searchLesson(index, q);
    list.innerHTML = hits.length ? hits.map(h => `
      <li><button type="button" class="find-hit" data-t="${h.time}" data-i="${h.chapterIndex}">
        <span class="find-time">${formatTime(h.time)}</span>
        <span><b>${escapeHtml(h.title)}</b><span>${escapeHtml(h.snippet)}</span></span>
      </button></li>`).join("")
      : `<li class="find-empty">Nothing in this lesson matches "${escapeHtml(q)}". Try another word, or ask your mentor in Discussion.</li>`;
    list.querySelectorAll(".find-hit").forEach(b => b.addEventListener("click", () => {
      seekTo(Number(b.dataset.t));
      const el = chapterEls[Number(b.dataset.i)];
      el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
    }));
  });

  /* ---- anonymous confusion flag ---- */
  $("confused-btn").addEventListener("click", async () => {
    const t = player.currentTime;
    const ci = chapterAt(t);
    if (L.hasFlagged(user.id, u.id, ci)) {
      return toast(`You've already flagged "${c.chapters[ci].title}". Your mentor can see it.`);
    }
    try {
      await L.flagConfusion(user, u, view.module.id, t, ci);
      toast(`Flagged anonymously at ${formatTime(t)}. Your mentor sees how many officers found this part confusing, never who.`, "ok", 6000);
    } catch (err) { toast(err.message, "warn"); }
  });
}

/* =========================================================
   Reading
   ========================================================= */
async function renderReading(u) {
  const c = u.content;
  const done = ["done", "reviewed"].includes(u.state);
  $("unit-view").innerHTML = `
    <div id="next-holder">${nextBanner(u)}</div>
    <div class="unit-card">
      <span class="unit-type">Reading, about ${u.minutes} minutes</span>
      <h2>${escapeHtml(c.title)}</h2>
      <div class="reading-body">${c.html}</div>
      <div class="reading-end" id="reading-end">
        <p id="read-hint">${done ? "Completed." : "Read to the end to mark this unit complete."}</p>
        <button class="btn btn-primary" id="mark-read" type="button" ${done ? "hidden" : "disabled"}>Mark as read</button>
      </div>
      ${tabsHtml(["notes", "discussion"])}
    </div>`;
  bindNext();
  setupTabs();
  renderNotes(u, null, null);
  renderDiscussion(u, null, null);

  if (!done) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        $("mark-read").disabled = false;
        $("read-hint").textContent = "You've reached the end.";
        io.disconnect();
      }
    }, { threshold: 1 });
    io.observe($("read-hint"));
    $("mark-read").addEventListener("click", async () => {
      try {
        await L.completeReading(user, view, current);
        $("mark-read").hidden = true;
        $("read-hint").textContent = "Completed.";
        await afterComplete();
        toast("Reading complete. The next unit is now open.", "ok");
      } catch (err) { toast(err.message, "danger"); }
    });
  }
}

/* =========================================================
   Quiz
   ========================================================= */
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function renderQuiz(u) {
  const c = u.content;
  const p = u.progress;
  const passMark = c.passMark || 70;
  const done = ["done", "reviewed"].includes(u.state);
  const orders = c.questions.map(q => shuffle(q.options.map((_, i) => i)));

  $("unit-view").innerHTML = `
    <div id="next-holder">${nextBanner(u)}</div>
    <div class="unit-card">
      <span class="unit-type">Quiz, pass mark ${passMark}%</span>
      <h2>${escapeHtml(u.title)}</h2>
      <p class="muted">${p?.attempts ? `Attempts: ${p.attempts}. Best score: ${p.bestScore}%.` : `${c.questions.length} questions. You need ${passMark}% to open the next unit.`}
        ${done ? " You've passed. Retaking is optional; your best score is kept." : ""}</p>
      <div id="quiz-result"></div>
      <form id="quiz-form">
        ${c.questions.map((q, qi) => `
          <fieldset class="question" data-q="${qi}">
            <legend>${qi + 1}. ${escapeHtml(q.q)}</legend>
            ${orders[qi].map(oi => `
              <label class="option" data-o="${oi}"><input type="radio" name="q${qi}" value="${oi}"><span>${escapeHtml(q.options[oi])}</span></label>`).join("")}
            <p class="explain" hidden>${escapeHtml(q.explain)}</p>
          </fieldset>`).join("")}
        <p class="field-error" id="quiz-error" role="alert"></p>
        <button class="btn btn-primary" type="submit" id="quiz-submit">${done ? "Retake quiz" : "Submit answers"}</button>
      </form>
      ${tabsHtml(["discussion", "notes"])}
    </div>`;
  bindNext();
  setupTabs();
  renderNotes(u, null, null);
  renderDiscussion(u, null, null);

  $("quiz-form").addEventListener("submit", async e => {
    e.preventDefault();
    const answers = c.questions.map((_, qi) => {
      const sel = document.querySelector(`input[name="q${qi}"]:checked`);
      return sel ? Number(sel.value) : null;
    });
    $("quiz-error").textContent = "";
    try {
      const res = await L.submitQuiz(user, view, current, answers);
      res.results.forEach((r, qi) => {
        const fs = document.querySelector(`.question[data-q="${qi}"]`);
        fs.querySelectorAll("input").forEach(i => { i.disabled = true; });
        fs.querySelector(`.option[data-o="${r.answer}"]`).classList.add("is-right");
        if (!r.correct) fs.querySelector(`.option[data-o="${r.chosen}"]`).classList.add("is-wrong");
        fs.querySelector(".explain").hidden = false;
      });
      $("quiz-submit").hidden = true;
      $("quiz-result").innerHTML = `
        <div class="result ${res.passed ? "is-pass" : "is-fail"}">
          <span class="result-score">${res.score}%</span>
          <div>
            <p><b>${res.passed ? "Passed." : `Not yet. You need ${res.passMark}%.`}</b></p>
            <p class="small">${res.passed ? "Explanations are below each question." : "Read the explanations below, review the lesson, then try again. Questions are reshuffled each time."}</p>
          </div>
          ${res.passed ? "" : `<button class="btn btn-primary" type="button" id="quiz-retry">Try again</button>`}
        </div>`;
      $("quiz-result").scrollIntoView({ behavior: "smooth", block: "start" });
      if ($("quiz-retry")) $("quiz-retry").addEventListener("click", async () => { await load(); current = view.units.find(x => x.id === u.id); renderNav(); renderQuiz(current); });
      if (res.justCompleted) {
        await afterComplete();
        toast("Quiz passed. The next unit is now open.", "ok");
      } else {
        await load(); current = view.units.find(x => x.id === u.id); renderNav();
      }
    } catch (err) {
      $("quiz-error").textContent = err.message;
    }
  });
}

/* =========================================================
   Practical task
   ========================================================= */
async function compressPhoto(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function renderPractical(u) {
  const c = u.content;
  const sub = await L.getSubmission(user, u.id);
  const submitted = u.state === "submitted" && sub;
  const reviewed = ["reviewed", "done"].includes(u.state) && sub && sub.status === "reviewed";
  const returned = sub && sub.status === "returned";

  $("unit-view").innerHTML = `
    <div id="next-holder">${nextBanner(u)}</div>
    <div class="unit-card">
      <span class="unit-type">Practical task, about ${u.minutes} minutes at your station</span>
      <h2>${escapeHtml(c.title)}</h2>
      <p>${escapeHtml(c.task)}</p>
      <ol class="steps">${c.steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
      ${reviewed ? `
        <div class="reviewed-box">
          <p><b>Approved by your mentor on ${formatDate(sub.reviewedAt, true)}.</b></p>
          <p class="competency-line">Competency score <b>${sub.competencyScore}%</b>. This is on your training record, not just a completion tick.</p>
          ${sub.feedback ? `<div class="submitted-text"><b>Mentor's feedback:</b> ${escapeHtml(sub.feedback)}</div>` : ""}
          <div class="submitted-text">${escapeHtml(sub.text)}</div>
        </div>` : submitted ? `
        <div class="submitted-box">
          <p><b>Submitted on ${formatDate(sub.createdAt, true)}. Waiting for your mentor's review.</b></p>
          <p class="small">Your mentor scores this against a rubric, and the competency score goes on your training record, not just a completion tick.</p>
          <div class="submitted-text">${escapeHtml(sub.text)}</div>
          ${sub.photo ? `<img class="photo-preview" src="${sub.photo}" alt="Photo you submitted as evidence">` : ""}
        </div>` : `
        ${returned ? `<div class="returned-box">
          <p><b>Your mentor returned this for rework on ${formatDate(sub.reviewedAt, true)}.</b></p>
          <div class="submitted-text"><b>What to change:</b> ${escapeHtml(sub.feedback || "")}</div>
          <p class="small">Your previous answer is below. Edit it and submit again.</p>
        </div>` : ""}
        <form id="practical-form">
          <p class="muted small">${escapeHtml(c.evidence)}</p>
          <div class="field">
            <label for="pr-text">What you did and what you found</label>
            <textarea class="input" id="pr-text" rows="6" placeholder="Describe the readings, what you identified, and your conclusion."></textarea>
            <span class="field-hint">At least 30 characters. Your draft is kept if you leave this page.</span>
          </div>
          <div class="field">
            <label for="pr-photo">Photo evidence (optional)</label>
            <input class="input" id="pr-photo" type="file" accept="image/*" capture="environment">
            <span class="field-hint">Photos are resized on your device to keep uploads small on slow connections.</span>
            <img class="photo-preview" id="pr-preview" alt="Preview of your photo" hidden>
          </div>
          <p class="field-error" id="pr-error" role="alert"></p>
          <button class="btn btn-primary" type="submit">Submit for mentor review</button>
        </form>`}
      ${tabsHtml(["discussion", "notes"])}
    </div>`;
  bindNext();
  setupTabs();
  renderNotes(u, null, null);
  renderDiscussion(u, null, null);
  if (submitted || reviewed) return;

  // Keep a local draft so a dropped connection or closed tab never loses work.
  const draftKey = `cc.draft.${user.id}.${u.id}`;
  try { $("pr-text").value = localStorage.getItem(draftKey) || (returned ? sub.text : ""); } catch { $("pr-text").value = returned ? sub.text : ""; }
  $("pr-text").addEventListener("input", e => { try { localStorage.setItem(draftKey, e.target.value); } catch { /* ignore */ } });

  let photo = null;
  $("pr-photo").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo = await compressPhoto(file);
      $("pr-preview").src = photo;
      $("pr-preview").hidden = false;
    } catch { toast("That file couldn't be read as a photo.", "warn"); }
  });

  $("practical-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("pr-error").textContent = "";
    try {
      await L.submitPractical(user, view, current, { text: $("pr-text").value, photo });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      await afterComplete();
      toast(navigator.onLine ? "Submitted for mentor review." : "Submitted. It will reach your mentor when you're back online.", "ok", 5000);
      renderPractical(current);
    } catch (err) {
      $("pr-error").textContent = err.message;
    }
  });
}


/* =========================================================
   Course feedback (one per officer per module, editable)
   ========================================================= */
async function renderFeedback() {
  const panel = $("feedback-panel");
  const mine = await getMyFeedback(user, view.module.id);
  let rating = mine?.rating || 0;
  panel.innerHTML = `
    <div class="panel-title"><h2 id="h-feedback">Your feedback on this module</h2><span class="meta-line">Trainers see ratings and comments without your name</span></div>
    <form id="fb-form">
      <div class="aspect-row"><span>Overall</span><span class="star-input" id="fb-stars" role="radiogroup" aria-label="Overall rating">${[1, 2, 3, 4, 5].map(n =>
        `<button type="button" role="radio" aria-checked="${n === rating}" aria-label="${n} star${n > 1 ? "s" : ""}" data-n="${n}" class="${n <= rating ? "on" : ""}">★</button>`).join("")}</span></div>
      ${Object.entries(ASPECTS).map(([k, l]) => `<div class="aspect-row"><label for="fb-${k}">${l}</label>
        <select class="input" id="fb-${k}"><option value="0">Skip</option>${[5, 4, 3, 2, 1].map(v => `<option value="${v}"${mine?.aspects?.[k] === v ? " selected" : ""}>${v} of 5</option>`).join("")}</select></div>`).join("")}
      <div class="field" style="margin-top: var(--sp-3)"><label for="fb-comment">Comment (optional)</label>
        <textarea class="input" id="fb-comment" rows="2" maxlength="800" placeholder="What worked, and what should change for the next batch?">${escapeHtml(mine?.comment || "")}</textarea></div>
      <p class="field-error" id="fb-error" role="alert"></p>
      <button class="btn btn-primary" type="submit">${mine ? "Update feedback" : "Send feedback"}</button>
      ${mine ? `<span class="meta-line" style="margin-left: var(--sp-3)">Last sent ${formatDate(mine.updatedAt)}</span>` : ""}
    </form>`;
  const stars = [...panel.querySelectorAll("#fb-stars button")];
  const paint = () => stars.forEach(b => { const n = Number(b.dataset.n); b.classList.toggle("on", n <= rating); b.setAttribute("aria-checked", String(n === rating)); });
  stars.forEach(b => b.addEventListener("click", () => { rating = Number(b.dataset.n); paint(); }));
  $("fb-form").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await submitFeedback(user, view.module.id, { rating, comment: $("fb-comment").value,
        aspects: Object.fromEntries(Object.keys(ASPECTS).map(k => [k, Number($(`fb-${k}`).value)])) });
      toast(navigator.onLine ? "Thanks. Your feedback goes to the trainers." : "Feedback saved on this device. It will send when you're back online.", "ok");
      renderFeedback();
    } catch (err) { $("fb-error").textContent = err.message; }
  });
}

/* =========================================================
   Boot
   ========================================================= */
document.addEventListener("visibilitychange", () => { if (document.hidden && onLeave) onLeave(); });

if (!enrollmentId) {
  location.replace("trainee.html");
} else {
  try {
    await load();
    renderHead();
    await openUnit(pickDefaultUnit().id);
    renderFeedback();
  } catch (err) {
    $("unit-view").innerHTML = `<div class="unit-card"><div class="empty"><p>${escapeHtml(err.message)}</p><a class="btn btn-primary" href="trainee.html">Back to my training</a></div></div>`;
  }
}
