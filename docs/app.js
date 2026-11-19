"use strict";
// Tarix testlari — static quiz app. Data: data/index.json + data/<topic>.json

const $app = document.getElementById("app");
const KEY = "tarix-v1";
const SESSION_KEY = "tarix-session";
const LETTERS = ["A", "B", "C", "D"];
const EXAM_SIZES = [10, 20, 30];
const SEC_PER_Q = 60;
const HISTORY_MAX = 500;

let INDEX = null;
const cache = {};
let session = null; // active quiz
let timerId = null;

// ---------- storage ----------
function blank() { return { best: {}, wrong: {}, history: [] }; }
function load() {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return blank(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} }
function saveSession() {
  try {
    if (session && !session.done) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}
function loadSession() {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY)); return s && !s.done && s.items?.length ? s : null; }
  catch { return null; }
}
function prefGet(k) { try { return sessionStorage.getItem("tarix-" + k); } catch { return null; } }
function prefSet(k, v) { try { sessionStorage.setItem("tarix-" + k, v); } catch {} }
let store = load();

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const topic = (id) => INDEX.topics.find((t) => t.id === id);
const topicsOf = (book) => INDEX.topics.filter((t) => t.book === book);
const topicNo = (t) => topicsOf(t.book).indexOf(t) + 1;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (ts) => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const pctClass = (p) => (p == null ? "" : p >= 80 ? "good" : p >= 50 ? "mid" : "low");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTopic(id) {
  if (!cache[id]) {
    const r = await fetch(`data/${id}.json`);
    if (!r.ok) throw new Error(`data/${id}.json: ${r.status}`);
    cache[id] = (await r.json()).map((q, i) => ({ ...q, id: `${id}:${i}`, tid: id }));
  }
  return cache[id];
}

function updateHeader() { document.getElementById("mistCount").textContent = Object.keys(store.wrong).length; }

function bookStats(book) {
  const list = topicsOf(book);
  const done = list.filter((t) => store.best[t.id] != null);
  const avg = done.length ? Math.round(done.reduce((s, t) => s + store.best[t.id], 0) / done.length) : null;
  const mastered = list.filter((t) => store.best[t.id] >= 80).length;
  return { list, done: done.length, avg, mastered, total: list.reduce((n, t) => n + t.count, 0) };
}

// ---------- views ----------
function resumeBanner() {
  const s = loadSession();
  if (!s) return "";
  const answered = s.items.filter((x) => x.pick !== null).length;
  return `<div class="card resume row">
    <div style="flex:1;min-width:180px"><b>Tugallanmagan test</b><div class="muted small">${esc(s.title)} · ${answered}/${s.items.length} javob</div></div>
    <button class="primary" id="resume">Davom ettirish</button><button id="drop">Bekor qilish</button></div>`;
}
function bindResume() {
  const r = document.getElementById("resume");
  if (!r) return;
  r.onclick = () => { session = loadSession(); if (!session) return route(); runSession(); };
  document.getElementById("drop").onclick = () => { localStorage.removeItem(SESSION_KEY); route(); };
}

function viewHome(book) {
  book = INDEX.books[book] ? book : (INDEX.books[prefGet("book")] ? prefGet("book") : "uz");
  prefSet("book", book);
  const st = bookStats(book);
  $app.innerHTML = `
    ${resumeBanner()}
    <div class="tabs" role="tablist">${Object.entries(INDEX.books).map(([k, b]) =>
      `<button role="tab" aria-selected="${k === book}" class="${k === book ? "on" : ""}" data-book="${k}">${esc(b.title)}</button>`).join("")}</div>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div><b>${esc(INDEX.books[book].title)}</b><div class="muted small">${st.list.length} mavzu · ${st.total} savol</div></div>
        <a class="btn primary" href="#/book/${book}">Aralash test</a>
      </div>
      <div class="meter" title="O‘zlashtirilgan mavzular (≥80%)"><i style="width:${st.mastered / st.list.length * 100}%"></i></div>
      <div class="muted small">${st.mastered}/${st.list.length} mavzu o‘zlashtirildi (≥80%) · ${st.done} mavzu ishlangan${st.avg != null ? ` · o‘rtacha ${st.avg}%` : ""}</div>
    </div>
    <h2>Mavzular</h2>
    <ul class="topics">${st.list.map((t, i) => {
      const b = store.best[t.id];
      return `<li><a href="#/topic/${t.id}"><span class="num ${pctClass(b)}">${i + 1}</span>
        <span class="ttl">${esc(t.title)}<small>${t.count} savol · ${t.pages[0]}–${t.pages[1]}-betlar</small></span>
        <span class="best ${pctClass(b)}">${b == null ? "" : b + "%"}</span></a></li>`;
    }).join("")}</ul>`;
  $app.querySelectorAll("[data-book]").forEach((b) => b.onclick = () => { location.hash = `#/home/${b.dataset.book}`; });
  bindResume();
}

function modePicker({ title, sub, back, total, start, extra = "" }) {
  const sizes = EXAM_SIZES.filter((n) => n < total);
  $app.innerHTML = `
    <a href="${back}">← Orqaga</a>
    <h1 style="margin-top:10px">${esc(title)}</h1>
    <p class="muted">${esc(sub)}</p>
    ${extra}
    <div class="modes">
      <div class="card"><h3>Mashq</h3><p>Har bir javobdan keyin to‘g‘ri javob va izoh ko‘rsatiladi. Vaqt cheklanmagan.</p>
        <button class="primary" data-mode="practice" data-n="${total}">Barcha ${total} savol</button></div>
      <div class="card"><h3>Imtihon</h3><p>Tasodifiy savollar, har savolga ${SEC_PER_Q} soniya. Natija oxirida.</p>
        <div class="row">${[...sizes, total].map((n) =>
          `<button data-mode="exam" data-n="${n}">${n === total ? "Hammasi (" + n + ")" : n + " ta"}</button>`).join("")}</div></div>
    </div>`;
  $app.querySelectorAll("[data-mode]").forEach((b) => b.onclick = async () => {
    $app.querySelectorAll("[data-mode]").forEach((x) => x.disabled = true);
    try { await start(b.dataset.mode, +b.dataset.n); }
    catch {
      $app.querySelectorAll("[data-mode]").forEach((x) => x.disabled = false);
      $app.insertAdjacentHTML("beforeend", `<p class="bad-text">Savollarni yuklab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.</p>`);
    }
  });
}

function viewTopic(id) {
  const t = topic(id);
  if (!t) return viewHome();
  const hist = store.history.filter((h) => h.kind === "topic" && h.ref === id).slice(-5).reverse();
  modePicker({
    title: t.title, back: `#/home/${t.book}`, total: t.count,
    sub: `${INDEX.books[t.book].title} · ${topicNo(t)}-mavzu · ${t.pages[0]}–${t.pages[1]}-betlar`,
    extra: store.best[id] != null ? `<div class="card small"><b>Eng yaxshi natija: ${store.best[id]}%</b>
      ${hist.length ? `<div class="muted">So‘nggi urinishlar: ${hist.map((h) => `<span class="chip ${pctClass(h.pct)}">${h.pct}%</span>`).join(" ")}</div>` : ""}</div>` : "",
    start: async (mode, n) => startQuiz({ mode, kind: "topic", ref: id, title: t.title, back: `#/topic/${id}`,
      questions: shuffle(await getTopic(id)).slice(0, n) }),
  });
}

function viewBook(book) {
  const list = topicsOf(book);
  if (!list.length) return viewHome();
  const total = list.reduce((n, t) => n + t.count, 0);
  modePicker({
    title: `${INDEX.books[book].title}: aralash test`, back: `#/home/${book}`, total,
    sub: `Barcha ${list.length} mavzudan tasodifiy savollar.`,
    start: async (mode, n) => {
      const all = (await Promise.all(list.map((t) => getTopic(t.id)))).flat();
      startQuiz({ mode, kind: "book", ref: book, title: `${INDEX.books[book].title}: aralash`, back: `#/book/${book}`, questions: shuffle(all).slice(0, n) });
    },
  });
}

async function viewMistakes() {
  const ids = Object.keys(store.wrong);
  if (!ids.length) {
    $app.innerHTML = `<a href="#/">← Bosh sahifa</a><h1 style="margin-top:10px">Xatolarim</h1>
      <p class="muted">Hozircha xato javoblar yo‘q. Test ishlang — noto‘g‘ri javob berilgan savollar shu yerda to‘planadi va to‘g‘ri javob berilganda o‘chiriladi.</p>`;
    return;
  }
  const tids = [...new Set(ids.map((k) => k.split(":")[0]))].filter(topic);
  let all;
  try { all = (await Promise.all(tids.map(getTopic))).flat(); }
  catch { $app.innerHTML = `<p>Savollarni yuklab bo‘lmadi. Internetni tekshirib, sahifani yangilang.</p>`; return; }
  const qs = all.filter((q) => store.wrong[q.id]);
  const byTopic = tids.map((id) => [topic(id), qs.filter((q) => q.tid === id).length]).filter(([, n]) => n);
  modePicker({
    title: "Xatolar ustida ishlash", back: "#/", total: qs.length,
    sub: `Avval noto‘g‘ri javob berilgan ${qs.length} ta savol. To‘g‘ri javob berilgan savol ro‘yxatdan o‘chadi.`,
    extra: `<div class="card small">${byTopic.map(([t, n]) =>
      `<div class="row between"><span>${esc(INDEX.books[t.book].title)}, ${topicNo(t)}-mavzu: ${esc(t.title)}</span><b>${n}</b></div>`).join("")}</div>`,
    start: (mode, n) => startQuiz({ mode, kind: "mistakes", ref: "", title: "Xatolar ustida ishlash", back: "#/mistakes", questions: shuffle(qs).slice(0, n) }),
  });
}

function viewStats() {
  const h = store.history;
  const answered = h.reduce((s, x) => s + x.n, 0), right = h.reduce((s, x) => s + x.right, 0);
  $app.innerHTML = `
    <a href="#/">← Bosh sahifa</a>
    <h1 style="margin-top:10px">Natijalarim</h1>
    <div class="stats">
      <div class="card"><div class="big">${h.length}</div><div class="muted small">test ishlangan</div></div>
      <div class="card"><div class="big">${answered}</div><div class="muted small">savolga javob</div></div>
      <div class="card"><div class="big">${answered ? Math.round(right / answered * 100) + "%" : "—"}</div><div class="muted small">umumiy aniqlik</div></div>
      <div class="card"><div class="big">${Object.keys(store.wrong).length}</div><div class="muted small">xato navbatda</div></div>
    </div>
    ${Object.keys(INDEX.books).map((b) => { const st = bookStats(b); return `<h2>${esc(INDEX.books[b].title)}</h2>
      <div class="card">
        <div class="meter"><i style="width:${st.mastered / st.list.length * 100}%"></i></div>
        <div class="muted small" style="margin-bottom:10px">${st.mastered}/${st.list.length} mavzu o‘zlashtirildi · ${st.done} ishlangan${st.avg != null ? ` · o‘rtacha ${st.avg}%` : ""}</div>
        <div class="grid">${st.list.map((t, i) => {
          const p = store.best[t.id];
          return `<a href="#/topic/${t.id}" class="cell ${pctClass(p)}" title="${esc(t.title)}">${i + 1}<small>${p == null ? "—" : p + "%"}</small></a>`;
        }).join("")}</div>
      </div>`; }).join("")}
    <h2>Urinishlar tarixi</h2>
    ${h.length ? `<ul class="review">${h.slice(-50).reverse().map((x) => `<li class="row between">
      <span><b>${esc(x.title)}</b><br><small class="muted">${fmtDate(x.t)} · ${x.mode === "exam" ? "Imtihon" : "Mashq"} · ${x.right}/${x.n}${x.sec ? " · " + fmtTime(x.sec) : ""}</small></span>
      <span class="best ${pctClass(x.pct)}">${x.pct}%</span></li>`).join("")}</ul>`
      : `<p class="muted">Hali test ishlanmagan.</p>`}
    <h2>Natijalarni saqlash</h2>
    <div class="card small">
      <p class="muted" style="margin-top:0">Natijalar shu brauzerda avtomatik saqlanadi. Boshqa qurilmaga o‘tkazish yoki zaxira nusxa olish uchun faylga yuklab oling.</p>
      <div class="row">
        <button id="exp">⬇ Faylga saqlash</button>
        <label class="btn">⬆ Fayldan tiklash<input type="file" id="imp" accept=".json,application/json" hidden></label>
        <button id="reset" class="danger">Hammasini o‘chirish</button>
      </div>
    </div>`;
  document.getElementById("exp").onclick = exportData;
  document.getElementById("imp").onchange = importData;
  document.getElementById("reset").onclick = () => {
    if (!confirm("Barcha natijalar, xatolar va tarix o‘chiriladi. Davom etasizmi?")) return;
    store = blank(); save(); updateHeader(); viewStats();
  };
}

function exportData() {
  const blob = new Blob([JSON.stringify({ app: "tarix-testlari", v: 1, data: store })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tarix-natijalar-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(e) {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const d = j && j.app === "tarix-testlari" ? j.data : null;
    if (!d || typeof d.best !== "object" || typeof d.wrong !== "object") throw new Error("format");
    if (!confirm("Fayldagi natijalar joriy natijalar bilan birlashtiriladi. Davom etasizmi?")) return;
    for (const [k, v] of Object.entries(d.best)) if (typeof v === "number") store.best[k] = Math.max(store.best[k] || 0, v);
    for (const k of Object.keys(d.wrong)) store.wrong[k] = 1;
    const seen = new Set(store.history.map((x) => x.t));
    const add = Array.isArray(d.history) ? d.history.filter((x) => x && typeof x.t === "number" && typeof x.pct === "number" && !seen.has(x.t)) : [];
    store.history = [...store.history, ...add].sort((a, b) => a.t - b.t).slice(-HISTORY_MAX);
    save(); updateHeader(); viewStats();
    alert("Natijalar tiklandi.");
  } catch {
    alert("Fayl noto‘g‘ri. Faqat shu saytdan yuklab olingan natijalar faylini tanlang.");
  }
}

// ---------- quiz ----------
function startQuiz({ mode, kind, ref, title, back, questions }) {
  session = {
    mode, kind, ref, title, back, i: 0, startAt: Date.now(),
    endAt: mode === "exam" ? Date.now() + questions.length * SEC_PER_Q * 1000 : 0,
    items: questions.map((q) => ({ q, opts: shuffle([q.a, ...q.w]), pick: null })),
  };
  runSession();
}

function runSession() {
  clearInterval(timerId);
  history.replaceState(null, "", "#/quiz");
  if (session.mode === "exam") {
    if (Date.now() >= session.endAt) return finish();
    timerId = setInterval(tick, 1000);
  }
  saveSession();
  renderQ();
}

const secondsLeft = () => Math.max(0, Math.round((session.endAt - Date.now()) / 1000));

function tick() {
  if (!session || session.done) return clearInterval(timerId);
  const left = secondsLeft();
  const el = document.querySelector(".timer");
  if (el) { el.textContent = "⏱ " + fmtTime(left); el.classList.toggle("low", left <= 30); }
  if (left <= 0) finish();
}

function renderQ() {
  const s = session, it = s.items[s.i], n = s.items.length;
  const answered = it.pick !== null, practice = s.mode === "practice";
  const reveal = practice && answered;
  const done = s.items.filter((x) => x.pick !== null).length;
  const nRight = s.items.filter((x) => x.pick === x.q.a).length;
  $app.innerHTML = `
    <div class="bar"><span class="ellipsis">${esc(s.title)}</span>
      ${practice ? `<span><b class="ok-text">${nRight}</b> to‘g‘ri · <b class="bad-text">${done - nRight}</b> xato</span>`
        : `<span class="timer">⏱ ${fmtTime(secondsLeft())}</span>`}</div>
    <div class="bar"><span>Savol ${s.i + 1} / ${n}${practice ? "" : ` · ${done} javob berildi`}</span><button id="quit" class="tiny">Tugatish</button></div>
    <div class="progress"><i style="width:${(practice ? done : s.i + 1) / n * 100}%"></i></div>
    <p class="q">${esc(it.q.q)}</p>
    <div class="opts">${it.opts.map((o, k) => {
      let cls = "";
      if (reveal) cls = o === it.q.a ? "ok" : o === it.pick ? "bad" : "";
      else if (o === it.pick) cls = "sel";
      return `<button class="opt ${cls}" data-k="${k}" ${reveal ? "disabled" : ""}><span class="k">${LETTERS[k]}</span><span>${esc(o)}</span></button>`;
    }).join("")}</div>
    ${reveal ? `<div class="explain" role="status">${it.pick === it.q.a ? '<b class="ok-text">To‘g‘ri!</b>' : `<b class="bad-text">Noto‘g‘ri.</b> To‘g‘ri javob: <b>${esc(it.q.a)}</b>`}
      <div>${esc(it.q.e)}</div><small class="muted">Darslik, ${it.q.p}-bet</small></div>` : ""}
    <div class="nav">
      <button id="prev" ${s.i === 0 ? "disabled" : ""}>← Oldingi</button>
      ${s.i === n - 1
        ? `<button class="primary" id="fin" ${practice && !answered ? "disabled" : ""}>Yakunlash</button>`
        : `<button class="primary" id="next" ${practice && !answered ? "disabled" : ""}>Keyingi →</button>`}
    </div>
    ${practice ? "" : `<div class="qnav" aria-label="Savollar">${s.items.map((x, k) =>
      `<button data-go="${k}" class="${k === s.i ? "cur" : ""} ${x.pick !== null ? "done" : ""}" aria-label="${k + 1}-savol">${k + 1}</button>`).join("")}</div>`}
    <p class="hint muted small">Klaviatura: 1–4 yoki A–D — javob, Enter / → — keyingi, ← — oldingi</p>`;
  $app.querySelectorAll(".opt").forEach((b) => b.onclick = () => choose(+b.dataset.k));
  $app.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => go(+b.dataset.go - s.i));
  document.getElementById("prev").onclick = () => go(-1);
  const next = document.getElementById("next"); if (next) next.onclick = () => go(1);
  const fin = document.getElementById("fin"); if (fin) fin.onclick = finishAsk;
  document.getElementById("quit").onclick = () => {
    if (confirm("Testni hozir yakunlaysizmi? Javob berilmagan savollar noto‘g‘ri hisoblanadi.")) finish();
  };
}

function choose(k) {
  const s = session, it = s.items[s.i];
  if (s.mode === "practice" && it.pick !== null) return;
  it.pick = it.opts[k];
  if (s.mode === "practice") { record(it); save(); updateHeader(); }
  saveSession();
  renderQ();
}

function go(d) {
  const s = session, j = s.i + d;
  if (j < 0 || j >= s.items.length) return;
  if (s.mode === "practice" && d > 0 && s.items[s.i].pick === null) return;
  s.i = j; saveSession(); renderQ(); window.scrollTo(0, 0);
}

function finishAsk() {
  const left = session.items.filter((x) => x.pick === null).length;
  if (left && !confirm(`${left} ta savolga javob berilmagan. Baribir yakunlaysizmi?`)) return;
  finish();
}

document.addEventListener("keydown", (e) => {
  if (!session || session.done || location.hash !== "#/quiz" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest("button") && e.key === "Enter") return; // let focused buttons act
  const k = e.key.toLowerCase();
  const idx = k.length === 1 ? Math.max("1234".indexOf(k), "abcd".indexOf(k)) : -1;
  if (idx >= 0) { choose(idx); e.preventDefault(); }
  else if (k === "arrowright" || k === "enter") {
    if (session.i === session.items.length - 1) { if (session.mode === "exam" || session.items[session.i].pick !== null) finishAsk(); }
    else go(1);
    e.preventDefault();
  } else if (k === "arrowleft") { go(-1); e.preventDefault(); }
});

function record(it) {
  if (it.pick === it.q.a) delete store.wrong[it.q.id];
  else store.wrong[it.q.id] = 1;
}

function finish() {
  const s = session;
  if (!s || s.done) return;
  s.done = true;
  clearInterval(timerId);
  if (s.mode === "exam") s.items.forEach((it) => { if (it.pick !== null) record(it); else store.wrong[it.q.id] = 1; });
  const right = s.items.filter((x) => x.pick === x.q.a).length, n = s.items.length;
  const pct = Math.round(right / n * 100);
  const sec = Math.round((Math.min(Date.now(), s.endAt || Infinity) - s.startAt) / 1000);
  const prevBest = s.kind === "topic" ? store.best[s.ref] : undefined;
  if (s.kind === "topic") store.best[s.ref] = Math.max(prevBest || 0, pct);
  store.history.push({ t: Date.now(), kind: s.kind, ref: s.ref, title: s.title, mode: s.mode, right, n, pct, sec });
  if (store.history.length > HISTORY_MAX) store.history = store.history.slice(-HISTORY_MAX);
  save(); saveSession(); updateHeader();
  const wrong = s.items.filter((x) => x.pick !== x.q.a);
  const isRecord = s.kind === "topic" && prevBest != null && pct > prevBest;
  const verdict = pct >= 90 ? "A’lo! 🎉" : pct >= 70 ? "Yaxshi natija!" : pct >= 50 ? "Yomon emas — xatolar ustida ishlang." : "Mavzuni qayta o‘qib chiqing va yana urinib ko‘ring.";
  $app.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="muted">${esc(s.title)} · ${s.mode === "exam" ? "Imtihon" : "Mashq"}</div>
      <div class="ring ${pctClass(pct)}" style="--p:${pct}"><span>${pct}%</span></div>
      <div><b>${right} / ${n}</b> to‘g‘ri · ${fmtTime(sec)}</div>
      <div style="margin-top:6px">${verdict}${isRecord ? ` <span class="chip good">Yangi rekord! (avval ${prevBest}%)</span>` : ""}</div>
      <div class="row" style="justify-content:center;margin-top:16px">
        ${wrong.length ? `<button class="primary" id="redo">Xatolarni qayta ishlash (${wrong.length})</button>` : ""}
        <a class="btn ${wrong.length ? "" : "primary"}" href="${s.back}">Yana ishlash</a>
        <button id="share">Ulashish</button>
        <a class="btn" href="#/">Bosh sahifa</a>
      </div>
    </div>
    ${wrong.length ? `<h2>Xatolar tahlili (${wrong.length})</h2><ul class="review">${wrong.map((x) => `<li>
      <b>${esc(x.q.q)}</b><br>
      ${x.pick === null ? '<span class="bad-text">Javob berilmagan</span>' : `<span class="bad-text">Sizning javobingiz: ${esc(x.pick)}</span>`}<br>
      <span class="ok-text">To‘g‘ri javob: ${esc(x.q.a)}</span><br>
      <span>${esc(x.q.e)}</span> <small class="muted">(${x.q.p}-bet)</small></li>`).join("")}</ul>` : `<p style="text-align:center">Barcha javoblar to‘g‘ri! 🎉</p>`}`;
  const redo = document.getElementById("redo");
  if (redo) redo.onclick = () => startQuiz({ mode: "practice", kind: "mistakes", ref: "", title: "Xatolarni qayta ishlash", back: s.back, questions: shuffle(wrong.map((x) => x.q)) });
  document.getElementById("share").onclick = async () => {
    const text = `📜 Tarix testlari — ${s.title}\n${s.mode === "exam" ? "Imtihon" : "Mashq"}: ${right}/${n} (${pct}%)\n${location.origin + location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); alert("Natija nusxalandi — Telegramga joylashingiz mumkin."); }
    } catch {}
  };
  window.scrollTo(0, 0);
}

// ---------- router ----------
function route() {
  if (session && !session.done && location.hash !== "#/quiz") {
    // Leaving an unfinished quiz keeps it resumable from the home page.
    clearInterval(timerId); session = null;
  }
  const [, view, arg] = location.hash.split("/");
  if (view === "quiz" && session && !session.done) return;
  ({ topic: viewTopic, book: viewBook, mistakes: viewMistakes, stats: viewStats, home: viewHome }[view] || viewHome)(arg);
  window.scrollTo(0, 0);
}

(async function init() {
  for (let attempt = 0; attempt < 3 && !INDEX; attempt++) {
    try { const r = await fetch("data/index.json"); if (r.ok) INDEX = await r.json(); }
    catch {}
    if (!INDEX) await sleep(800);
  }
  if (!INDEX) {
    $app.innerHTML = `<p>Ma’lumotlarni yuklab bo‘lmadi. Internetni tekshirib, sahifani yangilang.</p>`;
    return;
  }
  updateHeader();
  window.addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
