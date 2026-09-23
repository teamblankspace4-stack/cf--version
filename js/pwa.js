/* =========================================================
   pwa.js — service worker registration, update flow, install.
   ========================================================= */

import { showUpdateBanner } from "./ui.js";

let deferredInstall = null;
const installListeners = new Set();

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);

  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;

  // After the user taps "Refresh", the new worker takes over → reload once.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;   // first install: no reload needed
    refreshing = true;
    location.reload();
  });

  return navigator.serviceWorker.register("./sw.js").then(reg => {
    const offerUpdate = worker => showUpdateBanner(() => worker.postMessage({ type: "SKIP_WAITING" }));

    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });

    // Check for a new version when the app comes back into view, and every 30 min.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);

    return reg;
  }).catch(err => {
    console.warn("Service worker registration failed:", err);
    return null;
  });
}

/** Asks the active service worker for its version info. */
export function getSWInfo() {
  return new Promise(resolve => {
    const ctrl = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!ctrl) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = e => { clearTimeout(timer); resolve(e.data); };
    ctrl.postMessage({ type: "GET_VERSION" }, [channel.port2]);
  });
}

/* ---------- install prompt (Chrome / Edge / Android) ---------- */
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstall = e;
  installListeners.forEach(fn => fn(true));
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  installListeners.forEach(fn => fn(false));
});

export function onInstallAvailable(fn) {
  installListeners.add(fn);
  fn(!!deferredInstall);
}

export async function promptInstall() {
  if (!deferredInstall) return "unavailable";
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  installListeners.forEach(fn => fn(false));
  return outcome;
}

export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}
