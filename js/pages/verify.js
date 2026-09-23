import { registerServiceWorker } from "../pwa.js";
import { verifyToken, tokenFromHash, reencode } from "../cert-crypto.js";
import { escapeHtml, formatDate } from "../ui.js";

// Public page: no login, no demo data. Only the service worker, so it works offline.
registerServiceWorker();

const result = document.getElementById("result");
const ICON_OK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_BAD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

function details(f) {
  return `
    <dl class="v-details">
      <div class="wide"><dt>Officer</dt><dd>${escapeHtml(f.name)} (${escapeHtml(f.empId)})</dd></div>
      <div class="wide"><dt>Module</dt><dd>${escapeHtml(f.code)}: ${escapeHtml(f.title)}</dd></div>
      <div><dt>Certificate number</dt><dd>${escapeHtml(f.certNo)}</dd></div>
      <div><dt>Issued</dt><dd>${escapeHtml(f.issued ? formatDate(f.issued) : "")}</dd></div>
      <div><dt>Overall score</dt><dd>${f.score}%</dd></div>
      <div><dt>Practical competency</dt><dd>${f.competency != null ? `${f.competency}%` : "Not assessed"}</dd></div>
    </dl>`;
}

async function check(hash) {
  const { p, s } = tokenFromHash(hash);
  if (!p || !s) {
    result.innerHTML = `
      <section class="verify-card">
        <div class="verdict"><div><h2>Scan a certificate to begin</h2>
        <p>Every Capacity Connect certificate has a QR code. Scanning it opens this page with the certificate's details and signature.</p></div></div>
      </section>`;
    return;
  }
  const r = await verifyToken(p, s);
  if (r.valid) {
    result.innerHTML = `
      <section class="verify-card is-valid">
        <div class="verdict">
          <span class="verdict-icon">${ICON_OK}</span>
          <div><h2>Genuine certificate</h2><p>Signed by the Training Division, India Meteorological Department. Nothing has been changed since it was issued.</p></div>
        </div>
        ${details(r.fields)}
        <p class="v-note">Checked on this device with the department's public key. No data was sent anywhere.</p>
        <div class="tamper">
          <p><b>Demo:</b> see what happens if someone edits the certificate, for example raising the score to 100%.</p>
          <button class="btn btn-secondary" type="button" id="tamper-btn">Tamper with it</button>
        </div>
      </section>`;
    document.getElementById("tamper-btn").addEventListener("click", () => {
      const forged = { ...r.fields, score: 100 };
      location.hash = `p=${reencode(forged)}&s=${s}`;
    });
  } else {
    result.innerHTML = `
      <section class="verify-card is-invalid">
        <div class="verdict">
          <span class="verdict-icon">${ICON_BAD}</span>
          <div><h2>Not a valid certificate</h2><p>${escapeHtml(r.reason)}</p></div>
        </div>
        ${r.fields ? details(r.fields) : ""}
        <p class="v-note">Ask the officer for the original certificate, or contact the Training Division.</p>
      </section>`;
  }
}

document.getElementById("paste-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = document.getElementById("paste-input").value.trim();
  const i = v.indexOf("#");
  if (i === -1) {
    result.innerHTML = `<section class="verify-card is-invalid"><div class="verdict"><span class="verdict-icon">${ICON_BAD}</span><div><h2>That isn't a verification link</h2><p>It should contain "#p=" and "&amp;s=". Scan the QR code instead if you can.</p></div></div></section>`;
    return;
  }
  location.hash = v.slice(i + 1);
});

addEventListener("hashchange", () => check(location.hash));
check(location.hash);
