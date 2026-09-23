/* =========================================================
   shell.js — layout for signed-in pages: a navy sidebar with
   the role's navigation, and a white top bar with the page
   title, live sync status and the officer's identity.

   <header id="app-header"></header>
   renderShell(user, "nominations");
   ========================================================= */

import { read } from "./store.js";
import { logout, demoLogin, HOME_BY_ROLE, ROLE_LABEL } from "./auth.js";
import { onSyncState, pendingCount } from "./sync.js";
import { escapeHtml } from "./ui.js";

/* Line icons, 24px grid, stroke = currentColor */
const I = {
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>',
  inbox: '<path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  badge: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.2L7 21l5-2.5 5 2.5-1.5-7.8"/>',
  capsule: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 5V3M15 5V3"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  out: '<path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  catalog: '<rect x="3.5" y="4" width="7" height="7" rx="1.2"/><rect x="13.5" y="4" width="7" height="7" rx="1.2"/><rect x="3.5" y="14" width="7" height="6" rx="1.2"/><path d="M14 17h6"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9zM8.5 12l2 2 4-4M8.5 17h7"/>',
  library: '<path d="M4 20V5M8.5 20V5M13 20l-1.5-15M16 5l4 15"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l2 2M14 9l2 2"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
  matrix: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;

const NAV = {
  trainee: [
    { key: "training", label: "My training", href: "trainee.html", icon: "book" },
    { key: "courses", label: "Browse courses", href: "courses.html", icon: "catalog" },
    { key: "questionnaires", label: "Assessments", href: "questionnaires.html", icon: "clipboard" },
    { key: "library", label: "Library", href: "library.html", icon: "library" },
    { key: "capsule", label: "Station knowledge", href: "capsule.html", icon: "capsule" },
    { key: "profile", label: "My profile", href: "profile.html", icon: "user" }
  ],
  trainer: [
    { key: "batches", label: "Mentor dashboard", href: "trainer.html", icon: "grid" },
    { key: "questionnaires", label: "Questionnaires", href: "questionnaires.html", icon: "clipboard" },
    { key: "library", label: "Trainer library", href: "library.html", icon: "library" },
    { key: "competency", label: "Competency map", href: "competency.html", icon: "matrix" },
    { key: "capsule", label: "Station knowledge", href: "capsule.html", icon: "capsule" },
    { key: "profile", label: "My profile", href: "profile.html", icon: "user" }
  ],
  admin: [
    { key: "nominations", label: "Nominations", href: "admin.html", icon: "inbox" },
    { key: "reports", label: "Reports", href: "reports.html", icon: "chart" },
    { key: "users", label: "Users & roles", href: "users.html", icon: "key", division: true },
    { key: "announcements", label: "Announcements", href: "announcements.html", icon: "megaphone" },
    { key: "coverage", label: "Skill coverage", href: "coverage.html", icon: "shield" },
    { key: "competency", label: "Competency map", href: "competency.html", icon: "matrix" },
    { key: "capsule", label: "Succession capsules", href: "capsule.html", icon: "capsule" }
  ]
};
const TOOLS = [
  { key: "verify", label: "Verify a certificate", href: "verify.html", icon: "badge" },
  { key: "status", label: "System check", href: "status.html", icon: "pulse" }
];

const DEMO_VIEWS = [
  { value: "trainee",        label: "Trainee",           role: "trainee" },
  { value: "trainer",        label: "Trainer / Mentor",  role: "trainer" },
  { value: "admin-station",  label: "Station head",      role: "admin", scope: "station" },
  { value: "admin-division", label: "Training Division", role: "admin", scope: "division" }
];

export function roleTitle(user) {
  if (user.role === "admin") return user.adminScope === "division" ? "Training Division" : "Station head";
  return ROLE_LABEL[user.role];
}
function currentDemoValue(user) {
  if (user.role === "admin") return user.adminScope === "division" ? "admin-division" : "admin-station";
  return user.role;
}
function metaLine(user, station) {
  const role = roleTitle(user);
  const place = station ? station.name : "";
  return place.startsWith(role) ? place : `${role} · ${place}`;
}
export function initials(name) {
  return name.replace(/^(Dr\.|Capt\.)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const link = (l, activeKey) =>
  `<a href="${l.href}" class="side-link${l.key === activeKey ? " is-active" : ""}"${l.key === activeKey ? ' aria-current="page"' : ""}>${icon(l.icon)}<span>${l.label}</span></a>`;

/* ---------- live sync status in the top bar ---------- */
function setSync(el, state, pending) {
  el.classList.remove("is-offline", "is-syncing");
  if (state === "offline" || !navigator.onLine) {
    el.classList.add("is-offline");
    el.textContent = pending ? `Offline · ${pending} to sync` : "Offline";
  } else if (state === "syncing") {
    el.classList.add("is-syncing");
    el.textContent = "Syncing…";
  } else {
    el.textContent = "Synced";
  }
}

export async function renderShell(user, activeKey, title) {
  document.body.classList.add("has-sidebar", "is-entering");
  setTimeout(() => document.body.classList.remove("is-entering"), 1200);
  const station = await read.one("stations", user.stationId);
  const items = (NAV[user.role] || []).filter(i => !i.division || user.adminScope === "division");
  const pageTitle = title || (items.find(i => i.key === activeKey) || TOOLS.find(i => i.key === activeKey) || {}).label || "Capacity Connect";

  /* sidebar */
  const aside = document.createElement("aside");
  aside.className = "sidebar";
  aside.id = "sidebar";
  aside.setAttribute("aria-label", "Main navigation");
  aside.innerHTML = `
    <a class="brand" href="index.html"><img src="assets/icons/mark.svg" alt="">Capacity Connect</a>
    <nav class="side-nav">
      ${items.map(l => link(l, activeKey)).join("")}
      <span class="side-label">Tools</span>
      ${TOOLS.map(l => link(l, activeKey)).join("")}
    </nav>
    <div class="side-foot">
      <label class="demo-switch">
        <span>Demo: view as</span>
        <select id="demo-switch">
          ${DEMO_VIEWS.map(v => `<option value="${v.value}"${v.value === currentDemoValue(user) ? " selected" : ""}>${v.label}</option>`).join("")}
        </select>
      </label>
      <button class="side-link sign-out" id="sign-out" type="button">${icon("out")}<span>Sign out</span></button>
    </div>`;
  document.body.prepend(aside);
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  document.body.prepend(scrim);

  /* top bar */
  const header = document.getElementById("app-header");
  header.className = "topbar";
  header.innerHTML = `
    <div class="topbar-inner">
      <button class="menu-btn" id="menu-btn" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${icon("menu")}</button>
      <p class="topbar-title">${escapeHtml(pageTitle)}</p>
      <span class="spacer"></span>
      <span class="sync-pill" id="sync-pill" role="status">Synced</span>
      <div class="bell-wrap">
        <button class="bell-btn" id="bell-btn" type="button" aria-label="Notifications" aria-expanded="false" aria-controls="bell-panel">${icon("bell")}<span class="bell-count" id="bell-count" hidden></span></button>
        <div class="bell-panel" id="bell-panel" hidden role="region" aria-label="Notifications"></div>
      </div>
      <div class="user-chip" title="${escapeHtml(user.designation)}">
        <span class="avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
        <span class="user-text">
          <span class="user-name">${escapeHtml(user.name)}</span>
          <span class="user-meta">${escapeHtml(metaLine(user, station))}</span>
        </span>
      </div>
    </div>`;

  /* behaviour */
  const toggle = open => {
    document.body.classList.toggle("nav-open", open);
    header.querySelector("#menu-btn").setAttribute("aria-expanded", String(open));
  };
  header.querySelector("#menu-btn").addEventListener("click", () => toggle(!document.body.classList.contains("nav-open")));
  scrim.addEventListener("click", () => toggle(false));
  addEventListener("keydown", e => { if (e.key === "Escape") toggle(false); });

  aside.querySelector("#sign-out").addEventListener("click", logout);
  aside.querySelector("#demo-switch").addEventListener("change", async e => {
    const view = DEMO_VIEWS.find(v => v.value === e.target.value);
    const res = await demoLogin(view.role, view.scope);
    if (res.ok) location.href = HOME_BY_ROLE[res.user.role];
  });

  /* notifications: announcements published by administrators */
  const SEEN_KEY = `cc.seenNotices.${user.id}`;
  const { listAnnouncements, TYPES } = await import("./services/announcements.js");
  const notices = await listAnnouncements();
  let seen = 0;
  try { seen = Number(localStorage.getItem(SEEN_KEY) || 0); } catch { /* private mode */ }
  const unread = notices.filter(n => new Date(n.publishedAt).getTime() > seen).length;
  const count = header.querySelector("#bell-count");
  if (unread) { count.hidden = false; count.textContent = unread; }
  const panel = header.querySelector("#bell-panel");
  panel.innerHTML = `<p class="bell-title">Notices from the Training Division</p>` + (notices.length ? `<ul>${notices.slice(0, 6).map(n => `
    <li><span class="tag ${TYPES[n.type]?.tag || ""}">${escapeHtml(TYPES[n.type]?.label || "")}</span><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span></li>`).join("")}</ul>`
    : `<p class="muted small">No notices yet.</p>`);
  const bellBtn = header.querySelector("#bell-btn");
  bellBtn.addEventListener("click", e => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    bellBtn.setAttribute("aria-expanded", String(open));
    if (open) { count.hidden = true; try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* ignore */ } }
  });
  document.addEventListener("click", e => { if (!panel.hidden && !e.target.closest(".bell-wrap")) { panel.hidden = true; bellBtn.setAttribute("aria-expanded", "false"); } });

  const pill = header.querySelector("#sync-pill");
  setSync(pill, navigator.onLine ? "synced" : "offline", await pendingCount());
  onSyncState(s => setSync(pill, s.state, s.pending));
  addEventListener("online", async () => setSync(pill, "synced", await pendingCount()));
  addEventListener("offline", async () => setSync(pill, "offline", await pendingCount()));
}
