/* =========================================================
   search.js — "Find in this lesson": jump to the exact moment
   a topic is explained.

   PROTOTYPE: runs fully on the device (works offline). It ranks
   transcript chapters by term weighting across title, key points,
   keywords and narration, expands common synonyms, then finds the
   best-matching sentence and estimates its timestamp inside the
   chapter.
   PHASE B: the same interface can call a server-side embedding
   model for true semantic search, with word-level timestamps from
   automatic transcription. Pages don't change.
   ========================================================= */

const STOP = new Set(("a an the and or of to in on at for is are was be by it its this that these those with as from " +
  "how what when where why which who do does did can i you we they me my your our about into than then there here " +
  "explain explained show tell topic part lesson").split(" "));

/* Field vocabulary officers actually type → words used in lessons. */
const SYNONYMS = {
  fold: ["aliasing", "nyquist"], folding: ["aliasing", "nyquist"], alias: ["aliasing"],
  wind: ["velocity", "radial"], speed: ["velocity"], doppler: ["velocity", "radial"],
  dbz: ["reflectivity"], intensity: ["reflectivity", "dbz"], echo: ["reflectivity"],
  calibrate: ["calibration", "reference"], calibrating: ["calibration"], check: ["calibration", "check"],
  rainfall: ["rain", "gauge"], precipitation: ["rain", "reflectivity"], bucket: ["tipping", "gauge"],
  handover: ["handover", "shift", "logbook"], hand: ["handover"], relieve: ["handover"],
  pressure: ["barometer", "pressure"], barometer: ["pressure"], msl: ["pressure", "height", "reduction"],
  temp: ["temperature"], screen: ["radiation", "screen", "stevenson"], stevenson: ["screen", "radiation"],
  alarm: ["alarm", "fault", "escalate"], fault: ["alarm", "fault"], restart: ["alarm", "transmitter"],
  thunderstorm: ["convection", "cumulonimbus", "cold"], cb: ["cumulonimbus", "convection"], storm: ["convection", "cyclone"],
  moisture: ["water", "vapour"], vapor: ["vapour"], dry: ["vapour", "dry"],
  fog: ["fog", "low", "cloud"], ir: ["infrared"], vis: ["visible"],
  cyclone: ["cyclone", "eye", "overcast"], monsoon: ["monsoon", "trough"],
  maintenance: ["maintenance", "log", "preventive"], log: ["log", "logbook"]
};

function stem(w) {
  if (w.length <= 4) return w;
  return w.replace(/(ations|ation|ings|ing|ies|es|ed|ly|s)$/, "");
}

export function tokenize(text) {
  return String(text).toLowerCase().normalize("NFKD")
    .split(/[^a-z0-9°]+/).filter(t => t && !STOP.has(t)).map(stem);
}

/** Build once per lesson. chapters: [{start, end, title, points, keywords, text}] */
export function buildIndex(chapters) {
  const docs = chapters.map((ch, i) => {
    const fields = [
      [tokenize(ch.title), 3],
      [tokenize((ch.keywords || []).join(" ")), 2.5],
      [tokenize((ch.points || []).join(" ")), 2],
      [tokenize(ch.text), 1]
    ];
    const tf = new Map();
    for (const [toks, w] of fields) for (const t of toks) tf.set(t, (tf.get(t) || 0) + w);
    return { i, ch, tf };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  return { docs, df, n: docs.length };
}

function expand(query) {
  const raw = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const terms = new Map();
  for (const r of raw) {
    if (!STOP.has(r)) terms.set(stem(r), Math.max(terms.get(stem(r)) || 0, 1));
    for (const s of SYNONYMS[r] || []) terms.set(stem(s), Math.max(terms.get(stem(s)) || 0, 0.6));
  }
  return terms;
}

/** Returns up to `limit` results: { chapterIndex, title, time, snippet, score } */
export function searchLesson(index, query, limit = 3) {
  const terms = expand(query);
  if (!terms.size) return [];
  const scored = index.docs.map(d => {
    let score = 0;
    for (const [t, w] of terms) {
      const idf = Math.log(1 + index.n / (index.df.get(t) || 0.5));
      let tf = d.tf.get(t) || 0;
      if (!tf && t.length >= 4) {                     // partial match: "calib" → "calibration"
        for (const [k, v] of d.tf) if (k.startsWith(t) || t.startsWith(k) && k.length >= 4) tf += v * 0.5;
      }
      score += w * idf * Math.log(1 + tf);
    }
    return { d, score };
  }).filter(x => x.score > 0.4).sort((a, b) => b.score - a.score).slice(0, limit);

  return scored.map(({ d, score }) => {
    const { time, sentence } = bestMoment(d.ch, terms);
    return { chapterIndex: d.i, title: d.ch.title, time, snippet: sentence, score };
  });
}

/* Pick the sentence with the most query hits and estimate when it's
   spoken, assuming steady narration across the chapter. */
function bestMoment(ch, terms) {
  const sentences = ch.text.match(/[^.!?]+[.!?]+/g) || [ch.text];
  const totalWords = ch.text.split(/\s+/).length;
  const sentToks = sentences.map(tokenize);
  const has = (toks, t) => toks.some(k => k === t || (t.length >= 4 && k.startsWith(t)));
  // A word that appears in few sentences is more telling than one in many.
  const spread = new Map([...terms.keys()].map(t => [t, sentToks.filter(toks => has(toks, t)).length || 1]));
  let best = { hits: -1, idx: 0 };
  sentToks.forEach((toks, idx) => {
    let hits = 0;
    // Words the officer typed count fully; synonyms only break ties.
    for (const [t, w] of terms) if (has(toks, t)) hits += (w === 1 ? 1 : 0.2) / spread.get(t);
    if (hits > best.hits) best = { hits, idx };
  });
  const wordsBefore = sentences.slice(0, best.idx).join(" ").split(/\s+/).filter(Boolean).length;
  const time = Math.floor(ch.start + (ch.end - ch.start) * (wordsBefore / totalWords));
  return { time, sentence: sentences[best.idx].trim() };
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
