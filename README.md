# Capacity Connect

Training and skills portal for India Meteorological Department officers.
SIH 2026 · PS SIH26075 · Team Blankspace.

An offline-first Progressive Web App (PWA) built with plain HTML, CSS and JavaScript. It installs on phones and PCs and keeps working at remote stations with no network.

## Problem statement coverage

| PS requirement | Where |
|---|---|
| Secure signup and login, three roles | `signup.html` (request, then Training Division approval), `login.html` |
| Trainee profile: qualifications, experience, interests, skills, certificates | `profile.html` |
| Enrol in courses | `courses.html` (request enrolment) and nominations in `admin.html` |
| Access learning resources | `module.html`, `library.html` |
| Subject-wise MCQ assessments | Module quizzes, and trainer questionnaires in `questionnaires.html` |
| Feedback on courses and content | Feedback panel on every module; summaries in `reports.html` |
| Trainer profile | `profile.html` |
| Questionnaires with deadlines | `questionnaires.html` (trainer creates for a batch; one attempt; closes at the deadline) |
| Monitor participation and performance | `trainer.html` roster, questionnaire results |
| Trainer library: lectures, presentations, materials | `library.html` (upload; trainees open and download, offline too) |
| Admin user approval and role management | `users.html` |
| Admin dashboards: courses, enrolments, certifications, assessments, participation | `reports.html` |
| Publish notifications, announcements, achievements, new content on the homepage | `announcements.html`; landing "What's new"; notification bell |
| Competency mapping to identify suitable trainers | `competency.html`; batch approval suggests trainers by competency |
| Scalable, secure, user-friendly, accessible across devices | PWA, offline-first, CSP, Lighthouse 100 accessibility, responsive |
| APAR-ready records | `apar.html` (training report, print to PDF) |

## Judging day

Read **`DEMO_SCRIPT.md`**: the pre-demo checklist, a timed 3-minute demo, the requirement-to-feature map, measured results and prepared answers.

## Quality checks (measured before submission)

- Lighthouse, mobile profile: Performance 100, Accessibility 100, SEO 100 on landing, sign-in, verify and System check.
- axe-core WCAG 2.1 AA: 0 violations across 18 page states, including every dashboard and dialog.
- Slow 3G (400 kbps): about 200 KB and 5.4 s on the first visit; 0 KB on every visit after that.
- A Content Security Policy is set on every page: only the app's own scripts can run. Don't add inline `<script>` blocks or `onclick=` attributes; put code in `js/` files.

## Run it locally

Service workers do **not** run when you double-click an HTML file (`file://`). Always use a local server:

```bash
cd capacity-connect
python -m http.server 8000
```

Then open http://localhost:8000.

On `localhost` the app uses **network-first** caching, so your edits show up on a normal reload. On the real link it uses **cache-first**, which is faster on slow networks.

## Deploy to GitHub Pages (the submission link)

1. Create a GitHub **organization** for the team (e.g. `blankspace-sih`), so the link doesn't depend on one person's account.
2. Create a public repo `capacity-connect` and push the contents of this folder to `main`.
3. Open **Settings → Pages**, set Source to `main` / root, and save.
4. The link is `https://<org>.github.io/capacity-connect/`, and it never changes.

## Ship an update to the same link

1. In `sw.js`, bump `VERSION` (e.g. `0.1.0` → `0.2.0`).
2. Add every **new** file you created to the `SHELL` list in `sw.js`. If you forget, that file won't work offline.
3. Commit and push. Anyone with the app open sees an "Update available" banner with a Refresh button.

## Test offline before every demo

Open `status.html` (System check) and follow the five steps on that page. Use **Reset demo data** before presenting.

## Project rules (read before adding a page)

- **Pages never touch IndexedDB.** Pages import from `js/services/*.js` (business rules and permission checks) or `js/store.js`. This is what lets us add the backend later without rewriting pages.
- **Every write goes through `commit()`** in `store.js`. It stamps the record, queues the sync operation and appends to the audit trail.
- **One page = its own files:** `page.html`, `css/page.css`, `js/pages/page.js`. Shared styles live only in `css/theme.css`.
- **No CDN links.** Every library must be downloaded into the repo, or it breaks offline mode.
- **Every page starts with:**
  ```html
  <script type="module">import { ready } from "./js/app.js"; await ready;</script>
  ```
  or a page script that imports `ready`. Protected pages also call `requireRole([...])` from `js/auth.js`.

## Design system

- **Type:** Inter for text, Source Serif for headings and large numbers. Both are stored in `assets/fonts/`, so they work offline.
- **Colour:** paper `#F4F7FA` background, white cards with thin borders, navy `#0F2A4A` for emphasis blocks and the sidebar, teal `#1B8A84` for actions.
- **Signed-in layout:** `renderShell(user, key)` in `js/shell.js` builds the sidebar and top bar for every page. Add a page to the sidebar by editing `NAV` there.
- **Reusable pieces in `theme.css`:** `.summary` (stat cards), `.spotlight` (navy highlight card), `.panel`, `.pill`, `.btn-primary`, `.btn-navy`, `.btn-secondary`, tables and dialogs.
- **Logo:** `assets/icons/mark.svg`. The PWA icons are rendered from it.

## Structure

```
index.html          Landing page
login.html          Sign in + one-click demo roles
admin.html          Station head: nominate. Training Division: approve into batches
coverage.html       Skill coverage: hierarchy filter, single-point-of-failure alerts
capsule.html        Succession capsules: station knowledge and handovers
signup.html         Request an account (approved by the Training Division)
profile.html        Professional profile: qualifications, experience, skills, certificates
courses.html        Course catalogue and enrolment requests
questionnaires.html Trainer questionnaires with deadlines; trainee attempts
library.html        Trainer library: upload, open and download materials
users.html          Account approval and role management
reports.html        Admin dashboards and APAR report access
announcements.html  Publish to the homepage and notifications
competency.html     Trainer competency map
apar.html           APAR training report (print or save as PDF)
certificate.html    Printable certificate with a signed QR code
verify.html         Public certificate check: no login, works offline
trainee.html        Trainee dashboard: progress, next step, offline status
module.html         Module player: video, reading, quiz, practical, notes, discussion
trainer.html        Mentor dashboard: reviews, questions, confusion map, rosters
status.html         System check / offline demo control panel
offline.html        Shown for pages not yet saved offline
manifest.json       Makes the app installable
sw.js               Service worker: caching, offline, updates
css/theme.css       Design system: Inter + Source Serif, light surfaces, navy and teal
js/app.js           Bootstrap every page imports
js/db.js            IndexedDB wrapper (only store.js uses it)
js/store.js         Data layer: UUIDs, versioning, outbox, audit chain
js/seed.js          Demo officers, stations, modules
js/auth.js          Login, session, role guard, demo login
js/sync.js          Outbox sync (simulated server for now)
js/pwa.js           SW registration, update banner, install prompt
js/ui.js            Toasts, banners, helpers
js/shell.js         Signed-in layout: navy sidebar, top bar with live sync status
js/services/        Business rules: training.js = nominations, batches, enrollments;
                    learning.js = unlock rules, progress, quiz, practical, notes,
                    discussion, anonymous confusion flags, offline downloads;
                    mentoring.js = rubric reviews, competency scores, certificates;
                    coverage.js = skill coverage, SPOF alerts, backup assignment;
                    capsule.js = capsule entries, freshness, handovers;
                    certificates.js = ECDSA-signed certificate payloads and verification
js/vendor/          qrcode.mjs (qrcode-generator 2.0.4, MIT, Kazuhiko Arase)
js/search.js        "Find in this lesson": offline topic search with timestamps
js/cert-crypto.js   Public key + signature check (the only crypto the verify page loads)
content/            Lesson content JSON (transcripts, quizzes, practicals)
assets/media/       Lesson videos (downloaded per module, not precached)
tools/              Content build tool: see tools/README.md
js/pages/           One script per page
```

## Demo accounts

All use password `demo@123`.

| Role | Employee ID | Name |
|---|---|---|
| Trainee | T-4001 | Aditya Joshi, Ratnagiri Observatory |
| Trainer / Mentor | M-3001 | Dr. Anil Deshpande, Radar Division |
| Station head (nominates) | A-2001 | Rajesh Patil, RMC Mumbai |
| Training Division (approves) | A-1001 | Dr. Meera Iyer |

Waiting for approval in **Users & roles** (password `demo@123` once approved): Kiran Patwardhan `T-4101` (trainee), Dr. Sunita Rao `M-3101` (trainer).

## Demo story (Part 2)

1. **Try the demo → Station head.** Pick a module, tick officers, give a reason, and nominate. Turn Wi-Fi off and nominate again; it still works.
2. **View as Training Division.** The nominations are in the queue. Select them, approve into a new batch, and the matching trainer is suggested.
3. **View as Trainee.** The new course appears on the dashboard.
4. **View as Station head.** Each nomination shows its outcome, or the rejection reason.

## Demo story (Part 3, trainee)

1. **Try the demo → Trainee.** AWS-201 is half done and RAD-101 is new.
2. **Open RAD-101.** Units 2 to 4 are locked. Drag the video to the end: "Watched 1%". Skipping doesn't count.
3. **Find in this lesson:** type "why do winds fold" and it jumps to 2:22, the exact aliasing sentence.
4. **I'm confused at this point:** flags anonymously. Show the mentor discussion tab and the timestamped notes.
5. **Open AWS-201 → Download for offline (0.7 MB).** Turn Wi-Fi off, reload, and the video plays and seeks with no network.
6. **Quiz:** a wrong answer shows the explanation and blocks progress until the 70% pass mark.

## Demo story (Part 4, mentor)

1. **View as Trainer / Mentor.** The dashboard shows practicals to review, unanswered questions and where officers get stuck.
2. **Where officers get stuck:** the aliasing chapter at 2:10 is flagged by 5 officers. Chapters with fewer than 3 flags show "below threshold" and no count, so nobody can be identified.
3. **Post a clarification:** it lands beside the lesson at 2:10 for the whole batch.
4. **Review and score:** the rubric has four criteria. Marking one "Not yet" blocks approval and forces a return for rework, with feedback the officer sees.
5. **After the officer resubmits, approve.** The competency score is calculated, the certificate is issued, and the roster shows progress, quiz, competency and certificate number per officer.

## Demo story (Part 5, skill coverage)

1. **View as Training Division → Skill coverage.** Every station is checked against the skills it actually operates: a radar station needs radar-certified officers, an aerodrome office needs aviation.
2. **Filter by RMC, MC or observatory.** A station head sees only their own branch, and the filter is locked to it.
3. **Alerts:** "No cover" means nobody at the station holds a skill it operates. "Single point of failure" means exactly one officer does, and a transfer date is shown when the only holder is leaving.
4. **Assign backup training:** pick an officer (station first, then the parent station) and a module. The Training Division enrols them straight into a batch; a station head raises a nomination instead.
5. Stations with no officers on record are skipped and counted separately, because that's missing data, not a skill gap.

## Demo story (Part 6, certificates)

1. **Trainee → Certificates → View and verify.** A printable certificate with a QR code. "Print or save as PDF" produces a one-page A4 landscape sheet, with the QR fixed at 50 mm so it scans reliably from paper.
2. **Scan the QR with any phone camera** (from the deployed link). It opens `verify.html` and shows **Genuine certificate**. The phone needs no login, no server and no network: the QR holds the certificate details plus an ECDSA P-256 signature, checked against the Training Division's public key on the device.
3. **Press "Tamper with it"** on the verify page: the score is raised to 100% and the result flips to **Not a valid certificate**, with the altered details struck through. Changing even one letter of the name does the same.
4. **Works offline:** once a phone has opened the verify page once, it verifies with no network.
5. **Privacy:** the certificate details travel in the URL `#fragment`, which browsers never send to a server, so they don't reach any logs.
6. **Access:** a trainee can open only their own certificates; trainers and administrators can open any.

Note: a QR generated on `localhost` points to `localhost`, so a phone can't open it. Scan certificates from the GitHub Pages link.

## Demo story (Part 7, succession capsules)

1. **Trainee:** the dashboard shows **Handover waiting for you**. Mahesh Sawant leaves Ratnagiri on 15 October and has left 3 must-read notes.
2. **Open the handover.** Mark each must-read entry as read; the checklist fills in, and **Acknowledge handover** unlocks only when all are read. It works offline and syncs later, and the acknowledgement goes into the audit trail.
3. **Filter and search the capsule** by category: equipment and site, procedures that differ here, the seasonal and crop calendar, past advisories, and local contacts. **Still accurate** re-confirms an entry; anything unconfirmed for 6 months is flagged for review.
4. **Training Division → Succession capsules:** capsule health per station, officers leaving and their dates, and open handovers. **Start handover** at Machilipatnam: the leaving officer is pre-selected, and duplicates are refused.
5. Contacts use office and role titles only; there are no personal phone numbers in the demo data.

## Prototype vs production

| Area | Prototype (now) | Production (Phase B) |
|---|---|---|
| Data | IndexedDB on the device | Server database, IndexedDB kept as offline cache |
| Sync | Outbox drained by a simulated server | Same outbox, pushed to a real API |
| Login | Checked in the browser | Server auth; token cached for offline |
| Audit chain | Computed in the browser | Computed and anchored on the server |
| Lesson video | Generated slide video, silent, with synced transcript | Recorded lecture with automatic transcription |
| Lesson search | On-device term ranking with synonyms (works offline) | Server-side semantic search with word-level timestamps, cached for offline |
| Certificates | ECDSA P-256 signed; signing key in the browser for the demo | Signing key on the server (HSM); only the public key ships in the app |

The station list and designations in `js/seed.js` are illustrative. Verify them against IMD's directory before quoting any in the PPT.
