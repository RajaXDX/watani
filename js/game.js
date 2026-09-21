/* =========================================================================
   اكتشف وطنك مع الإمام عاصم — منطق اللعبة
   نسخة محلية بالكامل: لا حسابات ولا سحابة. بنك الأسئلة جاهز في questions.js
   ========================================================================= */

'use strict';

/* ============================= الأصوات ============================= */
const Sound = (function () {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gainVal) {
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
const LIFELINES = [
  { key: 'fakh',     name: 'الفخ',           ic: '🪤', desc: 'إذا أجاب الفريق الآخر إجابة صحيحة، تذهب النقاط لكم بدلاً منه.' },
  { key: 'istareeh', name: 'استريح',         ic: '✋', desc: 'تتخطّون السؤال بلا نقاط لأحد، ويبقى الدور معكم.' },
  { key: 'hofra',    name: 'الحفرة',         ic: '🕳️', desc: 'يُمنع الفريق الآخر من أخذ نقاط هذا السؤال.' },
  { key: 'sadeeq',   name: 'اتصال بصديق',    ic: '📞', desc: 'لديكم ٣٠ ثانية للاتصال بصديق يساعدكم في الإجابة.' },
  { key: 'jawabain', name: 'جاوب جوابين',    ic: '✌️', desc: 'يحقّ لكم تقديم إجابتين، وتُحتسب لكم إن صحّت إحداهما.' },
];

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
  A: { name: 'الفريق الأول', lifelines: [] },
  B: { name: 'الفريق الثاني', lifelines: [] },
};

let selectedCats = [];      // الفئات المختارة لهذه الجولة
let boardCats = [];         // فئات اللوحة الحالية
let stateUsed = [];         // [ci][row] = مستخدَمة؟
let questionCache = {};     // السؤال المسحوب لكل خانة حتى لا يتغيّر عند إعادة الفتح
let scores = { A: 0, B: 0 };
let lifelineUsed = { A: [], B: [] };
let current = null;         // { ci, row, cat }
let activeTeam = null;      // صاحب الدور
let activeLifeline = null;  // { team, key }
let friendCallTimer = null;
let qTimer = null;

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
      <div class="lifelines-label">وسائل المساعدة (اختر ٣)</div>
      <div class="lifelines" id="lifelines${team}"></div>
      <div class="lifeline-count" id="count${team}">0 / 3</div>
    `;
    container.appendChild(div);

    $(`setupName${team}`).addEventListener('input', e => {
      teamSetup[team].name = e.target.value.trim() || (first ? 'الفريق الأول' : 'الفريق الثاني');
    });

    renderLifelineChips(team);
  });

  updateSetupStatus();
}

function renderLifelineChips(team) {
  const wrap = $(`lifelines${team}`);
  wrap.innerHTML = '';

  LIFELINES.forEach(l => {
    const sel = teamSetup[team].lifelines.includes(l.key);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `lifeline-chip${sel ? ' sel' : ''}`;
    chip.title = l.desc;
    chip.innerHTML = `<span class="ic">${l.ic}</span>${escapeHtml(l.name)}`;
    chip.onclick = () => toggleLifeline(team, l.key, chip);
    wrap.appendChild(chip);
  });

  $(`count${team}`).textContent = `${teamSetup[team].lifelines.length} / 3`;
}

function toggleLifeline(team, key, chipEl) {
  Sound.select();
  const arr = teamSetup[team].lifelines;
  const idx = arr.indexOf(key);

  if (idx > -1) {
    arr.splice(idx, 1);
    chipEl.classList.remove('sel');
  } else {
    if (arr.length >= 3) return;
    arr.push(key);
    chipEl.classList.add('sel');
  }

  $(`count${team}`).textContent = `${arr.length} / 3`;
  updateSetupStatus();
}

function updateSetupStatus() {
  const a = teamSetup.A.lifelines.length;
  const b = teamSetup.B.lifelines.length;
  const ready = a === 3 && b === 3;
  const el = $('setupStatus');
  el.textContent = ready
    ? '✅ الفريقان جاهزان'
    : `اختر ٣ وسائل لكل فريق — الأول ${a}/٣ · الثاني ${b}/٣`;
  el.classList.toggle('ok', ready);
  $('btnSetupNext').disabled = !ready;
}

/* ============================= اختيار الفئات ============================= */
function updateHomeStats() {
  $('totalQuestions').textContent = countAllQuestions();
  $('totalCategories').textContent = CATEGORIES.length;
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
      <div class="cat-ic">${c.ic}</div>
      <div class="cat-name">${escapeHtml(c.name)}</div>
      <div class="cat-count">${count} سؤال</div>
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
    : `${n} من ٦ فئات · ${n * 3} سؤالاً في اللوحة`;
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
  stateUsed = boardCats.map(() => [false, false, false]);
  questionCache = {};
  scores = { A: 0, B: 0 };
  lifelineUsed = { A: [], B: [] };
  current = null;
  activeLifeline = null;
  activeTeam = Math.random() < 0.5 ? 'A' : 'B';

  updateGameUI();
  renderBoard();
  showScreen('screen-game');

  uiAlert(`🎲 القرعة اختارت ${getTeamName(activeTeam)} ليبدأ.\n\nاضغطوا على أي خانة في اللوحة لفتح السؤال.`);
}

function getTeamName(team) {
  return teamSetup[team]?.name || (team === 'A' ? 'الفريق الأول' : 'الفريق الثاني');
}

function updateGameUI() {
  $('gameNameA').textContent = `🟢 ${getTeamName('A')}`;
  $('gameNameB').textContent = `🟡 ${getTeamName('B')}`;
  $('scoreA').textContent = scores.A;
  $('scoreB').textContent = scores.B;
  renderTurnIndicator();
  renderLifelineDisplay();
}

function renderTurnIndicator() {
  const banner = $('turnBanner');
  banner.innerHTML = `<span class="turn-dot ${activeTeam}"></span> الدور على <b>${escapeHtml(getTeamName(activeTeam))}</b>`;
  $('teamCardA').classList.toggle('active', activeTeam === 'A');
  $('teamCardB').classList.toggle('active', activeTeam === 'B');
}

function switchTurn() {
  activeTeam = activeTeam === 'A' ? 'B' : 'A';
  renderTurnIndicator();
}

function renderLifelineDisplay() {
  ['A', 'B'].forEach(team => {
    const wrap = $(`lifeDisplay${team}`);
    wrap.innerHTML = '';

    teamSetup[team].lifelines.forEach(key => {
      const l = LIFELINES.find(x => x.key === key);
      if (!l) return;

      const used = lifelineUsed[team].includes(key);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `ic${used ? ' used' : ''}`;
      el.title = used ? `${l.name} — مُستخدمة` : `${l.name}: ${l.desc}`;
      el.textContent = l.ic;
      if (used) el.disabled = true;
      else el.onclick = () => useLifeline(team, key);
      wrap.appendChild(el);
    });
  });
}

/* ============================= اللوحة ============================= */
function renderBoard() {
  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${boardCats.length}, 1fr)`;
  board.innerHTML = '';

  boardCats.forEach(c => {
    const h = document.createElement('div');
    h.className = 'cat-header';
    h.innerHTML = `<span class="ic">${c.ic}</span><span>${escapeHtml(c.name)}</span>`;
    board.appendChild(h);
  });

  for (let row = 0; row < 3; row++) {
    boardCats.forEach((c, ci) => {
      const used = stateUsed[ci][row];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell${used ? ' used' : ''}`;
      cell.textContent = used ? '✓' : String(POINTS[row]);
      cell.setAttribute('aria-label', `${c.name} — ${POINTS[row]} نقطة`);
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
  if (!questionCache[key]) questionCache[key] = pickQuestion(cat.id, row);
  const item = questionCache[key];

  $('qcat').innerHTML = `${cat.ic} ${escapeHtml(cat.name)}`;
  $('qpoints').textContent = `${POINTS[row]} نقطة`;

  if (!item) {
    $('qbody').innerHTML = '<div class="errbox">ما فيه سؤال محفوظ لهذي الخانة</div>';
    $('cornersBar').style.display = 'none';
  } else {
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
  renderLifelineBanner();
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
  $('btnTimer').textContent = `⏱️ ابدأ العدّاد (٦٠ ثانية)`;
  $('btnTimer').disabled = false;
}

function startQuestionTimer() {
  clearInterval(qTimer);
  let left = QTIMER_SECONDS;
  const view = $('timerView');
  $('btnTimer').disabled = true;
  $('btnTimer').textContent = '⏱️ العدّاد شغّال';

  const tick = () => {
    view.textContent = `${left} ثانية`;
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

/* ============================= وسائل المساعدة ============================= */
async function useLifeline(team, key) {
  if (lifelineUsed[team].includes(key)) return;

  const l = LIFELINES.find(x => x.key === key);
  if (!l) return;

  if (!current) {
    uiAlert(`${l.ic} ${l.name}\n\n${l.desc}\n\nافتح السؤال أولاً ثم فعّلها.`);
    return;
  }

  if (activeLifeline) {
    uiAlert('⚠️ فيه وسيلة مساعدة مفعّلة على هذا السؤال بالفعل');
    return;
  }

  const ok = await uiConfirm(`${l.ic} تفعيل «${l.name}» لفريق ${getTeamName(team)}؟\n\n${l.desc}\n\nتُستخدم مرة واحدة فقط طوال اللعبة.`);
  if (!ok) return;

  Sound.select();
  lifelineUsed[team].push(key);
  activeLifeline = { team, key };

  renderLifelineDisplay();
  renderLifelineBanner();
  renderAwardButtons();

  if (key === 'sadeeq') startFriendCall();
  if (key === 'istareeh') award(null, { keepTurn: true });
}

function renderLifelineBanner() {
  const banner = $('lifelineBanner');

  if (!activeLifeline) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  const l = LIFELINES.find(x => x.key === activeLifeline.key);
  banner.style.display = 'block';
  banner.innerHTML = `
    <span class="ll-ic">${l.ic}</span>
    <b>${escapeHtml(l.name)}</b> — ${escapeHtml(getTeamName(activeLifeline.team))}
    <div class="ll-desc">${escapeHtml(l.desc)}</div>
    <div class="ll-timer" id="lifelineTimer"></div>
  `;
}

function startFriendCall() {
  clearInterval(friendCallTimer);
  let left = 30;

  const tick = () => {
    const el = $('lifelineTimer');
    if (!el) return;
    el.textContent = `⏱️ ${left} ثانية`;
    if (left <= 0) {
      clearInterval(friendCallTimer);
      friendCallTimer = null;
      el.textContent = '⏰ انتهى الوقت';
      Sound.skip();
    }
    left--;
  };

  tick();
  friendCallTimer = setInterval(tick, 1000);
}

function clearActiveLifeline() {
  clearInterval(friendCallTimer);
  friendCallTimer = null;
  activeLifeline = null;
  renderLifelineBanner();
}

/* ============================= النقاط ============================= */
function renderAwardButtons() {
  const container = $('awardButtons');
  container.innerHTML = '';

  // «الحفرة» تمنع الفريق الآخر من أخذ نقاط هذا السؤال
  const blocked = activeLifeline?.key === 'hofra'
    ? (activeLifeline.team === 'A' ? 'B' : 'A')
    : null;

  ['A', 'B'].forEach(team => {
    const isBlocked = blocked === team;
    const btn = document.createElement('button');
    btn.className = `btn btn-award ${team}${isBlocked ? ' blocked' : ''}`;
    btn.textContent = `${isBlocked ? '🕳️' : (team === 'A' ? '🟢' : '🟡')} ${getTeamName(team)}`;
    if (isBlocked) {
      btn.disabled = true;
      btn.title = 'محجوب بـ «الحفرة»';
    } else {
      btn.onclick = () => award(team);
    }
    container.appendChild(btn);
  });
}

function award(team, opts = {}) {
  if (!current) return;

  const pts = POINTS[current.row];

  // «الفخ»: إذا أجاب الفريق الآخر صحيحاً، تذهب النقاط لصاحب الفخ
  if (team && activeLifeline?.key === 'fakh' && team !== activeLifeline.team) {
    const trapper = activeLifeline.team;
    uiAlert(`🪤 وقع ${getTeamName(team)} في فخ ${getTeamName(trapper)}!\nالنقاط (${pts}) تذهب لـ ${getTeamName(trapper)}.`);
    team = trapper;
  }

  if (team) {
    scores[team] += pts;
    $(`score${team}`).textContent = scores[team];
    Sound.award();
  } else {
    Sound.skip();
  }

  stateUsed[current.ci][current.row] = true;
  closeQuestion();
  renderBoard();

  if (!opts.keepTurn) switchTurn();
  if (isGameFinished()) showEndScreen();
}

function closeQuestion() {
  $('overlay').classList.remove('show');
  $('cornersBar').style.display = '';
  clearInterval(qTimer);
  qTimer = null;
  current = null;
  clearActiveLifeline();
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
    $('endWinner').innerHTML = `<span class="tie-text">الفريقان تعادلا بـ ${a} نقطة</span>`;
  } else {
    const winTeam = a > b ? 'A' : 'B';
    const winName = a > b ? nameA : nameB;
    $('endTrophy').textContent = '🏆';
    $('endTitle').textContent = 'الفائز';
    $('endWinner').innerHTML = `
      <div class="winner-name ${winTeam}">${winTeam === 'A' ? '🟢' : '🟡'} ${escapeHtml(winName)}</div>
      <div class="winner-margin">بفارق ${Math.abs(a - b)} نقطة</div>
    `;
  }

  $('endScores').innerHTML = `
    <div class="end-score-card A ${a >= b ? 'lead' : ''}">
      <div class="end-team-name">🟢 ${escapeHtml(nameA)}</div>
      <div class="end-team-score">${a}</div>
    </div>
    <div class="end-score-card B ${b >= a ? 'lead' : ''}">
      <div class="end-team-name">🟡 ${escapeHtml(nameB)}</div>
      <div class="end-team-score">${b}</div>
    </div>
  `;

  showScreen('screen-end');
  Sound.win();
}

function buildResultText() {
  const a = scores.A, b = scores.B;
  const nameA = getTeamName('A'), nameB = getTeamName('B');
  const header = a === b
    ? '🤝 تعادل في «اكتشف وطنك مع الإمام عاصم»!'
    : `🏆 فاز ${a > b ? nameA : nameB} في «اكتشف وطنك مع الإمام عاصم»!`;
  return `${header}\n\n🟢 ${nameA}: ${a}\n🟡 ${nameB}: ${b}\n\n🇸🇦 كل عام والوطن بخير`;
}

async function shareResult() {
  Sound.click();
  const text = buildResultText();

  if (navigator.share) {
    try {
      await navigator.share({ title: 'اكتشف وطنك مع الإمام عاصم', text });
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
  else el.textContent = `باقي ${days} يوماً على ٢٣ سبتمبر`;
}

/* ============================= التنقّل ============================= */
function goHome() { Sound.click(); showScreen('screen-home'); }

function goSetup() {
  Sound.click();
  showScreen('screen-setup');
  renderTeamSetup();
}

function goCategories() {
  Sound.click();
  selectedCats = selectedCats.filter(c => CATEGORIES.some(x => x.id === c.id));
  if (selectedCats.length === 0) {
    // اللوحة تتسع لست: نختار الأكمل أسئلةً ونتجاهل الفاضية، ونحفظ ترتيبها الأصلي
    selectedCats = CATEGORIES
      .map((c, i) => ({ c, i, n: countCategoryQuestions(c.id) }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .slice(0, 6)
      .sort((a, b) => a.i - b.i)
      .map(x => x.c);
  }
  showScreen('screen-categories');
  renderCatGrid();
}

/* ============================= الربط ============================= */
document.addEventListener('DOMContentLoaded', () => {
  updateHomeStats();
  renderNationalDayCount();
  renderTeamSetup();

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
      selectedCats = [];
      goSetup();
    }
  };

  $('btnHowTo').onclick = () => {
    Sound.click();
    uiAlert(
      'كيف نلعب:\n\n' +
      '١) اكتبوا أسماء الفريقين، وكل فريق يختار ٣ وسائل مساعدة.\n' +
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
