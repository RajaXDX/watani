/* =========================================================================
   اكتشف وطنك مع الإمام عاصم — شاشة «عن اللعبة»
   أربعة أقسام: طريقة اللعب، الأدوات، اللغات، الفئات والأسئلة.

   لا رقم مكتوب بيد في قسم البنك: يُبنى من QBANK وCATEGORIES عند كل فتح،
   فيبقى صادقاً بعد أي إضافة من لوحة الإدارة. ونصوص وسائل المساعدة تُقرأ
   من LIFELINES في game.js حتى لا يتفرّق الشرح عن اللعبة.
   يُحمَّل بعد game.js.
   ========================================================================= */

function showAbout() {
  Sound.click();
  showScreen('screen-about');
  renderAboutLifelines();
  renderAboutBank();
}

/* ---- التبويبات ----
   قسم واحد ظاهر في كل مرة: الشرح طويل، وعرضه كاملاً على الجوال يدفن آخره */
function openAboutSection(sec) {
  Sound.click();

  document.querySelectorAll('#aboutToc .about-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.sec === sec);
  });
  document.querySelectorAll('.about-sec').forEach(s => {
    s.classList.toggle('active', s.id === `about-${sec}`);
  });

  $('aboutToc').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---- وسائل المساعدة ---- */
function renderAboutLifelines() {
  $('aboutLifelines').innerHTML = LIFELINES.map(l => `
    <div class="about-ll">
      <span class="all-ic">${l.ic}</span>
      <div>
        <div class="all-name">${escapeHtml(l.name)}</div>
        <div class="all-desc">${escapeHtml(l.desc)}</div>
      </div>
    </div>
  `).join('');
}

/* ---- بنك الأسئلة ---- */
function renderAboutBank() {
  const rows = CATEGORIES.map(c => {
    const cat = QBANK[c.id] || {};
    const counts = DIFFKEY.map(k => (cat[k] || []).length);
    return { c, counts, total: counts.reduce((a, n) => a + n, 0) };
  });
  const total = rows.reduce((a, r) => a + r.total, 0);

  $('aboutStats').innerHTML = [
    [CATEGORIES.length, 'فئة في البنك'],
    [total, 'سؤال'],
    [3, 'مستويات لكل فئة'],
    [18, 'سؤالاً في الجولة'],
  ].map(([n, label]) => `
    <div class="about-stat"><div class="as-num">${ar(n)}</div><div class="as-label">${label}</div></div>
  `).join('');

  const colTotals = DIFFKEY.map((_, i) => rows.reduce((a, r) => a + r.counts[i], 0));

  $('aboutCatTable').innerHTML = `
    <thead>
      <tr>
        <th>الفئة</th>
        ${DIFFNAME.map((name, i) => `<th>${name}<span class="th-pts">${ar(POINTS[i])}</span></th>`).join('')}
        <th>المجموع</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td class="ct-name"><span class="ct-ic">${escapeHtml(r.c.ic)}</span>${escapeHtml(r.c.name)}</td>
          ${r.counts.map(n => `<td class="${n ? '' : 'ct-zero'}">${ar(n)}</td>`).join('')}
          <td class="ct-total">${ar(r.total)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td>${catCount(CATEGORIES.length)}</td>
        ${colTotals.map(n => `<td>${ar(n)}</td>`).join('')}
        <td class="ct-total">${ar(total)}</td>
      </tr>
    </tfoot>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  $('btnAbout').onclick = showAbout;
  $('btnAboutBack').onclick = goHome;
  $('btnAboutPlay').onclick = goSetup;
  document.querySelectorAll('#aboutToc .about-tab').forEach(btn => {
    btn.onclick = () => openAboutSection(btn.dataset.sec);
  });
});
