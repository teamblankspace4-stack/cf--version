/* =========================================================
   cert-crypto.js — certificate payloads and signature checks.
   PUBLIC side only: the verify page imports this file and never
   loads the private key.

   Certificates are signed with ECDSA P-256. The QR code carries
   the certificate details AND the signature, so anyone can check
   a certificate on their own phone, offline, using only the
   Training Division's public key below. No database, no login.

   The payload travels in the URL #fragment, which browsers never
   send to a server, so certificate details don't reach any logs.
   Link format: verify.html#p=<payload>&s=<signature>
   ========================================================= */

export const ISSUER = "Training Division, India Meteorological Department";

/** Public key of the issuer. Safe to publish. */
export const ISSUER_PUBLIC_JWK = {"kty": "EC", "x": "TTGMBGf179q0wTQKAbZK51iM8Fo-MuWPdGhcqBTP1GM", "y": "RRtB6WKPWCT8EIqk_yozUvP1_ByxS4q3gR47MsXRlC4", "crv": "P-256"};

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes) {
  let s = "";
  new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/**
 * Canonical payload from certificate fields. Fixed key order and short
 * keys keep the QR code small and make the signed bytes deterministic.
 * fields: { certNo, empId, name, code, title, score, competency, issued }
 */
export function payloadFromFields(f) {
  return JSON.stringify({
    v: 1, n: f.certNo, e: f.empId, o: f.name, m: f.code, t: f.title,
    s: f.score, c: f.competency ?? null, i: String(f.issued || "").slice(0, 10)
  });
}

export function fieldsFromPayload(json) {
  const p = JSON.parse(json);
  return { certNo: p.n, empId: p.e, name: p.o, code: p.m, title: p.t, score: p.s, competency: p.c, issued: p.i };
}

/** Encode edited fields back into a link token (used by the tamper demo). */
export function reencode(fields) {
  return b64url(enc.encode(payloadFromFields(fields)));
}

/** "#p=…&s=…" → { p, s } (either may be null) */
export function tokenFromHash(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  return { p: params.get("p"), s: params.get("s") };
}

export function buildVerifyUrl(payloadJson, signature, base = location.href) {
  const url = new URL("verify.html", base);
  url.hash = `p=${b64url(enc.encode(payloadJson))}&s=${signature}`;
  return url.href;
}

let publicKeyPromise = null;
function publicKey() {
  publicKeyPromise ||= crypto.subtle.importKey("jwk", ISSUER_PUBLIC_JWK, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return publicKeyPromise;
}

export async function verifySignature(payloadJson, signatureB64) {
  try {
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await publicKey(),
      fromB64url(signatureB64), enc.encode(payloadJson));
  } catch {
    return false;
  }
}

/** Checks a link token. Returns { valid, fields, reason }. */
export async function verifyToken(p, s) {
  let payloadJson;
  let fields = null;
  try {
    payloadJson = dec.decode(fromB64url(p));
    fields = fieldsFromPayload(payloadJson);
  } catch {
    return { valid: false, fields: null, reason: "The link is damaged or incomplete, so the certificate can't be read." };
  }
  if (!crypto.subtle) {
    return { valid: false, fields, reason: "This browser can't check signatures here. Open the link over https." };
  }
  const ok = await verifySignature(payloadJson, s);
  return ok
    ? { valid: true, fields, reason: null }
    : { valid: false, fields, reason: "The signature doesn't match these details. The certificate has been altered, or wasn't issued by the Training Division." };
}
