import { ready } from "../app.js";
import { login, demoLogin, currentUser, HOME_BY_ROLE } from "../auth.js";
import { read } from "../store.js";
import { escapeHtml } from "../ui.js";

const $ = id => document.getElementById(id);

const ROLES = {
  trainee: {
    label: "Trainee",
    sub: "Pick up your assigned modules right where you left off — online or off.",
    demos: [{ role: "trainee" }]
  },
  trainer: {
    label: "Trainer / Mentor",
    sub: "Review practical work, answer questions and see where your batch is getting stuck.",
    demos: [{ role: "trainer" }]
  },
  admin: {
    label: "Administrator",
    sub: "Nominate officers, approve batches and close skill gaps before they become incidents.",
    demos: [{ role: "admin", scope: "station", title: "Station head" }, { role: "admin", scope: "division", title: "Training Division" }]
  }
};
const SIDE_DEFAULT = { title: "Every officer's training, in one record.", sub: "Sign in with your role to pick up training exactly where you left it — online or off." };

let chosen = null;
let users = [];
let stations = new Map();
// Demo accounts come from local data; a fast tap on a role waits for it.
const dataReady = (async () => {
  await ready;
  users = await read.all("users");
  stations = new Map((await read.all("stations")).map(s => [s.id, s.name]));
})();

function show(step) {
  const role = $("step-role");
  const form = $("step-form");
  role.hidden = step !== "role";
  form.hidden = step !== "form";
  (step === "role" ? role : form).classList.remove("js-step");
  void (step === "role" ? role : form).offsetWidth;
  (step === "role" ? role : form).classList.add("js-step");
}

function demoAccounts(roleKey) {
  return ROLES[roleKey].demos.map(d => {
    const u = users.find(x => x.demo && x.role === d.role && (!d.scope || x.adminScope === d.scope));
    return u ? { ...d, user: u } : null;
  }).filter(Boolean);
}

async function chooseRole(roleKey) {
  chosen = roleKey;
  const r = ROLES[roleKey];
  $("role-chip").textContent = r.label;
  $("side-sub").textContent = r.sub;
  $("login-error").textContent = "";
  $("emp-id").value = "";
  $("password").value = "";

  show("form");
  $("demo-accounts").innerHTML = `<p class="muted small">Loading demo accounts…</p>`;
  await dataReady;
  if (chosen !== roleKey) return;
  const accts = demoAccounts(roleKey);
  $("demo-accounts").innerHTML = accts.map((a, i) => `
    <div class="demo-acct">
      <span class="who">
        <b>${escapeHtml(a.title || r.label)}: ${escapeHtml(a.user.name)}</b>
        <span>${escapeHtml(stations.get(a.user.stationId) || "")} · Employee ID <code>${escapeHtml(a.user.empId)}</code></span>
      </span>
      <span class="acts">
        <button class="link-btn" type="button" data-fill="${i}">Fill sample credentials</button>
        <button class="btn btn-secondary btn-sm" type="button" data-go="${i}">Open instantly</button>
      </span>
    </div>`).join("");
  $("demo-accounts").querySelectorAll("[data-fill]").forEach(b => b.addEventListener("click", () => {
    const a = accts[Number(b.dataset.fill)];
    $("emp-id").value = a.user.empId;
    $("password").value = "demo@123";
    $("login-submit").focus();
  }));
  $("demo-accounts").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", async () => {
    const a = accts[Number(b.dataset.go)];
    b.disabled = true;
    const res = await demoLogin(a.role, a.scope);
    if (res.ok) location.href = HOME_BY_ROLE[res.user.role];
    else { $("login-error").textContent = res.error; b.disabled = false; }
  }));

  if (location.hash === "#demo") $("demo").classList.add("is-highlighted");
  $("emp-id").focus();
}

document.querySelectorAll(".role-card").forEach(c => c.addEventListener("click", () => chooseRole(c.dataset.role)));
$("change-role").addEventListener("click", () => {
  chosen = null;
  $("side-sub").textContent = SIDE_DEFAULT.sub;
  show("role");
});

$("pw-toggle").addEventListener("click", () => {
  const pw = $("password");
  const showing = pw.type === "text";
  pw.type = showing ? "password" : "text";
  $("pw-toggle").textContent = showing ? "Show" : "Hide";
  $("pw-toggle").setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("login-submit");
  $("login-error").textContent = "";
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const res = await login($("emp-id").value, $("password").value);
    // Permissions always come from the account, never from the role picker.
    if (res.ok) return location.href = HOME_BY_ROLE[res.user.role];
    $("login-error").textContent = res.error;
  } catch (err) {
    $("login-error").textContent = err.message;
  }
  btn.disabled = false;
  btn.textContent = "Sign in";
});

await dataReady;

const me = await currentUser();
if (me) {
  const note = $("signed-in-note");
  note.innerHTML = `You're signed in as <b>${escapeHtml(me.name)}</b>. <a href="${HOME_BY_ROLE[me.role]}">Continue to your dashboard</a>`;
  note.hidden = false;
}
