/* =========================================================================
   اكتشف وطنك مع الإمام عاصم — بنك الأسئلة (لوحة الإدارة)

   مقفولة بحساب إدارة «تحدي رجا»: نفس اسم المستخدم وكلمة المرور، والتحقق عند
   Supabase (دالة is_admin وجدول admins) — ولا كلمة مرور مكتوبة في الكود.
   الدخول يبقى في الذاكرة فقط: يُطلب كل مرة تنفتح اللوحة، وما يلمس جلسة
   «تحدي رجا» المحفوظة (الموقعان على نفس النطاق rajaxdx.github.io).
   التعديلات نفسها تبقى في متصفح هذا الجهاز كما كانت.
   ========================================================================= */

'use strict';

let adminReturnScreen = 'screen-home';
let editing = null;   // { catId, diff, idx } أثناء تعديل سؤال قائم
// صورتا السؤال والإجابة في النموذج (data URL مصغّرة)
const pendingImg = { q: '', a: '' };
const IMG_SLOTS = {
  q: { field: 'img',  btn: 'btnAddImg',  file: 'newQImgFile', preview: 'newQImgPreview', thumb: 'newQImgThumb', remove: 'btnRemoveImg',  label: 'صورة السؤال' },
  a: { field: 'aImg', btn: 'btnAddAImg', file: 'newAImgFile', preview: 'newAImgPreview', thumb: 'newAImgThumb', remove: 'btnRemoveAImg', label: 'صورة الإجابة' },
};

/* ============================= صور السؤال والإجابة =============================
   تُحفظ داخل البنك في localStorage، ومساحته محدودة (~٥ ميغا)، فنصغّر كل
   صورة لأطول ضلع ٨٠٠ بكسل ونضغطها JPEG قبل الحفظ. */
const IMG_MAX_SIDE = 800;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMG_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';   // الشفافية تصير أبيض بدل أسود في JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function setPendingImg(slot, dataUrl) {
  const s = IMG_SLOTS[slot];
  pendingImg[slot] = dataUrl || '';
  $(s.thumb).src = pendingImg[slot];
  $(s.preview).hidden = !pendingImg[slot];
  $(s.btn).textContent = `🖼️ ${pendingImg[slot] ? 'تغيير ' : ''}${s.label}`;
}

async function onImagePicked(slot, file) {
  if (!file.type.startsWith('image/')) { uiAlert('اختر ملف صورة.'); return; }
  try {
    setPendingImg(slot, await compressImage(file));
    Sound.select();
  } catch (e) {
    uiAlert('ما قدرت أقرأ الصورة — جرّب صورة ثانية.');
  }
}

/* ============================= دخول الإدارة =============================
   نفس حسابات «تحدي رجا» (raja-challenge/js/auth.js): اسم المستخدم يتحوّل
   لبريد داخلي من بصمته، أو يُكتب البريد مباشرة. */
const SUPABASE_URL = 'https://rqcltlleqpppeywxbkpo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Wtm3EsnJl5CGa8or1egt1g_ZLj_qw6N';   // مفتاح عام بطبيعته
const ACCOUNT_EMAIL_DOMAIN = 'raja-players.com';

let supa = null;

// المكتبة ثقيلة (~٢٠٠ كيلو) فما تنحمّل إلا لما أحد يضغط ⚙️
function loadSupabase() {
  if (supa) return Promise.resolve(supa);
  return new Promise((resolve, reject) => {
    const done = () => {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      resolve(supa);
    };
    if (window.supabase?.createClient) { done(); return; }
    const s = document.createElement('script');
    s.src = 'assets/vendor/supabase.js';
    s.onload = done;
    s.onerror = () => reject(new Error('supabase'));
    document.head.appendChild(s);
  });
}

async function usernameToEmail(name) {
  const clean = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const bytes = new TextEncoder().encode('raja:' + clean);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `u${hex}@${ACCOUNT_EMAIL_DOMAIN}`;
}

// نافذة الدخول: اسم المستخدم (أو البريد) وكلمة المرور، في نفس نافذة التنبيهات
function uiLogin(message) {
  return new Promise(resolve => {
    $('modalText').innerHTML = `
      <div class="login-title">🔒 بنك الأسئلة مقفول</div>
      <div class="login-sub">ادخل بحساب إدارة «تحدي رجا»</div>
      ${message ? `<div class="login-error">${escapeHtml(message)}</div>` : ''}
      <form class="login-form" id="loginForm" autocomplete="on">
        <input type="text" id="loginUser" placeholder="اسم المستخدم أو البريد" autocomplete="username" required>
        <input type="password" id="loginPass" placeholder="كلمة المرور" autocomplete="current-password" required>
        <button type="submit" hidden></button>
      </form>`;
    const actions = $('modalActions');
    actions.innerHTML = '';

    const finish = val => { modalClose(); resolve(val); };
    const submit = () => {
      const user = $('loginUser').value.trim(), pass = $('loginPass').value;
      if (!user || !pass) { (user ? $('loginPass') : $('loginUser')).focus(); return; }
      finish({ user, pass });
    };

    const no = document.createElement('button');
    no.className = 'btn-main btn-ghost';
    no.textContent = 'إلغاء';
    no.onclick = () => finish(null);

    const yes = document.createElement('button');
    yes.className = 'btn-main btn-primary';
    yes.textContent = 'دخول';
    yes.onclick = submit;

    $('loginForm').onsubmit = e => { e.preventDefault(); submit(); };
    actions.append(no, yes);
    $('modal').classList.add('show');
    $('loginUser').focus();
  });
}

async function authenticateAdmin() {
  let message = '';
  for (;;) {
    const cred = await uiLogin(message);
    if (!cred) return false;

    let client;
    try { client = await loadSupabase(); }
    catch (e) { await uiAlert('⚠️ الدخول يحتاج إنترنت — تأكد من الاتصال وجرّب مرة ثانية.'); return false; }

    try {
      const raw = cred.user;
      let { error } = await client.auth.signInWithPassword({
        email: raw.includes('@') ? raw.toLowerCase() : await usernameToEmail(raw),
        password: cred.pass,
      });
      // اسم مستخدم لحساب مسجّل ببريد حقيقي: نجرّب المسار الآخر مثل «تحدي رجا»
      if (error && !raw.includes('@')) {
        ({ error } = await client.auth.signInWithPassword({ email: raw.toLowerCase(), password: cred.pass }));
      }
      if (error) { message = '❌ اسم المستخدم أو كلمة المرور غير صحيحة'; continue; }

      const { data: isAdmin, error: rpcError } = await client.rpc('is_admin');
      // نحتاج الجواب فقط، لا جلسة باقية. scope: 'local' ضروري: الافتراضي
      // 'global' يُخرج الحساب من كل أجهزته — ومنها «تحدي رجا» نفسها.
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      if (rpcError || isAdmin !== true) { message = '❌ هذا الحساب ليس حساب إدارة'; continue; }
      return true;
    } catch (e) {
      await uiAlert('⚠️ تعذّر الاتصال بخدمة الدخول — تأكد من الإنترنت.');
      return false;
    }
  }
}

/* ============================= فتح وإغلاق ============================= */
async function openAdmin() {
  Sound.select();
  // تنقفل مع كل إغلاق: المعلم يدخل، وبعده ما يقدر طالب يفتحها بدون الحساب
  if (!await authenticateAdmin()) return;
  const active = document.querySelector('.screen.active');
  adminReturnScreen = active ? active.id : 'screen-home';
  showScreen('screen-admin');
  initAdmin();
}

function closeAdmin() {
  Sound.click();
  cancelEdit();
  showScreen(adminReturnScreen);

  if (adminReturnScreen === 'screen-categories') renderCatGrid();
  else if (adminReturnScreen === 'screen-game') renderBoard();

  updateHomeStats();
}

function initAdmin() {
  $('ptEasy').value = POINTS[0];
  $('ptMed').value = POINTS[1];
  $('ptHard').value = POINTS[2];

  populateSelects();
  renderAdminCategories();
  renderBankList();
  renderBackupInfo();
}

function switchAdminTab(name, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  $(`tab-${name}`)?.classList.add('active');
  btn?.classList.add('active');
  if (name === 'backup') renderBackupInfo();
}

/* ============================= القوائم المنسدلة ============================= */
function populateSelects() {
  const catSel = $('bankCatSelect');
  const keep = catSel.value;
  catSel.innerHTML = '';

  CATEGORIES.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = `${c.ic} ${c.name}`;
    catSel.appendChild(o);
  });
  if (keep && CATEGORIES.some(c => c.id === keep)) catSel.value = keep;

  const diffSel = $('bankDiffSelect');
  if (diffSel.options.length !== 3) {
    diffSel.innerHTML = '';
    DIFFKEY.forEach((k, i) => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = `${DIFFNAME[i]} (${POINTS[i]})`;
      diffSel.appendChild(o);
    });
  } else {
    [...diffSel.options].forEach((o, i) => { o.textContent = `${DIFFNAME[i]} (${POINTS[i]})`; });
  }
}

/* ============================= الأسئلة ============================= */
function ensureBucket(catId, diff) {
  if (!QBANK[catId]) QBANK[catId] = { easy: [], medium: [], hard: [] };
  if (!Array.isArray(QBANK[catId][diff])) QBANK[catId][diff] = [];
  return QBANK[catId][diff];
}

function saveQuestion() {
  const catId = $('bankCatSelect').value;
  const diff = $('bankDiffSelect').value;
  const emoji = $('newQEmoji').value.trim();
  const q = $('newQText').value.trim();
  const a = $('newQAnswer').value.trim();

  if (!catId) { uiAlert('أضف فئة أول من تبويب «الفئات».'); return; }
  if (!q) { uiAlert('اكتب نص السؤال.'); return; }
  if (!a) { uiAlert('اكتب الإجابة الصحيحة.'); return; }

  const item = { emoji: emoji || '❓', q, a };
  if (pendingImg.q) item.img = pendingImg.q;
  if (pendingImg.a) item.aImg = pendingImg.a;

  if (editing) {
    const sameBucket = editing.catId === catId && editing.diff === diff;
    if (sameBucket) {
      // يبقى السؤال في مكانه من القائمة بدل ما يقفز للآخر
      QBANK[catId][diff][editing.idx] = item;
    } else {
      QBANK[editing.catId][editing.diff].splice(editing.idx, 1);
      ensureBucket(catId, diff).push(item);
    }
    cancelEdit();
  } else {
    ensureBucket(catId, diff).push(item);
  }

  saveJSON(K_BANK, QBANK);
  Sound.award();
  clearQForm();
  renderBankList();
  renderAdminCategories();
  renderBackupInfo();
}

function editQuestion(catId, diff, idx) {
  Sound.click();
  const item = QBANK[catId][diff][idx];
  if (!item) return;

  editing = { catId, diff, idx };
  $('bankCatSelect').value = catId;
  $('bankDiffSelect').value = diff;
  $('newQEmoji').value = item.emoji === '❓' ? '' : (item.emoji || '');
  $('newQText').value = item.q;
  $('newQAnswer').value = item.a;
  setPendingImg('q', item.img);
  setPendingImg('a', item.aImg);

  $('qFormTitle').textContent = 'تعديل السؤال';
  $('btnSaveQ').textContent = '💾 احفظ التعديل';
  $('btnCancelEdit').hidden = false;
  renderBankList();
  $('newQText').focus();
}

function cancelEdit() {
  editing = null;
  $('qFormTitle').textContent = 'إضافة سؤال';
  $('btnSaveQ').textContent = '+ إضافة سؤال';
  $('btnCancelEdit').hidden = true;
}

function clearQForm() {
  $('newQEmoji').value = '';
  $('newQText').value = '';
  $('newQAnswer').value = '';
  setPendingImg('q', '');
  setPendingImg('a', '');
}

async function deleteQuestion(catId, diff, idx) {
  const item = QBANK[catId][diff][idx];
  if (!item) return;
  if (!await uiConfirm(`حذف هذا السؤال؟\n\n${item.q}`)) return;

  QBANK[catId][diff].splice(idx, 1);
  saveJSON(K_BANK, QBANK);
  Sound.skip();
  if (editing && editing.catId === catId && editing.diff === diff) cancelEdit();
  renderBankList();
  renderAdminCategories();
  renderBackupInfo();
}

function renderBankList() {
  const wrap = $('bankList');
  const catId = $('bankCatSelect').value;
  const diff = $('bankDiffSelect').value;
  wrap.innerHTML = '';

  const list = (QBANK[catId] || {})[diff] || [];

  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'admin-hint';
    p.textContent = 'ما فيه أسئلة في هذا المستوى — أضف أول سؤال من الحقول فوق.';
    wrap.appendChild(p);
  }

  list.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'bank-item' + (editing && editing.catId === catId && editing.diff === diff && editing.idx === i ? ' editing' : '');

    const body = document.createElement('div');
    body.className = 'bank-item-body';
    const qEl = document.createElement('div');
    qEl.className = 'bank-q';
    qEl.textContent = `${item.img ? '🖼️' : (item.emoji || '❓')} ${item.q}`;
    const aEl = document.createElement('div');
    aEl.className = 'bank-a';
    aEl.textContent = `${item.aImg ? '🖼️ ' : ''}${item.a}`;
    body.appendChild(qEl);
    body.appendChild(aEl);

    const acts = document.createElement('div');
    acts.className = 'bank-item-acts';

    const ed = document.createElement('button');
    ed.type = 'button';
    ed.className = 'icon-btn';
    ed.title = 'تعديل';
    ed.textContent = '✎';
    ed.onclick = () => editQuestion(catId, diff, i);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn danger';
    del.title = 'حذف';
    del.textContent = '✕';
    del.onclick = () => deleteQuestion(catId, diff, i);

    acts.appendChild(ed);
    acts.appendChild(del);
    row.appendChild(body);
    row.appendChild(acts);
    wrap.appendChild(row);
  });

  const cat = CATEGORIES.find(c => c.id === catId);
  const diffIdx = DIFFKEY.indexOf(diff);
  $('bankCount').textContent = cat
    ? `${list.length} سؤال في «${cat.name}» — مستوى ${DIFFNAME[diffIdx]} · الإجمالي ${countAllQuestions()} سؤالاً`
    : `الإجمالي ${countAllQuestions()} سؤالاً`;
}

/* ============================= الفئات ============================= */
function renderAdminCategories() {
  const wrap = $('catAdminList');
  wrap.innerHTML = '';

  if (!CATEGORIES.length) {
    const p = document.createElement('p');
    p.className = 'admin-hint';
    p.textContent = 'ما فيه فئات — أضف أول فئة من الحقل فوق.';
    wrap.appendChild(p);
    return;
  }

  CATEGORIES.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'cat-admin-chip';

    const label = document.createElement('span');
    label.textContent = `${c.ic} ${c.name}`;
    const count = document.createElement('b');
    count.className = 'cat-q-count';
    count.textContent = countCategoryQuestions(c.id);
    label.appendChild(count);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn danger';
    del.title = 'حذف الفئة';
    del.textContent = '✕';
    del.onclick = () => deleteCategory(c.id);

    chip.appendChild(label);
    chip.appendChild(del);
    wrap.appendChild(chip);
  });
}

function addCategory() {
  const name = $('newCatName').value.trim();
  const ic = $('newCatIcon').value.trim() || '✨';

  if (!name) { uiAlert('اكتب اسم الفئة.'); return; }
  if (CATEGORIES.some(c => c.name === name)) { uiAlert('فيه فئة بنفس الاسم.'); return; }

  const id = 'c' + Date.now().toString(36);
  CATEGORIES.push({ id, ic, name });
  QBANK[id] = { easy: [], medium: [], hard: [] };

  saveJSON(K_CATS, CATEGORIES);
  saveJSON(K_BANK, QBANK);
  Sound.award();

  $('newCatName').value = '';
  $('newCatIcon').value = '';
  renderAdminCategories();
  populateSelects();
  renderBackupInfo();
}

async function deleteCategory(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  if (!cat) return;

  const n = countCategoryQuestions(id);
  if (!await uiConfirm(`حذف فئة «${cat.name}»؟\n\nبتروح معها ${n} سؤالاً، ولا رجعة فيها.`)) return;

  CATEGORIES = CATEGORIES.filter(c => c.id !== id);
  delete QBANK[id];
  selectedCats = selectedCats.filter(c => c.id !== id);

  saveJSON(K_CATS, CATEGORIES);
  saveJSON(K_BANK, QBANK);
  Sound.skip();

  renderAdminCategories();
  populateSelects();
  renderBankList();
  renderBackupInfo();
}

/* ============================= النقاط ============================= */
function savePoints() {
  const e = parseInt($('ptEasy').value, 10);
  const m = parseInt($('ptMed').value, 10);
  const h = parseInt($('ptHard').value, 10);

  POINTS = [
    Number.isFinite(e) ? e : 100,
    Number.isFinite(m) ? m : 250,
    Number.isFinite(h) ? h : 400,
  ];

  saveJSON(K_POINTS, POINTS);
  Sound.award();
  populateSelects();
  renderBankList();
  if (boardCats.length) renderBoard();
  uiAlert('✅ تم حفظ النقاط');
}

/* ============================= نسخة احتياطية ============================= */
function renderBackupInfo() {
  $('backupInfo').textContent =
    `عندك ${countAllQuestions()} سؤالاً في ${CATEGORIES.length} فئة.`;
}

function exportBank() {
  Sound.click();
  const data = {
    app: 'watani',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: CATEGORIES,
    points: POINTS,
    bank: QBANK,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `watani-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importBank(file) {
  const reader = new FileReader();

  reader.onload = async () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      uiAlert('الملف مو JSON صالح — تأكد إنه الملف اللي صدّرته من اللعبة.');
      return;
    }

    if (!Array.isArray(data.categories) || !data.bank || typeof data.bank !== 'object') {
      uiAlert('الملف ما فيه فئات وبنك أسئلة — تأكد إنه ملف «اكتشف وطنك مع الإمام عاصم».');
      return;
    }

    const n = Object.values(data.bank).reduce(
      (sum, c) => sum + DIFFKEY.reduce((t, k) => t + ((c && c[k]) || []).length, 0), 0);

    if (!await uiConfirm(`استيراد ${n} سؤالاً في ${data.categories.length} فئة؟\n\nبيستبدل الفئات والأسئلة الحالية.`)) return;

    CATEGORIES = data.categories;
    QBANK = data.bank;
    if (Array.isArray(data.points) && data.points.length === 3) POINTS = data.points;

    saveJSON(K_CATS, CATEGORIES);
    saveJSON(K_BANK, QBANK);
    saveJSON(K_POINTS, POINTS);

    selectedCats = [];
    Sound.award();
    initAdmin();
    uiAlert('✅ تم الاستيراد');
  };

  reader.onerror = () => uiAlert('ما قدرت أقرأ الملف.');
  reader.readAsText(file);
}

async function restoreDefaults() {
  if (!await uiConfirm('ترجيع أسئلة اليوم الوطني الأصلية؟\n\nبتروح كل التعديلات اللي سويتها.')) return;

  CATEGORIES = clone(DEFAULT_CATEGORIES);
  QBANK = clone(DEFAULT_QBANK);
  POINTS = [100, 250, 400];

  saveJSON(K_CATS, CATEGORIES);
  saveJSON(K_BANK, QBANK);
  saveJSON(K_POINTS, POINTS);
  saveJSON(K_SEEN, DEFAULT_CATEGORIES.map(c => c.id));
  saveJSON(K_BANK_VER, DEFAULT_BANK_VERSION);

  selectedCats = [];
  cancelEdit();
  Sound.award();
  initAdmin();
  uiAlert(`✅ رجعت الفئات الأصلية: ${CATEGORIES.length} فئات و${countAllQuestions()} سؤالاً`);
}

async function wipeEverything() {
  if (!await uiConfirm('مسح كل الفئات والأسئلة؟\n\nلا رجعة فيه — صدّر نسخة أول.')) return;

  CATEGORIES = [];
  QBANK = {};
  selectedCats = [];

  saveJSON(K_CATS, CATEGORIES);
  saveJSON(K_BANK, QBANK);

  cancelEdit();
  Sound.skip();
  initAdmin();
}

/* ============================= الربط ============================= */
document.addEventListener('DOMContentLoaded', () => {
  $('btnAdmin').onclick = openAdmin;
  $('btnAdminClose').onclick = closeAdmin;
  $('btnAdminBack').onclick = closeAdmin;

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.onclick = () => { Sound.click(); switchAdminTab(btn.dataset.tab, btn); };
  });

  $('bankCatSelect').onchange = () => renderBankList();
  $('bankDiffSelect').onchange = () => renderBankList();

  $('btnSaveQ').onclick = saveQuestion;
  $('btnCancelEdit').onclick = () => { Sound.click(); cancelEdit(); clearQForm(); renderBankList(); };
  $('newQAnswer').addEventListener('keydown', e => { if (e.key === 'Enter') saveQuestion(); });

  Object.entries(IMG_SLOTS).forEach(([slot, s]) => {
    $(s.btn).onclick = () => { Sound.click(); $(s.file).click(); };
    $(s.file).onchange = e => {
      const f = e.target.files[0];
      if (f) onImagePicked(slot, f);
      e.target.value = '';
    };
    $(s.remove).onclick = () => { Sound.skip(); setPendingImg(slot, ''); };
  });

  $('btnAddCat').onclick = addCategory;
  $('newCatName').addEventListener('keydown', e => { if (e.key === 'Enter') addCategory(); });

  $('btnSavePoints').onclick = savePoints;

  $('btnExport').onclick = exportBank;
  $('btnImport').onclick = () => { Sound.click(); $('importFile').click(); };
  $('importFile').onchange = e => {
    const f = e.target.files[0];
    if (f) importBank(f);
    e.target.value = '';
  };
  $('btnRestore').onclick = restoreDefaults;
  $('btnWipe').onclick = wipeEverything;
});
