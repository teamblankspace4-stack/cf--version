/* =========================================================
   sw.js — Capacity Connect service worker

   HOW TO SHIP AN UPDATE TO THE SAME LINK:
   1. Bump VERSION below (e.g. "0.1.0" → "0.2.0").
   2. Add any NEW file to the SHELL list.
   3. Push to GitHub. Anyone with the app open gets an
      "Update available" banner; one tap loads the new version.
   ========================================================= */

const VERSION = "0.9.4";
const SHELL_CACHE = `cc-shell-${VERSION}`;
const MEDIA_CACHE = "cc-media";          // module downloads survive app updates

/* Every file the app needs to run offline. Paths are relative
   so the app works under /capacity-connect/ on GitHub Pages. */
const SHELL = [
  "assets/fonts/inter-latin-400-normal.woff2",
  "assets/fonts/inter-latin-500-normal.woff2",
  "assets/fonts/inter-latin-600-normal.woff2",
  "assets/fonts/inter-latin-700-normal.woff2",
  "assets/fonts/source-serif-4-latin-500-normal.woff2",
  "assets/fonts/source-serif-4-latin-600-normal.woff2",
  "assets/fonts/source-serif-4-latin-700-normal.woff2",
  "assets/icons/mark.svg",
  "./",
  "index.html",
  "login.html",
  "admin.html",
  "coverage.html",
  "capsule.html",
  "trainee.html",
  "trainer.html",
  "module.html",
  "certificate.html",
  "verify.html",
  "status.html",
  "offline.html",
  "manifest.json",
  "css/theme.css",
  "css/landing.css",
  "css/login.css",
  "css/admin.css",
  "css/coverage.css",
  "css/capsule.css",
  "css/certificate.css",
  "css/verify.css",
  "css/dashboard.css",
  "css/status.css",
  "css/module.css",
  "css/trainer.css",
  "js/app.js",
  "js/early.js",
  "js/db.js",
  "js/store.js",
  "js/seed.js",
  "js/auth.js",
  "js/sync.js",
  "js/pwa.js",
  "js/ui.js",
  "js/shell.js",
  "js/services/training.js",
  "js/services/learning.js",
  "js/services/mentoring.js",
  "js/services/coverage.js",
  "js/services/capsule.js",
  "js/services/certificates.js",
  "js/vendor/qrcode.mjs",
  "js/search.js",
  "js/pages/landing.js",
  "js/pages/login.js",
  "js/pages/admin.js",
  "js/pages/coverage.js",
  "js/pages/capsule.js",
  "js/pages/certificate.js",
  "js/pages/verify.js",
  "js/pages/trainee.js",
  "js/pages/trainer.js",
  "js/pages/status.js",
  "js/pages/module.js",
  "content/index.json",
  "content/rad-101.json",
  "content/aws-201.json",
  "content/sat-101.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-64.png",
  "js/cert-crypto.js",
  "signup.html",
  "profile.html",
  "courses.html",
  "questionnaires.html",
  "library.html",
  "users.html",
  "reports.html",
  "announcements.html",
  "competency.html",
  "apar.html",
  "css/portal.css",
  "css/apar.css",
  "js/services/accounts.js",
  "js/services/profile.js",
  "js/services/questionnaires.js",
  "js/services/library.js",
  "js/services/feedback.js",
  "js/services/announcements.js",
  "js/services/reports.js",
  "js/pages/signup.js",
  "js/pages/profile.js",
  "js/pages/courses.js",
  "js/pages/questionnaires.js",
  "js/pages/library.js",
  "js/pages/users.js",
  "js/pages/reports.js",
  "js/pages/announcements.js",
  "js/pages/competency.js",
  "js/pages/apar.js",
  "assets/library/aws-201-calibration-record-sheet.pdf",
  "assets/library/rad-101-lecture-slides.pdf",
  "assets/library/rad-101-shift-checklist.pdf",
  "assets/library/sat-101-channel-guide.pdf"
];

/* On localhost we use network-first so your edits show up
   immediately while coding; offline still falls back to cache.
   On the real link we use cache-first for speed on slow networks. */
const IS_DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL.map(async url => {
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (!response.ok) throw new Error(`Could not cache ${url}: ${response.status}`);
      await cache.put(url, await unredirect(response));
    }));
  })());
  // No skipWaiting() here: the page asks the user first (see js/pwa.js).
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith("cc-shell-") && k !== SHELL_CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  const msg = event.data || {};
  if (msg.type === "SKIP_WAITING") self.skipWaiting();
  if (msg.type === "GET_VERSION" && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION, shellCache: SHELL_CACHE, files: SHELL.length, dev: IS_DEV });
  }
});

function isCacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

/* Some hosts redirect /page.html to /page. A response that arrived through a
   redirect cannot be replayed for a navigation (Chrome rejects it) and should
   not be stored, so we copy it into a plain response first. */
async function unredirect(response) {
  if (!response || !response.redirected) return response;
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await unredirect(await fetch(request));
  if (isCacheable(response)) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await unredirect(await fetch(request));
    if (isCacheable(response)) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

/* Lesson videos: served from the download cache when the officer has
   downloaded the module, with byte-range support so seeking and
   "jump to the exact moment" work offline. Never auto-cached. */
async function mediaResponse(request) {
  const cached = await caches.match(request.url, { cacheName: MEDIA_CACHE });
  if (!cached) return fetch(request);
  const range = request.headers.get("range");
  if (!range) return cached;
  const buf = await cached.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = 0;
  let end = size - 1;
  if (m) {
    if (m[1] === "" && m[2] !== "") { start = Math.max(0, size - Number(m[2])); }
    else { start = Number(m[1] || 0); if (m[2]) end = Math.min(Number(m[2]), size - 1); }
  }
  if (start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const chunk = buf.slice(start, end + 1);
  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": cached.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(chunk.byteLength),
      "Accept-Ranges": "bytes"
    }
  });
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch other sites

  if (url.pathname.includes("/assets/media/")) {
    event.respondWith(mediaResponse(request).catch(() => new Response("", { status: 504, statusText: "Offline and not downloaded" })));
    return;
  }

  const strategy = IS_DEV ? networkFirst : cacheFirst;

  if (request.mode === "navigate") {
    event.respondWith(
      strategy(request).catch(async () =>
        (await caches.match("offline.html")) || new Response("Offline", { status: 503 }))
    );
    return;
  }

  event.respondWith(
    strategy(request).catch(() => new Response("", { status: 504, statusText: "Offline and not cached" }))
  );
});
