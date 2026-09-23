/* =========================================================
   seed.js — demo data loaded on first run.
   Bump SEED_VERSION whenever you change this file; every
   browser will wipe and reload the demo data on next open.

   NOTE: station list and designations are illustrative for
   the prototype. Verify against IMD's official directory
   before quoting any of it in the PPT.
   ========================================================= */

export const SEED_VERSION = "seed-2026-09-22.1";
export const DEMO_PASSWORD = "demo@123";
const SALT = "cc-demo-salt";

const T0 = "2026-06-01T09:00:00.000Z";
const id = () => crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
const rec = (o) => ({ id: id(), createdAt: T0, updatedAt: T0, version: 1, ...o });

export async function hashPassword(sha256, empId, password) {
  return sha256(`${empId.toLowerCase()}:${password}:${SALT}`);
}

export async function buildSeed(sha256) {
  /* ---------- stations: RMC → MC → Field Observatory ---------- */
  const stations = [];
  const addStation = (name, type, parent, facilities = []) => {
    const s = rec({ name, type, parentId: parent ? parent.id : null, facilities });
    stations.push(s);
    return s;
  };

  const hq      = addStation("Training Division, IMD Pune", "HQ", null, []);
  const delhi   = addStation("RMC New Delhi", "RMC", null, ["AWS", "Radar", "Satellite", "Aviation"]);
  const mumbai  = addStation("RMC Mumbai", "RMC", null, ["AWS", "Radar", "Aviation"]);
  const chennai = addStation("RMC Chennai", "RMC", null, ["AWS", "Radar", "Aviation"]);
  const kolkata = addStation("RMC Kolkata", "RMC", null, ["AWS", "Radar", "Aviation"]);
  const guwahati= addStation("RMC Guwahati", "RMC", null, ["AWS", "Aviation"]);
  const nagpur  = addStation("RMC Nagpur", "RMC", null, ["AWS", "Radar"]);

  const mcJaipur   = addStation("MC Jaipur", "MC", delhi, ["AWS", "Radar"]);
  const mcLucknow  = addStation("MC Lucknow", "MC", delhi, ["AWS", "Radar"]);
  const mcAhmd     = addStation("MC Ahmedabad", "MC", mumbai, ["AWS", "Aviation"]);
  const mcGoa      = addStation("MC Goa", "MC", mumbai, ["AWS", "Radar"]);
  const mcHyd      = addStation("MC Hyderabad", "MC", chennai, ["AWS", "Radar"]);
  const mcTvm      = addStation("MC Thiruvananthapuram", "MC", chennai, ["AWS", "Aviation"]);
  const mcBbsr     = addStation("MC Bhubaneswar", "MC", kolkata, ["AWS"]);
  const mcBhopal   = addStation("MC Bhopal", "MC", nagpur, ["AWS", "Radar"]);

  const foRatnagiri = addStation("Ratnagiri Observatory", "FO", mumbai, ["AWS"]);
  const foVeraval   = addStation("Veraval Observatory", "FO", mcAhmd, ["AWS"]);
  const foBhuj      = addStation("Bhuj Radar Station", "FO", mcAhmd, ["AWS", "Radar"]);
  const foMachili   = addStation("Machilipatnam Radar Station", "FO", chennai, ["AWS", "Radar"]);
  const foKochi     = addStation("Kochi Radar Station", "FO", mcTvm, ["AWS", "Radar"]);
  const foKaraikal  = addStation("Karaikal Observatory", "FO", chennai, ["AWS", "Radar"]);
  const foParadip   = addStation("Paradip Radar Station", "FO", mcBbsr, ["AWS", "Radar"]);
  const foPortBlair = addStation("Port Blair Observatory", "FO", kolkata, ["AWS", "Radar", "Aviation"]);
  const foAgartala  = addStation("Agartala Aerodrome Office", "FO", guwahati, ["AWS", "Aviation"]);
  const foMohanbari = addStation("Mohanbari Radar Station", "FO", guwahati, ["AWS", "Radar"]);

  /* ---------- modules: the four operational categories ---------- */
  const CATEGORIES = [
    { key: "aws",       label: "AWS and surface instruments" },
    { key: "radar",     label: "Radar" },
    { key: "satellite", label: "Satellite data analysis" },
    { key: "aviation",  label: "Aviation meteorology" }
  ];

  const moduleDefs = [
    ["aws", "AWS-101", "AWS commissioning and sensor checks", "Foundation", 6, true,
      "Install, commission and run daily checks on Automatic Weather Stations, including sensor exposure standards and data-logger health."],
    ["aws", "AWS-201", "Surface instruments: calibration and preventive maintenance", "Intermediate", 8, true,
      "Calibrate barometers, thermometers and rain gauges against reference standards and keep a preventive maintenance log."],
    ["radar", "RAD-101", "Doppler Weather Radar operations", "Foundation", 10, true,
      "Operate a DWR through a full scan strategy, handle routine alarms and hand over a shift safely."],
    ["radar", "RAD-201", "DWR data quality and product interpretation", "Advanced", 12, true,
      "Identify clutter, attenuation and anomalous propagation, and interpret reflectivity and velocity products for nowcasting."],
    ["satellite", "SAT-101", "INSAT-3D/3DR imagery interpretation", "Foundation", 6, false,
      "Read visible, infrared and water-vapour channels and recognise cloud systems relevant to Indian weather."],
    ["satellite", "SAT-201", "Satellite-derived products for nowcasting", "Intermediate", 8, true,
      "Use derived products such as cloud-top temperature and rainfall estimates to support short-range warnings."],
    ["aviation", "AVN-101", "METAR, SPECI and TAF coding", "Foundation", 6, true,
      "Encode and decode aerodrome reports and forecasts to ICAO standards, with common error patterns."],
    ["aviation", "AVN-201", "Aerodrome warnings and SIGMET basics", "Intermediate", 6, false,
      "Issue aerodrome warnings and understand SIGMET criteria for hazardous en-route weather."]
  ];

  const modules = moduleDefs.map(([category, code, title, level, hours, practical, description], i) =>
    rec({ category, code, title, level, durationHrs: hours, requiresPractical: practical, description, order: i + 1 }));

  /* ---------- units: lesson → reading → quiz → practical ----------
     Video files and timestamped transcripts are added in Part 3. */
  const units = [];
  for (const m of modules) {
    const list = [
      { type: "video",   title: `${m.code}: core lesson`, minutes: 4 },
      { type: "reading", title: "Field reference notes", minutes: 6 },
      { type: "quiz",    title: "Check your understanding", minutes: 5, passMark: 70 }
    ];
    if (m.requiresPractical) list.push({ type: "practical", title: "Practical task: submit evidence from your station", minutes: 45 });
    list.forEach((u, i) => units.push(rec({ moduleId: m.id, order: i + 1, ...u })));
  }
  const mod = code => modules.find(m => m.code === code);

  /* ---------- people ---------- */
  const users = [];
  const addUser = async (empId, name, designation, role, station, certifications = [], extra = {}) => {
    const u = rec({
      empId, name, designation, role, stationId: station.id, certifications,
      passwordHash: await hashPassword(sha256, empId, DEMO_PASSWORD),
      ...extra
    });
    users.push(u);
    return u;
  };

  // Administrators: Training Division approves; station heads nominate (scoped admins)
  const adminDiv   = await addUser("A-1001", "Dr. Meera Iyer", "Scientist-E, Training Division", "admin", hq, [], { adminScope: "division", demo: true });
  const headMumbai = await addUser("A-2001", "Rajesh Patil", "Head, RMC Mumbai", "admin", mumbai, [], { adminScope: "station" , demo: true, demoLabel: "Station head" });
  const headChennai= await addUser("A-2002", "S. Lakshmi Narayanan", "Head, RMC Chennai", "admin", chennai, [], { adminScope: "station" });

  // Trainers / mentors
  const trainerRadar = await addUser("M-3001", "Dr. Anil Deshpande", "Scientist-D, Radar Division", "trainer", hq, ["radar", "aws"], { expertise: ["radar"], demo: true });
  await addUser("M-3002", "Kavita Rao", "Scientist-C, Satellite Meteorology", "trainer", hq, ["satellite"], { expertise: ["satellite"] });
  await addUser("M-3003", "Capt. Vikram Sethi (Retd.)", "Aviation Met Instructor", "trainer", hq, ["aviation"], { expertise: ["aviation"] });
  await addUser("M-3004", "Pradeep Menon", "Scientist-C, Surface Instruments", "trainer", hq, ["aws"], { expertise: ["aws"] });

  // Trainees (field officers). Certifications are deliberately uneven so SPOF alerts fire.
  const demoTrainee = await addUser("T-4001", "Aditya Joshi", "Scientific Assistant", "trainee", foRatnagiri, ["aws"], { demo: true });
  const traineeDefs = [
    ["T-4002", "Sneha Kulkarni", "Scientific Assistant", mumbai, ["aws", "aviation"]],
    ["T-4003", "Imran Shaikh", "Meteorologist Grade-II", mumbai, ["radar", "aws"]],
    ["T-4004", "Pooja Desai", "Scientific Assistant", foVeraval, ["aws"]],
    ["T-4005", "Harshad Vyas", "Scientific Assistant", foBhuj, ["radar"]],
    ["T-4006", "Nikhil Bhatt", "Scientific Assistant", mcAhmd, ["aws", "aviation"]],
    ["T-4007", "K. Srinivas Rao", "Meteorologist Grade-II", foMachili, ["radar", "aws"], { transferDue: "2026-11-30" }],
    ["T-4025", "Mahesh Sawant", "Meteorologist Grade-II", foRatnagiri, ["aws"], { transferDue: "2026-10-15" }],
    ["T-4008", "Divya Reddy", "Scientific Assistant", foMachili, ["aws"]],
    ["T-4009", "Arun Kumar", "Scientific Assistant", foKaraikal, ["aws", "radar"]],
    ["T-4010", "Meenakshi S.", "Scientific Assistant", foKaraikal, ["aws", "radar"]],
    ["T-4011", "Joseph Varghese", "Scientific Assistant", foKochi, ["aws"]],
    ["T-4012", "Anjali Nair", "Scientific Assistant", mcTvm, ["aws", "aviation"]],
    ["T-4013", "Subhash Mohanty", "Meteorologist Grade-II", foParadip, ["radar"]],
    ["T-4014", "Rashmi Sahoo", "Scientific Assistant", foParadip, ["aws", "radar"]],
    ["T-4015", "Tapan Das", "Scientific Assistant", foPortBlair, ["aws"]],
    ["T-4016", "Bikash Debbarma", "Scientific Assistant", foAgartala, ["aws", "aviation"]],
    ["T-4017", "Pranjal Gogoi", "Scientific Assistant", foMohanbari, ["radar", "aws"]],
    ["T-4018", "Rohit Sharma", "Meteorologist Grade-II", delhi, ["satellite", "radar"]],
    ["T-4019", "Neha Verma", "Scientific Assistant", mcJaipur, ["aws", "radar"]],
    ["T-4020", "Amit Tiwari", "Scientific Assistant", mcLucknow, ["aws"]],
    ["T-4021", "Farah Khan", "Scientific Assistant", mcBhopal, ["aws", "radar"]],
    ["T-4022", "Sagar Wankhede", "Scientific Assistant", nagpur, ["aws", "radar", "satellite"]],
    ["T-4023", "Ramya Krishnan", "Scientific Assistant", mcHyd, ["radar", "satellite"]],
    ["T-4024", "Vinay Naik", "Scientific Assistant", mcGoa, ["aws", "radar"]]
  ];
  const trainees = [demoTrainee];
  for (const [empId, name, desig, st, certs, extra] of traineeDefs) {
    trainees.push(await addUser(empId, name, desig, "trainee", st, certs, extra || {}));
  }
  const byEmp = e => users.find(u => u.empId === e);

  /* ---------- batches, nominations, enrollments ---------- */
  const batches = [];
  const nominations = [];
  const enrollments = [];

  // An approved, running batch that the demo trainee is in
  const batchAws = rec({ moduleId: mod("AWS-201").id, name: "AWS-201 · September batch", status: "approved",
    approvedBy: adminDiv.id, approvedAt: "2026-09-02T10:00:00.000Z", startDate: "2026-09-08", trainerId: byEmp("M-3004").id });
  batches.push(batchAws);
  for (const t of [demoTrainee, byEmp("T-4004"), byEmp("T-4015")]) {
    const n = rec({ userId: t.id, moduleId: batchAws.moduleId, nominatedBy: headMumbai.id, status: "approved",
      batchId: batchAws.id, reason: "Station requires calibration capability before monsoon withdrawal",
      createdAt: "2026-08-24T10:00:00.000Z", decidedBy: adminDiv.id, decidedAt: batchAws.approvedAt });
    nominations.push(n);
    enrollments.push(rec({ userId: t.id, moduleId: batchAws.moduleId, batchId: batchAws.id, status: "active", source: "nomination" }));
  }
  // Demo trainee also enrolled in RAD-101 (so the dashboard has two modules)
  const batchRad = rec({ moduleId: mod("RAD-101").id, name: "RAD-101 · September batch", status: "approved",
    approvedBy: adminDiv.id, approvedAt: "2026-09-05T10:00:00.000Z", startDate: "2026-09-12", trainerId: trainerRadar.id });
  batches.push(batchRad);
  for (const t of [demoTrainee, byEmp("T-4008"), byEmp("T-4011")]) {
    nominations.push(rec({ userId: t.id, moduleId: batchRad.moduleId, nominatedBy: t.id === demoTrainee.id ? headMumbai.id : headChennai.id,
      status: "approved", batchId: batchRad.id, reason: "Backup radar operator needed at station",
      createdAt: "2026-08-28T10:00:00.000Z", decidedBy: adminDiv.id, decidedAt: batchRad.approvedAt }));
    enrollments.push(rec({ userId: t.id, moduleId: batchRad.moduleId, batchId: batchRad.id, status: "active", source: "nomination" }));
  }

  // Pending nominations waiting for Training Division (fills the admin queue)
  const pending = [
    ["T-4002", "AVN-201", headMumbai, "Aerodrome warnings workload increasing at Mumbai", "2026-09-14"],
    ["T-4006", "AVN-201", headMumbai, "Replacement for officer retiring in December", "2026-09-15"],
    ["T-4012", "AVN-101", headChennai, "New posting to aerodrome duty", "2026-09-16"],
    ["T-4009", "RAD-201", headChennai, "Clutter issues reported in last cyclone season", "2026-09-17"],
    ["T-4010", "RAD-201", headChennai, "Second quality-control officer for Karaikal DWR", "2026-09-17"]
  ];
  for (const [emp, code, by, reason, day] of pending) {
    const at = `${day}T10:30:00.000Z`;
    nominations.push(rec({ userId: byEmp(emp).id, moduleId: mod(code).id, nominatedBy: by.id, status: "pending", batchId: null, reason, createdAt: at, updatedAt: at }));
  }

  /* ---------- a couple of issued certificates (history) ---------- */
  const certificates = [
    rec({ userId: demoTrainee.id, moduleId: mod("AWS-101").id, issuedAt: "2026-07-18T11:30:00.000Z", certNo: "CC-2026-000118", score: 86 }),
    rec({ userId: byEmp("T-4007").id, moduleId: mod("RAD-101").id, issuedAt: "2026-03-02T11:30:00.000Z", certNo: "CC-2026-000031", score: 91 })
  ];

  /* ---------- learning activity (Part 3) ---------- */
  const unitOf = (code, order) => units.find(u => u.moduleId === mod(code).id && u.order === order);
  const enrollOf = (user, code) => enrollments.find(e => e.userId === user.id && e.moduleId === mod(code).id);

  // Demo trainee is part-way through AWS-201: lesson and reading done, quiz is next.
  const progress = [];
  const eAws = enrollOf(demoTrainee, "AWS-201");
  progress.push(rec({ userId: demoTrainee.id, unitId: unitOf("AWS-201", 1).id, enrollmentId: eAws.id, moduleId: mod("AWS-201").id,
    status: "completed", watched: "1".repeat(192), watchedPct: 100, completedAt: "2026-09-10T11:00:00.000Z" }));
  progress.push(rec({ userId: demoTrainee.id, unitId: unitOf("AWS-201", 2).id, enrollmentId: eAws.id, moduleId: mod("AWS-201").id,
    status: "completed", completedAt: "2026-09-11T09:30:00.000Z" }));

  // Mentor discussion beside the lessons (training is a dialogue, per officer feedback)
  const divya = byEmp("T-4008"), joseph = byEmp("T-4011"), tapan = byEmp("T-4015"), pm = byEmp("M-3004");
  const post = (code, order, author, text, at, atSecond = null) => rec({ moduleId: mod(code).id, unitId: unitOf(code, order).id,
    authorId: author.id, authorRole: author.role, text, atSecond, createdAt: at, updatedAt: at });
  const discussions = [
    post("RAD-101", 1, divya, "At Machilipatnam we sometimes see inbound and outbound side by side near the coast during squalls. How do I tell aliasing from a real wind shift?", "2026-09-13T06:20:00.000Z", 142),
    post("RAD-101", 1, trainerRadar, "Look at the neighbouring gates. Aliasing jumps straight from the strongest inbound colour to the strongest outbound one with nothing in between. A real shift passes through near-zero values. Then check the unfolded product.", "2026-09-13T08:05:00.000Z"),
    post("RAD-101", 1, joseph, "Should the pre-shift checks be written in the logbook even if everything is normal?", "2026-09-14T04:40:00.000Z", 75),
    post("RAD-101", 1, trainerRadar, "Yes. A one-line entry with the time and 'checks complete, no open alarms' is enough, and it protects you if something fails later in the shift.", "2026-09-14T07:15:00.000Z"),
    post("AWS-201", 1, tapan, "Port Blair humidity sensor reads about 4% high against the psychrometer after the monsoon. Is that within tolerance or should I report it?", "2026-09-12T05:10:00.000Z", 140),
    post("AWS-201", 1, pm, "Report it. Humidity sensors drift faster in salty, humid air. Log your paired readings and raise it for replacement. Don't apply a manual correction yourself.", "2026-09-12T09:45:00.000Z")
  ];

  // Anonymous confusion flags: no user id is stored, by design.
  const flag = (code, order, second, chapterIndex) => rec({ unitId: unitOf(code, order).id, moduleId: mod(code).id, second, chapterIndex });
  const confusion = [
    flag("RAD-101", 1, 138, 4), flag("RAD-101", 1, 141, 4), flag("RAD-101", 1, 147, 4), flag("RAD-101", 1, 150, 4), flag("RAD-101", 1, 155, 4),
    flag("RAD-101", 1, 44, 1), flag("RAD-101", 1, 52, 1),
    flag("RAD-101", 1, 119, 3),
    flag("AWS-201", 1, 70, 2), flag("AWS-201", 1, 78, 2), flag("AWS-201", 1, 84, 2)
  ];

  /* ---------- succession capsules (Part 7) ----------
     Station knowledge that isn't in any manual. Contacts use office
     and role titles only: no personal phone numbers in demo data. */
  const capsules = [];
  const entry = (station, category, title, body, author, when, mustRead = false) => capsules.push(rec({
    stationId: station.id, category, title, body, mustRead, authorId: author.id,
    createdAt: when, updatedAt: when, confirmedAt: when, confirmedBy: author.id
  }));
  const mahesh = byEmp("T-4025");
  const srinivas = byEmp("T-4007");

  entry(foRatnagiri, "equipment", "Rain gauge funnel clogs after the first monsoon week",
    "Leaves from the jackfruit tree by the east fence block the tipping bucket funnel within days of the monsoon onset. Clear the funnel and filter every morning from June to mid-July, before the 0830 observation, or the day's rainfall is under-reported.",
    mahesh, "2026-07-02T04:30:00.000Z", true);
  entry(foRatnagiri, "procedure", "Heavy rain days: report the AWS reading and the manual gauge together",
    "On red and orange alert days, send the manual standard gauge total alongside the AWS value in the 0830 report. The Regional Met Centre compares both, because the AWS tends to read low in intense bursts at this site.",
    mahesh, "2026-06-18T05:10:00.000Z", true);
  entry(foRatnagiri, "seasonal", "Crop calendar for agromet advisories",
    "Kharif paddy is transplanted from late June through July; advisories on heavy rain spells matter most then. Mango flowering runs roughly December to February, when unseasonal rain and cloudy spells drive pest advisories. Cashew harvest follows from March.",
    mahesh, "2026-05-20T06:00:00.000Z", true);
  entry(foRatnagiri, "contacts", "Who to inform during fishing warnings",
    "Squally weather warnings go to the district fisheries office and the port office before 0900. The current numbers are on the notice board inside the observatory; update the board if a number changes.",
    mahesh, "2026-03-11T07:00:00.000Z");
  entry(foRatnagiri, "advisory", "Lesson from last season's extremely heavy rain event",
    "The power backup ran out mid-afternoon on the second day and the AWS stopped transmitting. Charge the backup fully when an orange alert is issued, and log manual readings every three hours if transmission drops.",
    mahesh, "2025-11-02T09:00:00.000Z");

  entry(foMachili, "equipment", "Sea clutter on the lowest elevation on calm nights",
    "On calm, humid nights the lowest elevation shows sea clutter to the south-east that looks like light rain. Check it against the next elevation up and the velocity product before reporting precipitation offshore.",
    srinivas, "2026-08-14T15:00:00.000Z", true);
  entry(foMachili, "advisory", "Cyclone season: hand over the radar only with the scan strategy written down",
    "During cyclone watch the station runs the severe weather scan strategy. Every handover note must state which strategy is running and when it was switched, because the next shift has changed it back by mistake before.",
    srinivas, "2025-12-05T06:00:00.000Z", true);
  entry(foMachili, "contacts", "District emergency operations centre",
    "During cyclone watch, the district emergency operations centre expects a call whenever the radar shows a band approaching the coast. The duty number is kept on the control room whiteboard.",
    srinivas, "2025-10-20T06:00:00.000Z");

  // A handover in progress: Mahesh leaves Ratnagiri, the demo trainee takes over his duties.
  const handovers = [rec({
    stationId: foRatnagiri.id, fromUserId: mahesh.id, toUserId: demoTrainee.id, startedBy: headMumbai.id, status: "pending",
    note: "Mahesh is posted to RMC Mumbai on 15 October. Aditya takes over the morning observations and the monsoon reporting.",
    mustReadIds: capsules.filter(c => c.stationId === foRatnagiri.id && c.mustRead).map(c => c.id), readIds: [],
    createdAt: "2026-09-18T05:00:00.000Z", updatedAt: "2026-09-18T05:00:00.000Z"
  })];

  /* ---------- PS coverage: profiles, account requests, questionnaires,
     library, feedback, announcements. Dates are relative to the day the
     demo data is loaded, so deadlines never go stale. ---------- */
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const at = n => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d.toISOString(); };
  const pradeep = byEmp("M-3004");

  demoTrainee.profile = {
    summary: "Scientific Assistant at Ratnagiri Observatory, responsible for surface observations, AWS upkeep and monsoon reporting on the Konkan coast.",
    qualifications: [{ degree: "M.Sc. Physics", institution: "University of Mumbai", year: "2019" }, { degree: "B.Sc. Physics", institution: "Gogate Jogalekar College, Ratnagiri", year: "2017" }],
    experience: [{ role: "Scientific Assistant", organisation: "IMD, Ratnagiri Observatory", from: "2022", to: "Present" }, { role: "Project Assistant", organisation: "Coastal rainfall study, University of Mumbai", from: "2020", to: "2022" }],
    interests: ["Radar meteorology", "Monsoon extremes", "Agromet advisories"],
    skills: ["AWS maintenance", "Rain gauge calibration", "Python for data checks", "Marathi and Hindi public briefings"]
  };
  trainerRadar.profile = {
    summary: "Radar meteorologist with long experience running and quality-controlling Doppler Weather Radars on the east coast; mentors new radar operators.",
    qualifications: [{ degree: "Ph.D. Atmospheric Sciences", institution: "University of Pune", year: "2008" }, { degree: "M.Sc. Physics", institution: "Savitribai Phule Pune University", year: "2002" }],
    experience: [{ role: "Scientist-D, Radar Division", organisation: "IMD Pune", from: "2016", to: "Present" }, { role: "Radar officer", organisation: "IMD, Machilipatnam", from: "2009", to: "2016" }],
    interests: ["Cyclone nowcasting", "Radar data quality"], skills: ["DWR operations", "Velocity dealiasing", "Mentoring shift officers"]
  };
  pradeep.profile = { summary: "Surface instruments specialist; runs calibration training for AWS and manual gauges.",
    qualifications: [{ degree: "M.Tech. Instrumentation", institution: "COEP Pune", year: "2010" }],
    experience: [{ role: "Scientist-C, Surface Instruments", organisation: "IMD Pune", from: "2014", to: "Present" }], interests: ["Sensor drift"], skills: ["Calibration", "Preventive maintenance"] };

  // Account requests waiting for the Training Division
  users.push(rec({ empId: "T-4101", name: "Kiran Patwardhan", email: "kiran.patwardhan@imd.gov.in", designation: "Scientific Assistant",
    role: "trainee", requestedRole: "trainee", status: "pending", stationId: foVeraval.id, certifications: [], profile: {},
    requestReason: "Joined Veraval Observatory this month; need access for AWS training.", passwordHash: await hashPassword(sha256, "T-4101", DEMO_PASSWORD), createdAt: at(-1), updatedAt: at(-1) }));
  users.push(rec({ empId: "M-3101", name: "Dr. Sunita Rao", email: "sunita.rao@imd.gov.in", designation: "Scientist-C, Aviation Meteorology",
    role: "trainer", requestedRole: "trainer", status: "pending", stationId: hq.id, certifications: ["aviation"], expertise: ["aviation"], profile: {},
    requestReason: "Will run the AVN-201 aerodrome warnings batches from November.", passwordHash: await hashPassword(sha256, "M-3101", DEMO_PASSWORD), createdAt: at(-2), updatedAt: at(-2) }));

  // Trainer questionnaires with deadlines
  const qn = (batch, trainer, title, deadline, questions, created, extra = {}) => rec({ batchId: batch.id, moduleId: batch.moduleId, trainerId: trainer.id,
    title, instructions: "One attempt. Answer every question before the deadline.", deadline, passMark: 60, questions, status: "open", createdAt: created, updatedAt: created, ...extra });
  const questionnaires = [
    qn(batchRad, trainerRadar, "Week 2 check: velocity products and aliasing", day(10), [
      { q: "Strong inbound values sit right beside strong outbound values with nothing between. What do you check first?", options: ["Neighbouring gates and the unfolded product", "The transmitter power", "The rain gauge", "Satellite imagery"], answer: 0 },
      { q: "What sets the largest radial speed a radar can measure without ambiguity?", options: ["Beam width", "Nyquist velocity", "Scan elevation", "Reflectivity"], answer: 1 },
      { q: "Which elevation shows precipitation closest to the ground?", options: ["The highest", "The middle", "The lowest", "All equally"], answer: 2 },
      { q: "During cyclone watch, what must every handover note state?", options: ["The weather outside", "Which scan strategy is running and since when", "The officer's leave plans", "Nothing extra"], answer: 1 }
    ], at(-3)),
    qn(batchAws, pradeep, "Calibration practice quiz", day(6), [
      { q: "How many paired readings should a field calibration check include at minimum?", options: ["One", "Three", "Ten", "None"], answer: 1 },
      { q: "A blocked radiation screen on a sunny day makes temperature read:", options: ["Too cold", "Too warm", "Correctly", "Zero"], answer: 1 },
      { q: "What does a tipping bucket gauge count?", options: ["Wind gusts", "Fixed small amounts of rain", "Humidity", "Pressure changes"], answer: 1 }
    ], at(-2)),
    qn(batchAws, pradeep, "Pre-course readiness check", day(-7), [
      { q: "Why does calibration need a reference instrument with a certificate?", options: ["Traceability to a standard", "It is cheaper", "It replaces logs", "No reason"], answer: 0 },
      { q: "When should barometer comparisons be avoided?", options: ["Steady weather", "During a frontal passage", "At noon", "Never"], answer: 1 }
    ], at(-14))
  ];
  const closedQ = questionnaires[2];
  const resp = (u, answers, score) => rec({ questionnaireId: closedQ.id, userId: u.id, answers, score, passed: score >= 60, submittedAt: at(-9), createdAt: at(-9), updatedAt: at(-9) });
  const responses = [resp(demoTrainee, [0, 1], 100), resp(byEmp("T-4004"), [0, 0], 50), resp(byEmp("T-4015"), [0, 1], 100)];

  // Trainer library: real files shipped with the app
  const lib = (title, description, file, mime, size, kind, module, uploader, when, url) => rec({ title, description, fileName: file, mime, size, kind,
    moduleId: module ? module.id : null, category: module ? module.category : "general", uploaderId: uploader.id, url: url || `assets/library/${file}`, createdAt: when, updatedAt: when });
  const library = [
    lib("RAD-101 recorded lecture", "The full core lesson on Doppler Weather Radar operations.", "rad-101-lesson.mp4", "video/mp4", 752866, "lecture", mod("RAD-101"), trainerRadar, at(-12), "assets/media/rad-101-lesson.mp4"),
    lib("RAD-101 lecture slides", "Slides from the core lesson, one per topic, for revision or classroom use.", "rad-101-lecture-slides.pdf", "application/pdf", 271000, "presentation", mod("RAD-101"), trainerRadar, at(-12)),
    lib("DWR shift checklist", "Start-of-shift, during-shift and handover checklist for radar operators.", "rad-101-shift-checklist.pdf", "application/pdf", 55000, "sop", mod("RAD-101"), trainerRadar, at(-10)),
    lib("AWS-201 recorded lecture", "Core lesson on calibration and preventive maintenance.", "aws-201-lesson.mp4", "video/mp4", 742655, "lecture", mod("AWS-201"), pradeep, at(-11), "assets/media/aws-201-lesson.mp4"),
    lib("Calibration record sheet", "The sheet to fill in for every sensor calibration check.", "aws-201-calibration-record-sheet.pdf", "application/pdf", 53000, "notes", mod("AWS-201"), pradeep, at(-11)),
    lib("INSAT-3D/3DR channel guide", "Which channel shows what, and how to combine them to identify cloud.", "sat-101-channel-guide.pdf", "application/pdf", 54000, "notes", mod("SAT-101"), byEmp("M-3002"), at(-8))
  ];

  // Course feedback (shown to trainers and admins without names)
  const fb = (u, code, rating, aspects, comment, n) => rec({ userId: u.id, moduleId: mod(code).id, rating, aspects, comment, createdAt: at(n), updatedAt: at(n) });
  const feedback = [
    fb(byEmp("T-4004"), "AWS-201", 4, { content: 5, relevance: 4, pace: 3 }, "The rain gauge section was very practical. The pressure part moved a bit fast.", -5),
    fb(byEmp("T-4015"), "AWS-201", 5, { content: 5, relevance: 5, pace: 4 }, "Humidity drift in salty air is exactly our problem at Port Blair.", -4),
    fb(byEmp("T-4008"), "RAD-101", 4, { content: 4, relevance: 5, pace: 4 }, "Aliasing explanation helped. More examples from coastal radars would be good.", -3),
    fb(byEmp("T-4011"), "RAD-101", 3, { content: 4, relevance: 4, pace: 2 }, "Too much in one lesson for a first-time operator.", -2)
  ];

  // Homepage announcements published by the Training Division
  const ann = (type, title, body, n) => rec({ type, title, body, onHomepage: true, expires: null, authorId: adminDiv.id, publishedAt: at(n), createdAt: at(n), updatedAt: at(n) });
  const announcements = [
    ann("new-content", "New module: Doppler Weather Radar operations", "RAD-101 is open for nomination under Radar, with a practical task scored by a mentor.", -6),
    ann("achievement", "Ratnagiri Observatory: every officer AWS-certified", "All officers at Ratnagiri now hold AWS certification, removing the station's single point of failure.", -4),
    ann("announcement", "Cyclone season refresher batches from October", "Station heads on the east coast should nominate radar officers for RAD-201 before the end of the month.", -2),
    ann("notice", "Download lessons before field postings", "Officers heading to remote postings should download their modules while on a good connection.", -1)
  ];

  return {
    stations, modules, units, users, batches, nominations, enrollments, certificates,
    progress, discussions, confusion, capsules, handovers,
    questionnaires, responses, library, feedback, announcements,
    meta: [{ id: "categories", value: CATEGORIES }]
  };
}
