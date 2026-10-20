/* =========================================================================
   Rostampour shell tools
   - smart alerts + notification center (bell) + browser notifications
   - global search across all sections
   - admin: user management, alert settings, backup / restore, reports center
     (weekly / monthly summary reports + due-date reminders)
   Runs inside the shell (index.html) only.
   ========================================================================= */
const FB = window.ShellFB;
const FS = FB.fs, db = FB.db;
const { collection, doc, onSnapshot, getDocs, getDoc, setDoc, deleteDoc, updateDoc, writeBatch } = FS;

/* ---------------- tiny helpers ---------------- */
const $ = (id) => document.getElementById(id);
const isFa = () => (window.getLang ? window.getLang() : 'fa') === 'fa';
const L = (fa, en) => isFa() ? fa : en;
const toFaD = (v) => String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const D = (v) => isFa() ? toFaD(v) : String(v);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n, dec) => (n === null || n === undefined || n === '' || isNaN(Number(n))) ? '—' : D(Number(n).toLocaleString('en-US', { maximumFractionDigits: dec === undefined ? 2 : dec }));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const normQ = (s) => String(s == null ? '' : s).toLowerCase().replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[‌‏‎]/g, ' ');

/* ---------------- Jalali helpers ---------------- */
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
  return g.toISOString().slice(0, 10);
}
function daysInJ(jy, jm) { for (let d = 31; d >= 28; d--) { const p = isoToJ(jToISO(jy, jm, d)); if (p.year === jy && p.month === jm && p.day === d) return d; } return 29; }
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000);
const jStr = (iso) => { if (!iso) return '—'; const p = isoToJ(String(iso).slice(0, 10)); return D(`${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`); };
const MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const MONTHS_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
const mName = (m) => (isFa() ? MONTHS_FA : MONTHS_EN)[m - 1];

/* ---------------- toast / modal ---------------- */
function toast(msg) { const t = $('toolToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3600); }
let modalOnClose = null;
function openModal(title, body, foot, wide) {
  const m = $('toolModal');
  m.className = 'tool-modal' + (wide ? ' wide' : '');
  m.innerHTML = `<div class="tool-head"><span>${title}</span><span class="sp"></span><span class="tool-x" id="tmX">✕</span></div><div class="tool-body" id="tmBody">${body}</div><div class="tool-foot" id="tmFoot">${foot || ''}</div>`;
  $('toolOverlay').classList.add('show');
  $('tmX').onclick = closeModal;
  return m;
}
function closeModal() { $('toolOverlay').classList.remove('show'); if (modalOnClose) { try { modalOnClose(); } catch (e) { } modalOnClose = null; } }
$('toolOverlay').addEventListener('mousedown', (e) => { if (e.target === $('toolOverlay')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closePanels(); } });
function closePanels() { $('alertPanel').classList.remove('show'); $('toolsPanel').classList.remove('show'); }
document.addEventListener('mousedown', (e) => {
  ['alertPanel', 'toolsPanel'].forEach(id => {
    const p = $(id); if (!p.classList.contains('show')) return;
    if (!p.contains(e.target) && !e.target.closest('#bellBtn') && !e.target.closest('#toolsBtn')) p.classList.remove('show');
  });
});

/* =========================================================================
   Data (live copies of what the alert engine / search / reports need)
   ========================================================================= */
const SOURCES = [
  ['cmm', 'equipment', 'cmm_equipment'], ['cmm', 'pm', 'cmm_pm'], ['cmm', 'cm', 'cmm_cm'], ['cmm', 'tanks', 'cmm_tanks'], ['cmm', 'plants', 'cmm_plants'], ['cmm', 'pumping', 'cmm_pumping'],
  ['sw', 'daily', 'sw_daily'], ['sw', 'equipment', 'sw_equipment'], ['sw', 'pm', 'sw_pm'], ['sw', 'cm', 'sw_cm'],
  ['ds', 'daily', 'ds_daily'], ['ds', 'equipment', 'ds_equipment'], ['ds', 'pm', 'ds_pm'], ['ds', 'cm', 'ds_cm'], ['ds', 'wo', 'ds_wo'],
  ['meters', 'consumers', 'consumers']
];
const MODE_OF = { cmm: 'station', sw: 'sewage', ds: 'desal', wh: 'warehouse', meters: 'meters' };
const SPEC_OF = { sw: 'sewage', ds: 'desal' };
let DATA, LOADED, unsubs = [], role = null, evalTimer = null, intervalId = null;
function resetData() {
  DATA = { cmm: {}, sw: {}, ds: {}, meters: {}, wh: { items: [], transactions: [] }, settings: { alerts: {}, reportSchedule: {} } };
  SOURCES.forEach(([g, n]) => { DATA[g][n] = []; });
  LOADED = {};
}
resetData();
const modeLabel = (id) => { const m = (window.MODES || []).find(x => x.id === id); return m ? (isFa() ? m.fa : m.en) : id; };

function startListening() {
  stopListening();
  SOURCES.forEach(([g, n, col]) => {
    unsubs.push(onSnapshot(collection(db, col), (snap) => {
      const a = []; snap.forEach(d => a.push(Object.assign({ id: d.id }, d.data())));
      DATA[g][n] = a; LOADED[col] = true; scheduleEval();
    }, (err) => { console.warn('shell listener', col, err.code || err); }));
  });
  unsubs.push(onSnapshot(doc(db, 'wh_meta', 'warehouse_data'), (s) => { const d = s.exists() ? s.data() : {}; DATA.wh = { items: d.items || [], transactions: d.transactions || [] }; LOADED.wh = true; scheduleEval(); }, (e) => console.warn('wh', e.code || e)));
  unsubs.push(onSnapshot(doc(db, 'settings', 'alerts'), (s) => { DATA.settings.alerts = s.exists() ? s.data() : {}; LOADED.alerts = true; scheduleEval(); }, (e) => console.warn('alerts', e.code || e)));
  unsubs.push(onSnapshot(doc(db, 'settings', 'reportSchedule'), (s) => { DATA.settings.reportSchedule = s.exists() ? s.data() : {}; LOADED.sched = true; scheduleEval(); }, (e) => console.warn('sched', e.code || e)));
}
function stopListening() { unsubs.forEach(u => { try { u(); } catch (e) { } }); unsubs = []; }
function scheduleEval() { clearTimeout(evalTimer); evalTimer = setTimeout(evaluate, 450); }

/* =========================================================================
   Alert settings (defaults + what the admin saved in settings/alerts)
   ========================================================================= */
const DEF_GENERAL = { cmOpenDays: 3, entryHour: 11, tankLowPct: 20, tankHighPct: 95, lowStock: 5, pmSoonDays: 3, backupDays: 14 };
const DEF_ENABLED = { pm: true, cm: true, stock: true, entry: true, tank: true, param: true, backup: true, report: true };
const cfg = () => Object.assign({}, DEF_GENERAL, DATA.settings.alerts.general || {});
const enabled = () => Object.assign({}, DEF_ENABLED, DATA.settings.alerts.enabled || {});
const limitsOf = (src) => ((DATA.settings.alerts.limits || {})[src]) || {};
const TANKS = { t20000: { fa: 'مخزن ۲۰۰۰۰', en: 'Tank 20000', cap: 20000 }, t15000: { fa: 'مخزن ۱۵۰۰۰', en: 'Tank 15000', cap: 15000 } };

function specParams(src) {
  const sp = window.PLANT_SPECS && window.PLANT_SPECS[SPEC_OF[src]];
  const out = []; if (!sp) return out;
  sp.groups.forEach(g => g.params.forEach(p => out.push(Object.assign({ group: g }, p))));
  return out;
}
function eqName(src, id) { const e = (DATA[src].equipment || []).find(x => x.id === id); return e ? e.name : ''; }

/* =========================================================================
   Alert engine
   ========================================================================= */
let ALERTS = [];
function computeAlerts() {
  const out = [], cf = cfg(), en = enabled(), today = todayISO(), hour = new Date().getHours();
  const add = (a) => out.push(a);
  const lab = (o) => o; // placeholder for readability

  /* --- periodic inspections --- */
  if (en.pm) ['cmm', 'sw', 'ds'].forEach(src => {
    (DATA[src].pm || []).forEach(p => {
      if (!p.freqDays) return;
      const base = p.lastDone || p.createdAt || today, due = addDays(String(base).slice(0, 10), Number(p.freqDays)), d = diffDays(due, today);
      const eq = eqName(src, p.equipmentId);
      if (d < 0) add({ key: `pm:${src}:${p.id}:over`, level: 'red', mode: MODE_OF[src], view: 'pm',
        fa: `بازدید «${p.title || ''}»${eq ? ' (' + eq + ')' : ''} ${toFaD(-d)} روز معوق است`, en: `Inspection "${p.title || ''}"${eq ? ' (' + eq + ')' : ''} is ${-d} day(s) overdue` });
      else if (d <= cf.pmSoonDays) add({ key: `pm:${src}:${p.id}:soon`, level: 'amber', mode: MODE_OF[src], view: 'pm',
        fa: `بازدید «${p.title || ''}»${eq ? ' (' + eq + ')' : ''} ${d === 0 ? 'امروز' : toFaD(d) + ' روز دیگر'} موعد دارد`, en: `Inspection "${p.title || ''}"${eq ? ' (' + eq + ')' : ''} is due ${d === 0 ? 'today' : 'in ' + d + ' day(s)'}` });
    });
  });

  /* --- open repairs --- */
  if (en.cm) ['cmm', 'sw', 'ds'].forEach(src => {
    (DATA[src].cm || []).forEach(c => {
      if (c.status === 'closed') return;
      const age = c.date ? diffDays(today, String(c.date).slice(0, 10)) : 0;
      if (age < cf.cmOpenDays) return;
      const eq = eqName(src, c.equipmentId);
      add({ key: `cm:${src}:${c.id}`, level: age >= cf.cmOpenDays * 2 + 1 ? 'red' : 'amber', mode: MODE_OF[src], view: 'cm',
        fa: `تعمیر باز: ${eq ? eq + ' — ' : ''}${(c.issue || '').slice(0, 60)} (${toFaD(age)} روز)`, en: `Open repair: ${eq ? eq + ' — ' : ''}${(c.issue || '').slice(0, 60)} (${age} d)` });
    });
  });

  /* --- warehouse low stock --- */
  if (en.stock && LOADED.wh) (DATA.wh.items || []).forEach(it => {
    const q = Number(it.currentStock);
    if (isNaN(q)) return;
    if (q <= 0) add({ key: `stock:${it.id}:zero`, level: 'red', mode: 'warehouse', view: 'items', fa: `موجودی «${it.name}» تمام شده است`, en: `"${it.name}" is out of stock` });
    else if (q < cf.lowStock) add({ key: `stock:${it.id}:low`, level: 'amber', mode: 'warehouse', view: 'items', fa: `موجودی «${it.name}» کم است (${toFaD(q)} عدد)`, en: `"${it.name}" is low (${q})` });
  });

  /* --- missing daily entries --- */
  if (en.entry && hour >= cf.entryHour) {
    ['sw', 'ds'].forEach(src => {
      if (!LOADED[src + '_daily']) return;
      if (!(DATA[src].daily || []).some(r => (r.date || r.id) === today))
        add({ key: `entry:${src}:${today}`, level: 'amber', mode: MODE_OF[src], view: 'entry', fa: `ثبت اطلاعات روزانه امروز انجام نشده است (${modeLabel(MODE_OF[src])})`, en: `Today's daily entry is missing (${modeLabel(MODE_OF[src])})` });
    });
    if (LOADED.cmm_tanks && !(DATA.cmm.tanks || []).some(r => String(r.datetime || '').slice(0, 10) === today))
      add({ key: `entry:tanks:${today}`, level: 'amber', mode: 'station', view: 'tanks', fa: 'قرائت امروز مخازن آب ثبت نشده است', en: "Today's tank reading is missing" });
  }

  /* --- plant parameter limits --- */
  if (en.param) ['sw', 'ds'].forEach(src => {
    const lim = limitsOf(src); if (!Object.keys(lim).length) return;
    const recs = (DATA[src].daily || []).slice().sort((a, b) => String(b.date || b.id).localeCompare(String(a.date || a.id)));
    const r = recs[0]; if (!r) return;
    const rd = String(r.date || r.id); if (diffDays(today, rd) > 2) return;
    const P = specParams(src);
    Object.keys(lim).forEach(k => {
      const l = lim[k] || {}, v = r.values && r.values[k];
      if (v === null || v === undefined || v === '' || isNaN(Number(v))) return;
      const p = P.find(x => x.key === k); const name = p ? (isFa() ? p.fa : p.en) : k; const unit = p && p.unit ? ' ' + p.unit : '';
      if (l.max != null && l.max !== '' && Number(v) > Number(l.max)) add({ key: `param:${src}:${k}:${rd}:hi`, level: 'red', mode: MODE_OF[src], view: 'dashboard', fa: `${name} = ${toFaD(v)}${unit} — بیشتر از حد مجاز (${toFaD(l.max)}) در ${jStr(rd)}`, en: `${name} = ${v}${unit} — above limit (${l.max}) on ${jStr(rd)}` });
      if (l.min != null && l.min !== '' && Number(v) < Number(l.min)) add({ key: `param:${src}:${k}:${rd}:lo`, level: 'red', mode: MODE_OF[src], view: 'dashboard', fa: `${name} = ${toFaD(v)}${unit} — کمتر از حد مجاز (${toFaD(l.min)}) در ${jStr(rd)}`, en: `${name} = ${v}${unit} — below limit (${l.min}) on ${jStr(rd)}` });
    });
  });

  /* --- tank levels --- */
  if (en.tank) Object.keys(TANKS).forEach(tk => {
    const rs = (DATA.cmm.tanks || []).filter(r => r.tankKey === tk).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime)));
    const r = rs[0]; if (!r) return;
    const pct = Number(r.volume) / TANKS[tk].cap * 100; if (isNaN(pct)) return;
    if (pct < cf.tankLowPct) add({ key: `tank:${tk}:low:${String(r.datetime).slice(0, 10)}`, level: 'red', mode: 'station', view: 'tanks', fa: `سطح ${TANKS[tk].fa} پایین است (${toFaD(Math.round(pct))}٪)`, en: `${TANKS[tk].en} level is low (${Math.round(pct)}%)` });
    else if (pct > cf.tankHighPct) add({ key: `tank:${tk}:high:${String(r.datetime).slice(0, 10)}`, level: 'amber', mode: 'station', view: 'tanks', fa: `سطح ${TANKS[tk].fa} بسیار بالا است (${toFaD(Math.round(pct))}٪)`, en: `${TANKS[tk].en} level is very high (${Math.round(pct)}%)` });
  });

  /* --- admin only: backup + periodic report reminders --- */
  if (role === 'admin') {
    if (en.backup) {
      const last = lsGet('rostampour-last-backup', '');
      const age = last ? diffDays(today, last) : 9999;
      if (age >= cf.backupDays) add({ key: `backup:${today}`, level: 'info', mode: '', fa: last ? `${toFaD(age)} روز از آخرین پشتیبان‌گیری گذشته است — برای پشتیبان‌گیری بزنید` : 'تاکنون از اطلاعات پشتیبان گرفته نشده است — برای پشتیبان‌گیری بزنید', en: last ? `${age} days since the last backup — tap to back up` : 'No backup has been made yet — tap to back up', action: () => openBackup() });
    }
    const sch = DATA.settings.reportSchedule || {};
    if (en.report && LOADED.sched && sch.weekly) {
      const last = sch.lastWeekly || '';
      if (!last || diffDays(today, last) >= 7) add({ key: `rep:w:${today}`, level: 'info', mode: '', fa: 'گزارش هفتگی آماده تولید است — برای ساخت بزنید', en: 'The weekly report is due — tap to generate', action: () => runScheduled('weekly') });
    }
    if (en.report && LOADED.sched && sch.monthly) {
      const t = isoToJ(today); const pm = t.month === 1 ? { y: t.year - 1, m: 12 } : { y: t.year, m: t.month - 1 };
      const key = `${pm.y}-${pm.m}`;
      if (sch.lastMonthly !== key) add({ key: `rep:m:${key}`, level: 'info', mode: '', fa: `گزارش ماهانه ${MONTHS_FA[pm.m - 1]} ${toFaD(pm.y)} آماده تولید است — برای ساخت بزنید`, en: `The ${MONTHS_EN[pm.m - 1]} ${pm.y} monthly report is due — tap to generate`, action: () => runScheduled('monthly') });
    }
  }
  const rank = { red: 0, amber: 1, info: 2 };
  out.sort((a, b) => rank[a.level] - rank[b.level]);
  return out;
}

function evaluate() {
  if (!role) return;
  ALERTS = computeAlerts();
  const n = ALERTS.filter(a => a.level !== 'info').length;
  const b = $('bellBadge');
  b.textContent = n > 99 ? '99+' : D(n); b.classList.toggle('show', n > 0);
  $('bellBtn').title = L('هشدارها', 'Alerts') + (n ? ` (${n})` : '');
  try { if (navigator.setAppBadge) { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (e) { }
  if ($('alertPanel').classList.contains('show')) renderAlertPanel();
  maybeNotify();
}

/* ---------- browser notifications ---------- */
function notifState() { try { const o = JSON.parse(lsGet('rostampour-notified', '{}')); if (o.d !== todayISO()) return { d: todayISO(), k: [] }; return o; } catch (e) { return { d: todayISO(), k: [] }; } }
async function showNote(title, body, tag) {
  const opts = { body, icon: 'icon-192.png', badge: 'favicon-32.png', tag: tag || 'rostampour', dir: isFa() ? 'rtl' : 'ltr', lang: isFa() ? 'fa' : 'en' };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
  } catch (e) { }
  try { new Notification(title, opts); } catch (e) { }
}
function maybeNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const st = notifState();
  const fresh = ALERTS.filter(a => a.level !== 'info' && st.k.indexOf(a.key) < 0);
  if (!fresh.length) return;
  fresh.forEach(a => st.k.push(a.key));
  lsSet('rostampour-notified', JSON.stringify(st));
  if (fresh.length <= 3) fresh.forEach(a => showNote(L('هشدار — ', 'Alert — ') + modeLabel(a.mode), isFa() ? a.fa : a.en, a.key));
  else showNote(L('سامانه جامع رستم‌پور', 'Rostampour'), L(`${toFaD(fresh.length)} هشدار جدید`, `${fresh.length} new alerts`), 'summary');
}
async function askNotifications() {
  if (!('Notification' in window)) { toast(L('این مرورگر از اعلان پشتیبانی نمی‌کند', 'Notifications are not supported here')); return; }
  const r = await Notification.requestPermission();
  if (r === 'granted') { toast(L('اعلان‌ها فعال شد', 'Notifications enabled')); lsSet('rostampour-notified', JSON.stringify({ d: todayISO(), k: [] })); maybeNotify(); }
  else toast(L('اجازه اعلان داده نشد؛ از تنظیمات مرورگر فعال کنید', 'Permission denied — enable it in browser settings'));
  renderAlertPanel();
}

/* ---------- bell panel ---------- */
function renderAlertPanel() {
  const p = $('alertPanel');
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const items = ALERTS;
  p.innerHTML = `<div class="panel-head"><span>🔔 ${L('مرکز هشدارها', 'Alert centre')}</span><span class="sp"></span>
      ${perm === 'default' ? `<button class="btn sm" id="alNotif">${L('فعال‌سازی اعلان', 'Enable notifications')}</button>` : (perm === 'granted' ? `<span class="tag ok">${L('اعلان فعال', 'Notifications on')}</span>` : '')}</div>
    <div class="panel-body">${items.length ? items.map((a, i) => `<div class="al-item" data-i="${i}"><span class="al-dot ${a.level === 'red' ? 'red' : a.level === 'info' ? 'info' : ''}"></span><div><div class="al-txt">${esc(isFa() ? a.fa : a.en)}</div><div class="al-sec">${esc(a.mode ? modeLabel(a.mode) : L('مدیریت', 'Admin'))}</div></div></div>`).join('') : `<div class="al-empty">✅ ${L('هشدار فعالی وجود ندارد', 'No active alerts')}</div>`}</div>`;
  p.querySelectorAll('.al-item').forEach(el => el.onclick = () => { const a = items[+el.dataset.i]; closePanels(); if (a.action) a.action(); else if (a.mode) window.navigateTo(a.mode, a.view); });
  const nb = $('alNotif'); if (nb) nb.onclick = askNotifications;
}
$('bellBtn').addEventListener('click', () => { const p = $('alertPanel'); $('toolsPanel').classList.remove('show'); if (p.classList.contains('show')) { p.classList.remove('show'); return; } renderAlertPanel(); p.classList.add('show'); });

/* =========================================================================
   Global search
   ========================================================================= */
function searchIndex() {
  const rows = [];
  const mk = (mode, view, group, rec, title, sub) => rows.push({ mode, view, group, title: String(title || '').trim() || '—', sub: sub || '', hay: normQ(Object.values(rec).filter(v => typeof v === 'string' || typeof v === 'number').join(' ')) });
  const G = (fa, en) => L(fa, en);
  ['cmm', 'sw', 'ds'].forEach(src => {
    const m = MODE_OF[src], ml = modeLabel(m);
    (DATA[src].equipment || []).forEach(e => mk(m, 'equipment', ml + ' · ' + G('تجهیزات', 'Equipment'), e, e.name, [e.code, e.location, e.category].filter(Boolean).join(' · ')));
    (DATA[src].pm || []).forEach(p => mk(m, 'pm', ml + ' · ' + G('بازدید دوره‌ای', 'Inspections'), p, p.title, eqName(src, p.equipmentId)));
    (DATA[src].cm || []).forEach(c => mk(m, 'cm', ml + ' · ' + G('تعمیرات', 'Repairs'), c, c.issue, eqName(src, c.equipmentId) + (c.date ? ' · ' + jStr(c.date) : '')));
  });
  (DATA.ds.wo || []).forEach(w => mk('desal', 'wo', modeLabel('desal') + ' · ' + G('دستورکار', 'Work orders'), w, (w.no ? w.no + ' — ' : '') + (w.description || ''), w.assignee || ''));
  (DATA.wh.items || []).forEach(i => mk('warehouse', 'items', modeLabel('warehouse') + ' · ' + G('قطعات', 'Parts'), i, i.name, [i.specs, G('موجودی', 'Stock') + ': ' + D(i.currentStock)].filter(Boolean).join(' · ')));
  (DATA.meters.consumers || []).forEach(c => mk('meters', 'consumers', modeLabel('meters') + ' · ' + G('کنتورها', 'Meters'), c, c.name, [c.code, c.group].filter(Boolean).join(' · ')));
  return rows;
}
function openSearch() {
  openModal('🔍 ' + L('جستجو در همه بخش‌ها', 'Search all sections'), `<input class="srch-in" id="srchIn" type="text" placeholder="${L('نام تجهیز، قطعه، کنتور، خرابی…', 'Equipment, part, meter, fault…')}" autocomplete="off"><div id="srchOut" style="margin-top:8px"></div>`, '', true);
  const idx = searchIndex();
  const run = () => {
    const q = normQ($('srchIn').value).trim(), out = $('srchOut');
    if (q.length < 2) { out.innerHTML = `<div class="hint">${L('حداقل دو حرف وارد کنید. جستجو در تجهیزات، بازدیدها، تعمیرات، قطعات انبار و کنتورها انجام می‌شود.', 'Type at least two characters. Searches equipment, inspections, repairs, warehouse parts and meters.')}</div>`; return; }
    const terms = q.split(/\s+/).filter(Boolean);
    const hits = idx.filter(r => terms.every(t => r.hay.indexOf(t) >= 0) || terms.every(t => normQ(r.title).indexOf(t) >= 0)).slice(0, 60);
    if (!hits.length) { out.innerHTML = `<div class="al-empty">${L('نتیجه‌ای یافت نشد', 'No results')}</div>`; return; }
    const groups = {}; hits.forEach((h, i) => { h.i = i; (groups[h.group] = groups[h.group] || []).push(h); });
    out.innerHTML = Object.keys(groups).map(g => `<div class="srch-grp">${esc(g)}</div>` + groups[g].slice(0, 10).map(h => `<div class="srch-hit" data-i="${h.i}"><span>${esc(h.title.slice(0, 90))}</span><small>${esc(h.sub.slice(0, 60))}</small></div>`).join('')).join('');
    out.querySelectorAll('.srch-hit').forEach(el => el.onclick = () => { const h = hits[+el.dataset.i]; closeModal(); window.navigateTo(h.mode, h.view); });
  };
  $('srchIn').addEventListener('input', run); run(); setTimeout(() => $('srchIn').focus(), 60);
}
$('searchBtn').addEventListener('click', openSearch);

/* =========================================================================
   Admin menu
   ========================================================================= */
$('toolsBtn').addEventListener('click', () => {
  const p = $('toolsPanel'); $('alertPanel').classList.remove('show');
  if (p.classList.contains('show')) { p.classList.remove('show'); return; }
  p.innerHTML = `<div class="panel-head"><span>⚙ ${L('مدیریت سامانه', 'Administration')}</span></div><div class="panel-body">
    ${[['users', '👥', L('کاربران و سطح دسترسی', 'Users & access levels'), L('تعریف اپراتور و مشاهده‌گر', 'Create operators and viewers')],
    ['alerts', '🚨', L('تنظیم هشدارها و حدود مجاز', 'Alert settings & limits'), L('حد پایین/بالای پارامترها، سطح مخازن، …', 'Parameter limits, tank levels, …')],
    ['reports', '📑', L('مرکز گزارش‌های دوره‌ای', 'Periodic reports centre'), L('گزارش هفتگی / ماهانه PDF، Word، Excel', 'Weekly / monthly PDF, Word, Excel')],
    ['backup', '💾', L('پشتیبان‌گیری و بازیابی', 'Backup & restore'), L('دریافت و بازگردانی کل اطلاعات', 'Export / import all data')]]
      .map(([k, ic, t, s]) => `<div class="al-item" data-k="${k}"><span style="font-size:20px">${ic}</span><div><div class="al-txt"><b>${t}</b></div><div class="al-sec">${s}</div></div></div>`).join('')}</div>`;
  p.querySelectorAll('.al-item').forEach(el => el.onclick = () => { p.classList.remove('show'); ({ users: openUsers, alerts: openAlertSettings, reports: openReports, backup: openBackup })[el.dataset.k](); });
  p.classList.add('show');
});

/* =========================================================================
   Users & access levels
   ========================================================================= */
let usersUnsub = null;
function openUsers() {
  const roleOpts = (sel) => ['operator', 'viewer'].map(r => `<option value="${r}" ${sel === r ? 'selected' : ''}>${Role.label(r, isFa())}</option>`).join('');
  openModal('👥 ' + L('کاربران و سطح دسترسی', 'Users & access levels'), `
    <div class="hint">${L('<b>مدیر</b>: همه‌چیز (فقط حساب rostampour). <b>اپراتور</b>: فقط ثبت داده‌های روزانه — بدون ثبت تجهیز جدید، ورودی انبار و گزارش‌گیری. <b>مشاهده‌گر</b>: فقط مشاهده — بدون ثبت و گزارش.', '<b>Administrator</b>: everything (the rostampour account). <b>Operator</b>: daily data entry only — no new equipment, warehouse intake or reports. <b>Viewer</b>: read-only — no entry and no reports.')}</div>
    <h4>${L('کاربران تعریف‌شده', 'Defined users')}</h4><div id="usrList"><div class="al-empty">…</div></div>
    <h4>${L('افزودن کاربر جدید', 'Add a new user')}</h4>
    <div class="row"><div><label>${L('نام کاربری (انگلیسی، بدون فاصله)', 'Username (a-z, 0-9, no spaces)')}</label><input type="text" id="nuUser" autocomplete="off" dir="ltr"></div>
      <div><label>${L('نام نمایشی', 'Display name')}</label><input type="text" id="nuName" autocomplete="off"></div></div>
    <div class="row"><div><label>${L('رمز عبور (حداقل ۶ نویسه)', 'Password (min 6 chars)')}</label><input type="text" id="nuPass" autocomplete="off" dir="ltr"></div>
      <div><label>${L('سطح دسترسی', 'Access level')}</label><select id="nuRole">${roleOpts('operator')}</select></div></div>
    <div class="hint">${L('رمز عبور بعد از ساخت قابل مشاهده نیست؛ آن را به کاربر بدهید. برای رمز جدید باید حساب در Firebase → Authentication حذف و دوباره ساخته شود.', 'The password cannot be viewed after creation. To set a new one, delete the account in Firebase → Authentication and create it again.')}</div>
    <div id="nuMsg" style="color:var(--red);font-size:12.5px;min-height:18px"></div>`,
    `<button class="btn btn-primary sm" id="nuAdd" style="padding:9px 18px">${L('ایجاد کاربر', 'Create user')}</button><button class="btn sm" id="nuClose" style="padding:9px 18px">${L('بستن', 'Close')}</button>`, true);
  $('nuClose').onclick = closeModal;
  if (usersUnsub) { usersUnsub(); usersUnsub = null; }
  modalOnClose = () => { if (usersUnsub) { usersUnsub(); usersUnsub = null; } };
  usersUnsub = onSnapshot(collection(db, 'app_users'), (snap) => {
    const rows = []; snap.forEach(d => rows.push(Object.assign({ id: d.id }, d.data())));
    rows.sort((a, b) => a.id.localeCompare(b.id));
    const host = $('usrList'); if (!host) return;
    host.innerHTML = rows.length ? `<div style="overflow-x:auto"><table><thead><tr><th>${L('کاربر', 'User')}</th><th>${L('نام', 'Name')}</th><th>${L('سطح', 'Level')}</th><th>${L('وضعیت', 'Status')}</th><th></th></tr></thead><tbody>${rows.map(u => `<tr>
      <td dir="ltr"><b>${esc(u.id)}</b></td><td>${esc(u.displayName || '')}</td>
      <td><select data-role="${esc(u.id)}" style="width:auto">${roleOpts(u.role)}</select></td>
      <td><span class="tag ${u.active === false ? 'off' : 'ok'}">${u.active === false ? L('غیرفعال', 'Inactive') : L('فعال', 'Active')}</span></td>
      <td style="white-space:nowrap"><button class="btn sm" data-tg="${esc(u.id)}">${u.active === false ? L('فعال‌سازی', 'Activate') : L('غیرفعال‌سازی', 'Deactivate')}</button> <button class="btn sm danger" data-del="${esc(u.id)}">🗑</button></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="al-empty">${L('هنوز کاربری تعریف نشده است', 'No users yet')}</div>`;
    host.querySelectorAll('[data-role]').forEach(s => s.onchange = async () => { try { await updateDoc(doc(db, 'app_users', s.dataset.role), { role: s.value }); toast(L('سطح دسترسی تغییر کرد', 'Access level updated')); } catch (e) { toast(L('خطا در ذخیره', 'Save failed')); } });
    host.querySelectorAll('[data-tg]').forEach(b => b.onclick = async () => { const u = rows.find(x => x.id === b.dataset.tg); try { await updateDoc(doc(db, 'app_users', u.id), { active: u.active === false }); } catch (e) { toast(L('خطا در ذخیره', 'Save failed')); } });
    host.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm(L('دسترسی این کاربر حذف شود؟', 'Remove this user’s access?'))) return; try { await deleteDoc(doc(db, 'app_users', b.dataset.del)); } catch (e) { toast(L('خطا در حذف', 'Delete failed')); } });
  }, (e) => { const h = $('usrList'); if (h) h.innerHTML = `<div class="al-empty">${L('دسترسی به فهرست کاربران ممکن نیست — قوانین Firestore نسخه ۳ را منتشر کرده‌اید؟', 'Cannot read users — did you publish the v3 Firestore rules?')}</div>`; });
  $('nuAdd').onclick = createUser;
}
async function createUser() {
  const msg = $('nuMsg'); msg.textContent = '';
  const u = $('nuUser').value.trim().toLowerCase(), name = $('nuName').value.trim(), pass = $('nuPass').value, r = $('nuRole').value;
  if (!/^[a-z0-9._-]{2,32}$/.test(u)) { msg.textContent = L('نام کاربری باید ۲ تا ۳۲ نویسه انگلیسی/عدد باشد', 'Username must be 2–32 chars (a–z, 0–9, . _ -)'); return; }
  if (u === 'rostampour') { msg.textContent = L('این نام کاربری رزرو است', 'This username is reserved'); return; }
  if (pass.length < 6) { msg.textContent = L('رمز عبور حداقل ۶ نویسه باشد', 'Password must be at least 6 characters'); return; }
  const btn = $('nuAdd'); btn.disabled = true;
  let existed = false, sec = null;
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    sec = appMod.initializeApp(FB.config, 'user-admin-' + Date.now());     // separate app: the admin stays signed in
    const sa = authMod.getAuth(sec);
    try { await authMod.createUserWithEmailAndPassword(sa, Role.emailOf(u), pass); }
    catch (e) { if (e && e.code === 'auth/email-already-in-use') existed = true; else throw e; }
    try { await authMod.signOut(sa); } catch (e) { }
    try { await appMod.deleteApp(sec); } catch (e) { }
    await setDoc(doc(db, 'app_users', u), { role: r, active: true, displayName: name || u, createdAt: new Date().toISOString(), createdBy: 'rostampour' });
    $('nuUser').value = ''; $('nuName').value = ''; $('nuPass').value = '';
    toast(existed ? L('حساب از قبل وجود داشت؛ دسترسی دوباره فعال شد (رمز قبلی معتبر است)', 'Account already existed — access re-enabled (old password still valid)') : L('کاربر ایجاد شد', 'User created'));
  } catch (e) {
    console.error(e);
    const c = e && e.code || '';
    msg.textContent = c === 'auth/operation-not-allowed' ? L('ورود با ایمیل/رمز در Firebase فعال نیست', 'Email/password sign-in is not enabled in Firebase')
      : c === 'auth/weak-password' ? L('رمز عبور ضعیف است', 'Weak password')
      : c === 'permission-denied' || /permission/i.test(e.message || '') ? L('مجوز نوشتن نیست — قوانین Firestore نسخه ۳ را منتشر کنید', 'Permission denied — publish the v3 Firestore rules')
      : L('ایجاد کاربر ناموفق بود: ', 'Could not create the user: ') + (c || e.message);
  }
  btn.disabled = false;
}

/* =========================================================================
   Alert settings
   ========================================================================= */
function openAlertSettings() {
  const A = DATA.settings.alerts || {}, g = cfg(), en = enabled();
  const nf = (id, label, v, extra) => `<div><label>${label}</label><input type="number" step="any" id="${id}" value="${v == null ? '' : v}" ${extra || ''}></div>`;
  const chk = (k, label) => `<label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text);margin:0"><input type="checkbox" data-en="${k}" ${en[k] ? 'checked' : ''}> ${label}</label>`;
  const plantRows = (src) => {
    const lim = limitsOf(src); const P = specParams(src); if (!P.length) return '';
    let lastG = '';
    return `<h4>${modeLabel(MODE_OF[src])} — ${L('حدود مجاز پارامترها', 'parameter limits')}</h4><div style="overflow-x:auto"><table><thead><tr><th>${L('پارامتر', 'Parameter')}</th><th style="width:90px">${L('حداقل', 'Min')}</th><th style="width:90px">${L('حداکثر', 'Max')}</th></tr></thead><tbody>` +
      P.map(p => { const l = lim[p.key] || {}; let head = ''; if (p.group.id !== lastG) { lastG = p.group.id; head = `<tr><td colspan="3" style="color:var(--teal);font-weight:800;font-size:11.5px">${esc(isFa() ? p.group.fa : p.group.en)}</td></tr>`; }
        return head + `<tr><td>${esc(isFa() ? p.fa : p.en)} <small style="color:var(--text-dim)">${esc(p.unit || '')}</small></td><td><input type="number" step="any" data-lim="${src}:${p.key}:min" value="${l.min == null ? '' : l.min}"></td><td><input type="number" step="any" data-lim="${src}:${p.key}:max" value="${l.max == null ? '' : l.max}"></td></tr>`; }).join('') + '</tbody></table></div>';
  };
  openModal('🚨 ' + L('تنظیم هشدارها و حدود مجاز', 'Alert settings & limits'), `
    <div class="hint">${L('هشدارها روی همه دستگاه‌ها و برای همه کاربران یکسان است. پارامترهایی که حد نداشته باشند بررسی نمی‌شوند.', 'Settings apply to every device and user. Parameters without a limit are not checked.')}</div>
    <h4>${L('نوع هشدارها', 'Alert types')}</h4>
    <div class="row" style="align-items:center">${chk('pm', L('بازدید دوره‌ای معوق / نزدیک موعد', 'Overdue / due inspections'))}${chk('cm', L('تعمیرات باز مانده', 'Repairs left open'))}${chk('stock', L('موجودی کم انبار', 'Low warehouse stock'))}</div>
    <div class="row" style="align-items:center">${chk('entry', L('ثبت نشدن اطلاعات امروز', 'Missing daily entry'))}${chk('tank', L('سطح مخازن', 'Tank levels'))}${chk('param', L('خارج از حد پارامترها', 'Parameters out of limit'))}</div>
    <div class="row" style="align-items:center">${chk('backup', L('یادآوری پشتیبان‌گیری', 'Backup reminder'))}${chk('report', L('یادآوری گزارش دوره‌ای', 'Periodic report reminder'))}</div>
    <h4>${L('آستانه‌های عمومی', 'General thresholds')}</h4>
    <div class="row">${nf('gCm', L('تعمیر باز بیش از … روز', 'Repair open more than … days'), g.cmOpenDays)}${nf('gPm', L('نزدیک موعد: … روز مانده', 'Inspection “soon”: … days left'), g.pmSoonDays)}${nf('gStock', L('موجودی کم: کمتر از …', 'Low stock: below …'), g.lowStock)}</div>
    <div class="row">${nf('gLow', L('سطح پایین مخزن (٪)', 'Tank low level (%)'), g.tankLowPct)}${nf('gHigh', L('سطح بالای مخزن (٪)', 'Tank high level (%)'), g.tankHighPct)}${nf('gHour', L('ساعت یادآوری ثبت روزانه (۰–۲۳)', 'Daily-entry reminder hour (0–23)'), g.entryHour)}${nf('gBk', L('یادآوری پشتیبان هر … روز', 'Backup reminder every … days'), g.backupDays)}</div>
    ${plantRows('sw')}${plantRows('ds')}`,
    `<button class="btn btn-primary sm" id="asSave" style="padding:9px 18px">${L('ذخیره', 'Save')}</button><button class="btn sm" id="asClose" style="padding:9px 18px">${L('انصراف', 'Cancel')}</button>`, true);
  $('asClose').onclick = closeModal;
  $('asSave').onclick = async () => {
    const n = (id, d) => { const v = parseFloat($(id).value); return isNaN(v) ? d : v; };
    const general = { cmOpenDays: n('gCm', 3), pmSoonDays: n('gPm', 3), lowStock: n('gStock', 5), tankLowPct: n('gLow', 20), tankHighPct: n('gHigh', 95), entryHour: Math.min(23, Math.max(0, n('gHour', 11))), backupDays: n('gBk', 14) };
    const enabledO = {}; document.querySelectorAll('[data-en]').forEach(c => { enabledO[c.dataset.en] = c.checked; });
    const limits = { sw: {}, ds: {} };
    document.querySelectorAll('[data-lim]').forEach(i => {
      const [src, key, kind] = i.dataset.lim.split(':'); if (i.value === '') return;
      limits[src][key] = limits[src][key] || {}; limits[src][key][kind] = parseFloat(i.value);
    });
    try { await setDoc(doc(db, 'settings', 'alerts'), { general, enabled: enabledO, limits, updatedAt: new Date().toISOString() }); toast(L('تنظیمات ذخیره شد', 'Settings saved')); closeModal(); }
    catch (e) { console.error(e); toast(L('ذخیره ناموفق بود', 'Save failed')); }
  };
}

/* =========================================================================
   Backup & restore
   ========================================================================= */
const BACKUP_COLLECTIONS = ['consumers', 'tariffs', 'meterTypes', 'routes', 'readings', 'auditLogs', 'settings', 'wh_meta',
  'cmm_equipment', 'cmm_pm', 'cmm_cm', 'cmm_tanks', 'cmm_plants', 'cmm_pumping', 'cmm_activitylog', 'cmm_meta', 'cmm_history',
  'sw_daily', 'sw_equipment', 'sw_pm', 'sw_cm', 'sw_log', 'ds_daily', 'ds_equipment', 'ds_pm', 'ds_cm', 'ds_log', 'ds_wo'];
const jsonSafe = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toDate === 'function') ? { __ts: x.toDate().toISOString() } : x));
const revive = (v) => (v && typeof v === 'object') ? (v.__ts ? new Date(v.__ts) : (Array.isArray(v) ? v.map(revive) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])))) : v;
function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function makeBackup(onProgress) {
  const out = { format: 'rostampour-backup-v1', createdAt: new Date().toISOString(), project: FB.config.projectId, collections: {} };
  let i = 0, total = 0;
  for (const c of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, c)); const rows = [];
    snap.forEach(d => rows.push({ id: d.id, data: jsonSafe(d.data()) }));
    out.collections[c] = rows; total += rows.length; i++;
    if (onProgress) onProgress(i / BACKUP_COLLECTIONS.length, c);
  }
  out.totalDocs = total; return out;
}
function openBackup() {
  const last = lsGet('rostampour-last-backup', '');
  openModal('💾 ' + L('پشتیبان‌گیری و بازیابی', 'Backup & restore'), `
    <h4>${L('۱) دریافت پشتیبان', '1) Download a backup')}</h4>
    <div class="hint">${L('همه اطلاعات ۵ بخش (تجهیزات، ثبت‌ها، انبار، قرائت کنتورها، لاگ‌ها، تنظیمات) در یک فایل JSON ذخیره می‌شود. فایل را در جای امن نگه دارید.', 'All data of the 5 sections is saved to a single JSON file. Keep it somewhere safe.')}<br>${last ? L('آخرین پشتیبان: ', 'Last backup: ') + jStr(last) : L('تاکنون پشتیبان گرفته نشده است.', 'No backup yet.')}</div>
    <div class="progress" id="bkBar" style="display:none"><i></i></div><div id="bkMsg" style="font-size:12px;color:var(--text-muted);min-height:18px"></div>
    <button class="btn btn-primary" id="bkGo" style="padding:10px 20px">⬇ ${L('ساخت و دریافت فایل پشتیبان', 'Create & download backup')}</button>
    <h4 style="margin-top:22px">${L('۲) بازیابی از فایل', '2) Restore from a file')}</h4>
    <div class="hint">⚠ ${L('قبل از بازیابی، به‌صورت خودکار یک پشتیبان ایمنی از وضعیت فعلی دانلود می‌شود.', 'A safety backup of the current state is downloaded automatically before restoring.')}</div>
    <div class="row"><div><label>${L('فایل پشتیبان (.json)', 'Backup file (.json)')}</label><input type="file" id="rsFile" accept=".json,application/json"></div>
      <div><label>${L('روش بازیابی', 'Mode')}</label><select id="rsMode"><option value="merge">${L('ادغام (رکوردهای هم‌شناسه بازنویسی می‌شوند)', 'Merge (same ids are overwritten)')}</option><option value="replace">${L('جایگزینی کامل (رکوردهای اضافه حذف می‌شوند)', 'Full replace (extra records are deleted)')}</option></select></div></div>
    <div id="rsInfo" class="hint" style="display:none"></div>
    <label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:13px"><input type="checkbox" id="rsOk"> ${L('می‌دانم که اطلاعات فعلی تغییر می‌کند', 'I understand current data will change')}</label>
    <div class="progress" id="rsBar" style="display:none"><i></i></div><div id="rsMsg" style="font-size:12px;color:var(--text-muted);min-height:18px"></div>`,
    `<button class="btn danger" id="rsGo" disabled style="padding:9px 18px">♻ ${L('شروع بازیابی', 'Start restore')}</button><button class="btn sm" id="bkClose" style="padding:9px 18px">${L('بستن', 'Close')}</button>`, true);
  $('bkClose').onclick = closeModal;
  const bar = (id, p) => { const b = $(id); b.style.display = ''; b.firstElementChild.style.width = Math.round(p * 100) + '%'; };
  $('bkGo').onclick = async () => {
    $('bkGo').disabled = true; $('bkMsg').textContent = L('در حال خواندن اطلاعات…', 'Reading data…');
    try {
      const b = await makeBackup((p, c) => { bar('bkBar', p); $('bkMsg').textContent = c; });
      download(`Rostampour-backup-${todayISO()}.json`, JSON.stringify(b));
      lsSet('rostampour-last-backup', todayISO()); scheduleEval();
      $('bkMsg').textContent = L(`انجام شد — ${toFaD(b.totalDocs)} رکورد`, `Done — ${b.totalDocs} records`);
    } catch (e) { console.error(e); $('bkMsg').textContent = L('پشتیبان‌گیری ناموفق بود: ', 'Backup failed: ') + (e.code || e.message); }
    $('bkGo').disabled = false;
  };
  let parsed = null;
  const upd = () => { $('rsGo').disabled = !(parsed && $('rsOk').checked); };
  $('rsOk').onchange = upd;
  $('rsFile').onchange = async () => {
    parsed = null; const f = $('rsFile').files[0]; const info = $('rsInfo'); info.style.display = 'none'; upd(); if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.format !== 'rostampour-backup-v1' || !j.collections) throw new Error('format');
      parsed = j; const names = Object.keys(j.collections).filter(c => BACKUP_COLLECTIONS.indexOf(c) >= 0);
      info.style.display = ''; info.innerHTML = L('تاریخ فایل: ', 'File date: ') + esc(j.createdAt || '') + '<br>' + L('مجموعه‌ها: ', 'Collections: ') + names.length + ' — ' + L('رکوردها: ', 'records: ') + names.reduce((s, c) => s + j.collections[c].length, 0);
    } catch (e) { info.style.display = ''; info.textContent = L('فایل پشتیبان معتبر نیست.', 'Not a valid backup file.'); }
    upd();
  };
  $('rsGo').onclick = async () => {
    if (!parsed) return; $('rsGo').disabled = true; const msg = $('rsMsg');
    try {
      msg.textContent = L('پشتیبان ایمنی از وضعیت فعلی…', 'Safety backup of the current state…');
      const safety = await makeBackup(); download(`Rostampour-before-restore-${todayISO()}.json`, JSON.stringify(safety));
      const replace = $('rsMode').value === 'replace';
      const names = Object.keys(parsed.collections).filter(c => BACKUP_COLLECTIONS.indexOf(c) >= 0);
      let done = 0; const totalOps = names.reduce((s, c) => s + parsed.collections[c].length, 0) || 1;
      for (const c of names) {
        const rows = parsed.collections[c];
        let ops = rows.map(r => ({ t: 's', id: r.id, data: revive(r.data) }));
        if (replace) { const cur = await getDocs(collection(db, c)); const keep = new Set(rows.map(r => r.id)); cur.forEach(d => { if (!keep.has(d.id)) ops.push({ t: 'd', id: d.id }); }); }
        for (let i = 0; i < ops.length; i += 400) {
          const batch = writeBatch(db);
          ops.slice(i, i + 400).forEach(o => { const ref = doc(db, c, o.id); if (o.t === 's') batch.set(ref, o.data); else batch.delete(ref); });
          await batch.commit(); done += Math.min(400, ops.length - i); bar('rsBar', Math.min(1, done / totalOps)); msg.textContent = c;
        }
      }
      msg.textContent = L('بازیابی کامل شد. صفحه را دوباره بارگذاری کنید.', 'Restore complete. Please reload the page.');
      toast(L('بازیابی انجام شد', 'Restore finished'));
    } catch (e) { console.error(e); msg.textContent = L('بازیابی ناموفق بود: ', 'Restore failed: ') + (e.code || e.message); }
    upd();
  };
}

/* =========================================================================
   Periodic reports centre
   ========================================================================= */
function periodRange(kind) {
  const today = todayISO(), t = isoToJ(today);
  if (kind === 'last7') return { from: addDays(today, -6), to: today, label: L('۷ روز گذشته', 'Last 7 days') };
  if (kind === 'last30') return { from: addDays(today, -29), to: today, label: L('۳۰ روز گذشته', 'Last 30 days') };
  if (kind === 'curMonth') return { from: jToISO(t.year, t.month, 1), to: today, label: `${mName(t.month)} ${D(t.year)} ${L('(تا امروز)', '(to date)')}` };
  const pm = t.month === 1 ? { y: t.year - 1, m: 12 } : { y: t.year, m: t.month - 1 };
  return { from: jToISO(pm.y, pm.m, 1), to: jToISO(pm.y, pm.m, daysInJ(pm.y, pm.m)), label: `${mName(pm.m)} ${D(pm.y)}`, key: `${pm.y}-${pm.m}` };
}
const inRange = (iso, r) => { const d = String(iso || '').slice(0, 10); return d >= r.from && d <= r.to; };
const stats = (arr) => window.RK.stats(arr);
async function buildSummary(period, secs) {
  const r = periodRange(period), sections = [], fa = isFa();
  const fmt = (v, dec) => num(v, dec);
  const metaFrom = `${jStr(r.from)} — ${jStr(r.to)}`;
  if (secs.includes('station')) {
    const sec = { title: modeLabel('station'), kpis: [], table: { head: [L('مخزن', 'Tank'), L('تعداد قرائت', 'Readings'), L('کمینه ٪', 'Min %'), L('میانگین ٪', 'Avg %'), L('بیشینه ٪', 'Max %'), L('آخرین حجم m³', 'Last vol. m³')], rows: [] } };
    Object.keys(TANKS).forEach(tk => {
      const rs = (DATA.cmm.tanks || []).filter(x => x.tankKey === tk && inRange(x.datetime, r)).sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));
      const s = stats(rs.map(x => Number(x.volume) / TANKS[tk].cap * 100));
      sec.table.rows.push([isFa() ? TANKS[tk].fa : TANKS[tk].en, D(s.n), fmt(s.min, 0), fmt(s.avg, 0), fmt(s.max, 0), rs.length ? fmt(rs[rs.length - 1].volume, 0) : '—']);
    });
    const sum = (arr, f) => arr.reduce((a, x) => a + (Number(x[f]) || 0), 0);
    const pl = (DATA.cmm.plants || []).filter(x => inRange(x.date, r)), pu = (DATA.cmm.pumping || []).filter(x => inRange(x.date, r));
    sec.kpis.push({ label: L('تولید کارخانه‌ها', 'Plants production'), value: fmt(sum(pl, 'volume'), 0), unit: 'm³' });
    sec.kpis.push({ label: L('پمپاژ و بارگیری', 'Pumping & loading'), value: fmt(sum(pu, 'volume'), 0), unit: 'm³' });
    const cm = DATA.cmm.cm || [], pm = DATA.cmm.pm || [];
    sec.kpis.push({ label: L('تعمیرات ثبت‌شده در بازه', 'Repairs logged'), value: D(cm.filter(c => inRange(c.date, r)).length), unit: '' });
    sec.kpis.push({ label: L('تعمیرات باز', 'Open repairs'), value: D(cm.filter(c => c.status !== 'closed').length), unit: '' });
    sec.kpis.push({ label: L('بازدید معوق', 'Overdue inspections'), value: D(ALERTS.filter(a => a.key.startsWith('pm:cmm:') && a.key.endsWith(':over')).length), unit: '' });
    sections.push(sec);
  }
  if (secs.includes('warehouse')) {
    const tx = (DATA.wh.transactions || []).filter(t => inRange(t.date, r));
    const items = DATA.wh.items || [], by = {};
    tx.forEach(t => { const o = by[t.itemId] = by[t.itemId] || { i: 0, o: 0 }; if (t.type === 'in') o.i += Number(t.qty) || 0; else o.o += Number(t.qty) || 0; });
    const rows = Object.keys(by).map(id => { const it = items.find(x => x.id === id); return [it ? it.name : '—', fmt(by[id].i, 0), fmt(by[id].o, 0), it ? fmt(it.currentStock, 0) : '—', by[id].o]; }).sort((a, b) => b[4] - a[4]).slice(0, 25).map(x => x.slice(0, 4));
    const low = items.filter(i => Number(i.currentStock) < cfg().lowStock);
    sections.push({ title: modeLabel('warehouse'), kpis: [
      { label: L('تراکنش ورودی', 'Intake transactions'), value: D(tx.filter(t => t.type === 'in').length), unit: '' },
      { label: L('تراکنش خروجی', 'Issue transactions'), value: D(tx.filter(t => t.type === 'out').length), unit: '' },
      { label: L('اقلام با موجودی کم', 'Low-stock items'), value: D(low.length), unit: '' }],
      table: { head: [L('قطعه', 'Part'), L('ورودی', 'In'), L('خروجی', 'Out'), L('موجودی فعلی', 'Current stock')], rows } });
    if (low.length) sections.push({ title: L('اقلام با موجودی کم / تمام‌شده', 'Low / out-of-stock items'), table: { head: [L('قطعه', 'Part'), L('موجودی', 'Stock')], rows: low.slice(0, 40).map(i => [i.name, fmt(i.currentStock, 0)]) } });
  }
  if (secs.includes('meters')) {
    let rd = [];
    try { const snap = await getDocs(collection(db, 'readings')); snap.forEach(d => rd.push(d.data())); } catch (e) { }
    const pj = (s) => { const m = String(s || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? jToISO(+m[1], +m[2], +m[3]) : ''; };
    rd = rd.filter(x => inRange(pj(x.date), r));
    const tot = rd.reduce((a, x) => a + (x.closed ? 0 : (Number(x.consumption) || 0)), 0);
    const byG = {}; rd.forEach(x => { const g = x.group || '—'; byG[g] = (byG[g] || 0) + (x.closed ? 0 : (Number(x.consumption) || 0)); });
    sections.push({ title: modeLabel('meters'), kpis: [{ label: L('تعداد قرائت', 'Readings'), value: D(rd.length), unit: '' }, { label: L('مجموع مصرف', 'Total consumption'), value: fmt(tot, 0), unit: 'm³' }],
      table: { head: [L('گروه', 'Group'), L('مصرف m³', 'Consumption m³')], rows: Object.keys(byG).sort().map(g => [g, fmt(byG[g], 0)]) } });
  }
  ['sw', 'ds'].forEach(src => {
    if (!secs.includes(src)) return;
    const recs = (DATA[src].daily || []).filter(x => inRange(x.date || x.id, r));
    const sp = window.PLANT_SPECS[SPEC_OF[src]], rows = [], base = {};
    sp.groups.forEach(g => {
      g.params.forEach(p => {
        const vals = recs.map(x => x.values && x.values[p.key]).filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)));
        const s = stats(vals); const main = p.agg === 'sum' ? s.sum : s.avg; base[p.key] = s.n ? main : null;
        rows.push([isFa() ? p.fa : p.en, p.unit || '', p.agg === 'sum' ? L('مجموع', 'Sum') : L('میانگین', 'Avg'), s.n ? fmt(main, p.dec == null ? 2 : p.dec) : '—', fmt(s.min, p.dec == null ? 2 : p.dec), fmt(s.max, p.dec == null ? 2 : p.dec), D(s.n)]);
      });
      (g.derived || []).forEach(dv => { let v = null; try { v = dv.fn(base); } catch (e) { } rows.push([isFa() ? dv.fa : dv.en, dv.unit || '', L('محاسبه‌شده', 'Derived'), v == null ? '—' : fmt(v, dv.dec == null ? 1 : dv.dec), '—', '—', '—']); });
    });
    const cm = DATA[src].cm || [];
    sections.push({ title: modeLabel(MODE_OF[src]), kpis: [
      { label: L('روزهای ثبت‌شده', 'Days recorded'), value: D(recs.length), unit: '' },
      { label: L('تعمیرات ثبت‌شده', 'Repairs logged'), value: D(cm.filter(c => inRange(c.date, r)).length), unit: '' },
      { label: L('تعمیرات باز', 'Open repairs'), value: D(cm.filter(c => c.status !== 'closed').length), unit: '' },
      { label: L('بازدید معوق', 'Overdue inspections'), value: D(ALERTS.filter(a => a.key.startsWith(`pm:${src}:`) && a.key.endsWith(':over')).length), unit: '' }],
      table: { head: [L('پارامتر', 'Parameter'), L('واحد', 'Unit'), L('نوع', 'Type'), L('مقدار', 'Value'), L('کمینه', 'Min'), L('بیشینه', 'Max'), L('تعداد', 'N')], rows } });
  });
  const act = ALERTS.filter(a => a.level !== 'info');
  sections.push({ title: L('هشدارهای فعال در زمان تهیه گزارش', 'Active alerts at report time'), table: { head: [L('بخش', 'Section'), L('هشدار', 'Alert')], rows: act.slice(0, 60).map(a => [modeLabel(a.mode), isFa() ? a.fa : a.en]) } });
  return { rep: { title: L('گزارش دوره‌ای سامانه جامع رستم‌پور', 'Rostampour periodic summary report'), subtitle: r.label, meta: [[L('بازه', 'Period'), metaFrom]], sections }, range: r };
}
function openReports() {
  const sch = DATA.settings.reportSchedule || {};
  const secList = [['station', modeLabel('station')], ['warehouse', modeLabel('warehouse')], ['meters', modeLabel('meters')], ['sw', modeLabel('sewage')], ['ds', modeLabel('desal')]];
  openModal('📑 ' + L('مرکز گزارش‌های دوره‌ای', 'Periodic reports centre'), `
    <h4>${L('ساخت گزارش خلاصه', 'Build a summary report')}</h4>
    <div class="row"><div><label>${L('بازه زمانی', 'Period')}</label><select id="rpPeriod"><option value="last7">${L('۷ روز گذشته', 'Last 7 days')}</option><option value="last30">${L('۳۰ روز گذشته', 'Last 30 days')}</option><option value="curMonth">${L('ماه شمسی جاری', 'Current Jalali month')}</option><option value="prevMonth">${L('ماه شمسی گذشته', 'Previous Jalali month')}</option></select></div>
      <div><label>${L('قالب خروجی', 'Format')}</label><select id="rpFmt"><option value="pdf">PDF</option><option value="word">Word</option><option value="excel">Excel</option></select></div></div>
    <div class="row" style="align-items:center">${secList.map(([k, t]) => `<label style="display:flex;gap:6px;align-items:center;color:var(--text);margin:0;font-size:12.5px"><input type="checkbox" data-sec="${k}" checked> ${esc(t)}</label>`).join('')}</div>
    <div id="rpMsg" style="font-size:12px;color:var(--text-muted);min-height:20px"></div>
    <h4>${L('یادآوری خودکار گزارش‌ها', 'Automatic report reminders')}</h4>
    <div class="hint">${L('وقتی سامانه باز است و موعد گزارش رسیده باشد، در مرکز هشدار پیام «گزارش آماده تولید است» نمایش داده می‌شود و با یک لمس ساخته و دانلود می‌شود. ساخت کاملاً بی‌صدا و بدون باز بودن برنامه نیاز به سرور (Cloud Functions) دارد.', 'When the app is open and a report is due, an alert appears in the alert centre and one tap builds and downloads it. Fully unattended generation (app closed) needs a server (Cloud Functions).')}</div>
    <div class="row" style="align-items:center"><label style="display:flex;gap:8px;align-items:center;color:var(--text);margin:0"><input type="checkbox" id="scW" ${sch.weekly ? 'checked' : ''}> ${L('گزارش هفتگی (۷ روز گذشته)', 'Weekly report (last 7 days)')}</label>
      <label style="display:flex;gap:8px;align-items:center;color:var(--text);margin:0"><input type="checkbox" id="scM" ${sch.monthly ? 'checked' : ''}> ${L('گزارش ماهانه (ماه شمسی گذشته)', 'Monthly report (previous Jalali month)')}</label>
      <div><label>${L('قالب گزارش خودکار', 'Scheduled format')}</label><select id="scF"><option value="pdf" ${sch.format === 'pdf' || !sch.format ? 'selected' : ''}>PDF</option><option value="word" ${sch.format === 'word' ? 'selected' : ''}>Word</option><option value="excel" ${sch.format === 'excel' ? 'selected' : ''}>Excel</option></select></div></div>
    <div style="font-size:11.5px;color:var(--text-muted)">${sch.lastWeekly ? L('آخرین گزارش هفتگی: ', 'Last weekly: ') + jStr(sch.lastWeekly) + ' · ' : ''}${sch.lastMonthly ? L('آخرین گزارش ماهانه: ', 'Last monthly: ') + esc(sch.lastMonthly) : ''}</div>`,
    `<button class="btn btn-primary sm" id="rpGo" style="padding:9px 18px">⬇ ${L('ساخت گزارش', 'Build report')}</button><button class="btn sm" id="scSave" style="padding:9px 18px">${L('ذخیره یادآوری‌ها', 'Save reminders')}</button><button class="btn sm" id="rpClose" style="padding:9px 18px">${L('بستن', 'Close')}</button>`, true);
  $('rpClose').onclick = closeModal;
  $('rpGo').onclick = async () => {
    const secs = [...document.querySelectorAll('[data-sec]')].filter(c => c.checked).map(c => c.dataset.sec);
    if (!secs.length) { $('rpMsg').textContent = L('حداقل یک بخش را انتخاب کنید', 'Select at least one section'); return; }
    $('rpGo').disabled = true; $('rpMsg').textContent = L('در حال ساخت گزارش…', 'Building the report…');
    try { await generateReport($('rpPeriod').value, secs, $('rpFmt').value); $('rpMsg').textContent = L('گزارش ساخته شد', 'Report generated'); }
    catch (e) { console.error(e); $('rpMsg').textContent = L('ساخت گزارش ناموفق بود: ', 'Report failed: ') + (e.message || e); }
    $('rpGo').disabled = false;
  };
  $('scSave').onclick = async () => {
    try { await setDoc(doc(db, 'settings', 'reportSchedule'), { weekly: $('scW').checked, monthly: $('scM').checked, format: $('scF').value }, { merge: true }); toast(L('ذخیره شد', 'Saved')); } catch (e) { toast(L('ذخیره ناموفق بود', 'Save failed')); }
  };
}
async function generateReport(period, secs, format) {
  const { rep, range } = await buildSummary(period, secs);
  const name = `Rostampour-summary-${range.from}_${range.to}`;
  if (format === 'word') await window.RK.word(rep, name); else if (format === 'excel') await window.RK.excel(rep, name); else await window.RK.pdf(rep, name);
  return range;
}
async function runScheduled(kind) {
  const sch = DATA.settings.reportSchedule || {};
  toast(L('در حال ساخت گزارش…', 'Building the report…'));
  try {
    const period = kind === 'weekly' ? 'last7' : 'prevMonth';
    const range = await generateReport(period, ['station', 'warehouse', 'meters', 'sw', 'ds'], sch.format || 'pdf');
    const upd = kind === 'weekly' ? { lastWeekly: todayISO() } : { lastMonthly: periodRange('prevMonth').key };
    await setDoc(doc(db, 'settings', 'reportSchedule'), upd, { merge: true });
    toast(L('گزارش ساخته شد', 'Report generated'));
  } catch (e) { console.error(e); toast(L('ساخت گزارش ناموفق بود', 'Report failed') + ': ' + (e.message || '')); }
}

/* =========================================================================
   lifecycle
   ========================================================================= */
function start(r) {
  role = r; resetData(); startListening();
  clearInterval(intervalId); intervalId = setInterval(evaluate, 5 * 60 * 1000);
  evaluate();
}
function stop() {
  role = null; stopListening(); clearInterval(intervalId); clearTimeout(evalTimer); ALERTS = [];
  const b = $('bellBadge'); b.classList.remove('show'); closePanels(); closeModal();
  try { if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (e) { }
}
window.addEventListener('shell-auth-state', (ev) => { if (ev.detail.user) start(ev.detail.role); else stop(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && role) evaluate(); });
window.ShellTools = { stop, onLang: () => { if (role) evaluate(); }, refresh: evaluate, _alerts: () => ALERTS, _data: () => DATA };
if (window.__lastAuth && window.__lastAuth.user) start(window.__lastAuth.role);
