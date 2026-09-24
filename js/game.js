/* =========================================================================
   اكتشف وطنك مع رجا — منطق اللعبة
   نسخة محلية بالكامل: لا حسابات ولا سحابة. بنك الأسئلة جاهز في questions.js
   ========================================================================= */

'use strict';

/* ============================= الأصوات ============================= */
const Sound = (function () {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('nd_muted') === '1'; } catch (e) { /* التخزين معطّل */ }

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gainVal) {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + start);
      gain.gain.setValueAtTime(0, c.currentTime + start);
      gain.gain.linearRampToValueAtTime(gainVal || 0.15, c.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + dur + 0.02);
    } catch (e) {
      /* الصوت غير متاح — اللعبة تكمل بدونه */
    }
  }

  return {
    get muted() { return muted; },
    setMuted(v) {
      muted = !!v;
      try { localStorage.setItem('nd_muted', muted ? '1' : '0'); } catch (e) { /* التخزين معطّل */ }
    },
    click()  { tone(520, 0, 0.08, 'triangle', 0.12); },
    select() { tone(440, 0, 0.06, 'square', 0.06); },
    open()   { tone(420, 0, 0.09, 'sine', 0.10); tone(620, 0.07, 0.12, 'sine', 0.10); },
    reveal() { tone(740, 0, 0.10, 'sine', 0.12); tone(990, 0.08, 0.16, 'sine', 0.12); },
    award()  { tone(523, 0, 0.12, 'triangle', 0.14); tone(659, 0.10, 0.12, 'triangle', 0.14); tone(784, 0.20, 0.22, 'triangle', 0.16); },
    skip()   { tone(300, 0, 0.12, 'sine', 0.10); tone(220, 0.10, 0.18, 'sine', 0.10); },
    start()  { tone(392, 0, 0.10, 'triangle', 0.12); tone(494, 0.10, 0.10, 'triangle', 0.12); tone(587, 0.20, 0.10, 'triangle', 0.12); tone(784, 0.30, 0.25, 'triangle', 0.16); },
    win()    { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.3, 'triangle', 0.15)); },
  };
})();

/* ============================= أدوات ============================= */
const $ = (id) => document.getElementById(id);

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---- الأرقام والعدد ----
   كل رقم يظهر للاعبين بالأرقام العربية، وتمييزه يتبع صيغة العدد:
   واحد · اثنان · ٣-١٠ جمع · ١١ فما فوق مفرد منصوب. */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n ?? '').replace(/-/g, '−').replace(/[0-9]/g, d => AR_DIGITS[+d]);

// forms = [صفر, مفرد, مثنى, جمع (٣-١٠), تمييز (١١+)]
function arCount(n, forms) {
  const v = Math.abs(Math.trunc(Number(n) || 0));
  if (v === 0) return forms[0];
  if (v === 1) return forms[1];
  if (v === 2) return forms[2];
  return `${ar(v)} ${v <= 10 ? forms[3] : forms[4]}`;
}

const Q_FORMS = ['بلا أسئلة', 'سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالاً'];
const CAT_FORMS = ['بلا فئات', 'فئة واحدة', 'فئتان', 'فئات', 'فئة'];
const qCount = (n) => arCount(n, Q_FORMS);
const catCount = (n) => arCount(n, CAT_FORMS);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = $(id);
  if (s) { s.classList.add('active'); window.scrollTo(0, 0); }
}

/* ---- نوافذ التنبيه والتأكيد ---- */
function modalClose() {
  $('modal').classList.remove('show');
  $('modalActions').innerHTML = '';
}

function uiAlert(message) {
  return new Promise(resolve => {
    $('modalText').innerHTML = escapeHtml(message).replace(/\n/g, '<br>');
    const actions = $('modalActions');
    actions.innerHTML = '';
    const ok = document.createElement('button');
    ok.className = 'btn-main btn-primary';
    ok.textContent = 'تمام';
    ok.onclick = () => { modalClose(); resolve(true); };
    actions.appendChild(ok);
    $('modal').classList.add('show');
    ok.focus();
  });
}

function uiConfirm(message) {
  return new Promise(resolve => {
    $('modalText').innerHTML = escapeHtml(message).replace(/\n/g, '<br>');
    const actions = $('modalActions');
    actions.innerHTML = '';

    const no = document.createElement('button');
    no.className = 'btn-main btn-ghost';
    no.textContent = 'إلغاء';
    no.onclick = () => { modalClose(); resolve(false); };

    const yes = document.createElement('button');
    yes.className = 'btn-main btn-primary';
    yes.textContent = 'أكيد';
    yes.onclick = () => { modalClose(); resolve(true); };

    actions.appendChild(no);
    actions.appendChild(yes);
    $('modal').classList.add('show');
    yes.focus();
  });
}

/* ============================= الثوابت ============================= */
const DIFFKEY = ['easy', 'medium', 'hard'];
const DIFFNAME = ['سهل', 'متوسط', 'صعب'];
const QTIMER_SECONDS = 60;

/* ============================= التخزين =============================
   البنك الأصلي في questions.js، وتعديلات لوحة الإدارة تُحفظ هنا فقط.
   المفاتيح مسبوقة بـ nd_ حتى لا تختلط ببيانات ألعاب أخرى على نفس المتصفح.
*/
const K_CATS = 'nd_categories';
const K_BANK = 'nd_bank';
const K_POINTS = 'nd_points';

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    uiAlert('⚠️ ما قدرت أحفظ — يمكن مساحة المتصفح ممتلئة أو التخزين معطّل.');
    return false;
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v));

let CATEGORIES = loadJSON(K_CATS, null);
let QBANK = loadJSON(K_BANK, null);
let POINTS = loadJSON(K_POINTS, null);

if (!Array.isArray(CATEGORIES)) CATEGORIES = clone(DEFAULT_CATEGORIES);
if (!QBANK || typeof QBANK !== 'object') QBANK = clone(DEFAULT_QBANK);
if (!Array.isArray(POINTS) || POINTS.length !== 3) POINTS = [100, 250, 400];

/* ---- أسماء فئات أصلية تغيّرت ----
   البنك المحفوظ يحمل الاسم القديم، فنبدّله فقط لو ما عدّله صاحب الجهاز. */
const RENAMED_DEFAULTS = { turath: { from: 'تراث وفلكلور', to: 'تراث' } };
(function renameOldDefaults() {
  let changed = false;
  CATEGORIES.forEach(c => {
    const r = RENAMED_DEFAULTS[c.id];
    if (r && c.name === r.from) { c.name = r.to; changed = true; }
  });
  if (changed) saveJSON(K_CATS, CATEGORIES);
})();

/* ---- فئات أصلية تُضاف مع تحديثات اللعبة ----
   البنك المحفوظ يتقدّم على الأصل، فمن عنده بنك محفوظ ما يشوف فئة أُضيفت
   للأصل بعدين. كل فئة أصلية لم تمرّ على هذا المتصفح تُدمج مرة واحدة —
   ولو حذفها صاحب الجهاز بعدها ما ترجع (المفتاح nd_seen_defaults).
   ولو كان أنشأ فئة بنفس الموضوع، نعبّي فئته هو بدل ما نكرّرها. */
const K_SEEN = 'nd_seen_defaults';
const FIRST_DEFAULTS = ['tawheed', 'rumooz', 'jugh', 'mulook', 'ru2ya', 'turath'];

function normName(s) {
  return String(s || '')
    .replace(/[ً-ٰٟـ]/g, '')   // تشكيل وتطويل
    .replace(/[^ء-يa-z0-9]/gi, '')
    .replace(/^ال/, '');
}

(function mergeNewDefaults() {
  const hasSaved = Array.isArray(loadJSON(K_CATS, null));
  let seen = loadJSON(K_SEEN, null);
  if (!Array.isArray(seen)) {
    // أول تشغيل بعد التحديث: البنك المحفوظ شاف فئات الإصدار الأول فقط
    seen = hasSaved ? FIRST_DEFAULTS.slice() : DEFAULT_CATEGORIES.map(c => c.id);
  }

  let changed = false;

  DEFAULT_CATEGORIES.forEach(def => {
    if (seen.includes(def.id)) return;
    seen.push(def.id);
    if (CATEGORIES.some(c => c.id === def.id)) return;

    const key = normName(def.name);
    const twin = CATEGORIES.find(c => {
      const n = normName(c.name);
      return n && (n.includes(key) || (n.length >= 6 && key.includes(n)));
    });
    const src = DEFAULT_QBANK[def.id] || {};

    if (twin) {
      if (!QBANK[twin.id] || typeof QBANK[twin.id] !== 'object') QBANK[twin.id] = {};
      DIFFKEY.forEach(k => {
        if (!Array.isArray(QBANK[twin.id][k])) QBANK[twin.id][k] = [];
        const bucket = QBANK[twin.id][k];
        (src[k] || []).forEach(item => {
          if (!bucket.some(x => normName(x.q) === normName(item.q))) bucket.push(clone(item));
        });
      });
    } else {
      CATEGORIES.push(clone(def));
      QBANK[def.id] = clone(src);
    }
    changed = true;
  });

  saveJSON(K_SEEN, seen);
  if (changed && hasSaved) {
    saveJSON(K_CATS, CATEGORIES);
    saveJSON(K_BANK, QBANK);
  }
})();

/* ---- أسئلة أصلية تُضاف لفئات موجودة ----
   السؤال الذي يحمل since: N يُدمج مرة واحدة في البنك المحفوظ الأقدم من الإصدار N
   (المفتاح nd_bank_version)، ولو حذفه صاحب الجهاز بعدها ما يرجع. */
const K_BANK_VER = 'nd_bank_version';

(function mergeNewQuestions() {
  const hasSaved = !!loadJSON(K_BANK, null);
  const ver = Number(loadJSON(K_BANK_VER, 0)) || (hasSaved ? 1 : DEFAULT_BANK_VERSION);
  if (ver >= DEFAULT_BANK_VERSION) {
    if (!hasSaved) saveJSON(K_BANK_VER, DEFAULT_BANK_VERSION);
    return;
  }

  let changed = false;
  Object.keys(DEFAULT_QBANK).forEach(id => {
    const cat = QBANK[id];
    if (!cat || typeof cat !== 'object') return;   // فئة محذوفة أو لم تُدمج
    DIFFKEY.forEach(k => {
      (DEFAULT_QBANK[id][k] || []).forEach(item => {
        if (!(item.since > ver)) return;
        if (!Array.isArray(cat[k])) cat[k] = [];
        if (cat[k].some(x => normName(x.q) === normName(item.q))) return;
        cat[k].push(clone(item));
        changed = true;
      });
    });
  });

  saveJSON(K_BANK_VER, DEFAULT_BANK_VERSION);
  if (changed) saveJSON(K_BANK, QBANK);
})();

/* ============================= الحالة ============================= */
let teamSetup = {
  A: { name: 'الفريق الأول' },
  B: { name: 'الفريق الثاني' },
};

let selectedCats = [];      // الفئات المختارة لهذه الجولة
let boardCats = [];         // فئات اللوحة الحالية
let stateUsed = [];         // [ci][row] = مستخدَمة؟
let questionCache = {};     // السؤال المسحوب لكل خانة حتى لا يتغيّر عند إعادة الفتح
let scores = { A: 0, B: 0 };
let current = null;         // { ci, row, cat }
let activeTeam = null;      // صاحب الدور
let qTimer = null;
let undoStack = [];         // { ci, row, team, pts, cat, turn } لكل سؤال انحسب — للتراجع

/* ---- حفظ الجولة الجارية ----
   تُحفظ بعد كل تغيير، فلو تحدّثت الصفحة أو انقفل المتصفح ترجع من الرئيسية.
   السؤال المفتوح لحظتها ما يُحفظ — يرجع للوحة ويُفتح من جديد. */
const K_GAME = 'nd_game';
const HISTORY_MAX = 30;

function saveGame() {
  try {
    localStorage.setItem(K_GAME, JSON.stringify({
      teamSetup, boardCats, stateUsed, questionCache, scores, activeTeam, undoStack,
    }));
  } catch (e) { /* التخزين ممتلئ أو معطّل — اللعبة تكمل بدون حفظ */ }
}

function clearSavedGame() {
  try { localStorage.removeItem(K_GAME); } catch (e) { /* التخزين معطّل */ }
}

function loadSavedGame() {
  const g = loadJSON(K_GAME, null);
  if (!g || !Array.isArray(g.boardCats) || !Array.isArray(g.stateUsed) || !g.scores) return null;
  if (g.stateUsed.length !== g.boardCats.length) return null;
  if (g.stateUsed.every(col => col.every(Boolean))) return null;   // جولة منتهية
  return g;
}

function resumeGame() {
  const g = loadSavedGame();
  if (!g) { renderResumeButton(); return; }
  Sound.start();
  teamSetup = g.teamSetup || teamSetup;
  boardCats = g.boardCats;
  stateUsed = g.stateUsed;
  questionCache = g.questionCache || {};
  scores = g.scores;
  activeTeam = g.activeTeam === 'B' ? 'B' : 'A';
  // جولات محفوظة من الإصدار السابق كانت تحفظ لقطات كاملة — ما تنفع للتراجع الجديد
  undoStack = Array.isArray(g.undoStack) ? g.undoStack.filter(u => Number.isInteger(u.ci)) : [];
  current = null;
  updateGameUI();
  renderBoard();
  showScreen('screen-game');
}

function renderResumeButton() {
  const g = loadSavedGame();
  $('resumeBox').hidden = !g;
  // زر أخضر واحد بارز: «كمّل» لو فيه جولة، وإلا «لعبة جديدة»
  $('btnNewGame').classList.toggle('btn-primary', !g);
  $('btnNewGame').classList.toggle('btn-secondary', !!g);
  if (!g) return;
  const name = t => escapeHtml(g.teamSetup?.[t]?.name || (t === 'A' ? 'الفريق الأول' : 'الفريق الثاني'));
  const left = g.stateUsed.flat().filter(u => !u).length;
  $('resumeInfo').innerHTML = `🟢 ${name('A')} <b>${ar(g.scores.A)}</b> · 🟡 ${name('B')} <b>${ar(g.scores.B)}</b> — باقي ${qCount(left)}`;
}

/* ============================= إعداد الفرق ============================= */
function renderTeamSetup() {
  const container = $('teamsSetupContainer');
  container.innerHTML = '';

  ['A', 'B'].forEach(team => {
    const first = team === 'A';
    const div = document.createElement('div');
    div.className = `team-setup ${team}`;
    div.innerHTML = `
      <label for="setupName${team}">${first ? '🟢' : '🟡'} اسم ${first ? 'الفريق الأول' : 'الفريق الثاني'}</label>
      <input type="text" id="setupName${team}" maxlength="18"
             placeholder="${first ? 'الفريق الأول' : 'الفريق الثاني'}"
             value="${escapeHtml(teamSetup[team].name)}">
    `;
    container.appendChild(div);

    $(`setupName${team}`).addEventListener('input', e => {
      teamSetup[team].name = e.target.value.trim() || (first ? 'الفريق الأول' : 'الفريق الثاني');
    });
  });
}

/* ============================= اختيار الفئات ============================= */
function updateHomeStats() {
  $('totalQuestions').textContent = ar(countAllQuestions());
  $('totalCategories').textContent = ar(CATEGORIES.length);
}

function renderCatGrid() {
  const grid = $('catGrid');
  grid.innerHTML = '';

  if (!CATEGORIES.length) {
    const empty = document.createElement('p');
    empty.className = 'cat-empty';
    empty.textContent = 'ما فيه فئات — افتح ⚙️ بنك الأسئلة وأضف فئة، أو رجّع الأسئلة الأصلية من تبويب النسخة الاحتياطية.';
    grid.appendChild(empty);
    updateSelStatus();
    return;
  }

  CATEGORIES.forEach(c => {
    const sel = selectedCats.some(x => x.id === c.id);
    const count = countCategoryQuestions(c.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `cat-card${sel ? ' sel' : ''}`;
    card.innerHTML = `
      <div class="cat-ic">${escapeHtml(c.ic)}</div>
      <div class="cat-name">${escapeHtml(c.name)}</div>
      <div class="cat-count">${qCount(count)}</div>
    `;
    card.onclick = () => toggleCategory(c, card);
    grid.appendChild(card);
  });

  updateSelStatus();
}

function toggleCategory(c, card) {
  Sound.select();
  const idx = selectedCats.findIndex(x => x.id === c.id);

  if (idx > -1) {
    selectedCats.splice(idx, 1);
    card.classList.remove('sel');
  } else {
    if (selectedCats.length >= 6) {
      uiAlert('اللوحة تتسع لـ ٦ فئات فقط.\nألغِ اختيار فئة قبل إضافة غيرها.');
      return;
    }
    selectedCats.push(c);
    card.classList.add('sel');
  }

  updateSelStatus();
}

function updateSelStatus() {
  const n = selectedCats.length;
  const el = $('selStatus');
  el.textContent = n === 0
    ? 'اختر فئة واحدة على الأقل'
    : `${ar(n)} من ٦ فئات · ${qCount(n * 3)} في اللوحة`;
  $('btnStartGame').disabled = n === 0;
}

function countCategoryQuestions(id) {
  const cat = QBANK[id] || {};
  return DIFFKEY.reduce((sum, k) => sum + (cat[k] || []).length, 0);
}

function countAllQuestions() {
  return CATEGORIES.reduce((sum, c) => sum + countCategoryQuestions(c.id), 0);
}

/* ============================= بدء اللعبة ============================= */
function startGame() {
  if (selectedCats.length === 0) return;

  Sound.start();

  boardCats = selectedCats.slice();
  selectedCats = [];   // الجولة الجاية تبدأ بشاشة فئات فاضية
  stateUsed = boardCats.map(() => [false, false, false]);
  questionCache = {};
  scores = { A: 0, B: 0 };
  current = null;
  activeTeam = Math.random() < 0.5 ? 'A' : 'B';
  undoStack = [];

  updateGameUI();
  renderBoard();
  showScreen('screen-game');
  saveGame();

  uiAlert(`🎲 القرعة اختارت ${getTeamName(activeTeam)} ليبدأ.\n\nاضغطوا على أي خانة في اللوحة لفتح السؤال.`);
}

function getTeamName(team) {
  return teamSetup[team]?.name || (team === 'A' ? 'الفريق الأول' : 'الفريق الثاني');
}

function updateGameUI() {
  $('gameNameA').textContent = `🟢 ${getTeamName('A')}`;
  $('gameNameB').textContent = `🟡 ${getTeamName('B')}`;
  $('scoreA').textContent = ar(scores.A);
  $('scoreB').textContent = ar(scores.B);
  renderTurnIndicator();
}

function renderTurnIndicator() {
  renderUndoButtons();
  const banner = $('turnBanner');
  banner.innerHTML = `<span class="turn-dot ${activeTeam}"></span> الدور على <b>${escapeHtml(getTeamName(activeTeam))}</b>`;
  $('teamCardA').classList.toggle('active', activeTeam === 'A');
  $('teamCardB').classList.toggle('active', activeTeam === 'B');
}

function switchTurn() {
  activeTeam = activeTeam === 'A' ? 'B' : 'A';
  renderTurnIndicator();
}

/* ============================= اللوحة ============================= */
function renderBoard() {
  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${boardCats.length}, 1fr)`;
  board.innerHTML = '';

  boardCats.forEach(c => {
    const h = document.createElement('div');
    h.className = 'cat-header';
    h.innerHTML = `<span class="ic">${escapeHtml(c.ic)}</span><span>${escapeHtml(c.name)}</span>`;
    board.appendChild(h);
  });

  for (let row = 0; row < 3; row++) {
    boardCats.forEach((c, ci) => {
      const used = stateUsed[ci][row];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell${used ? ' used' : ''}`;
      cell.textContent = used ? '✓' : ar(POINTS[row]);
      cell.setAttribute('aria-label', `${c.name} — ${ar(POINTS[row])} نقطة`);
      if (used) cell.disabled = true;
      else cell.onclick = () => openQuestion(ci, row);
      board.appendChild(cell);
    });
  }
}

function pickQuestion(catId, row) {
  const pool = (QBANK[catId] || {})[DIFFKEY[row]] || [];
  if (pool.length === 0) return null;
  return shuffle(pool)[0];
}

function openQuestion(ci, row) {
  Sound.open();
  const cat = boardCats[ci];
  current = { ci, row, cat };

  const key = `${ci}-${row}`;
  if (!questionCache[key]) { questionCache[key] = pickQuestion(cat.id, row); saveGame(); }
  const item = questionCache[key];

  $('qcat').innerHTML = `${escapeHtml(cat.ic)} ${escapeHtml(cat.name)}`;
  $('qpoints').textContent = `${ar(POINTS[row])} نقطة`;

  if (!item) {
    // بلا سؤال: يبقى «بدون نقاط» حتى تُقفل الخانة وتكمل الجولة لنهايتها
    $('qbody').innerHTML = '<div class="errbox">ما فيه سؤال محفوظ لهذي الخانة — أقفلها بـ«بدون نقاط»، أو أضف لها سؤالاً من ⚙️ بنك الأسئلة.</div>';
    $('cornersBar').style.display = 'flex';
    $('answerCorner').style.display = 'none';
    $('awardButtons').innerHTML = '';
  } else {
    $('answerCorner').style.display = '';
    // صورة مرفوعة من اللوحة (data URL) أو ملف داخل assets/ مثل شعارات البنك الأصلي
    const isImg = (src) => typeof src === 'string' && /^(data:image\/|assets\/[\w\/.-]+$)/.test(src);
    $('qbody').innerHTML = `
      ${isImg(item.img)
        ? `<div class="qimg has-photo" id="qmedia"><img src="${escapeHtml(item.img)}" alt=""></div>`
        : `<div class="qimg" id="qmedia">${escapeHtml(item.emoji || '❓')}</div>`}
      ${isImg(item.aImg)
        ? `<div class="qimg has-photo hide" id="amedia"><img src="${escapeHtml(item.aImg)}" alt=""></div>`
        : ''}
      <div class="qtext" id="qtext">${escapeHtml(item.q)}</div>
      <div class="atext" id="atext">${escapeHtml(item.a)}</div>
    `;
    $('toggleAnswerBtn').textContent = 'عرض الإجابة';
    $('cornersBar').style.display = 'flex';
    renderAwardButtons();
  }

  resetQuestionTimer();
  $('overlay').classList.add('show');
}

function toggleAnswer() {
  Sound.reveal();
  const q = $('qtext'), a = $('atext'), btn = $('toggleAnswerBtn');
  if (!q || !a) return;

  const showing = !a.classList.contains('show');
  a.classList.toggle('show', showing);
  q.classList.toggle('hide', showing);
  btn.textContent = showing ? 'رجوع للسؤال' : 'عرض الإجابة';

  // لو للإجابة صورة، تحلّ مكان صورة السؤال وقت عرض الإجابة
  const am = $('amedia');
  if (am) {
    am.classList.toggle('hide', !showing);
    $('qmedia')?.classList.toggle('hide', showing);
  }
}

/* ---- عدّاد السؤال ---- */
function resetQuestionTimer() {
  clearInterval(qTimer);
  qTimer = null;
  $('timerView').textContent = '';
  $('timerView').classList.remove('low');
  $('btnTimer').textContent = `⏱️ ابدأ العدّاد (${ar(QTIMER_SECONDS)} ثانية)`;
  $('btnTimer').disabled = false;
}

function startQuestionTimer() {
  clearInterval(qTimer);
  let left = QTIMER_SECONDS;
  const view = $('timerView');
  $('btnTimer').disabled = true;
  $('btnTimer').textContent = '⏱️ العدّاد شغّال';

  const tick = () => {
    view.textContent = `${ar(left)} ثانية`;
    view.classList.toggle('low', left <= 10);
    if (left <= 0) {
      clearInterval(qTimer);
      qTimer = null;
      view.textContent = '⏰ انتهى الوقت';
      Sound.skip();
      $('btnTimer').disabled = false;
      $('btnTimer').textContent = '↺ أعد العدّاد';
    }
    left--;
  };

  tick();
  qTimer = setInterval(tick, 1000);
}

/* ============================= النقاط ============================= */
function renderAwardButtons() {
  const container = $('awardButtons');
  container.innerHTML = '';

  ['A', 'B'].forEach(team => {
    const btn = document.createElement('button');
    btn.className = `btn btn-award ${team}`;
    btn.textContent = `${team === 'A' ? '🟢' : '🟡'} ${getTeamName(team)}`;
    btn.onclick = () => award(team);
    container.appendChild(btn);
  });
}

function award(team) {
  if (!current) return;

  const pts = POINTS[current.row];

  if (team) {
    scores[team] += pts;
    $(`score${team}`).textContent = ar(scores[team]);
    Sound.award();
  } else {
    Sound.skip();
  }

  undoStack.push({ ci: current.ci, row: current.row, team, pts, cat: current.cat.name, turn: activeTeam });
  if (undoStack.length > HISTORY_MAX) undoStack.shift();

  stateUsed[current.ci][current.row] = true;
  closeQuestion();
  renderBoard();

  switchTurn();
  saveGame();
  if (isGameFinished()) showEndScreen();
}

/* ---- التراجع عن آخر سؤال ----
   يفتح الخانة من جديد، ويشيل نقاطها من الفريق، ويرجّع الدور لصاحبه.
   ما يلمس أي زيادة أو نقص يدوي صار بعدها. */
function renderUndoButtons() {
  const last = undoStack[undoStack.length - 1];
  ['btnUndo', 'btnEndUndo'].forEach(id => {
    const b = $(id);
    b.disabled = !last;
    b.title = last
      ? `تراجع عن: ${last.cat} — ${last.team ? `${ar(last.pts)} لـ ${getTeamName(last.team)}` : 'بدون نقاط'}`
      : 'ما فيه شي تتراجع عنه';
  });
}

async function undoLast() {
  const last = undoStack[undoStack.length - 1];
  if (!last) return;
  Sound.click();
  const what = last.team ? `${ar(last.pts)} نقطة لـ ${getTeamName(last.team)}` : 'بدون نقاط';
  if (!await uiConfirm(`↩️ تراجع عن آخر سؤال؟\n\n${last.cat} — ${what}\n\nالخانة ترجع مفتوحة والدور يرجع لصاحبه.`)) return;

  undoStack.pop();
  stateUsed[last.ci][last.row] = false;
  if (last.team) scores[last.team] -= last.pts;
  activeTeam = last.turn;

  updateGameUI();
  renderBoard();
  saveGame();
  if (!$('screen-game').classList.contains('active')) showScreen('screen-game');
  Sound.skip();
}

function closeQuestion() {
  $('overlay').classList.remove('show');
  $('cornersBar').style.display = '';
  $('answerCorner').style.display = '';
  clearInterval(qTimer);
  qTimer = null;
  current = null;
}

/* ---- زيادة ونقص يدوي ----
   لتصحيح أي خطأ أو لمكافأة/خصم يقرره الحَكَم. تُحفظ مع الجولة. */
function adjustScore(team, delta) {
  scores[team] += delta;
  $(`score${team}`).textContent = ar(scores[team]);
  (delta > 0 ? Sound.select : Sound.skip)();
  saveGame();
}

function isGameFinished() {
  return stateUsed.length > 0 && stateUsed.every(col => col.every(Boolean));
}

/* ============================= النهاية ============================= */
function showEndScreen() {
  const a = scores.A, b = scores.B;
  const nameA = getTeamName('A'), nameB = getTeamName('B');

  if (a === b) {
    $('endTrophy').textContent = '🤝';
    $('endTitle').textContent = 'تعادل!';
    $('endWinner').innerHTML = `<span class="tie-text">الفريقان تعادلا بـ ${ar(a)} نقطة</span>`;
  } else {
    const winTeam = a > b ? 'A' : 'B';
    const winName = a > b ? nameA : nameB;
    $('endTrophy').textContent = '🏆';
    $('endTitle').textContent = 'الفائز';
    $('endWinner').innerHTML = `
      <div class="winner-name ${winTeam}">${winTeam === 'A' ? '🟢' : '🟡'} ${escapeHtml(winName)}</div>
      <div class="winner-margin">بفارق ${ar(Math.abs(a - b))} نقطة</div>
    `;
  }

  $('endScores').innerHTML = `
    <div class="end-score-card A ${a >= b ? 'lead' : ''}">
      <div class="end-team-name">🟢 ${escapeHtml(nameA)}</div>
      <div class="end-team-score">${ar(a)}</div>
    </div>
    <div class="end-score-card B ${b >= a ? 'lead' : ''}">
      <div class="end-team-name">🟡 ${escapeHtml(nameB)}</div>
      <div class="end-team-score">${ar(b)}</div>
    </div>
  `;

  showScreen('screen-end');
  renderUndoButtons();
  Sound.win();
}

function buildResultText() {
  const a = scores.A, b = scores.B;
  const nameA = getTeamName('A'), nameB = getTeamName('B');
  const header = a === b
    ? '🤝 تعادل في «اكتشف وطنك مع رجا»!'
    : `🏆 فاز ${a > b ? nameA : nameB} في «اكتشف وطنك مع رجا»!`;
  return `${header}\n\n🟢 ${nameA}: ${ar(a)}\n🟡 ${nameB}: ${ar(b)}\n\n🇸🇦 كل عام والوطن بخير`;
}

async function shareResult() {
  Sound.click();
  const text = buildResultText();

  if (navigator.share) {
    try {
      await navigator.share({ title: 'اكتشف وطنك مع رجا', text });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }

  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

/* ============================= العدّ لليوم الوطني ============================= */
function renderNationalDayCount() {
  const now = new Date();
  const year = now.getMonth() > 8 || (now.getMonth() === 8 && now.getDate() > 23)
    ? now.getFullYear() + 1
    : now.getFullYear();

  const target = new Date(year, 8, 23);           // ٢٣ سبتمبر
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target - today) / 86400000);

  const el = $('ndCount');
  if (days === 0) el.textContent = '🇸🇦 اليوم هو اليوم الوطني';
  else if (days === 1) el.textContent = 'باقي يوم واحد على ٢٣ سبتمبر';
  else if (days === 2) el.textContent = 'باقي يومان على ٢٣ سبتمبر';
  else el.textContent = `باقي ${ar(days)} يوماً على ٢٣ سبتمبر`;
}

/* ============================= العمل بدون إنترنت ============================= */
// sw.js يحفظ الملفات؛ هنا نعطيه كل ما حمّلته الصفحة + صور الأسئلة كلها
function registerOffline() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('sw.js');
      const reg = await navigator.serviceWorker.ready;

      const urls = new Set(['./', 'manifest.webmanifest']);
      performance.getEntriesByType('resource').forEach(e => {
        if (new URL(e.name).origin === location.origin) urls.add(e.name);
      });
      [DEFAULT_QBANK, QBANK].forEach(bank => Object.values(bank || {}).forEach(cat =>
        DIFFKEY.forEach(k => (cat?.[k] || []).forEach(item => {
          [item.img, item.aImg].forEach(src => {
            if (typeof src === 'string' && src.startsWith('assets/')) urls.add(src);
          });
        }))));

      reg.active?.postMessage({ type: 'precache', urls: [...urls] });
    } catch (e) { /* المتصفح ما يدعمه — اللعبة تشتغل عادي بالنت */ }
  });
}

/* ============================= الصوت ============================= */
function renderMuteButton() {
  const b = $('btnMute');
  b.textContent = Sound.muted ? '🔇' : '🔊';
  b.title = Sound.muted ? 'تشغيل الصوت' : 'كتم الصوت';
  b.setAttribute('aria-pressed', String(Sound.muted));
}

/* ============================= التنقّل ============================= */
function goHome() { Sound.click(); renderResumeButton(); showScreen('screen-home'); }

function goSetup() {
  Sound.click();
  showScreen('screen-setup');
  renderTeamSetup();
}

function goCategories() {
  Sound.click();
  // ما نختار فئات تلقائياً — اللاعبون يختارونها بأنفسهم
  selectedCats = selectedCats.filter(c => CATEGORIES.some(x => x.id === c.id));
  showScreen('screen-categories');
  renderCatGrid();
}

/* ============================= الربط ============================= */
document.addEventListener('DOMContentLoaded', () => {
  updateHomeStats();
  renderNationalDayCount();
  renderTeamSetup();
  renderResumeButton();
  renderMuteButton();
  registerOffline();

  $('btnResume').onclick = resumeGame;
  $('btnUndo').onclick = undoLast;
  $('btnEndUndo').onclick = undoLast;
  document.querySelectorAll('.score-adj').forEach(b => {
    b.onclick = () => adjustScore(b.dataset.team, Number(b.dataset.delta));
  });
  $('btnMute').onclick = () => { Sound.setMuted(!Sound.muted); renderMuteButton(); Sound.click(); };

  $('btnNewGame').onclick = goSetup;
  $('btnSetupBack').onclick = goHome;
  $('btnSetupNext').onclick = goCategories;
  $('btnCatBack').onclick = goSetup;
  $('btnStartGame').onclick = startGame;
  $('btnEndHome').onclick = goHome;
  $('btnPlayAgain').onclick = goSetup;
  $('btnShare').onclick = shareResult;

  $('toggleAnswerBtn').onclick = toggleAnswer;
  $('btnNoAward').onclick = () => award(null);
  $('btnCloseQ').onclick = () => { Sound.click(); closeQuestion(); };
  $('btnTimer').onclick = () => { Sound.click(); startQuestionTimer(); };

  $('btnResetGame').onclick = async () => {
    if (await uiConfirm('بدء لعبة جديدة؟ بيروح كل التقدم الحالي.')) {
      clearSavedGame();
      selectedCats = [];
      goSetup();
    }
  };

  $('btnHowTo').onclick = () => {
    Sound.click();
    uiAlert(
      'كيف نلعب:\n\n' +
      '١) اكتبوا أسماء الفريقين.\n' +
      '٢) اللوحة ٦ فئات × ٣ مستويات: ١٠٠ سهل، ٢٥٠ متوسط، ٤٠٠ صعب.\n' +
      '٣) الفريق صاحب الدور يختار خانة، ويقرأ أحدكم السؤال بصوت عالٍ.\n' +
      '٤) بعد الإجابة اضغطوا «عرض الإجابة»، ثم أعطوا النقاط للفريق المستحق أو «بدون نقاط».\n' +
      '٥) الدور ينتقل تلقائياً، واللي يجمع نقاط أكثر بعد ١٨ سؤالاً يكسب.'
    );
  };

  // «عن اللعبة» شاشة كاملة في js/about.js

  // إغلاق نافذة السؤال بزر Esc
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('modal').classList.contains('show')) return;   // النافذة العامة تُغلق بأزرارها
    if ($('overlay').classList.contains('show')) closeQuestion();
  });
});
