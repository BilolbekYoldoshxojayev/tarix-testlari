"use strict";
// Tarix testlari — static quiz app. Data: data/index.json + data/<topic>.json

const $app = document.getElementById("app");
const KEY = "tarix-v1";
const LETTERS = ["A", "B", "C", "D"];
const EXAM_SIZES = [10, 20, 30];
const SEC_PER_Q = 60;

let INDEX = null;
const cache = {};
let session = null; // active quiz
let timerId = null;

// ---------- storage ----------
function load() {
  try { return Object.assign({ best: {}, wrong: {} }, JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return { best: {}, wrong: {} }; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
let store = load();

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const topic = (id) => INDEX.topics.find((t) => t.id === id);
const topicNo = (t) => INDEX.topics.filter((x) => x.book === t.book).indexOf(t) + 1;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

async function getTopic(id) {
  if (!cache[id]) {
    const r = await fetch(`data/${id}.json`);
    if (!r.ok) throw new Error(`data/${id}.json: ${r.status}`);
    cache[id] = (await r.json()).map((q, i) => ({ ...q, id: `${id}:${i}`, tid: id }));
  }
  return cache[id];
}

function updateMistCount() { document.getElementById("mistCount").textContent = Object.keys(store.wrong).length; }

// ---------- views ----------
function viewHome(book) {
  book = INDEX.books[book] ? book : "uz";
  const list = INDEX.topics.filter((t) => t.book === book);
  const total = list.reduce((n, t) => n + t.count, 0);
  $app.innerHTML = `
    <div class="tabs">${Object.entries(INDEX.books).map(([k, b]) =>
      `<button class="${k === book ? "on" : ""}" data-book="${k}">${esc(b.title)}</button>`).join("")}</div>
    <div class="card row" style="justify-content:space-between">
      <div><b>${esc(INDEX.books[book].title)}</b><div class="muted" style="font-size:14px">${list.length} mavzu · ${total} savol</div></div>
      <a class="btn primary" href="#/book/${book}">Aralash test</a>
    </div>
    <h2>Mavzular</h2>
    <ul class="topics">${list.map((t, i) => {
      const b = store.best[t.id];
      return `<li><a href="#/topic/${t.id}"><span class="num">${i + 1}</span>
        <span class="ttl">${esc(t.title)}<small>${t.count} savol · ${t.pages[0]}–${t.pages[1]}-betlar</small></span>
        <span class="best ${b >= 80 ? "good" : ""}">${b == null ? "" : b + "%"}</span></a></li>`;
    }).join("") || `<p class="muted">Savollar hali qo‘shilmagan.</p>`}</ul>`;
  $app.querySelectorAll("[data-book]").forEach((b) => b.onclick = () => { location.hash = `#/home/${b.dataset.book}`; });
}

function modePicker({ title, sub, back, total, start }) {
  const sizes = EXAM_SIZES.filter((n) => n < total);
  $app.innerHTML = `
    <a href="${back}">← Orqaga</a>
    <h1 style="margin-top:10px">${esc(title)}</h1>
    <p class="muted">${esc(sub)}</p>
    <div class="modes">
      <div class="card"><h3>Mashq</h3><p>Har bir javobdan keyin to‘g‘ri javob va izoh ko‘rsatiladi. Vaqt cheklanmagan.</p>
        <button class="primary" data-mode="practice" data-n="${total}">Barcha ${total} savol</button></div>
      <div class="card"><h3>Imtihon</h3><p>Tasodifiy savollar, har savolga ${SEC_PER_Q} soniya. Natija oxirida.</p>
        <div class="row">${[...sizes, total].map((n) =>
          `<button data-mode="exam" data-n="${n}">${n === total ? "Hammasi (" + n + ")" : n + " ta"}</button>`).join("")}</div></div>
    </div>`;
  $app.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => start(b.dataset.mode, +b.dataset.n));
}

async function viewTopic(id) {
  const t = topic(id);
  if (!t) return viewHome();
  modePicker({
    title: t.title, back: `#/home/${t.book}`, total: t.count,
    sub: `${INDEX.books[t.book].title} · ${topicNo(t)}-mavzu · ${t.pages[0]}–${t.pages[1]}-betlar`,
    start: async (mode, n) => startQuiz({ mode, title: t.title, back: `#/topic/${id}`, topicId: id,
      questions: shuffle(await getTopic(id)).slice(0, n) }),
  });
}

async function viewBook(book) {
  const list = INDEX.topics.filter((t) => t.book === book);
  if (!list.length) return viewHome();
  const total = list.reduce((n, t) => n + t.count, 0);
  modePicker({
    title: `${INDEX.books[book].title}: aralash test`, back: `#/home/${book}`, total,
    sub: `Barcha ${list.length} mavzudan tasodifiy savollar.`,
    start: async (mode, n) => {
      const all = (await Promise.all(list.map((t) => getTopic(t.id)))).flat();
      startQuiz({ mode, title: `${INDEX.books[book].title}: aralash`, back: `#/book/${book}`, questions: shuffle(all).slice(0, n) });
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
  const all = (await Promise.all(tids.map(getTopic))).flat();
  const qs = all.filter((q) => store.wrong[q.id]);
  modePicker({
    title: "Xatolar ustida ishlash", back: "#/", total: qs.length,
    sub: `Avval noto‘g‘ri javob berilgan ${qs.length} ta savol. To‘g‘ri javob berilgan savol ro‘yxatdan o‘chadi.`,
    start: (mode, n) => startQuiz({ mode, title: "Xatolar ustida ishlash", back: "#/mistakes", questions: shuffle(qs).slice(0, n) }),
  });
}

// ---------- quiz ----------
function startQuiz({ mode, title, back, topicId, questions }) {
  session = {
    mode, title, back, topicId, i: 0,
    items: questions.map((q) => ({ q, opts: shuffle([q.a, ...q.w]), pick: null })),
    left: mode === "exam" ? questions.length * SEC_PER_Q : 0,
  };
  clearInterval(timerId);
  if (mode === "exam") timerId = setInterval(tick, 1000);
  history.replaceState(null, "", "#/quiz");
  renderQ();
}

function tick() {
  if (!session || session.done) return clearInterval(timerId);
  session.left--;
  const el = document.querySelector(".timer");
  if (el) { el.textContent = fmtTime(Math.max(0, session.left)); el.classList.toggle("low", session.left <= 30); }
  if (session.left <= 0) finish();
}

function renderQ() {
  const s = session, it = s.items[s.i], n = s.items.length;
  const answered = it.pick !== null, practice = s.mode === "practice";
  const reveal = practice && answered;
  $app.innerHTML = `
    <div class="bar"><span>${esc(s.title)}</span>
      ${practice ? `<span>${s.items.filter((x) => x.pick === x.q.a).length} to‘g‘ri</span>` : `<span class="timer">${fmtTime(s.left)}</span>`}</div>
    <div class="bar"><span>Savol ${s.i + 1} / ${n}</span><button id="quit" style="padding:4px 10px;font-size:13px">Tugatish</button></div>
    <div class="progress"><i style="width:${(s.i + (answered ? 1 : 0)) / n * 100}%"></i></div>
    <p class="q">${esc(it.q.q)}</p>
    <div class="opts">${it.opts.map((o, k) => {
      let cls = "";
      if (reveal) cls = o === it.q.a ? "ok" : o === it.pick ? "bad" : "";
      else if (o === it.pick) cls = "sel";
      return `<button class="opt ${cls}" data-k="${k}" ${reveal ? "disabled" : ""}><span class="k">${LETTERS[k]}</span><span>${esc(o)}</span></button>`;
    }).join("")}</div>
    ${reveal ? `<div class="explain">${it.pick === it.q.a ? '<b class="ok">To‘g‘ri!</b>' : `<b class="bad">Noto‘g‘ri.</b> To‘g‘ri javob: <b>${esc(it.q.a)}</b>`}
      <div>${esc(it.q.e)}</div><small class="muted">Darslik, ${it.q.p}-bet</small></div>` : ""}
    <div class="nav">
      <button id="prev" ${s.i === 0 ? "disabled" : ""}>← Oldingi</button>
      ${s.i === n - 1
        ? `<button class="primary" id="fin" ${practice && !answered ? "disabled" : ""}>Yakunlash</button>`
        : `<button class="primary" id="next" ${practice && !answered ? "disabled" : ""}>Keyingi →</button>`}
    </div>`;
  $app.querySelectorAll(".opt").forEach((b) => b.onclick = () => {
    if (practice && answered) return;
    it.pick = it.opts[+b.dataset.k];
    if (practice) record(it);
    renderQ();
  });
  const go = (d) => { s.i += d; renderQ(); window.scrollTo(0, 0); };
  document.getElementById("prev").onclick = () => go(-1);
  const next = document.getElementById("next"); if (next) next.onclick = () => go(1);
  const fin = document.getElementById("fin"); if (fin) fin.onclick = finish;
  document.getElementById("quit").onclick = () => {
    if (confirm("Testni hozir yakunlaysizmi? Javob berilmagan savollar noto‘g‘ri hisoblanadi.")) finish();
  };
}

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
  if (s.topicId) store.best[s.topicId] = Math.max(store.best[s.topicId] || 0, pct);
  save(store); updateMistCount();
  const wrong = s.items.filter((x) => x.pick !== x.q.a);
  $app.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="muted">${esc(s.title)}</div>
      <div class="score">${pct}%</div>
      <div>${right} / ${n} to‘g‘ri</div>
      <div class="row" style="justify-content:center;margin-top:14px">
        <a class="btn primary" href="${s.back}">Yana ishlash</a><a class="btn" href="#/">Bosh sahifa</a></div>
    </div>
    ${wrong.length ? `<h2>Xatolar tahlili (${wrong.length})</h2><ul class="review">${wrong.map((x) => `<li>
      <b>${esc(x.q.q)}</b><br>
      ${x.pick === null ? '<span class="yours">Javob berilmagan</span>' : `<span class="yours">Sizning javobingiz: ${esc(x.pick)}</span>`}<br>
      <span class="right">To‘g‘ri javob: ${esc(x.q.a)}</span><br>
      <span>${esc(x.q.e)}</span> <small>(${x.q.p}-bet)</small></li>`).join("")}</ul>` : `<p style="text-align:center">Barcha javoblar to‘g‘ri! 🎉</p>`}`;
  window.scrollTo(0, 0);
}

// ---------- router ----------
function route() {
  if (session && !session.done && location.hash !== "#/quiz") {
    if (!confirm("Test tugallanmagan. Chiqib ketasizmi?")) { history.pushState(null, "", "#/quiz"); return; }
    clearInterval(timerId); session = null;
  }
  const [, view, arg] = location.hash.split("/");
  if (view === "quiz" && session && !session.done) return;
  ({ topic: viewTopic, book: viewBook, mistakes: viewMistakes, home: viewHome }[view] || viewHome)(arg);
  window.scrollTo(0, 0);
}

(async function init() {
  try {
    INDEX = await (await fetch("data/index.json")).json();
  } catch (e) {
    $app.innerHTML = `<p>Ma’lumotlarni yuklab bo‘lmadi. Sahifani yangilang.</p>`;
    return;
  }
  updateMistCount();
  window.addEventListener("hashchange", route);
  route();
})();
