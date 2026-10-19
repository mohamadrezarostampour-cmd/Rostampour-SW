/* =========================================================================
   Plant engine — shared by Section 4 (Wastewater Treatment Plant) and
   Section 5 (Desalination Plant 1).
   Features: dashboard · daily data entry · analytics (daily / monthly / yearly
   with charts) · equipment register · periodic inspections · repairs & failures ·
   work orders (optional) · activity log · PDF / Word / Excel export · FA/EN · light/dark
   Storage: Firebase Firestore, collections prefixed per plant (sw_… / ds_…)
   ========================================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3BGGIX2B104SdhML7eoxcvl3CjKGfXw4",
  authDomain: "rostampour-water-billing.firebaseapp.com",
  projectId: "rostampour-water-billing",
  storageBucket: "rostampour-water-billing.firebasestorage.app",
  messagingSenderId: "790326632020",
  appId: "1:790326632020:web:91cb2da018fc5e061717c1"
};
const ADMIN_EMAIL = "rostampour@rostampour-system.local";

/* ---------------- language / theme ---------------- */
const getLang = () => { try { return localStorage.getItem('rostampour-lang') || 'fa'; } catch (e) { return 'fa'; } };
const isFa = () => getLang() === 'fa';
const L = (fa, en) => isFa() ? fa : en;
const lab = (o) => isFa() ? o.fa : o.en;
const toFa = (v) => String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const toEn = (v) => String(v).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]).replace(/٫/g, '.').replace(/،/g, '');
const D = (v) => isFa() ? toFa(v) : String(v);
const num = (n, dec) => (n === null || n === undefined || n === '' || isNaN(Number(n))) ? '—' : D(Number(n).toLocaleString('en-US', { maximumFractionDigits: dec === undefined ? 2 : dec }));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const MONTHS_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
const mName = (m) => (isFa() ? MONTHS_FA : MONTHS_EN)[m - 1];

/* ---------------- Jalali calendar helpers (Intl persian) ---------------- */
const JFMT = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
function jParts(d) { const o = {}; JFMT.formatToParts(d).forEach(p => { if (p.type === 'year' || p.type === 'month' || p.type === 'day') o[p.type] = parseInt(p.value, 10); }); return o; }
const isoToJ = (iso) => jParts(new Date(iso + 'T00:00:00Z'));
function jToISO(jy, jm, jd) {
  let g = new Date(Date.UTC(jy + 621, jm - 1, jd));
  for (let i = 0; i < 8; i++) {
    const p = jParts(g);
    if (p.year === jy && p.month === jm && p.day === jd) return g.toISOString().slice(0, 10);
    g = new Date(g.getTime() + ((jy - p.year) * 365 + (jm - p.month) * 30 + (jd - p.day)) * 86400000);
  }
  for (let o = -5; o <= 5; o++) { const c = new Date(g.getTime() + o * 86400000), p = jParts(c); if (p.year === jy && p.month === jm && p.day === jd) return c.toISOString().slice(0, 10); }
  return g.toISOString().slice(0, 10);
}
function daysInJ(jy, jm) { for (let d = 31; d >= 28; d--) { const p = isoToJ(jToISO(jy, jm, d)); if (p.year === jy && p.month === jm && p.day === d) return d; } return 29; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const curJY = () => isoToJ(todayISO()).year;
const jStr = (iso) => { if (!iso) return '—'; const p = isoToJ(iso); return D(`${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`); };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000);

/* ---------------- icons ---------------- */
const ICON = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  entry: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.4 7.4 0 000-3l1.7-1.3-1.5-2.6-2 .7a7.6 7.6 0 00-2.6-1.5L14.6 3h-3l-.4 2.3a7.6 7.6 0 00-2.6 1.5l-2-.7-1.5 2.6 1.7 1.3a7.4 7.4 0 000 3l-1.7 1.3 1.5 2.6 2-.7a7.6 7.6 0 002.6 1.5l.4 2.3h3l.4-2.3a7.6 7.6 0 002.6-1.5l2 .7 1.5-2.6-1.7-1.3z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
  wrench: '<path d="M14.7 6.3a3.5 3.5 0 01-4.4 4.4L4 17l3 3 6.3-6.3a3.5 3.5 0 014.4-4.4l-2.6 2.6-2-2 2.6-2.6z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/>'
};
const svg = (k, s) => `<svg width="${s || 17}" height="${s || 17}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

/* =========================================================================
   startPlant(spec)
   ========================================================================= */
export function startPlant(spec) {
  const fbApp = initializeApp(firebaseConfig);
  const auth = getAuth(fbApp);
  const db = getFirestore(fbApp);
  const P = spec.prefix;
  const COLS = ['daily', 'equipment', 'pm', 'cm', 'log'].concat(spec.workOrders ? ['wo'] : []);
  const S = { daily: [], equipment: [], pm: [], cm: [], wo: [], log: [], view: 'dashboard', ready: false, online: true };
  const UI = { charts: {}, an: { scope: null, mode: 'monthly', jy: curJY(), jm: isoToJ(todayISO()).month }, search: {}, filters: {} };
  let unsubs = [];

  document.documentElement.style.setProperty('--mc', spec.color);
  const root = document.getElementById('root');

  /* ---------------- persistence ---------------- */
  const colRef = (n) => collection(db, P + n);
  const fbAdd = (n, data) => addDoc(colRef(n), JSON.parse(JSON.stringify(data)));
  const fbSet = (n, id, data) => setDoc(doc(db, P + n, id), JSON.parse(JSON.stringify(data)), { merge: true });
  const fbUpd = (n, id, data) => updateDoc(doc(db, P + n, id), JSON.parse(JSON.stringify(data)));
  const fbDel = (n, id) => deleteDoc(doc(db, P + n, id));
  let renderTimer = null;
  const scheduleRender = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => { if (S.ready) renderCurrent(); }, 80); };
  function attach() {
    unsubs.forEach(u => { try { u(); } catch (e) { } }); unsubs = [];
    COLS.forEach(n => {
      unsubs.push(onSnapshot(colRef(n), (snap) => {
        const arr = []; snap.forEach(d => arr.push(Object.assign({ id: d.id }, d.data())));
        S[n] = arr; S.online = true; setStatus(); scheduleRender();
      }, (err) => { console.error('snapshot', n, err); S.online = false; setStatus(); }));
    });
  }
  function setStatus() {
    const dot = document.getElementById('stDot'), tx = document.getElementById('stTxt');
    if (!dot) return;
    dot.className = 'dot-live' + (S.online ? '' : ' off');
    tx.textContent = S.online ? L('داده‌ها به‌صورت آنلاین ذخیره می‌شود', 'Data is stored online') : L('اتصال به حافظه آنلاین برقرار نیست', 'Online storage not reachable');
  }
  async function logAct(action, detail) { try { await fbAdd('log', { at: new Date().toISOString(), action, detail: detail || '' }); } catch (e) { } }

  /* ---------------- toast / modal ---------------- */
  function toast(msg) {
    let t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function modal(title, bodyHtml, onSave, opts) {
    const ov = document.getElementById('overlay'), m = ov.querySelector('.modal');
    m.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3><div class="close-x" id="mClose">✕</div></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">${onSave ? `<button class="btn btn-primary" id="mSave">${(opts && opts.saveLabel) || L('ذخیره', 'Save')}</button>` : ''}<button class="btn btn-ghost" id="mCancel">${onSave ? L('انصراف', 'Cancel') : L('بستن', 'Close')}</button></div>`;
    ov.classList.add('active');
    const close = () => ov.classList.remove('active');
    m.querySelector('#mClose').onclick = close; m.querySelector('#mCancel').onclick = close;
    if (onSave) m.querySelector('#mSave').onclick = async () => {
      const b = m.querySelector('#mSave'); b.disabled = true;
      try { const ok = await onSave(m); if (ok !== false) close(); } catch (e) { console.error(e); toast(L('خطا در ذخیره‌سازی؛ اتصال اینترنت را بررسی کنید', 'Save failed — check your connection')); }
      b.disabled = false;
    };
  }
  const confirmDel = (msg, fn) => modal(L('تأیید حذف', 'Confirm delete'), `<div style="font-size:14px;">${esc(msg)}</div>`, async () => { await fn(); }, { saveLabel: L('حذف', 'Delete') });

  /* ---------------- form helpers ---------------- */
  function dateField(id, label, iso, withFuture) {
    const p = isoToJ(iso || todayISO()), cy = curJY();
    const ys = []; for (let y = cy - 6; y <= cy + (withFuture ? 3 : 1); y++) ys.push(y);
    return `<div class="field"><label>${label}</label><div class="dateline" id="${id}">
      <select data-p="y">${ys.map(y => `<option value="${y}" ${y === p.year ? 'selected' : ''}>${D(y)}</option>`).join('')}</select>
      <select data-p="m">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === p.month ? 'selected' : ''}>${mName(i + 1)}</option>`).join('')}</select>
      <select data-p="d">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === p.day ? 'selected' : ''}>${D(i + 1)}</option>`).join('')}</select></div></div>`;
  }
  function dateVal(m, id) {
    const w = m.querySelector('#' + id); const y = +w.querySelector('[data-p=y]').value, mo = +w.querySelector('[data-p=m]').value;
    let d = +w.querySelector('[data-p=d]').value; d = Math.min(d, daysInJ(y, mo)); return jToISO(y, mo, d);
  }
  const fText = (id, label, v, ph) => `<div class="field"><label>${label}</label><input type="text" id="${id}" value="${esc(v || '')}" placeholder="${esc(ph || '')}"></div>`;
  const fNum = (id, label, v, extra) => `<div class="field"><label>${label}</label><input type="number" inputmode="decimal" step="any" id="${id}" value="${v == null ? '' : esc(v)}" ${extra || ''}></div>`;
  const fArea = (id, label, v) => `<div class="field"><label>${label}</label><textarea id="${id}">${esc(v || '')}</textarea></div>`;
  const fSel = (id, label, opts, v) => `<div class="field"><label>${label}</label><select id="${id}">${opts.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>`;
  const gv = (m, id) => (m.querySelector('#' + id) || {}).value || '';

  /* =====================================================================
     Layout
     ===================================================================== */
  const NAV = [
    ['dashboard', 'dash', ['داشبورد', 'Dashboard']],
    ['entry', 'entry', ['ثبت و ویرایش اطلاعات روزانه', 'Daily data entry']],
    ['reports', 'chart', ['گزارش‌ها و آمار', 'Reports & statistics']],
    ['equipment', 'gear', ['تجهیزات', 'Equipment']],
    ['pm', 'cal', ['بازدید دوره‌ای', 'Periodic inspections']],
    ['cm', 'wrench', ['تعمیرات و خرابی‌ها', 'Repairs & failures']]
  ];
  if (spec.workOrders) NAV.push(['wo', 'list', ['دستورکار', 'Work orders']]);
  NAV.push(['log', 'clock', ['لاگ فعالیت', 'Activity log']]);

  let shownLang = getLang();
  function shell() {
    shownLang = getLang();
    const fa = isFa();
    document.documentElement.lang = fa ? 'fa' : 'en'; document.documentElement.dir = fa ? 'rtl' : 'ltr';
    document.title = lab(spec.title);
    root.innerHTML = `<div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="brand"><div class="brand-logo"><img src="icon-192.png" alt="logo"></div>
          <div class="brand-name">${esc(lab(spec.title))}<small>${esc(lab(spec.subtitle))}</small></div></div>
        <nav class="nav">${NAV.map(([id, ic, t]) => `<div class="nav-item ${S.view === id ? 'active' : ''}" data-view="${id}">${svg(ic)}<span>${esc(L(t[0], t[1]))}</span><span class="nav-count" id="cnt_${id}" style="display:none"></span></div>`).join('')}</nav>
        <div class="sidebar-foot"><span class="dot-live" id="stDot"></span><span id="stTxt"></span></div>
      </aside>
      <div class="scrim" id="scrim"></div>
      <div class="main">
        <div class="topbar"><div style="display:flex;align-items:center;gap:12px;"><button class="menu-btn" id="menuBtn">☰</button>
          <div><h1 id="pgTitle"></h1><div class="sub" id="pgSub"></div></div></div></div>
        <div class="content" id="content"></div>
      </div></div>
      <div class="overlay" id="overlay"><div class="modal"></div></div><div class="toast" id="toast"></div>`;
    root.querySelectorAll('.nav-item').forEach(n => n.onclick = () => go(n.dataset.view));
    document.getElementById('menuBtn').onclick = () => { document.getElementById('sidebar').classList.add('open'); document.getElementById('scrim').classList.add('show'); };
    document.getElementById('scrim').onclick = closeSide;
    setStatus();
  }
  function closeSide() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('scrim').classList.remove('show'); }
  function go(v) { S.view = v; closeSide(); root.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === v)); renderCurrent(); }
  function setTitle(t, s) { document.getElementById('pgTitle').textContent = t; document.getElementById('pgSub').textContent = s || ''; }
  function destroyCharts() { Object.values(UI.charts).forEach(c => { try { c.destroy(); } catch (e) { } }); UI.charts = {}; }
  function renderCurrent() {
    destroyCharts();
    const f = { dashboard: vDash, entry: vEntry, reports: vReports, equipment: vEquip, pm: vPm, cm: vCm, wo: vWo, log: vLog }[S.view];
    if (!f) return;
    f(document.getElementById('content'));
    [['equipment', S.equipment.length], ['pm', S.pm.length], ['cm', S.cm.filter(c => c.status === 'open').length], ['wo', S.wo.filter(w => w.status !== 'done' && w.status !== 'cancelled').length]].forEach(([id, n]) => {
      const e = document.getElementById('cnt_' + id); if (e) { e.style.display = n ? '' : 'none'; e.textContent = D(n); }
    });
  }

  /* ---------------- chart helpers ---------------- */
  const dark = () => document.body.classList.contains('dark-theme');
  const axisC = () => dark() ? '#8db3c2' : '#52708a', gridC = () => dark() ? 'rgba(255,255,255,0.07)' : 'rgba(10,50,65,0.08)';
  const PAL = ['#1565c0', '#00a896', '#ff7a59', '#f5a524', '#7c5cff', '#1f9d76', '#d43439', '#00b8d9'];
  function chartCfg(type, labels, sets, o) {
    o = o || {};
    return { type, data: { labels, datasets: sets }, options: Object.assign({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: axisC(), font: { size: 11 } } } },
      scales: { x: { stacked: !!o.stacked, ticks: { color: axisC(), font: { size: 10 } }, grid: { display: false } }, y: { stacked: !!o.stacked, beginAtZero: o.zero !== false, ticks: { color: axisC() }, grid: { color: gridC() } } } }, o.options || {}) };
  }
  const line = (label, data, color, extra) => Object.assign({ label, data, borderColor: color, backgroundColor: color + '33', tension: .3, spanGaps: true, pointRadius: 2.5, borderWidth: 2 }, extra || {});
  const bar = (label, data, color) => ({ label, data, backgroundColor: color, borderRadius: 3 });
  function mkChart(id, cfg) {
    const cv = document.getElementById(id); if (!cv || typeof Chart === 'undefined') return;
    if (UI.charts[id]) UI.charts[id].destroy();
    UI.charts[id] = new Chart(cv.getContext('2d'), cfg);
  }
  async function ensureChart() { if (typeof Chart === 'undefined') { try { await RK.ensure.chart(); } catch (e) { } } }

  /* ---------------- param aggregation ---------------- */
  const ALLP = []; spec.groups.forEach(g => g.params.forEach(p => ALLP.push(p)));
  const PBY = {}; ALLP.forEach(p => PBY[p.key] = p);
  const dailyMap = () => { const m = {}; S.daily.forEach(r => m[r.date || r.id] = r); return m; };
  function aggregate(p, recs) {
    const vals = recs.map(r => (r.values || {})[p.key]).filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v))).map(Number);
    if (!vals.length) return null;
    const st = RK.stats(vals);
    return { n: vals.length, sum: st.sum, avg: st.avg, min: st.min, max: st.max, last: vals[vals.length - 1],
      v: p.agg === 'sum' ? st.sum : p.agg === 'last' ? vals[vals.length - 1] : st.avg };
  }
  function buckets(mode, jy, jm) {
    const out = [];
    if (mode === 'daily') { const n = daysInJ(jy, jm); for (let d = 1; d <= n; d++) { const iso = jToISO(jy, jm, d); out.push({ label: D(d), full: jStr(iso), from: iso, to: iso }); } }
    else if (mode === 'monthly') { for (let m = 1; m <= 12; m++) out.push({ label: mName(m), full: mName(m) + ' ' + D(jy), from: jToISO(jy, m, 1), to: jToISO(jy, m, daysInJ(jy, m)) }); }
    else { const ys = new Set([curJY()]); S.daily.forEach(r => ys.add(isoToJ(r.date || r.id).year)); [...ys].sort((a, b) => a - b).forEach(y => out.push({ label: D(y), full: D(y), from: jToISO(y, 1, 1), to: jToISO(y, 12, daysInJ(y, 12)) })); }
    return out;
  }
  const recsIn = (b) => S.daily.filter(r => { const d = r.date || r.id; return d >= b.from && d <= b.to; }).sort((a, c) => (a.date || a.id).localeCompare(c.date || c.id));
  const fmtP = (p, v) => v === null || v === undefined ? '—' : num(v, p.dec !== undefined ? p.dec : (p.unit === '' ? 2 : 1));
  const unitOf = (p) => p.unit || '';

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  function vDash(c) {
    setTitle(lab(spec.title), lab(spec.subtitle));
    const dm = dailyMap(), dates = Object.keys(dm).sort(), last = dates[dates.length - 1];
    const today = todayISO(), rec = last ? dm[last] : null;
    const pmS = { overdue: 0, soon: 0, ok: 0 }; S.pm.forEach(p => pmS[pmStat(p).k]++);
    const openCm = S.cm.filter(x => x.status === 'open').length;
    const openWo = S.wo.filter(w => w.status !== 'done' && w.status !== 'cancelled').length;
    const kp = (label, val, sub, color) => `<div class="card kpi" style="--k:${color || 'var(--mc)'};margin:0;"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div><div class="kpi-sub">${sub || ''}</div></div>`;
    const todayDone = !!dm[today];
    c.innerHTML = `
      ${todayDone ? '' : `<div class="notice">⚠️ <div>${L('اطلاعات امروز هنوز ثبت نشده است.', "Today's data has not been entered yet.")} <a href="#" id="goEntry" style="color:var(--accent-2);font-weight:700;">${L('ثبت اطلاعات روز', 'Enter data')}</a></div></div>`}
      <div class="grid kpi-row">
        ${kp(L('آخرین ثبت اطلاعات', 'Last data entry'), last ? jStr(last) : '—', last ? (diffDays(today, last) === 0 ? L('امروز', 'today') : D(diffDays(today, last)) + ' ' + L('روز پیش', 'days ago')) : L('بدون ثبت', 'no data'), 'var(--accent-2)')}
        ${kp(L('تعداد تجهیزات', 'Equipment'), D(S.equipment.length), '', 'var(--violet)')}
        ${kp(L('بازدید معوق', 'Overdue inspections'), D(pmS.overdue), L('نزدیک موعد: ', 'Due soon: ') + D(pmS.soon), pmS.overdue ? 'var(--red)' : 'var(--green)')}
        ${kp(L('تعمیرات باز', 'Open repairs'), D(openCm), '', openCm ? 'var(--amber)' : 'var(--green)')}
        ${spec.workOrders ? kp(L('دستورکار باز', 'Open work orders'), D(openWo), '', openWo ? 'var(--coral)' : 'var(--green)') : ''}
      </div>
      <div class="card"><div class="panel-title"><div><h3>${L('آخرین مقادیر ثبت‌شده', 'Latest recorded values')}</h3><div class="sub">${last ? jStr(last) : ''}</div></div></div>
        ${rec ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));">${spec.dashParams.map(k => { const p = PBY[k]; const v = (rec.values || {})[k]; return `<div style="border:1px solid var(--border);border-radius:10px;padding:9px 12px;background:var(--panel-2);"><div style="font-size:11px;color:var(--text-muted)">${esc(lab(p))}</div><div style="font-family:var(--mono);font-size:17px;font-weight:800;color:var(--accent-2)">${v == null || v === '' ? '—' : fmtP(p, Number(v))} <small style="font-size:10px;color:var(--text-dim);font-weight:500">${esc(unitOf(p))}</small></div></div>`; }).join('')}</div>` : `<div class="empty"><h4>${L('هنوز داده‌ای ثبت نشده است', 'No data recorded yet')}</h4></div>`}
      </div>
      <div class="charts-grid" id="dashCharts"></div>
      <div class="charts-grid">
        <div class="card" style="margin:0;"><div class="panel-title"><h3>${L('بازدیدهای نیازمند توجه', 'Inspections needing attention')}</h3></div><div class="alert-list">${(() => { const a = S.pm.map(p => ({ p, s: pmStat(p) })).filter(x => x.s.k !== 'ok').sort((x, y) => x.s.d - y.s.d).slice(0, 6); return a.length ? a.map(({ p, s }) => `<div class="alert-item"><span class="tag ${s.k === 'overdue' ? 'tag-red' : 'tag-amber'}">${s.k === 'overdue' ? L('معوق', 'Overdue') : L('نزدیک موعد', 'Due soon')}</span><b>${esc(eqName(p.equipmentId))}</b><span style="color:var(--text-muted)">${esc(p.title)}</span><span style="margin-inline-start:auto" class="cell-mono">${jStr(s.due)}</span></div>`).join('') : `<div class="empty" style="padding:14px"><h4>${L('همه بازدیدها به‌روز است', 'All inspections are up to date')}</h4></div>`; })()}</div></div>
        <div class="card" style="margin:0;"><div class="panel-title"><h3>${L('تعمیرات و خرابی‌های باز', 'Open repairs & failures')}</h3></div><div class="alert-list">${(() => { const a = S.cm.filter(x => x.status === 'open').sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6); return a.length ? a.map(x => `<div class="alert-item"><span class="tag tag-amber">${L('باز', 'Open')}</span><b>${esc(eqName(x.equipmentId))}</b><span style="color:var(--text-muted)">${esc((x.issue || '').slice(0, 60))}</span><span style="margin-inline-start:auto" class="cell-mono">${jStr(x.date)}</span></div>`).join('') : `<div class="empty" style="padding:14px"><h4>${L('مورد بازی وجود ندارد', 'No open items')}</h4></div>`; })()}</div></div>
      </div>`;
    const ge = document.getElementById('goEntry'); if (ge) ge.onclick = (e) => { e.preventDefault(); go('entry'); };
    drawDashCharts();
  }
  async function drawDashCharts() {
    await ensureChart();
    const wrap = document.getElementById('dashCharts'); if (!wrap || S.view !== 'dashboard') return;
    const end = todayISO(), days = []; for (let i = 13; i >= 0; i--) days.push(addDays(end, -i));
    const dm = dailyMap();
    wrap.innerHTML = spec.dashCharts.map((c, i) => `<div class="chart-card"><div class="ct">${esc(lab(c.title))} — ${L('۱۴ روز اخیر', 'last 14 days')}</div><div class="chart-box" style="height:210px"><canvas id="dc_${i}"></canvas></div></div>`).join('');
    spec.dashCharts.forEach((c, i) => {
      const sets = c.series.map((k, j) => { const p = PBY[k]; const data = days.map(d => { const v = dm[d] && (dm[d].values || {})[k]; return (v === undefined || v === null || v === '') ? null : Number(v); }); return c.type === 'bar' ? bar(lab(p), data, PAL[j % PAL.length]) : line(lab(p), data, PAL[j % PAL.length]); });
      mkChart('dc_' + i, chartCfg(c.type || 'line', days.map(d => { const p = isoToJ(d); return D(p.month + '/' + p.day); }), sets));
    });
  }

  /* =====================================================================
     DAILY ENTRY
     ===================================================================== */
  function vEntry(c) {
    setTitle(L('ثبت و ویرایش اطلاعات روزانه', 'Daily data entry'), L('یک رکورد برای هر روز؛ ثبت مجدد همان تاریخ، رکورد را ویرایش می‌کند', 'One record per day; saving the same date again updates that record'));
    const gsel = UI.filters.entryGroup || spec.groups[0].id;
    const g = spec.groups.find(x => x.id === gsel) || spec.groups[0];
    const rows = [...S.daily].sort((a, b) => (b.date || b.id).localeCompare(a.date || a.id));
    c.innerHTML = `
      <div class="toolbar"><button class="btn btn-primary" id="addDay">＋ ${L('ثبت اطلاعات روز', 'Enter day data')}</button>
        <div class="seg" id="entG">${spec.groups.map(x => `<button class="btn btn-sm ${x.id === g.id ? 'btn-primary' : 'btn-ghost'}" data-g="${x.id}">${esc(lab(x))}</button>`).join('')}</div>
        <div style="flex:1"></div><div id="entExp">${RK.exportBarHTML()}</div></div>
      <div class="card" style="padding:0;"><div class="table-wrap" style="max-height:62vh;overflow:auto;border:none;"><table>
        <thead><tr><th>${L('تاریخ', 'Date')}</th>${g.params.map(p => `<th>${esc(lab(p))} ${p.unit ? `<span style="font-weight:400">(${esc(p.unit)})</span>` : ''}</th>`).join('')}<th></th></tr></thead>
        <tbody>${rows.length ? rows.map(r => `<tr><td class="cell-strong cell-mono">${jStr(r.date || r.id)}</td>${g.params.map(p => { const v = (r.values || {})[p.key]; return `<td class="cell-mono">${v === null || v === undefined || v === '' ? '—' : fmtP(p, Number(v))}</td>`; }).join('')}
          <td><div class="row-actions"><span class="icon-sm" data-e="${r.id}" title="${L('ویرایش', 'Edit')}">✎</span><span class="icon-sm" data-d="${r.id}" title="${L('حذف', 'Delete')}">🗑</span></div></td></tr>`).join('') : `<tr><td colspan="${g.params.length + 2}"><div class="empty"><h4>${L('رکوردی ثبت نشده است', 'No records yet')}</h4></div></td></tr>`}</tbody></table></div></div>`;
    document.getElementById('addDay').onclick = () => dayForm(null);
    c.querySelectorAll('#entG [data-g]').forEach(b => b.onclick = () => { UI.filters.entryGroup = b.dataset.g; vEntry(c); });
    c.querySelectorAll('[data-e]').forEach(b => b.onclick = () => dayForm(S.daily.find(r => r.id === b.dataset.e)));
    c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const r = S.daily.find(x => x.id === b.dataset.d); confirmDel(L('رکورد روز ', 'Delete record of ') + jStr(r.date || r.id) + L(' حذف شود؟', '?'), async () => { await fbDel('daily', r.id); logAct(L('حذف اطلاعات روزانه', 'Deleted daily data'), jStr(r.date || r.id)); toast(L('حذف شد', 'Deleted')); }); });
    RK.bindExport(document.getElementById('entExp'), async () => ({ title: lab(spec.title) + ' — ' + L('اطلاعات روزانه', 'Daily data'), subtitle: lab(g), meta: [[L('تعداد رکورد', 'Records'), D(rows.length)]],
      sections: [{ title: lab(g), table: { head: [L('تاریخ', 'Date'), ...g.params.map(p => lab(p) + (p.unit ? ` (${p.unit})` : ''))], rows: rows.map(r => [jStr(r.date || r.id), ...g.params.map(p => { const v = (r.values || {})[p.key]; return v === null || v === undefined || v === '' ? '—' : fmtP(p, Number(v)); })]) } }] }),
      () => spec.id + '-daily-' + g.id, toast);
  }
  function dayForm(existing) {
    const iso = existing ? (existing.date || existing.id) : todayISO();
    const html = dateField('f_date', L('تاریخ (شمسی)', 'Date (Jalali)'), iso) +
      `<div id="dayHint" class="notice" style="display:none;margin:0;">ℹ️ ${L('برای این تاریخ قبلاً اطلاعات ثبت شده؛ ذخیره، آن را ویرایش می‌کند.', 'A record already exists for this date; saving will update it.')}</div>` +
      spec.groups.map(g => `<div class="fgroup"><div class="fg-title">${esc(lab(g))}</div><div class="field-row">${g.params.map(p => {
        const v = existing && existing.values ? existing.values[p.key] : '';
        return fNum('f_' + p.key, `${esc(lab(p))}${p.unit ? `<span class="u">(${esc(p.unit)})</span>` : ''}`, v === undefined || v === null ? '' : v, `${p.min !== undefined ? `min="${p.min}"` : ''} ${p.max !== undefined ? `max="${p.max}"` : ''}`);
      }).join('')}</div></div>`).join('');
    modal(existing ? L('ویرایش اطلاعات روز', 'Edit day data') : L('ثبت اطلاعات روز', 'Enter day data'), html, async (m) => {
      const date = dateVal(m, 'f_date'); const values = {}; let bad = null;
      ALLP.forEach(p => {
        const raw = toEn(gv(m, 'f_' + p.key)).trim();
        if (raw === '') { values[p.key] = null; return; }
        const n = Number(raw); if (isNaN(n)) { bad = lab(p); return; }
        if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)) { bad = lab(p) + ` (${p.min !== undefined ? p.min : ''}–${p.max !== undefined ? p.max : ''})`; return; }
        values[p.key] = n;
      });
      if (bad) { toast(L('مقدار نامعتبر: ', 'Invalid value: ') + bad); return false; }
      if (Object.values(values).every(v => v === null)) { toast(L('حداقل یک مقدار وارد کنید', 'Enter at least one value')); return false; }
      const old = S.daily.find(r => (r.date || r.id) === date);
      const merged = Object.assign({}, old && old.values ? old.values : {}, existing || !old ? values : values);
      await fbSet('daily', date, { date, values: merged, updatedAt: new Date().toISOString() });
      logAct(old ? L('ویرایش اطلاعات روزانه', 'Updated daily data') : L('ثبت اطلاعات روزانه', 'Entered daily data'), jStr(date));
      toast(L('ذخیره شد', 'Saved'));
    });
    const chk = () => { const m = document.querySelector('.modal'); if (!m || !m.querySelector('#f_date')) return; const d = dateVal(m, 'f_date'); const ex = S.daily.find(r => (r.date || r.id) === d); m.querySelector('#dayHint').style.display = (ex && !existing) ? '' : 'none'; if (ex && !existing) { ALLP.forEach(p => { const el = m.querySelector('#f_' + p.key); if (el && el.value === '' && ex.values && ex.values[p.key] != null) el.value = ex.values[p.key]; }); } };
    document.querySelectorAll('#f_date select').forEach(s => s.addEventListener('change', chk)); chk();
  }

  /* =====================================================================
     REPORTS / ANALYTICS
     ===================================================================== */
  function groupStats(g) {
    const A = UI.an, bk = buckets(A.mode, A.jy, A.jm);
    const per = bk.map(b => { const rs = recsIn(b); const o = {}; g.params.forEach(p => o[p.key] = aggregate(p, rs)); o._days = rs.length; return o; });
    const allRecs = S.daily.filter(r => { const d = r.date || r.id; return d >= bk[0].from && d <= bk[bk.length - 1].to; }).sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
    const tot = {}; g.params.forEach(p => tot[p.key] = aggregate(p, allRecs));
    const derivedVals = per.map(o => { const dv = {}; (g.derived || []).forEach(d => { const base = {}; g.params.forEach(p => base[p.key] = o[p.key] ? o[p.key].v : null); ALLP.forEach(p => { if (!(p.key in base)) { base[p.key] = null; } }); const val = d.fn(base); dv[d.key] = (val === null || val === undefined || !isFinite(val)) ? null : val; }); return dv; });
    const derivedTot = {}; (g.derived || []).forEach(d => { const base = {}; ALLP.forEach(p => base[p.key] = tot[p.key] ? tot[p.key].v : null); const val = d.fn(base); derivedTot[d.key] = (val === null || val === undefined || !isFinite(val)) ? null : val; });
    return { bk, per, tot, derivedVals, derivedTot, allRecs };
  }
  function buildGroup(g) {
    const st = groupStats(g), labels = st.bk.map(b => b.label);
    const kpis = [];
    g.params.forEach(p => {
      const t = st.tot[p.key]; if (!t) { kpis.push({ label: lab(p), value: '—', unit: unitOf(p) }); return; }
      if (p.agg === 'sum') kpis.push({ label: lab(p) + ' — ' + L('مجموع', 'Total'), value: fmtP(p, t.sum), unit: unitOf(p) }, { label: lab(p) + ' — ' + L('میانگین روزانه', 'Daily avg'), value: fmtP(p, t.avg), unit: unitOf(p) });
      else kpis.push({ label: lab(p) + ' — ' + L('میانگین', 'Average'), value: fmtP(p, t.avg), unit: unitOf(p) }, { label: lab(p) + ' — ' + L('کمینه / بیشینه', 'Min / Max'), value: fmtP(p, t.min) + ' / ' + fmtP(p, t.max), unit: unitOf(p) });
    });
    (g.derived || []).forEach(d => kpis.push({ label: lab(d), value: st.derivedTot[d.key] == null ? '—' : num(st.derivedTot[d.key], d.dec !== undefined ? d.dec : 1), unit: d.unit || '' }));
    const head = [L('بازه', 'Period'), ...g.params.map(p => lab(p) + (p.unit ? ` (${p.unit})` : '') + (p.agg === 'sum' ? ' Σ' : p.agg === 'last' ? ' ⟲' : ' ⌀')), ...(g.derived || []).map(d => lab(d) + (d.unit ? ` (${d.unit})` : '')), L('روزهای ثبت‌شده', 'Days')];
    const rows = st.bk.map((b, i) => [b.full, ...g.params.map(p => st.per[i][p.key] ? fmtP(p, st.per[i][p.key].v) : '—'), ...(g.derived || []).map(d => st.derivedVals[i][d.key] == null ? '—' : num(st.derivedVals[i][d.key], d.dec !== undefined ? d.dec : 1)), D(st.per[i]._days)]);
    const charts = (g.charts || []).map(cd => ({ title: lab(cd.title), type: cd.type || 'line', cfg: () => {
      const sets = cd.series.map((k, j) => {
        const isDer = (g.derived || []).some(d => d.key === k);
        const p = isDer ? g.derived.find(d => d.key === k) : PBY[k];
        const data = st.per.map((o, i) => isDer ? st.derivedVals[i][k] : (o[k] ? Number(o[k].v.toFixed(3)) : null));
        const color = (cd.colors && cd.colors[j]) || PAL[j % PAL.length];
        return cd.type === 'bar' ? bar(lab(p) + (p.unit ? ` (${p.unit})` : ''), data, color) : line(lab(p) + (p.unit ? ` (${p.unit})` : ''), data, color);
      });
      return chartCfg(cd.type || 'line', labels, sets, { stacked: cd.stacked, zero: cd.zero });
    } }));
    return { title: lab(g), kpis, head, rows, charts };
  }
  /* --- maintenance statistics --- */
  const catLab = (k) => { const c = spec.categories.find(x => x.key === k); return c ? lab(c) : (k || '—'); };
  function buildMaint() {
    const A = UI.an, bk = buckets(A.mode, A.jy, A.jm), rg = { from: bk[0].from, to: bk[bk.length - 1].to };
    const eqBy = {}; S.equipment.forEach(e => eqBy[e.id] = e);
    const cms = S.cm.filter(c => c.date >= rg.from && c.date <= rg.to);
    const open = cms.filter(c => c.status === 'open').length;
    const durs = cms.filter(c => c.status === 'closed' && c.closedAt).map(c => Math.max(0, diffDays(c.closedAt, c.date)));
    const ds = RK.stats(durs);
    const pmS = { overdue: 0, soon: 0, ok: 0 }; S.pm.forEach(p => pmS[pmStat(p).k]++);
    const compl = S.pm.length ? Math.round((pmS.ok + pmS.soon) / S.pm.length * 100) : 0;
    const pmDone = []; S.pm.forEach(p => { const h = new Set(Array.isArray(p.history) ? p.history : []); if (p.lastDone) h.add(p.lastDone); h.forEach(d => { if (d >= rg.from && d <= rg.to) pmDone.push(d); }); });
    const woIn = S.wo.filter(w => w.date >= rg.from && w.date <= rg.to);
    const kpis = [
      { label: L('تعداد تجهیزات', 'Equipment'), value: D(S.equipment.length), unit: '' },
      { label: L('تعمیرات ثبت‌شده', 'Repairs logged'), value: D(cms.length), unit: '' },
      { label: L('تعمیرات باز', 'Open repairs'), value: D(open), unit: '' },
      { label: L('میانگین زمان رفع خرابی', 'Avg time to repair'), value: ds.n ? num(ds.avg, 1) : '—', unit: L('روز', 'days') },
      { label: L('بازدیدهای انجام‌شده', 'Inspections done'), value: D(pmDone.length), unit: '' },
      { label: L('بازدید معوق', 'Overdue inspections'), value: D(pmS.overdue), unit: '' },
      { label: L('نرخ انطباق بازدید', 'Inspection compliance'), value: D(compl) + '٪', unit: '' }
    ];
    if (spec.workOrders) kpis.push({ label: L('دستورکارها', 'Work orders'), value: D(woIn.length), unit: '' }, { label: L('دستورکار تکمیل‌شده', 'Completed work orders'), value: D(woIn.filter(w => w.status === 'done').length), unit: '' });
    const labels = bk.map(b => b.label);
    const cmN = bk.map(b => S.cm.filter(c => c.date >= b.from && c.date <= b.to).length);
    const pmN = bk.map(b => { let n = 0; S.pm.forEach(p => { const h = new Set(Array.isArray(p.history) ? p.history : []); if (p.lastDone) h.add(p.lastDone); h.forEach(d => { if (d >= b.from && d <= b.to) n++; }); }); return n; });
    const woN = bk.map(b => S.wo.filter(w => w.date >= b.from && w.date <= b.to).length);
    const byEq = {}; cms.forEach(c => { const n = (eqBy[c.equipmentId] || {}).name || '—'; byEq[n] = (byEq[n] || 0) + 1; });
    const stL = (s) => s === 'open' ? L('باز', 'Open') : L('بسته‌شده', 'Closed');
    const tables = [
      { title: L('ریز تعمیرات و خرابی‌ها', 'Repairs & failures log'), head: [L('تاریخ', 'Date'), L('تجهیز', 'Equipment'), L('شرح', 'Issue'), L('اقدام', 'Action'), L('تکنسین', 'Technician'), L('وضعیت', 'Status'), L('روز تا رفع', 'Days to fix')], rows: [...cms].sort((a, b) => a.date.localeCompare(b.date)).map(c => [jStr(c.date), (eqBy[c.equipmentId] || {}).name || '—', c.issue || '', c.action || '', c.technician || '—', stL(c.status), c.closedAt ? D(Math.max(0, diffDays(c.closedAt, c.date))) : '—']) },
      { title: L('وضعیت بازدیدهای دوره‌ای', 'Periodic inspection status'), head: [L('وضعیت', 'Status'), L('تجهیز', 'Equipment'), L('بازدید', 'Inspection'), L('تناوب (روز)', 'Interval'), L('آخرین انجام', 'Last done'), L('موعد بعدی', 'Next due')], rows: S.pm.map(p => { const s = pmStat(p); return [s.k === 'overdue' ? L('معوق', 'Overdue') : s.k === 'soon' ? L('نزدیک موعد', 'Due soon') : L('به‌روز', 'On time'), eqName(p.equipmentId), p.title, D(p.freqDays), p.lastDone ? jStr(p.lastDone) : '—', jStr(s.due)]; }) },
      { title: L('تجهیزات پرخرابی', 'Most failure-prone equipment'), head: [L('تجهیز', 'Equipment'), L('تعداد خرابی', 'Failures')], rows: Object.entries(byEq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, D(v)]) },
      { title: L('فهرست تجهیزات', 'Equipment register'), head: [L('نام', 'Name'), L('دسته', 'Category'), L('سریال / پلاک', 'Serial'), L('محل نصب', 'Location'), L('تاریخ نصب', 'Install date')], rows: S.equipment.map(e => [e.name, catLab(e.category), e.serial || '—', e.location || '—', e.installDate ? jStr(e.installDate) : '—']) }
    ];
    if (spec.workOrders) tables.splice(2, 0, { title: L('فهرست دستورکارها', 'Work orders'), head: [L('شماره', 'No.'), L('تاریخ', 'Date'), L('تجهیز', 'Equipment'), L('نوع', 'Type'), L('اولویت', 'Priority'), L('شرح', 'Description'), L('مسئول', 'Assignee'), L('وضعیت', 'Status')], rows: [...woIn].sort((a, b) => a.date.localeCompare(b.date)).map(w => [w.no || '—', jStr(w.date), eqName(w.equipmentId), woTypeL(w.type), woPrioL(w.priority), w.description || '', w.assignee || '—', woStatL(w.status)]) });
    const sets = [{ label: L('تعمیرات', 'Repairs'), data: cmN, backgroundColor: '#ff7a59', borderRadius: 3 }, { label: L('بازدیدها', 'Inspections'), data: pmN, backgroundColor: '#00a896', borderRadius: 3 }];
    if (spec.workOrders) sets.push({ label: L('دستورکارها', 'Work orders'), data: woN, backgroundColor: '#1565c0', borderRadius: 3 });
    return { title: L('آمار تعمیرات، بازدید و دستورکار', 'Maintenance, inspections & work orders'), kpis, head: null, rows: null, extraTables: tables,
      charts: [{ title: L('تعمیرات / بازدیدها در هر بازه', 'Repairs / inspections per period'), type: 'bar', cfg: () => chartCfg('bar', labels, sets) },
        { title: L('وضعیت بازدیدها', 'Inspection status'), type: 'doughnut', cfg: () => ({ type: 'doughnut', data: { labels: [L('به‌روز', 'On time'), L('نزدیک موعد', 'Due soon'), L('معوق', 'Overdue')], datasets: [{ data: [pmS.ok, pmS.soon, pmS.overdue], backgroundColor: ['#1f9d76', '#f5a524', '#d43439'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisC() } } } } }) }] };
  }
  const scopes = () => spec.groups.map(g => [g.id, lab(g)]).concat([['maint', L('تعمیرات و بازدید', 'Maintenance')], ['all', L('گزارش جامع (همه)', 'Full report (all)')]]);
  const build = (id) => id === 'maint' ? buildMaint() : buildGroup(spec.groups.find(g => g.id === id));
  const scopeIds = () => UI.an.scope === 'all' ? spec.groups.map(g => g.id).concat(['maint']) : [UI.an.scope];
  const periodTitle = () => { const A = UI.an; return A.mode === 'daily' ? L('روزانه', 'Daily') + ' — ' + mName(A.jm) + ' ' + D(A.jy) : A.mode === 'monthly' ? L('ماهانه', 'Monthly') + ' — ' + D(A.jy) : L('سالانه', 'Yearly'); };

  function vReports(c) {
    const A = UI.an; if (!A.scope) A.scope = spec.groups[0].id;
    setTitle(L('گزارش‌ها و آمار', 'Reports & statistics'), L('آمار روزانه، ماهانه و سالانه با نمودار و خروجی PDF / Word / Excel', 'Daily, monthly & yearly statistics with charts and PDF / Word / Excel export'));
    const ys = new Set([curJY()]); S.daily.forEach(r => ys.add(isoToJ(r.date || r.id).year)); S.cm.forEach(r => r.date && ys.add(isoToJ(r.date).year));
    c.innerHTML = `<div class="card"><div class="seg" id="anSc" style="margin-bottom:12px;">${scopes().map(([k, l]) => `<button class="btn btn-sm ${A.scope === k ? 'btn-primary' : 'btn-ghost'}" data-s="${k}">${esc(l)}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div class="seg" id="anMo">${[['daily', L('روزانه', 'Daily')], ['monthly', L('ماهانه', 'Monthly')], ['yearly', L('سالانه', 'Yearly')]].map(([k, l]) => `<button class="btn btn-sm ${A.mode === k ? 'btn-primary' : 'btn-ghost'}" data-m="${k}">${l}</button>`).join('')}</div>
        <div class="field" style="min-width:100px;${A.mode === 'yearly' ? 'display:none' : ''}"><label>${L('سال', 'Year')}</label><select id="anY">${[...ys].sort((a, b) => b - a).map(y => `<option value="${y}" ${y === A.jy ? 'selected' : ''}>${D(y)}</option>`).join('')}</select></div>
        <div class="field" style="min-width:120px;${A.mode === 'daily' ? '' : 'display:none'}"><label>${L('ماه', 'Month')}</label><select id="anM">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === A.jm ? 'selected' : ''}>${mName(i + 1)}</option>`).join('')}</select></div>
        <div style="flex:1"></div><div id="anExp">${RK.exportBarHTML()}</div></div></div><div id="anBody"></div>`;
    c.querySelectorAll('#anSc [data-s]').forEach(b => b.onclick = () => { A.scope = b.dataset.s; vReports(c); });
    c.querySelectorAll('#anMo [data-m]').forEach(b => b.onclick = () => { A.mode = b.dataset.m; vReports(c); });
    document.getElementById('anY').onchange = (e) => { A.jy = +e.target.value; renderAnBody(); };
    document.getElementById('anM').onchange = (e) => { A.jm = +e.target.value; renderAnBody(); };
    RK.bindExport(document.getElementById('anExp'), getReport, () => spec.id + '-' + A.scope + '-' + A.mode + '-' + (A.mode === 'yearly' ? 'all' : A.jy), toast);
    renderAnBody();
  }
  async function renderAnBody() {
    destroyCharts(); await ensureChart();
    const body = document.getElementById('anBody'); if (!body) return;
    const built = scopeIds().map(id => ({ id, d: build(id) }));
    body.innerHTML = built.map(({ id, d }) => `<div class="card"><div class="panel-title"><div><h3>${esc(d.title)}</h3><div class="sub">${esc(periodTitle())}</div></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));margin-bottom:14px;">${d.kpis.map(k => `<div style="border:1px solid var(--border);border-radius:10px;padding:8px 11px;background:var(--panel-2);"><div style="font-size:10.5px;color:var(--text-muted)">${esc(k.label)}</div><div style="font-family:var(--mono);font-size:15.5px;font-weight:800;color:var(--accent-2)">${esc(k.value)} <small style="font-size:10px;color:var(--text-dim);font-weight:500">${esc(k.unit || '')}</small></div></div>`).join('')}</div>
      <div class="charts-grid">${d.charts.map((ch, i) => `<div class="chart-card"><div class="ct">${esc(ch.title)}</div><div class="chart-box"><canvas id="an_${id}_${i}"></canvas></div></div>`).join('')}</div>
      ${d.rows ? `<div class="table-wrap" style="max-height:440px;overflow:auto;"><table><thead><tr>${d.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr>${r.map((x, i) => `<td class="${i ? 'cell-mono' : 'cell-strong'}">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${(d.extraTables || []).map(t => `<div style="margin-top:16px;"><div style="font-weight:800;font-size:13px;margin-bottom:6px;">${esc(t.title)}</div><div class="table-wrap" style="max-height:340px;overflow:auto;"><table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.length ? t.rows.map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.head.length}" style="text-align:center;color:var(--text-dim)">${L('داده‌ای ثبت نشده', 'No data')}</td></tr>`}</tbody></table></div></div>`).join('')}</div>`).join('');
    if (typeof Chart !== 'undefined') built.forEach(({ id, d }) => d.charts.forEach((ch, i) => mkChart(`an_${id}_${i}`, ch.cfg())));
    else body.insertAdjacentHTML('afterbegin', `<div class="notice">⚠️ ${L('نمایش نمودارها نیاز به اتصال اینترنت دارد.', 'Charts need an internet connection.')}</div>`);
  }
  async function getReport() {
    const sections = [];
    for (const id of scopeIds()) {
      const d = build(id);
      for (let i = 0; i < d.charts.length; i++) {
        const ch = d.charts[i]; let img = '';
        try { const cfg = JSON.parse(JSON.stringify(ch.cfg(), (k, v) => (v === '#8db3c2' ? '#52708a' : v === 'rgba(255,255,255,0.07)' ? 'rgba(10,50,65,0.08)' : v))); img = await RK.chartImage(cfg, ch.type === 'doughnut' ? 520 : 900, ch.type === 'doughnut' ? 330 : 350); } catch (e) { }
        sections.push({ title: i === 0 ? d.title + ' — ' + ch.title : ch.title, kpis: i === 0 ? d.kpis : null, chart: img });
      }
      if (!d.charts.length) sections.push({ title: d.title, kpis: d.kpis });
      if (d.rows) sections.push({ title: d.title + ' — ' + L('جدول تفصیلی', 'Detailed table'), table: { head: d.head, rows: d.rows } });
      (d.extraTables || []).forEach(t => sections.push({ title: t.title, table: { head: t.head, rows: t.rows } }));
    }
    return { title: lab(spec.title) + ' — ' + L('گزارش جامع', 'Comprehensive report'), subtitle: periodTitle(), meta: [[L('بخش', 'Section'), lab(spec.title)], [L('بازه', 'Scope'), periodTitle()]], sections };
  }

  /* =====================================================================
     EQUIPMENT
     ===================================================================== */
  const eqName = (id) => (S.equipment.find(e => e.id === id) || {}).name || '—';
  function listExport(containerId, titleFn, headFn, rowsFn, base) {
    RK.bindExport(document.getElementById(containerId), async () => ({ title: lab(spec.title) + ' — ' + titleFn(), subtitle: '', meta: [], sections: [{ title: titleFn(), table: { head: headFn(), rows: rowsFn() } }] }), () => spec.id + '-' + base, toast);
  }
  function vEquip(c) {
    setTitle(L('تجهیزات', 'Equipment'), L('فهرست تجهیزات و ماشین‌آلات', 'Register of equipment and machinery'));
    const q = (UI.search.eq || '').toLowerCase(), cat = UI.filters.eqCat || '';
    const rows = S.equipment.filter(e => (!cat || e.category === cat) && (!q || (e.name + (e.serial || '') + (e.location || '')).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    c.innerHTML = `<div class="toolbar"><button class="btn btn-primary" id="add">＋ ${L('افزودن تجهیز', 'Add equipment')}</button>
      <div class="search">🔍<input id="q" placeholder="${L('جستجو...', 'Search...')}" value="${esc(UI.search.eq || '')}"></div>
      <select id="cat"><option value="">${L('همه دسته‌ها', 'All categories')}</option>${spec.categories.map(k => `<option value="${k.key}" ${cat === k.key ? 'selected' : ''}>${esc(lab(k))}</option>`).join('')}</select><div id="exp">${RK.exportBarHTML()}</div></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:none"><table><thead><tr><th>${L('دسته', 'Category')}</th><th>${L('نام تجهیز', 'Name')}</th><th>${L('شماره سریال / پلاک', 'Serial / tag')}</th><th>${L('محل نصب', 'Location')}</th><th>${L('تاریخ نصب', 'Install date')}</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map(e => `<tr><td><span class="tag tag-blue">${esc(catLab(e.category))}</span></td><td class="cell-strong">${esc(e.name)}</td><td class="cell-mono">${esc(e.serial || '—')}</td><td>${esc(e.location || '—')}</td><td class="cell-mono">${e.installDate ? jStr(e.installDate) : '—'}</td>
        <td><div class="row-actions"><span class="icon-sm" data-e="${e.id}">✎</span><span class="icon-sm" data-d="${e.id}">🗑</span></div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty"><h4>${L('تجهیزی ثبت نشده است', 'No equipment yet')}</h4><p>${L('با دکمه «افزودن تجهیز» شروع کنید.', 'Start with “Add equipment”.')}</p></div></td></tr>`}</tbody></table></div></div>`;
    document.getElementById('add').onclick = () => equipForm(null);
    document.getElementById('q').oninput = (e) => { UI.search.eq = e.target.value; const p = e.target.selectionStart; vEquip(c); const el = document.getElementById('q'); el.focus(); el.setSelectionRange(p, p); };
    document.getElementById('cat').onchange = (e) => { UI.filters.eqCat = e.target.value; vEquip(c); };
    c.querySelectorAll('[data-e]').forEach(b => b.onclick = () => equipForm(S.equipment.find(e => e.id === b.dataset.e)));
    c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const e = S.equipment.find(x => x.id === b.dataset.d); confirmDel(L('تجهیز «', 'Delete equipment “') + e.name + L('» حذف شود؟', '”?'), async () => { await fbDel('equipment', e.id); logAct(L('حذف تجهیز', 'Deleted equipment'), e.name); toast(L('حذف شد', 'Deleted')); }); });
    listExport('exp', () => L('فهرست تجهیزات', 'Equipment register'), () => [L('دسته', 'Category'), L('نام', 'Name'), L('سریال / پلاک', 'Serial'), L('محل نصب', 'Location'), L('تاریخ نصب', 'Install date')], () => rows.map(e => [catLab(e.category), e.name, e.serial || '—', e.location || '—', e.installDate ? jStr(e.installDate) : '—']), 'equipment');
  }
  function equipForm(ex) {
    modal(ex ? L('ویرایش تجهیز', 'Edit equipment') : L('افزودن تجهیز', 'Add equipment'),
      fSel('f_cat', L('دسته تجهیز', 'Category'), spec.categories.map(k => ({ v: k.key, l: lab(k) })), ex && ex.category) + fText('f_name', L('نام تجهیز', 'Equipment name'), ex && ex.name) + fText('f_serial', L('شماره سریال / پلاک', 'Serial / tag number'), ex && ex.serial) + fText('f_loc', L('محل نصب', 'Install location'), ex && ex.location) + dateField('f_inst', L('تاریخ نصب (شمسی)', 'Install date (Jalali)'), ex && ex.installDate) + fArea('f_notes', L('توضیحات', 'Notes'), ex && ex.notes),
      async (m) => {
        const name = gv(m, 'f_name').trim(); if (!name) { toast(L('نام تجهیز را وارد کنید', 'Enter the equipment name')); return false; }
        const rec = { category: gv(m, 'f_cat'), name, serial: gv(m, 'f_serial').trim(), location: gv(m, 'f_loc').trim(), installDate: dateVal(m, 'f_inst'), notes: gv(m, 'f_notes').trim() };
        if (ex) await fbUpd('equipment', ex.id, rec); else await fbAdd('equipment', Object.assign({ createdAt: todayISO() }, rec));
        logAct(ex ? L('ویرایش تجهیز', 'Edited equipment') : L('افزودن تجهیز', 'Added equipment'), name); toast(L('ذخیره شد', 'Saved'));
      });
  }

  /* =====================================================================
     PERIODIC INSPECTIONS (PM)
     ===================================================================== */
  const FREQS = [[1, ['روزانه', 'Daily']], [7, ['هفتگی', 'Weekly']], [14, ['دو هفته', 'Bi-weekly']], [30, ['ماهانه', 'Monthly']], [90, ['سه‌ماهه', 'Quarterly']], [180, ['شش‌ماهه', 'Semi-annual']], [365, ['سالانه', 'Annual']]];
  function pmStat(p) { const base = p.lastDone || p.createdAt || todayISO(); const due = addDays(base, Number(p.freqDays) || 30); const d = diffDays(due, todayISO()); return { k: d < 0 ? 'overdue' : d <= 7 ? 'soon' : 'ok', d, due }; }
  function vPm(c) {
    setTitle(L('بازدید دوره‌ای', 'Periodic inspections'), L('برنامه‌ریزی و پایش بازدیدهای پیشگیرانه', 'Planning and monitoring preventive inspections'));
    const f = UI.filters.pm || '';
    const rows = S.pm.map(p => ({ p, s: pmStat(p) })).filter(x => !f || x.s.k === f).sort((a, b) => a.s.d - b.s.d);
    c.innerHTML = `<div class="toolbar"><button class="btn btn-primary" id="add">＋ ${L('تعریف بازدید', 'Define inspection')}</button>
      <select id="st"><option value="">${L('همه وضعیت‌ها', 'All statuses')}</option><option value="overdue" ${f === 'overdue' ? 'selected' : ''}>${L('معوق', 'Overdue')}</option><option value="soon" ${f === 'soon' ? 'selected' : ''}>${L('نزدیک موعد', 'Due soon')}</option><option value="ok" ${f === 'ok' ? 'selected' : ''}>${L('به‌روز', 'On time')}</option></select><div style="flex:1"></div><div id="exp">${RK.exportBarHTML()}</div></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:none"><table><thead><tr><th>${L('وضعیت', 'Status')}</th><th>${L('تجهیز', 'Equipment')}</th><th>${L('عنوان بازدید', 'Inspection')}</th><th>${L('تناوب', 'Interval')}</th><th>${L('آخرین انجام', 'Last done')}</th><th>${L('موعد بعدی', 'Next due')}</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map(({ p, s }) => `<tr><td><span class="tag ${s.k === 'overdue' ? 'tag-red' : s.k === 'soon' ? 'tag-amber' : 'tag-green'}">${s.k === 'overdue' ? L('معوق', 'Overdue') : s.k === 'soon' ? L('نزدیک موعد', 'Due soon') : L('به‌روز', 'On time')}</span></td><td class="cell-strong">${esc(eqName(p.equipmentId))}</td><td>${esc(p.title)}</td><td>${esc(freqL(p.freqDays))}</td><td class="cell-mono">${p.lastDone ? jStr(p.lastDone) : '—'}</td><td class="cell-mono">${jStr(s.due)}</td>
        <td><div class="row-actions"><button class="btn btn-sm" data-ok="${p.id}">✓ ${L('انجام شد', 'Done')}</button><span class="icon-sm" data-e="${p.id}">✎</span><span class="icon-sm" data-d="${p.id}">🗑</span></div></td></tr>`).join('') : `<tr><td colspan="7"><div class="empty"><h4>${L('بازدیدی تعریف نشده است', 'No inspections defined')}</h4></div></td></tr>`}</tbody></table></div></div>`;
    document.getElementById('add').onclick = () => pmForm(null);
    document.getElementById('st').onchange = (e) => { UI.filters.pm = e.target.value; vPm(c); };
    c.querySelectorAll('[data-e]').forEach(b => b.onclick = () => pmForm(S.pm.find(x => x.id === b.dataset.e)));
    c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const p = S.pm.find(x => x.id === b.dataset.d); confirmDel(L('این بازدید حذف شود؟', 'Delete this inspection?'), async () => { await fbDel('pm', p.id); logAct(L('حذف بازدید', 'Deleted inspection'), p.title); toast(L('حذف شد', 'Deleted')); }); });
    c.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => { const p = S.pm.find(x => x.id === b.dataset.ok); const h = Array.isArray(p.history) ? [...p.history] : []; h.push(todayISO()); await fbUpd('pm', p.id, { lastDone: todayISO(), history: h }); logAct(L('ثبت انجام بازدید', 'Inspection done'), p.title); toast(L('بازدید امروز ثبت شد', 'Inspection recorded for today')); });
    listExport('exp', () => L('بازدیدهای دوره‌ای', 'Periodic inspections'), () => [L('وضعیت', 'Status'), L('تجهیز', 'Equipment'), L('بازدید', 'Inspection'), L('تناوب', 'Interval'), L('آخرین انجام', 'Last done'), L('موعد بعدی', 'Next due')], () => rows.map(({ p, s }) => [s.k === 'overdue' ? L('معوق', 'Overdue') : s.k === 'soon' ? L('نزدیک موعد', 'Due soon') : L('به‌روز', 'On time'), eqName(p.equipmentId), p.title, freqL(p.freqDays), p.lastDone ? jStr(p.lastDone) : '—', jStr(s.due)]), 'inspections');
  }
  const freqL = (d) => { const f = FREQS.find(x => x[0] === Number(d)); return f ? L(f[1][0], f[1][1]) : D(d) + ' ' + L('روز', 'days'); };
  function needEq() { if (!S.equipment.length) { toast(L('ابتدا یک تجهیز اضافه کنید', 'Add equipment first')); return true; } return false; }
  const eqOpts = () => S.equipment.map(e => ({ v: e.id, l: e.name }));
  function pmForm(ex) {
    if (needEq()) return;
    modal(ex ? L('ویرایش بازدید', 'Edit inspection') : L('تعریف بازدید دوره‌ای', 'Define periodic inspection'),
      fSel('f_eq', L('تجهیز', 'Equipment'), eqOpts(), ex && ex.equipmentId) + fText('f_title', L('عنوان بازدید', 'Inspection title'), ex && ex.title) + fSel('f_freq', L('دوره تناوب', 'Interval'), FREQS.map(f => ({ v: f[0], l: L(f[1][0], f[1][1]) })), ex ? ex.freqDays : 30) + dateField('f_last', L('آخرین تاریخ انجام (شمسی)', 'Last done (Jalali)'), ex && ex.lastDone) + fArea('f_notes', L('یادداشت', 'Notes'), ex && ex.notes),
      async (m) => {
        const title = gv(m, 'f_title').trim(); if (!title) { toast(L('عنوان بازدید را وارد کنید', 'Enter the inspection title')); return false; }
        const rec = { equipmentId: gv(m, 'f_eq'), title, freqDays: Number(gv(m, 'f_freq')), lastDone: dateVal(m, 'f_last'), notes: gv(m, 'f_notes').trim() };
        if (ex) await fbUpd('pm', ex.id, rec); else await fbAdd('pm', Object.assign({ createdAt: todayISO() }, rec));
        logAct(ex ? L('ویرایش بازدید', 'Edited inspection') : L('تعریف بازدید', 'Defined inspection'), title); toast(L('ذخیره شد', 'Saved'));
      });
  }

  /* =====================================================================
     REPAIRS & FAILURES (CM)
     ===================================================================== */
  function vCm(c) {
    setTitle(L('تعمیرات و خرابی‌ها', 'Repairs & failures'), L('ثبت و پیگیری خرابی‌ها و تعمیرات اصلاحی', 'Log and follow up failures and corrective repairs'));
    const f = UI.filters.cm || '', q = (UI.search.cm || '').toLowerCase();
    const rows = S.cm.filter(x => (!f || x.status === f) && (!q || ((x.issue || '') + (x.technician || '') + eqName(x.equipmentId)).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date));
    c.innerHTML = `<div class="toolbar"><button class="btn btn-primary" id="add">＋ ${L('ثبت خرابی / تعمیر', 'Log failure / repair')}</button><div class="search">🔍<input id="q" placeholder="${L('جستجو...', 'Search...')}" value="${esc(UI.search.cm || '')}"></div>
      <select id="st"><option value="">${L('همه', 'All')}</option><option value="open" ${f === 'open' ? 'selected' : ''}>${L('باز', 'Open')}</option><option value="closed" ${f === 'closed' ? 'selected' : ''}>${L('بسته‌شده', 'Closed')}</option></select><div id="exp">${RK.exportBarHTML()}</div></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:none"><table><thead><tr><th>${L('وضعیت', 'Status')}</th><th>${L('تاریخ', 'Date')}</th><th>${L('تجهیز', 'Equipment')}</th><th>${L('شرح خرابی', 'Issue')}</th><th>${L('اقدام انجام‌شده', 'Action taken')}</th><th>${L('تکنسین', 'Technician')}</th><th>${L('قطعات / متریال', 'Parts / materials')}</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map(x => `<tr><td><span class="tag ${x.status === 'open' ? 'tag-amber' : 'tag-green'}">${x.status === 'open' ? L('باز', 'Open') : L('بسته‌شده', 'Closed')}</span></td><td class="cell-mono">${jStr(x.date)}</td><td class="cell-strong">${esc(eqName(x.equipmentId))}</td><td>${esc(x.issue)}</td><td>${esc(x.action || '—')}</td><td>${esc(x.technician || '—')}</td><td>${esc(x.materials || '—')}</td>
        <td><div class="row-actions"><span class="icon-sm" data-e="${x.id}">✎</span><span class="icon-sm" data-d="${x.id}">🗑</span></div></td></tr>`).join('') : `<tr><td colspan="8"><div class="empty"><h4>${L('رکوردی ثبت نشده است', 'No records yet')}</h4></div></td></tr>`}</tbody></table></div></div>`;
    document.getElementById('add').onclick = () => cmForm(null);
    document.getElementById('st').onchange = (e) => { UI.filters.cm = e.target.value; vCm(c); };
    document.getElementById('q').oninput = (e) => { UI.search.cm = e.target.value; const p = e.target.selectionStart; vCm(c); const el = document.getElementById('q'); el.focus(); el.setSelectionRange(p, p); };
    c.querySelectorAll('[data-e]').forEach(b => b.onclick = () => cmForm(S.cm.find(x => x.id === b.dataset.e)));
    c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const x = S.cm.find(y => y.id === b.dataset.d); confirmDel(L('این رکورد حذف شود؟', 'Delete this record?'), async () => { await fbDel('cm', x.id); logAct(L('حذف تعمیر', 'Deleted repair'), x.issue); toast(L('حذف شد', 'Deleted')); }); });
    listExport('exp', () => L('تعمیرات و خرابی‌ها', 'Repairs & failures'), () => [L('وضعیت', 'Status'), L('تاریخ', 'Date'), L('تجهیز', 'Equipment'), L('شرح', 'Issue'), L('اقدام', 'Action'), L('تکنسین', 'Technician'), L('متریال', 'Materials')], () => rows.map(x => [x.status === 'open' ? L('باز', 'Open') : L('بسته‌شده', 'Closed'), jStr(x.date), eqName(x.equipmentId), x.issue || '', x.action || '', x.technician || '—', x.materials || '—']), 'repairs');
  }
  function cmForm(ex) {
    if (needEq()) return;
    modal(ex ? L('ویرایش رکورد', 'Edit record') : L('ثبت خرابی / تعمیر', 'Log failure / repair'),
      fSel('f_eq', L('تجهیز', 'Equipment'), eqOpts(), ex && ex.equipmentId) + dateField('f_date', L('تاریخ وقوع (شمسی)', 'Date (Jalali)'), ex && ex.date) + fArea('f_issue', L('شرح خرابی / مشکل', 'Issue description'), ex && ex.issue) + fArea('f_action', L('اقدام انجام‌شده', 'Action taken'), ex && ex.action) + fText('f_tech', L('نام تکنسین', 'Technician'), ex && ex.technician) + fText('f_mat', L('قطعات / متریال مصرفی', 'Parts / materials used'), ex && ex.materials) + fSel('f_status', L('وضعیت', 'Status'), [{ v: 'open', l: L('باز', 'Open') }, { v: 'closed', l: L('بسته‌شده', 'Closed') }], ex ? ex.status : 'open'),
      async (m) => {
        const issue = gv(m, 'f_issue').trim(); if (!issue) { toast(L('شرح خرابی را وارد کنید', 'Describe the issue')); return false; }
        const status = gv(m, 'f_status');
        const rec = { equipmentId: gv(m, 'f_eq'), date: dateVal(m, 'f_date'), issue, action: gv(m, 'f_action').trim(), technician: gv(m, 'f_tech').trim(), materials: gv(m, 'f_mat').trim(), status, closedAt: status === 'closed' ? ((ex && ex.status === 'closed' && ex.closedAt) || todayISO()) : null };
        if (ex) await fbUpd('cm', ex.id, rec); else await fbAdd('cm', Object.assign({ createdAt: todayISO() }, rec));
        logAct(ex ? L('ویرایش تعمیر', 'Edited repair') : L('ثبت تعمیر', 'Logged repair'), eqName(rec.equipmentId) + ' — ' + issue); toast(L('ذخیره شد', 'Saved'));
      });
  }

  /* =====================================================================
     WORK ORDERS
     ===================================================================== */
  const WO_TYPES = [['preventive', ['پیشگیرانه', 'Preventive']], ['corrective', ['اصلاحی', 'Corrective']], ['inspection', ['بازرسی', 'Inspection']], ['improvement', ['اصلاح و بهبود', 'Improvement']], ['calibration', ['کالیبراسیون', 'Calibration']], ['cleaning', ['شست‌وشو / سرویس', 'Cleaning / service']]];
  const WO_PRIO = [['low', ['کم', 'Low'], 'tag-muted'], ['normal', ['عادی', 'Normal'], 'tag-blue'], ['high', ['بالا', 'High'], 'tag-amber'], ['urgent', ['اضطراری', 'Urgent'], 'tag-red']];
  const WO_STAT = [['new', ['جدید', 'New'], 'tag-blue'], ['progress', ['در حال انجام', 'In progress'], 'tag-amber'], ['done', ['انجام‌شده', 'Done'], 'tag-green'], ['cancelled', ['لغو‌شده', 'Cancelled'], 'tag-muted']];
  const woTypeL = (k) => { const x = WO_TYPES.find(t => t[0] === k); return x ? L(x[1][0], x[1][1]) : (k || '—'); };
  const woPrioL = (k) => { const x = WO_PRIO.find(t => t[0] === k); return x ? L(x[1][0], x[1][1]) : (k || '—'); };
  const woStatL = (k) => { const x = WO_STAT.find(t => t[0] === k); return x ? L(x[1][0], x[1][1]) : (k || '—'); };
  const nextWoNo = () => { const y = isoToJ(todayISO()).year; const n = S.wo.map(w => parseInt(String(w.no || '').split('-').pop(), 10)).filter(x => !isNaN(x)); return `WO-${y}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`; };
  function vWo(c) {
    setTitle(L('دستورکار', 'Work orders'), L('صدور، پیگیری و تکمیل دستورکارهای نگهداری و تعمیرات', 'Issue, track and complete maintenance work orders'));
    const f = UI.filters.wo || '', q = (UI.search.wo || '').toLowerCase();
    const rows = S.wo.filter(w => (!f || w.status === f) && (!q || ((w.description || '') + (w.assignee || '') + (w.no || '') + eqName(w.equipmentId)).toLowerCase().includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.no).localeCompare(String(a.no)));
    const cnt = (k) => S.wo.filter(w => w.status === k).length;
    c.innerHTML = `<div class="grid kpi-row">${WO_STAT.map(([k, l]) => `<div class="card kpi" style="--k:${k === 'done' ? 'var(--green)' : k === 'progress' ? 'var(--amber)' : k === 'new' ? 'var(--accent-2)' : 'var(--text-dim)'};margin:0;"><div class="kpi-label">${L(l[0], l[1])}</div><div class="kpi-value">${D(cnt(k))}</div></div>`).join('')}</div>
      <div class="toolbar"><button class="btn btn-primary" id="add">＋ ${L('صدور دستورکار', 'New work order')}</button><div class="search">🔍<input id="q" placeholder="${L('جستجو...', 'Search...')}" value="${esc(UI.search.wo || '')}"></div>
      <select id="st"><option value="">${L('همه وضعیت‌ها', 'All statuses')}</option>${WO_STAT.map(([k, l]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${L(l[0], l[1])}</option>`).join('')}</select><div id="exp">${RK.exportBarHTML()}</div></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:none"><table><thead><tr><th>${L('شماره', 'No.')}</th><th>${L('وضعیت', 'Status')}</th><th>${L('اولویت', 'Priority')}</th><th>${L('تاریخ صدور', 'Issued')}</th><th>${L('تجهیز', 'Equipment')}</th><th>${L('نوع', 'Type')}</th><th>${L('شرح کار', 'Description')}</th><th>${L('مسئول انجام', 'Assignee')}</th><th>${L('مهلت', 'Due')}</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map(w => { const st = WO_STAT.find(x => x[0] === w.status) || WO_STAT[0], pr = WO_PRIO.find(x => x[0] === w.priority) || WO_PRIO[1]; const late = w.dueDate && w.status !== 'done' && w.status !== 'cancelled' && w.dueDate < todayISO(); return `<tr><td class="cell-strong cell-mono">${esc(w.no || '—')}</td><td><span class="tag ${st[2]}">${L(st[1][0], st[1][1])}</span></td><td><span class="tag ${pr[2]}">${L(pr[1][0], pr[1][1])}</span></td><td class="cell-mono">${jStr(w.date)}</td><td class="cell-strong">${esc(eqName(w.equipmentId))}</td><td>${esc(woTypeL(w.type))}</td><td>${esc(w.description || '')}</td><td>${esc(w.assignee || '—')}</td><td class="cell-mono" style="${late ? 'color:var(--red);font-weight:700' : ''}">${w.dueDate ? jStr(w.dueDate) : '—'}</td>
        <td><div class="row-actions">${w.status === 'new' ? `<button class="btn btn-sm" data-go="${w.id}">▶ ${L('شروع', 'Start')}</button>` : ''}${w.status === 'progress' ? `<button class="btn btn-sm" data-fin="${w.id}">✓ ${L('تکمیل', 'Complete')}</button>` : ''}<span class="icon-sm" data-e="${w.id}">✎</span><span class="icon-sm" data-d="${w.id}">🗑</span></div></td></tr>`; }).join('') : `<tr><td colspan="10"><div class="empty"><h4>${L('دستورکاری ثبت نشده است', 'No work orders yet')}</h4></div></td></tr>`}</tbody></table></div></div>`;
    document.getElementById('add').onclick = () => woForm(null);
    document.getElementById('st').onchange = (e) => { UI.filters.wo = e.target.value; vWo(c); };
    document.getElementById('q').oninput = (e) => { UI.search.wo = e.target.value; const p = e.target.selectionStart; vWo(c); const el = document.getElementById('q'); el.focus(); el.setSelectionRange(p, p); };
    c.querySelectorAll('[data-e]').forEach(b => b.onclick = () => woForm(S.wo.find(x => x.id === b.dataset.e)));
    c.querySelectorAll('[data-go]').forEach(b => b.onclick = async () => { const w = S.wo.find(x => x.id === b.dataset.go); await fbUpd('wo', w.id, { status: 'progress', startedAt: todayISO() }); logAct(L('شروع دستورکار', 'Work order started'), w.no); toast(L('دستورکار در حال انجام است', 'Work order in progress')); });
    c.querySelectorAll('[data-fin]').forEach(b => b.onclick = () => { const w = S.wo.find(x => x.id === b.dataset.fin); modal(L('تکمیل دستورکار ', 'Complete work order ') + w.no, fNum('f_hrs', L('ساعت کار انجام‌شده', 'Hours spent'), w.hours) + fArea('f_note', L('گزارش انجام کار', 'Completion notes'), w.completionNote), async (m) => { await fbUpd('wo', w.id, { status: 'done', completedAt: todayISO(), hours: gv(m, 'f_hrs') === '' ? null : Number(toEn(gv(m, 'f_hrs'))), completionNote: gv(m, 'f_note').trim() }); logAct(L('تکمیل دستورکار', 'Work order completed'), w.no); toast(L('دستورکار تکمیل شد', 'Work order completed')); }, { saveLabel: L('ثبت تکمیل', 'Mark complete') }); });
    c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const w = S.wo.find(x => x.id === b.dataset.d); confirmDel(L('دستورکار ', 'Delete work order ') + w.no + L(' حذف شود؟', '?'), async () => { await fbDel('wo', w.id); logAct(L('حذف دستورکار', 'Deleted work order'), w.no); toast(L('حذف شد', 'Deleted')); }); });
    listExport('exp', () => L('دستورکارها', 'Work orders'), () => [L('شماره', 'No.'), L('وضعیت', 'Status'), L('اولویت', 'Priority'), L('تاریخ', 'Date'), L('تجهیز', 'Equipment'), L('نوع', 'Type'), L('شرح', 'Description'), L('مسئول', 'Assignee'), L('مهلت', 'Due'), L('ساعت کار', 'Hours')], () => rows.map(w => [w.no || '—', woStatL(w.status), woPrioL(w.priority), jStr(w.date), eqName(w.equipmentId), woTypeL(w.type), w.description || '', w.assignee || '—', w.dueDate ? jStr(w.dueDate) : '—', w.hours == null ? '—' : num(w.hours, 1)]), 'work-orders');
  }
  function woForm(ex) {
    modal(ex ? L('ویرایش دستورکار ', 'Edit work order ') + (ex.no || '') : L('صدور دستورکار جدید', 'New work order'),
      fText('f_no', L('شماره دستورکار', 'Work order no.'), ex ? ex.no : nextWoNo()) + dateField('f_date', L('تاریخ صدور (شمسی)', 'Issue date (Jalali)'), ex && ex.date) +
      fSel('f_eq', L('تجهیز (اختیاری)', 'Equipment (optional)'), [{ v: '', l: '—' }].concat(eqOpts()), ex && ex.equipmentId) +
      `<div class="field-row">${fSel('f_type', L('نوع کار', 'Work type'), WO_TYPES.map(t => ({ v: t[0], l: L(t[1][0], t[1][1]) })), ex ? ex.type : 'preventive')}${fSel('f_prio', L('اولویت', 'Priority'), WO_PRIO.map(t => ({ v: t[0], l: L(t[1][0], t[1][1]) })), ex ? ex.priority : 'normal')}</div>` +
      fArea('f_desc', L('شرح کار', 'Work description'), ex && ex.description) + fText('f_asg', L('مسئول انجام', 'Assignee'), ex && ex.assignee) + dateField('f_due', L('مهلت انجام (شمسی)', 'Due date (Jalali)'), ex && ex.dueDate ? ex.dueDate : addDays(todayISO(), 7), true) +
      fSel('f_status', L('وضعیت', 'Status'), WO_STAT.map(t => ({ v: t[0], l: L(t[1][0], t[1][1]) })), ex ? ex.status : 'new'),
      async (m) => {
        const desc = gv(m, 'f_desc').trim(); if (!desc) { toast(L('شرح کار را وارد کنید', 'Describe the work')); return false; }
        const status = gv(m, 'f_status');
        const rec = { no: gv(m, 'f_no').trim() || nextWoNo(), date: dateVal(m, 'f_date'), equipmentId: gv(m, 'f_eq'), type: gv(m, 'f_type'), priority: gv(m, 'f_prio'), description: desc, assignee: gv(m, 'f_asg').trim(), dueDate: dateVal(m, 'f_due'), status };
        if (status === 'done' && !(ex && ex.completedAt)) rec.completedAt = todayISO();
        if (ex) await fbUpd('wo', ex.id, rec); else await fbAdd('wo', Object.assign({ createdAt: todayISO() }, rec));
        logAct(ex ? L('ویرایش دستورکار', 'Edited work order') : L('صدور دستورکار', 'Issued work order'), rec.no + ' — ' + desc); toast(L('ذخیره شد', 'Saved'));
      });
  }

  /* =====================================================================
     ACTIVITY LOG
     ===================================================================== */
  function vLog(c) {
    setTitle(L('لاگ فعالیت', 'Activity log'), L('تاریخچه ثبت و ویرایش‌ها', 'History of entries and edits'));
    const rows = [...S.log].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 400);
    c.innerHTML = `<div class="toolbar"><div style="flex:1"></div><div id="exp">${RK.exportBarHTML()}</div></div><div class="card" style="padding:0"><div class="table-wrap" style="border:none;max-height:70vh;overflow:auto"><table><thead><tr><th>${L('تاریخ و ساعت', 'Date & time')}</th><th>${L('عملیات', 'Action')}</th><th>${L('جزئیات', 'Details')}</th></tr></thead><tbody>${rows.length ? rows.map(r => `<tr><td class="cell-mono">${jStr((r.at || '').slice(0, 10))} ${D((r.at || '').slice(11, 16))}</td><td class="cell-strong">${esc(r.action)}</td><td>${esc(r.detail || '')}</td></tr>`).join('') : `<tr><td colspan="3"><div class="empty"><h4>${L('رویدادی ثبت نشده', 'No events yet')}</h4></div></td></tr>`}</tbody></table></div></div>`;
    listExport('exp', () => L('لاگ فعالیت', 'Activity log'), () => [L('تاریخ و ساعت', 'Date & time'), L('عملیات', 'Action'), L('جزئیات', 'Details')], () => rows.map(r => [jStr((r.at || '').slice(0, 10)) + ' ' + D((r.at || '').slice(11, 16)), r.action, r.detail || '']), 'activity-log');
  }

  /* =====================================================================
     boot: auth gate, language/theme sync
     ===================================================================== */
  function applyTheme(m) { document.body.classList.toggle('dark-theme', m === 'dark'); }
  try { if (localStorage.getItem('rostampour-theme') === 'dark') applyTheme('dark'); } catch (e) { }
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.rostampourTheme) { applyTheme(d.rostampourTheme); try { localStorage.setItem('rostampour-theme', d.rostampourTheme); } catch (e) { } if (S.ready) renderCurrent(); }
    if (d.rostampourLang) { try { localStorage.setItem('rostampour-lang', d.rostampourLang); } catch (e) { } if (d.rostampourLang !== shownLang) { if (S.ready) { shell(); renderCurrent(); } else noAuth(); } }
  });
  function noAuth() {
    shownLang = getLang();
    document.documentElement.lang = isFa() ? 'fa' : 'en'; document.documentElement.dir = isFa() ? 'rtl' : 'ltr';
    root.innerHTML = `<div class="card login-note"><h3 style="margin-bottom:8px">${L('ابتدا وارد سامانه شوید', 'Please sign in first')}</h3><p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">${L('این بخش فقط از داخل سامانه‌ی اصلی در دسترس است.', 'This section is available from inside the main application.')}</p><a class="btn btn-primary" href="index.html" target="_top">${L('رفتن به صفحه ورود', 'Go to sign-in')}</a></div>`;
  }
  onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      if (!S.ready) { S.ready = true; spec.groups.forEach(g => { }); if (!UI.an.scope) UI.an.scope = spec.groups[0].id; shell(); attach(); renderCurrent(); }
    } else { S.ready = false; unsubs.forEach(u => { try { u(); } catch (e) { } }); unsubs = []; noAuth(); }
  });
  noAuth();
}
