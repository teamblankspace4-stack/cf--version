/* =========================================================
   services/certificates.js — signing and loading certificates.

   PROTOTYPE KEY: the private key below is a demo key so the
   prototype can sign in the browser without a server. In
   production it lives only on the server (ideally in an HSM)
   and the browser never sees it. The public key and the verify
   page stay exactly the same.
   ========================================================= */

import { read, commit } from "../store.js";
import { ISSUER, payloadFromFields, buildVerifyUrl, b64url, verifySignature } from "../cert-crypto.js";

export { ISSUER };
// Re-exported for callers that expect them here; the verify page imports cert-crypto.js directly.
export { verifyToken, tokenFromHash, reencode } from "../cert-crypto.js";

const DEMO_PRIVATE_JWK = {"kty": "EC", "x": "TTGMBGf179q0wTQKAbZK51iM8Fo-MuWPdGhcqBTP1GM", "y": "RRtB6WKPWCT8EIqk_yozUvP1_ByxS4q3gR47MsXRlC4", "crv": "P-256", "d": "t86yS5w2IYDVxh7x9GA9fb-KzvADvqqoJYQN10AXdT4"};

let signingKey = null;
function privateKey() {
  signingKey ||= crypto.subtle.importKey("jwk", DEMO_PRIVATE_JWK, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return signingKey;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function sign(payloadJson) {
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await privateKey(), new TextEncoder().encode(payloadJson));
  return b64url(sig);
}

/**
 * Everything the certificate page needs. Signs on first view if the
 * certificate predates signing, and re-signs if the stored payload no
 * longer matches the record.
 */
export async function getCertificateView(viewer, certId) {
  const cert = await read.one("certificates", certId);
  assert(cert, "Certificate not found.");
  assert(cert.userId === viewer.id || ["trainer", "admin"].includes(viewer.role), "You can only view your own certificates.");

  const [officer, module] = await Promise.all([read.one("users", cert.userId), read.one("modules", cert.moduleId)]);
  const station = officer ? await read.one("stations", officer.stationId) : null;

  const fields = {
    certNo: cert.certNo, empId: officer.empId, name: officer.name,
    code: module.code, title: module.title,
    score: cert.score, competency: cert.competencyScore ?? null,
    issued: String(cert.issuedAt).slice(0, 10)
  };
  const payloadJson = payloadFromFields(fields);

  let signature = cert.signature;
  if (!signature || cert.signedPayload !== payloadJson || !(await verifySignature(payloadJson, signature))) {
    signature = await sign(payloadJson);
    await commit({
      op: "sign-certificate", store: "certificates",
      record: { id: cert.id, signedPayload: payloadJson, signature },
      actorId: viewer.id, auditAction: "signed-certificate", auditDetails: { certNo: cert.certNo }
    });
  }

  return { cert, officer, module, station, fields, signature, verifyUrl: buildVerifyUrl(payloadJson, signature) };
}
