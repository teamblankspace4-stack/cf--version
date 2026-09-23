import { ready } from "../app.js";
import { requireRole } from "../auth.js";
import { renderShell } from "../shell.js";
import { toast, escapeHtml, formatDate } from "../ui.js";
import { getCertificateView, ISSUER } from "../services/certificates.js";
import qrcode from "../vendor/qrcode.mjs";

await ready;
const user = await requireRole(["trainee", "trainer", "admin"]);
await renderShell(user, { trainee: "training", trainer: "batches", admin: "nominations" }[user.role]);

const view = document.getElementById("view");
const id = new URLSearchParams(location.search).get("id");

function qrSvg(text) {
  // Level L keeps modules large enough to scan from a small printout;
  // the signature, not error correction, is what protects the data.
  const q = qrcode(0, "L");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: "QR code to verify this certificate" });
}

try {
  if (!id) throw new Error("No certificate selected.");
  const c = await getCertificateView(user, id);
  const f = c.fields;
  document.title = `${f.certNo} · Capacity Connect`;
  const back = { trainee: "trainee.html", trainer: "trainer.html", admin: "admin.html" }[user.role];

  view.innerHTML = `
    <div class="cert-actions no-print">
      <a class="btn btn-secondary" href="${back}">Back</a>
      <button class="btn btn-primary" type="button" id="print-btn">Print or save as PDF</button>
      <button class="btn btn-secondary" type="button" id="copy-btn">Copy verification link</button>
      <a class="btn btn-secondary" href="${c.verifyUrl}" target="_blank" rel="noopener">Open verification page</a>
    </div>

    <article class="cert-sheet" aria-label="Certificate ${escapeHtml(f.certNo)}">
      <header class="cert-band">
        <div class="cert-brand">
          <img src="assets/icons/mark.svg" alt="">
          <div><b>Capacity Connect</b><span>INDIA METEOROLOGICAL DEPARTMENT</span></div>
        </div>
        <div class="cert-no">Certificate number<b>${escapeHtml(f.certNo)}</b></div>
      </header>

      <div class="cert-body">
        <div>
          <p class="cert-kicker">Certificate of competency</p>
          <h2 class="cert-title">Training completed and assessed</h2>
          <p class="cert-small">This certifies that</p>
          <p class="cert-name">${escapeHtml(f.name)}</p>
          <p class="cert-who">${escapeHtml(c.officer?.designation || "")}, ${escapeHtml(c.station?.name || "")}. Employee ID ${escapeHtml(f.empId)}.</p>
          <p class="cert-small">has completed and been assessed in</p>
          <p class="cert-module"><span>${escapeHtml(f.code)}</span>${escapeHtml(f.title)}</p>
          <dl class="cert-facts">
            <div><dt>Overall score</dt><dd>${f.score}%</dd></div>
            <div><dt>Practical competency</dt><dd>${f.competency != null ? `${f.competency}%` : "Not assessed"}</dd></div>
            <div><dt>Issued</dt><dd>${formatDate(c.cert.issuedAt)}</dd></div>
          </dl>
        </div>
        <div class="cert-qr">
          <div class="qr">${qrSvg(c.verifyUrl)}</div>
          <b>Scan to verify</b>
          <span>Checks the digital signature. Works on any phone, even offline.</span>
        </div>
      </div>

      <footer class="cert-foot">
        <div class="cert-sign"><b>${escapeHtml(ISSUER)}</b>Issued through Capacity Connect and recorded in the tamper-evident audit trail.</div>
        <span class="cert-seal"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.2l3 3L12.5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Digitally signed</span>
      </footer>
    </article>
    <p class="proto-note no-print">Prototype: the signing key runs in the browser so this demo works without a server. In production it lives on the server and only the public key ships with the app.</p>`;

  document.getElementById("print-btn").addEventListener("click", () => window.print());
  document.getElementById("copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(c.verifyUrl);
      toast("Verification link copied.", "ok");
    } catch {
      prompt("Copy this verification link:", c.verifyUrl);
    }
  });
} catch (err) {
  view.innerHTML = `<div class="panel"><div class="empty"><p>${escapeHtml(err.message)}</p><a class="btn btn-primary" href="index.html">Go home</a></div></div>`;
}
