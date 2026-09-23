import { ready } from "../app.js";
import { getStationTree } from "../store.js";
import { escapeHtml } from "../ui.js";
import { requestAccount } from "../services/accounts.js";

const $ = id => document.getElementById(id);
await ready;

const opts = [`<option value="">Choose your station</option>`];
const walk = (nodes, depth) => nodes.forEach(n => {
  opts.push(`<option value="${n.id}">${"&nbsp;".repeat(depth * 3)}${escapeHtml(n.name)}</option>`);
  walk(n.children, depth + 1);
});
walk(await getStationTree(), 0);
$("su-station").innerHTML = opts.join("");

$("su-pw-toggle").addEventListener("click", () => {
  const pw = $("su-pw"); const show = pw.type === "password";
  pw.type = show ? "text" : "password"; $("su-pw-toggle").textContent = show ? "Hide" : "Show";
});

$("signup-form").addEventListener("submit", async e => {
  e.preventDefault();
  $("su-error").textContent = "";
  const btn = $("su-submit"); btn.disabled = true;
  try {
    const u = await requestAccount({
      name: $("su-name").value, empId: $("su-emp").value, email: $("su-email").value, designation: $("su-desig").value,
      stationId: $("su-station").value, role: $("su-role").value, password: $("su-pw").value, reason: $("su-reason").value
    });
    $("signup-step").hidden = true;
    $("signup-done").hidden = false;
    $("done-text").textContent = `Your request for ${u.empId} is with the Training Division. You'll be able to sign in with your employee ID and password once it's approved.`
      + (navigator.onLine ? "" : " You're offline: the request is saved on this device and will send when you reconnect.");
  } catch (err) {
    $("su-error").textContent = err.message;
  } finally { btn.disabled = false; }
});
