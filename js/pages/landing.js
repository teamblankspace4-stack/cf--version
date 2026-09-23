import { ready } from "../app.js";
import { getSWInfo, onInstallAvailable, promptInstall } from "../pwa.js";
import { listAnnouncements, TYPES } from "../services/announcements.js";

const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- offline readiness ---------- */
async function checkOffline() {
  const status = $("offline-status");
  const text = $("offline-status-text");
  const info = await getSWInfo();
  if (info) {
    status.classList.add("is-ready");
    text.textContent = "Ready to work offline on this device";
  } else if (!("serviceWorker" in navigator)) {
    text.textContent = "This browser can't run offline. Use Chrome or Edge.";
  } else {
    text.textContent = "Preparing offline mode…";
    setTimeout(checkOffline, 1500);
  }
}
navigator.serviceWorker?.addEventListener("controllerchange", checkOffline);

/* ---------- install ---------- */
const installBtn = $("install-btn");
onInstallAvailable(ok => { installBtn.hidden = !ok; });
installBtn.addEventListener("click", promptInstall);

/* ---------- header ---------- */
const header = $("site-header");
const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
const toggle = $("nav-toggle");
toggle.addEventListener("click", () => {
  const open = !header.classList.contains("nav-open");
  header.classList.toggle("nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
});
document.querySelectorAll("#header-nav a").forEach(a => a.addEventListener("click", () => {
  header.classList.remove("nav-open");
  toggle.setAttribute("aria-expanded", "false");
}));

/* ---------- reveal on scroll, staggered within a group ---------- */
const items = document.querySelectorAll(".reveal");
if (!("IntersectionObserver" in window) || reduced) {
  items.forEach(el => el.classList.add("is-in"));
} else {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const group = [...e.target.parentElement.children].filter(c => c.classList.contains("reveal"));
      e.target.style.transitionDelay = `${Math.min(Math.max(0, group.indexOf(e.target)), 6) * 80}ms`;
      e.target.classList.add("is-in");
      obs.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
  items.forEach(el => io.observe(el));
}

/* ---------- smooth in-page links, offset for the sticky header ---------- */
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const el = document.querySelector(a.getAttribute("href"));
  if (!el) return;
  e.preventDefault();
  const y = el.getBoundingClientRect().top + scrollY - header.offsetHeight + 1;
  scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
}));


/* ---------- role preview tabs: auto-rotate until the visitor takes over ---------- */
const showcase = document.querySelector(".showcase");
const tabs = [...document.querySelectorAll(".role-tab")];
let tabTimer = null;
function selectTab(tab, focus = false) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
}
function stopAuto() { clearInterval(tabTimer); tabTimer = null; showcase?.classList.remove("is-auto"); }
if (showcase && tabs.length) {
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => { stopAuto(); selectTab(t); });
    t.addEventListener("keydown", e => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
      e.preventDefault(); stopAuto();
      const next = tabs[(i + (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next, true);
    });
  });
  if (!reduced) {
    const startAuto = () => {
      showcase.classList.add("is-auto");
      tabTimer = setInterval(() => {
        const i = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
        const next = tabs[(i + 1) % tabs.length];
        // restart the progress line on the newly selected tab
        showcase.classList.remove("is-auto"); void showcase.offsetWidth; showcase.classList.add("is-auto");
        selectTab(next);
      }, 6000);
    };
    // only start once the section is on screen
    const so = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) { startAuto(); obs.disconnect(); }
    }, { threshold: 0.3 });
    so.observe(showcase);
  }
}

/* ---------- live sync demo: offline edits queue, then sync ---------- */
const sdPill = $("sd-pill"), sdNote = $("sd-note"), sdQueue = $("sd-queue");
if (sdPill) {
  const ACTIONS = ["Quiz passed, AWS-201", "Note saved at 2:22", "Practical submitted"];
  const steps = [
    () => { sdPill.className = "sd-pill is-offline"; sdPill.textContent = "Offline"; sdNote.textContent = "Signal lost at the observatory"; sdQueue.innerHTML = ""; },
    () => add(0), () => add(1), () => add(2),
    () => { sdPill.className = "sd-pill is-syncing"; sdPill.textContent = "Syncing…"; sdNote.textContent = "Connection is back"; },
    () => markSent(0), () => markSent(1), () => markSent(2),
    () => { sdPill.className = "sd-pill"; sdPill.textContent = "Synced"; sdNote.textContent = "Nothing lost, nothing re-uploaded"; }
  ];
  function add(i) {
    sdPill.textContent = `Offline · ${i + 1} to sync`;
    const li = document.createElement("li");
    li.innerHTML = `<span>${ACTIONS[i]}</span><em>Saved on device</em>`;
    sdQueue.appendChild(li);
  }
  function markSent(i) {
    const li = sdQueue.children[i];
    if (!li) return;
    li.classList.add("is-sent");
    li.querySelector("em").textContent = "Synced";
  }
  if (reduced) {
    steps[0](); add(0); add(1); add(2);
    [0, 1, 2].forEach(markSent);
    steps[8]();
  } else {
    let k = 0;
    let running = null;
    const tick = () => { steps[k](); k = (k + 1) % steps.length; running = setTimeout(tick, k === 0 ? 2600 : k === 1 ? 900 : 1100); };
    const so2 = new IntersectionObserver(entries => {
      const visible = entries.some(e => e.isIntersecting);
      if (visible && !running) tick();
      if (!visible && running) { clearTimeout(running); running = null; }
    }, { threshold: 0.2 });
    so2.observe(sdPill.closest(".sync-demo"));
  }
}

await ready;
checkOffline();

/* "What's new" shows what the Training Division has published */
const news = (await listAnnouncements({ homepageOnly: true })).slice(0, 3);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
if (news.length) {
  $("news-list").innerHTML = news.map(n => `
    <article class="news is-in reveal">
      <span class="tag ${TYPES[n.type]?.tag || "tag-slate"}">${esc(TYPES[n.type]?.label || "Update")}</span>
      <h3>${esc(n.title)}</h3>
      <p>${esc(n.body)}</p>
      <p class="news-date">${new Date(n.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
    </article>`).join("");
}
