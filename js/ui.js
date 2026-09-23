/* =========================================================
   ui.js — small shared UI pieces injected on every page.
   ========================================================= */

function stack() {
  let el = document.querySelector(".banner-stack");
  if (!el) {
    el = document.createElement("div");
    el.className = "banner-stack";
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  return el;
}

/* ---------- toasts ---------- */
export function toast(message, type = "info", ms = 3500) {
  let host = document.querySelector(".toast-stack");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-stack";
    host.setAttribute("role", "status");
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = `toast${type !== "info" ? " toast-" + type : ""}`;
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- connection banner ---------- */
let netBanner = null;
let hideTimer = null;

export function setConnectionBanner(state, pending = 0) {
  if (!netBanner) {
    netBanner = document.createElement("div");
    netBanner.className = "net-banner";
    netBanner.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="msg"></span>`;
    stack().appendChild(netBanner);
  }
  clearTimeout(hideTimer);
  const msg = netBanner.querySelector(".msg");
  netBanner.classList.toggle("is-offline", state === "offline");
  netBanner.hidden = false;

  if (state === "offline") {
    msg.textContent = pending
      ? `You're offline. ${pending === 1 ? "1 change is" : `${pending} changes are`} saved on this device and will sync when you reconnect.`
      : "You're offline. Everything keeps working; changes will sync when you reconnect.";
  } else if (state === "syncing") {
    msg.textContent = `Back online. Syncing ${pending} change${pending > 1 ? "s" : ""}…`;
  } else if (state === "online") {
    msg.textContent = "Back online.";
    hideTimer = setTimeout(() => { netBanner.hidden = true; }, 2500);
  } else if (state === "synced") {
    msg.textContent = "All changes synced.";
    hideTimer = setTimeout(() => { netBanner.hidden = true; }, 3000);
  } else {
    netBanner.hidden = true;
  }
}

/* ---------- update banner ---------- */
export function showUpdateBanner(onRefresh) {
  if (document.querySelector(".net-banner.is-update")) return;
  const b = document.createElement("div");
  b.className = "net-banner is-update";
  b.innerHTML = `<span class="dot" aria-hidden="true"></span><span>A new version of Capacity Connect is ready.</span>`;
  const btn = document.createElement("button");
  btn.className = "btn btn-on-dark";
  btn.style.minHeight = "32px";
  btn.style.padding = "0.3rem 0.8rem";
  btn.textContent = "Refresh";
  btn.addEventListener("click", () => { btn.disabled = true; btn.textContent = "Updating…"; onRefresh(); });
  b.appendChild(btn);
  stack().appendChild(b);
}

/* ---------- tiny helpers ---------- */
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formatDate(iso, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  const opts = { day: "numeric", month: "short", year: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("en-IN", opts);
}
