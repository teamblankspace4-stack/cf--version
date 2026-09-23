# Capacity Connect — demo script

SIH 2026 · SIH26075 · Team Blankspace

Everything below runs on the deployed link. Rehearse it three times before judging, and run the **pre-demo checklist** every time.

---

## Pre-demo checklist (10 minutes before)

1. Open the deployed link on the **demo laptop** and on an **Android phone** (Chrome).
2. On both, open **System check** and press **Reset demo data**. Wait for **Offline readiness: Ready**.
3. If a banner says **"A new version is ready"**, press **Refresh**.
4. On the phone: **Install app** (or Chrome menu → Add to Home screen). Open it once from the home screen.
5. Open a certificate on the laptop (Trainee → View and verify) so it's ready to scan.
6. Test once: switch the phone to **airplane mode**, open the app, and confirm it loads. Then switch airplane mode off.
7. Close every other tab. Set browser zoom to 100%.

**If the venue Wi-Fi fails, that is your demo.** The app is built for exactly that.

---

## The 3-minute demo

| Time | Do | Say (short version) |
|---|---|---|
| 0:00 | Landing page. Point at **"Ready to work offline on this device"**. | "Capacity Connect is IMD's training record for every officer, built for stations that lose signal for days." |
| 0:15 | **Try the demo → Administrator → Station head: Open instantly.** Choose a module, tick an officer, add a reason, **Nominate**. | "Nobody enrols in training unchecked. Field officers told us station heads nominate, and the Training Division approves. Officers can also request a course; it joins the same queue." |
| 0:40 | Sidebar **Demo: view as → Training Division.** Select the nomination, **Approve**, new batch, matching trainer pre-selected. | "One approval creates the batch and assigns a trainer with the right expertise." |
| 1:00 | **Skill coverage.** Point at the spotlight numbers, then **Assign backup training** on Kochi Radar Station. | "Kochi operates a radar and has no radar-certified officer. One click enrols a backup, before a transfer or an incident exposes the gap." |
| 1:25 | **View as Trainee.** Open **Doppler Weather Radar operations**. Drag the video to the end: **"Watched 1%"**. | "Skipping doesn't count. Units unlock only when the work is actually done." |
| 1:45 | **Find in this lesson:** type *why do winds fold*. It jumps to **2:22**. | "Officers ask in their own words; it jumps to the exact second. This runs on the device, so it works offline." |
| 2:00 | **Turn Wi-Fi off.** Top bar changes to **Offline**. Open **Station knowledge** and mark two must-read notes as read. | "No network. Everything still works, and the top bar shows what's waiting to sync." |
| 2:20 | **Turn Wi-Fi on.** Top bar: **Syncing… → Synced**. | "Reconnect, and it syncs by itself. Nothing lost, nothing re-uploaded." |
| 2:35 | Hand the judge the **phone**. Scan the certificate QR → **Genuine certificate**. Press **Tamper with it** → **Not a valid certificate**. | "Any phone can verify a certificate offline, against the Training Division's digital signature. Change one number and it fails." |
| 2:55 | Close. | "Offline-first, tamper-evident, and built with IMD field officers. Thank you." |

**Timing rule:** if you're behind at 1:45, skip the lesson search and go straight to the Wi-Fi-off step. The offline moment is the one to protect.

---

## If you get 5 more minutes

- **Mentor view:** "Where your batch is getting stuck" shows aliasing at 2:10, flagged by 5 officers, anonymously. Post a clarification; it lands beside the lesson at that second.
- **Practical review:** score on the four-criteria rubric, return for rework, approve, and the certificate issues automatically with a competency score.
- **Succession capsule:** Trainee dashboard → "Handover waiting for you". Mahesh Sawant leaves Ratnagiri on 15 October; Aditya can't acknowledge until he's read every must-read note. "Train the post, not just the person."
- **Audit trail:** System check → **Verify integrity**. Every action is hash-chained; editing any past entry breaks the chain.

---

## Problem statement, line by line: where to show each item

Judges often read the PS aloud and ask "show me this". Each item below is two or three clicks away. Use **Demo: view as** in the sidebar to switch roles.

| PS says | Role | Show it | Say |
|---|---|---|---|
| Secure signup and login, three roles | Public → Training Division | Sign-in → **Request an account** → fill the form. Try signing in: "waiting for approval". Switch to Training Division → **Users & roles** → **Approve**. | "Anyone can request an account; nobody gets in until the Training Division approves and confirms the role." |
| Trainee profile: qualifications, experience, interests, skills, certificates | Trainee | **My profile** → **Edit profile** | "Certificates come from the record, so they can't be typed in." |
| Enrol in courses | Trainee | **Browse courses** → **Request enrolment** | "The request joins the same approval queue as a station head's nomination." |
| Access learning resources | Trainee | **My training** → a module; **Library** | |
| Subject-wise MCQ assessments | Trainee | Module quiz; **Assessments** → **Start** | |
| Feedback on courses and content | Trainee | Any module → **Your feedback** panel | "Trainers see ratings and comments, never the officer's name." |
| Trainer profile | Trainer | **My profile** | |
| Questionnaires with deadlines | Trainer | **Questionnaires** → **New questionnaire** → set a deadline → publish | "One attempt per officer, and it closes itself at the deadline." |
| Monitor participation and performance | Trainer | **Mentor dashboard** roster; **Questionnaires** → **Results** | "Results show the hardest question for the batch." |
| Trainer library | Trainer | **Trainer library** → **Upload** a PDF | "Trainees can open it offline once it's on their device." |
| User approval and role management | Training Division | **Users & roles**: approve, reject, change role, deactivate | |
| Dashboards: courses, enrolments, certifications, assessments, participation | Training Division | **Reports** | |
| Publish notifications, announcements, achievements, new content | Training Division | **Announcements** → publish → open the homepage; trainee's **bell** | |
| Competency mapping for suitable trainers | Training Division | **Competency map** → **Find a trainer for a subject**; also the batch approval dialog | "The score is transparent: expertise plus a real teaching record." |
| Scalable, secure, user-friendly, accessible across devices | Any | System check; phone; Wi-Fi off | Quote the measured results below. |
| APAR (our addition) | Training Division | **Reports** → **APAR training reports** → **Open report** → **Print or save as PDF** | "The training section of an officer's APAR, generated from the tamper-evident record." |

**Pending demo accounts for the approval flow:** Kiran Patwardhan (T-4101, trainee) and Dr. Sunita Rao (M-3101, trainer) are waiting in **Users & roles**. After approval they sign in with password `demo@123`.

**Sample documents to hand out:** `Sample-Certificate-QR-verified.pdf` and `Sample-APAR-Training-Report.pdf`. The certificate's QR opens the verification page once the app is live at the address it points to.

**Same-device rule:** in the prototype, data lives on the device. Do the signup → approval flow and announcement → homepage flow on the same laptop.

## Problem statement requirements → where to show them

| Requirement | What answers it | Show it | Evidence |
|---|---|---|---|
| **System design** | Offline-first PWA: local database, sync outbox of operations, service worker. The data layer is isolated so a server can replace it without rewriting pages. | System check page; README "Prototype vs production" | Architecture slide |
| **Computer networks / low bandwidth** | Cache-first app shell, per-module downloads, background sync, 0 KB repeat visits. | Wi-Fi off during the demo | Measured below |
| **Cybersecurity** | Content Security Policy on every page (only the app's own scripts can run), ECDSA-signed certificates, SHA-256 hash-chained audit trail, permission checks in the service layer rather than the page. | Tamper with a certificate; Verify integrity | Tested: forged score rejected, edited audit entry detected |
| **Anonymity** | Confusion flags store no user ID; a moment is shown only after 3 or more officers flag it; the audit entry records the actor as "anonymous". | Mentor dashboard: "below threshold" rows show no count | By design; see `js/services/learning.js` |
| **Security** | Role-scoped data: station heads see only their region, trainees only their own certificates and station. | Try opening another officer's certificate as a trainee | Tested |
| **Affordability** | No app store, no new hardware, installs from one link on existing phones and PCs; about 200 KB first load. | Install from the link | Measured below |

---

## Measured results

Measured on the prototype before submission (headless Chrome, Lighthouse 12, axe-core 4.13).

| Check | Result |
|---|---|
| Lighthouse, mobile profile (landing, sign-in, verify, System check) | **Performance 100, Accessibility 100, SEO 100** on all four |
| Lighthouse Best Practices | 79 locally, only because the test server was plain HTTP; the HTTPS checks pass on GitHub Pages |
| Accessibility (axe-core, WCAG 2.1 AA), 18 page states including every dashboard and dialog | **0 violations** |
| First visit on Slow 3G (400 kbps, 400 ms latency) | First paint ~2.0 s, fully loaded ~5.4 s, **204 KB** |
| Every later visit | **0 KB from the network**, first paint ~0.14 s |
| Downloading one lesson for offline use (0.7 MB) on Slow 3G | ~18 s, once |
| Offline tests (server shut down, or browser set offline) | Tested working: every page, downloaded lessons (play, seek, lesson search), nominations, handover read and acknowledge, certificate verification. Changes queue and sync on reconnect. |

State numbers as "measured on our prototype". Don't round them up.

---

## Questions judges are likely to ask

**"Does it sync between two devices?"**
Not yet in the prototype: data lives on each device, and sync to a server is simulated through a real operation queue. The queue already stores operations ("nominate", "approve", "submit practical"), which is what the server API will accept. That's the first thing we build in the next two months.

**"Where is the certificate signing key?"**
In the prototype it's in the browser, so the demo works without a server, and the certificate page says so. In production the private key lives only on the server; the app ships only the public key, which is all verification needs.

**"Is the lesson search AI?"**
It's on-device topic search with a synonym model, which is why it works offline. In production, recorded lectures get automatic transcription and server-side semantic search, cached for offline use. Say "AI-assisted search"; don't claim a neural model runs on the phone.

**"Why are the videos silent slides?"**
They're prototype lesson videos generated from the transcript, so timestamps match exactly. Real IMD lecture recordings drop in with the same chapter timestamps (`tools/README.md`).

**"What happens with very small batches and the confusion map?"**
With fewer than 3 flags on a moment, nothing is shown. That's deliberate: showing a count of 1 would identify the officer.

**"Why not a native app?"**
One link installs on every device the department already has, updates instantly, and needs no app-store approval. It's cheaper to build and to run.

**"How do you know it works offline?"**
Offer to switch off the Wi-Fi yourself, then do it.

---

## If something goes wrong

- **Old version showing:** press **Refresh** on the update banner, or System check → reload.
- **Demo data looks wrong:** System check → **Reset demo data**.
- **QR won't open on the phone:** it must be generated from the deployed link, not `localhost`. Open the certificate on the deployed site.
- **Everything else fails:** keep calm, turn Wi-Fi off, and show that the app still loads. That's the core claim.
