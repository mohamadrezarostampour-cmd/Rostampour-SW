/* =========================================================================
   Station (CMM) — advanced analytics & reporting view
   Adds a new "Analytics & Reports" page to cmm.html: tanks, plant production,
   pumping/loading and maintenance (PM/CM) statistics — daily / monthly / yearly,
   with charts, detailed tables and PDF / Word / Excel export.
   Relies on globals from cmm.html: state, TANKS_META, PLANTS_META, JALALI_MONTHS,
   daysInJalaliMonth, jalaliToISO, isoToJalaliParts, jalaliYearOf, currentJalaliYear,
   todayISO, pmStatus, CATEGORIES, VIEW_META, switchView, showToast
   ========================================================================= */
(function () {
  'use strict';
  const MONTHS_EN = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
  const L = (fa, en) => RK.isFa() ? fa : en;
  const D = (v) => RK.digits(v);
  const mName = (m) => RK.isFa() ? JALALI_MONTHS[m - 1] : MONTHS_EN[m - 1];
  const COLORS = { blue: '#1565c0', teal: '#00a896', coral: '#ff7a59', amber: '#f5a524', violet: '#7c5cff', green: '#1f9d76', red: '#d43439' };

  const S = { scope: 'tanks', mode: 'monthly', jy: null, jm: null, charts: {}, last: null };

  /* ---------- helpers ---------- */
  function isDark() { return document.body.classList.contains('dark-theme'); }
  function axisColor() { return isDark() ? '#8db3c2' : '#52708a'; }
  function gridColor() { return isDark() ? 'rgba(255,255,255,0.07)' : 'rgba(10,50,65,0.08)'; }
  function jDate(iso) { const p = isoToJalaliParts(iso); return D(`${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`); }

  function buckets() {
    const out = [];
    const jy = S.jy, jm = S.jm;
    if (S.mode === 'daily') {
      const n = daysInJalaliMonth(jy, jm);
      for (let d = 1; d <= n; d++) { const iso = jalaliToISO(jy, jm, d); out.push({ label: D(d), full: jDate(iso), from: iso, to: iso }); }
    } else if (S.mode === 'monthly') {
      for (let m = 1; m <= 12; m++) {
        out.push({ label: mName(m), full: mName(m) + ' ' + D(jy), from: jalaliToISO(jy, m, 1), to: jalaliToISO(jy, m, daysInJalaliMonth(jy, m)) });
      }
    } else {
      const ys = new Set([currentJalaliYear()]);
      [state.tankReadings.map(r => r.datetime.slice(0, 10)), state.plantProd.map(r => r.date), state.pumpLoad.map(r => r.date),
       state.cm.map(r => r.date), state.pm.map(r => r.lastDone).filter(Boolean)].forEach(arr => arr.forEach(i => { if (i) ys.add(jalaliYearOf(i)); }));
      [...ys].sort((a, b) => a - b).forEach(y => out.push({ label: D(y), full: D(y), from: jalaliToISO(y, 1, 1), to: jalaliToISO(y, 12, daysInJalaliMonth(y, 12)) }));
    }
    return out;
  }
  const inRange = (iso, b) => iso >= b.from && iso <= b.to;
  function periodTitle() {
    if (S.mode === 'daily') return L('روزانه', 'Daily') + ' — ' + mName(S.jm) + ' ' + D(S.jy);
    if (S.mode === 'monthly') return L('ماهانه', 'Monthly') + ' — ' + D(S.jy);
    return L('سالانه', 'Yearly');
  }
  function rangeBounds() {
    const b = buckets(); return { from: b[0].from, to: b[b.length - 1].to };
  }

  /* ---------- scope builders: each returns {title, kpis, chartCfg(theme), tableHead, rows, extra[]} ---------- */
  function lineCfg(labels, datasets, opt) {
    return {
      type: (opt && opt.type) || 'line',
      data: { labels, datasets },
      options: Object.assign({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: axisColor(), font: { size: 11 } } } },
        scales: { x: { ticks: { color: axisColor(), font: { size: 10 } }, grid: { display: false }, stacked: !!(opt && opt.stacked) },
                  y: { ticks: { color: axisColor() }, grid: { color: gridColor() }, stacked: !!(opt && opt.stacked), beginAtZero: true } }
      }, (opt && opt.options) || {})
    };
  }
  const ds = (label, data, color, extra) => Object.assign({ label, data, borderColor: color, backgroundColor: color + '33', tension: .3, spanGaps: true, pointRadius: 2.5, borderWidth: 2 }, extra || {});

  function buildTanks() {
    const bk = buckets();
    const head = [L('بازه', 'Period')];
    const rows = bk.map(b => [b.full]);
    const datasets = [], pctSets = [];
    const kpis = [];
    const palette = [COLORS.blue, COLORS.teal];
    Object.entries(TANKS_META).forEach(([key, meta], ti) => {
      const per = bk.map(b => {
        const rs = state.tankReadings.filter(r => r.tankKey === key && inRange(r.datetime.slice(0, 10), b)).sort((a, c) => a.datetime.localeCompare(c.datetime));
        return { st: RK.stats(rs.map(r => r.volume)), n: rs.length };
      });
      head.push(`${meta.label} — ${L('آخرین', 'Last')}`, L('کمینه', 'Min'), L('بیشینه', 'Max'), L('میانگین', 'Avg'), L('٪ میانگین پُری', 'Avg fill %'), L('تعداد قرائت', 'Readings'));
      per.forEach((p, i) => rows[i].push(
        p.n ? RK.num(p.st.last, 0) : '—', p.n ? RK.num(p.st.min, 0) : '—', p.n ? RK.num(p.st.max, 0) : '—', p.n ? RK.num(p.st.avg, 0) : '—',
        p.n ? D(Math.round(p.st.avg / meta.capacity * 100)) + '٪' : '—', D(p.n)));
      datasets.push(ds(`${meta.label} (m³)`, per.map(p => p.n ? Math.round(p.st.avg) : null), palette[ti]));
      pctSets.push(per.map(p => p.n ? Math.round(p.st.avg / meta.capacity * 100) : null));
      const all = RK.stats(per.filter(p => p.n).map(p => p.st.avg));
      const mx = RK.stats(per.filter(p => p.n).map(p => p.st.max)), mn = RK.stats(per.filter(p => p.n).map(p => p.st.min));
      const lastBucket = [...per].reverse().find(p => p.n);
      kpis.push({ label: `${meta.label} — ${L('آخرین حجم', 'Latest volume')}`, value: lastBucket ? RK.num(lastBucket.st.last, 0) : '—', unit: 'm³' });
      kpis.push({ label: `${meta.label} — ${L('میانگین دوره', 'Period average')}`, value: all.n ? RK.num(all.avg, 0) : '—', unit: 'm³' });
      kpis.push({ label: `${meta.label} — ${L('بیشینه / کمینه', 'Max / Min')}`, value: mx.n ? `${RK.num(mx.max, 0)} / ${RK.num(mn.min, 0)}` : '—', unit: 'm³' });
      kpis.push({ label: `${meta.label} — ${L('میانگین درصد پُری', 'Avg fill')}`, value: all.n ? D(Math.round(all.avg / meta.capacity * 100)) + '٪' : '—', unit: '' });
    });
    const labels = bk.map(b => b.label);
    return {
      title: L('آمار مخازن ذخیره آب', 'Water storage tanks statistics'),
      kpis, labels, rows, head,
      charts: [
        { title: L('روند میانگین حجم مخازن (m³)', 'Average tank volume trend (m³)'), cfg: () => lineCfg(labels, datasets.map((d, i) => Object.assign({}, d, { borderColor: palette[i], backgroundColor: palette[i] + '33' })), {}) },
        { title: L('میانگین درصد پُری مخازن', 'Average fill percentage'), cfg: () => lineCfg(labels, Object.entries(TANKS_META).map(([k, m], i) => ({ label: m.label + ' %', data: pctSets[i], backgroundColor: palette[i], borderRadius: 4 })), { type: 'bar', options: { scales: { y: { max: 100, beginAtZero: true, ticks: { color: axisColor() }, grid: { color: gridColor() } }, x: { ticks: { color: axisColor(), font: { size: 10 } }, grid: { display: false } } } } }) }
      ]
    };
  }

  function buildPair(records, groupField, keys, names, colors, title, unitNote) {
    const bk = buckets();
    const head = [L('بازه', 'Period'), ...names.map(n => n + ' (m³)'), L('مجموع (m³)', 'Total (m³)'), L('میانگین روزانه', 'Daily avg'), L('بیشینه روزانه', 'Peak day'), L('روزهای ثبت‌شده', 'Days logged')];
    const rows = [], perKey = keys.map(() => []), totals = [];
    bk.forEach(b => {
      const rs = records.filter(r => inRange(r.date, b));
      const sums = keys.map(k => rs.filter(r => r[groupField] === k).reduce((s, r) => s + Number(r.volume || 0), 0));
      const has = rs.length > 0;
      const dayMap = {}; rs.forEach(r => { dayMap[r.date] = (dayMap[r.date] || 0) + Number(r.volume || 0); });
      const days = Object.keys(dayMap).length, tot = sums.reduce((a, c) => a + c, 0), peak = days ? Math.max(...Object.values(dayMap)) : null;
      keys.forEach((k, i) => perKey[i].push(has ? sums[i] : null));
      totals.push(has ? tot : null);
      rows.push([b.full, ...sums.map(v => has ? RK.num(v, 0) : '—'), has ? RK.num(tot, 0) : '—', days ? RK.num(tot / days, 0) : '—', days ? RK.num(peak, 0) : '—', D(days)]);
    });
    const grand = RK.stats(totals), sumsAll = keys.map((k, i) => perKey[i].reduce((a, c) => a + (c || 0), 0));
    const allRecs = records.filter(r => { const rg = rangeBounds(); return r.date >= rg.from && r.date <= rg.to; });
    const dm = {}; allRecs.forEach(r => { dm[r.date] = (dm[r.date] || 0) + Number(r.volume || 0); });
    const dayVals = Object.entries(dm), nDays = dayVals.length;
    const best = nDays ? dayVals.reduce((a, c) => c[1] > a[1] ? c : a) : null;
    const worst = nDays ? dayVals.reduce((a, c) => c[1] < a[1] ? c : a) : null;
    const total = sumsAll.reduce((a, c) => a + c, 0);
    const kpis = [
      { label: L('مجموع دوره', 'Period total'), value: RK.num(total, 0), unit: 'm³' },
      ...names.map((n, i) => ({ label: n, value: RK.num(sumsAll[i], 0), unit: 'm³' })),
      { label: L('میانگین روزانه', 'Daily average'), value: nDays ? RK.num(total / nDays, 0) : '—', unit: 'm³' },
      { label: L('بیشترین روز', 'Peak day'), value: best ? `${RK.num(best[1], 0)} (${jDate(best[0])})` : '—', unit: '' },
      { label: L('کمترین روز', 'Lowest day'), value: worst ? `${RK.num(worst[1], 0)} (${jDate(worst[0])})` : '—', unit: '' },
      { label: L('روزهای ثبت‌شده', 'Days logged'), value: D(nDays), unit: '' }
    ];
    const labels = bk.map(b => b.label);
    const cum = []; let run = 0; totals.forEach(t => { run += (t || 0); cum.push(Math.round(run)); });
    return {
      title, kpis, labels, rows, head,
      charts: [
        { title: L('حجم ثبت‌شده در هر بازه (m³)', 'Volume per period (m³)'), cfg: () => lineCfg(labels, keys.map((k, i) => ({ label: names[i], data: perKey[i], backgroundColor: colors[i], borderRadius: 3 })), { type: 'bar', stacked: true }) },
        { title: L('مجموع تجمعی (m³)', 'Cumulative total (m³)'), cfg: () => lineCfg(labels, [ds(L('تجمعی', 'Cumulative'), cum, COLORS.violet, { fill: true })], {}) },
        { title: L('سهم هر بخش از مجموع', 'Share of total'), type: 'doughnut', cfg: () => ({ type: 'doughnut', data: { labels: names, datasets: [{ data: sumsAll, backgroundColor: colors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor() } } } } }) }
      ]
    };
  }
  const buildPlants = () => buildPair(state.plantProd, 'plant', ['norouzheh', 'bonab'], [L('کارخانه نورویژه', 'Norouzeh plant'), L('کارخانه بناب', 'Bonab plant')], [COLORS.blue, COLORS.amber], L('آمار تولید کارخانه‌های آب‌شیرین‌کن', 'Desalination plants production statistics'));
  const buildPumping = () => buildPair(state.pumpLoad, 'type', ['mainpump', 'tankerload'], [L('پمپاژ اصلی', 'Main pumping'), L('بارگیری تانکر', 'Tanker loading')], [COLORS.teal, COLORS.coral], L('آمار پمپاژ اصلی و بارگیری تانکر', 'Main pumping & tanker loading statistics'));

  function buildMaintenance() {
    const rg = rangeBounds(), bk = buckets();
    const eqById = {}; state.equipment.forEach(e => eqById[e.id] = e);
    const catLabel = (k) => (CATEGORIES.find(c => c.key === k) || { label: k || '—' }).label;
    const cms = state.cm.filter(c => c.date >= rg.from && c.date <= rg.to);
    const open = cms.filter(c => c.status === 'open').length, closed = cms.length - open;
    const durations = cms.filter(c => c.status === 'closed' && c.closedAt).map(c => Math.max(0, Math.round((new Date(c.closedAt) - new Date(c.date)) / 86400000)));
    const dur = RK.stats(durations);
    const pmS = { overdue: 0, soon: 0, ok: 0 }; state.pm.forEach(p => pmS[pmStatus(p).key]++);
    const compliance = state.pm.length ? Math.round((pmS.ok + pmS.soon) / state.pm.length * 100) : 0;
    const pmDone = []; state.pm.forEach(p => { const h = new Set(Array.isArray(p.history) ? p.history : []); if (p.lastDone) h.add(p.lastDone); h.forEach(d => { if (d >= rg.from && d <= rg.to) pmDone.push({ p, d }); }); });
    let mats = 0, photos = 0; cms.forEach(c => { mats += (c.materials || []).length; photos += (c.photos || []).length; });
    const kpis = [
      { label: L('تعداد کل تجهیزات', 'Total equipment'), value: D(state.equipment.length), unit: '' },
      { label: L('تعمیرات ثبت‌شده در دوره', 'Repairs in period'), value: D(cms.length), unit: '' },
      { label: L('تعمیرات باز', 'Open repairs'), value: D(open), unit: '' },
      { label: L('تعمیرات بسته‌شده', 'Closed repairs'), value: D(closed), unit: '' },
      { label: L('میانگین زمان رفع خرابی', 'Avg time to repair'), value: dur.n ? RK.num(dur.avg, 1) : '—', unit: L('روز', 'days') },
      { label: L('بازدیدهای انجام‌شده در دوره', 'Inspections done in period'), value: D(pmDone.length), unit: '' },
      { label: L('بازدید معوق', 'Overdue inspections'), value: D(pmS.overdue), unit: '' },
      { label: L('نزدیک موعد', 'Due soon'), value: D(pmS.soon), unit: '' },
      { label: L('نرخ انطباق بازدیدها', 'Inspection compliance'), value: D(compliance) + '٪', unit: '' },
      { label: L('اقلام متریال مصرفی', 'Materials used'), value: D(mats), unit: '' }
    ];
    // per-bucket counts
    const labels = bk.map(b => b.label);
    const cmCount = bk.map(b => state.cm.filter(c => inRange(c.date, b)).length);
    const pmCount = bk.map(b => { let n = 0; state.pm.forEach(p => { const h = new Set(Array.isArray(p.history) ? p.history : []); if (p.lastDone) h.add(p.lastDone); h.forEach(d => { if (inRange(d, b)) n++; }); }); return n; });
    // by category / equipment / technician
    const byCat = {}, byEq = {}, byTech = {};
    cms.forEach(c => { const e = eqById[c.equipmentId]; const ck = catLabel(e && e.category); byCat[ck] = (byCat[ck] || 0) + 1; const en = e ? e.name : '—'; byEq[en] = (byEq[en] || 0) + 1; const t = (c.technician || '').trim() || '—'; byTech[t] = (byTech[t] || 0) + 1; });
    const sortObj = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n || 99);
    const stLabel = (c) => c.status === 'open' ? L('باز', 'Open') : L('بسته‌شده', 'Closed');
    const secs = [];
    const tables = [
      { title: L('ریز تعمیرات و خرابی‌ها', 'Repairs & failures log'),
        head: [L('تاریخ', 'Date'), L('تجهیز', 'Equipment'), L('شرح مشکل', 'Issue'), L('اقدام انجام‌شده', 'Action taken'), L('تکنسین', 'Technician'), L('وضعیت', 'Status'), L('مدت رفع (روز)', 'Days to fix')],
        rows: cms.sort((a, b) => a.date.localeCompare(b.date)).map(c => [jDate(c.date), (eqById[c.equipmentId] || {}).name || '—', c.issue || '', c.action || '', c.technician || '—', stLabel(c), c.closedAt ? D(Math.max(0, Math.round((new Date(c.closedAt) - new Date(c.date)) / 86400000))) : '—']) },
      { title: L('وضعیت برنامه بازدیدهای دوره‌ای', 'Periodic inspection schedule status'),
        head: [L('وضعیت', 'Status'), L('تجهیز', 'Equipment'), L('عنوان بازدید', 'Inspection'), L('تناوب (روز)', 'Interval (days)'), L('آخرین انجام', 'Last done'), L('موعد بعدی', 'Next due')],
        rows: state.pm.map(p => { const st = pmStatus(p); return [st.key === 'overdue' ? L('معوق', 'Overdue') : st.key === 'soon' ? L('نزدیک موعد', 'Due soon') : L('به‌روز', 'On time'), (eqById[p.equipmentId] || {}).name || '—', p.title, D(p.freqDays), p.lastDone ? jDate(p.lastDone) : '—', jDate(st.due)]; }) },
      { title: L('تجهیزات پرخرابی (برترین‌ها)', 'Most failure-prone equipment'), head: [L('تجهیز', 'Equipment'), L('تعداد خرابی', 'Failures')], rows: sortObj(byEq, 15).map(([k, v]) => [k, D(v)]) },
      { title: L('خرابی به تفکیک دسته تجهیز', 'Failures by equipment category'), head: [L('دسته', 'Category'), L('تعداد', 'Count')], rows: sortObj(byCat).map(([k, v]) => [k, D(v)]) },
      { title: L('عملکرد تکنسین‌ها', 'Technician workload'), head: [L('تکنسین', 'Technician'), L('تعداد تعمیر', 'Repairs')], rows: sortObj(byTech).map(([k, v]) => [k, D(v)]) },
      { title: L('فهرست تجهیزات', 'Equipment register'), head: [L('نام', 'Name'), L('دسته', 'Category'), L('سریال / پلاک', 'Serial'), L('محل نصب', 'Location'), L('تاریخ نصب', 'Install date')],
        rows: state.equipment.map(e => [e.name, catLabel(e.category), e.serial || '—', e.location || '—', e.installDate ? jDate(e.installDate) : '—']) }
    ];
    return {
      title: L('آمار تعمیرات، خرابی و بازدیدهای دوره‌ای', 'Maintenance, failures & inspections statistics'),
      kpis, labels, extraTables: tables, rows: null, head: null,
      charts: [
        { title: L('تعداد تعمیرات و بازدیدهای انجام‌شده در هر بازه', 'Repairs & inspections per period'), cfg: () => lineCfg(labels, [{ label: L('تعمیرات', 'Repairs'), data: cmCount, backgroundColor: COLORS.coral, borderRadius: 3 }, { label: L('بازدیدها', 'Inspections'), data: pmCount, backgroundColor: COLORS.teal, borderRadius: 3 }], { type: 'bar' }) },
        { title: L('وضعیت بازدیدهای دوره‌ای', 'Inspection status'), type: 'doughnut', cfg: () => ({ type: 'doughnut', data: { labels: [L('به‌روز', 'On time'), L('نزدیک موعد', 'Due soon'), L('معوق', 'Overdue')], datasets: [{ data: [pmS.ok, pmS.soon, pmS.overdue], backgroundColor: [COLORS.green, COLORS.amber, COLORS.red] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor() } } } } }) },
        { title: L('خرابی به تفکیک دسته تجهیز', 'Failures by category'), type: 'doughnut', cfg: () => { const e = sortObj(byCat); return { type: 'doughnut', data: { labels: e.map(x => x[0]), datasets: [{ data: e.map(x => x[1]), backgroundColor: [COLORS.blue, COLORS.coral, COLORS.teal, COLORS.amber, COLORS.violet, COLORS.green, '#8aa0b5', '#00b8d9'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: axisColor() } } } } }; } }
      ]
    };
  }

  const BUILDERS = { tanks: buildTanks, plants: buildPlants, pumping: buildPumping, maint: buildMaintenance };

  /* ---------- UI ---------- */
  function html() {
    return `<div data-i18n-skip="1" id="anRoot">
      <div class="card" style="margin-bottom:16px;">
        <div class="panel-title"><div><h3>${L('تحلیل و گزارش‌های جامع ایستگاه', 'Station analytics & comprehensive reports')}</h3>
          <div class="sub">${L('آمار روزانه، ماهانه و سالانه با نمودار، جدول تفصیلی و خروجی PDF / Word / Excel', 'Daily, monthly & yearly statistics with charts, detailed tables and PDF / Word / Excel export')}</div></div></div>
        <div id="anScopes" class="seg" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
          <div id="anModes" class="seg" style="display:flex;gap:6px;"></div>
          <div class="field" style="min-width:110px;margin:0;"><label>${L('سال', 'Year')}</label><select id="anYear"></select></div>
          <div class="field" id="anMonthWrap" style="min-width:130px;margin:0;"><label>${L('ماه', 'Month')}</label><select id="anMonth"></select></div>
          <div style="flex:1"></div>
          <div id="anExport">${RK.exportBarHTML()}</div>
        </div>
      </div>
      <div id="anBody"></div>
    </div>`;
  }
  function segBtn(active, label, attrs) {
    return `<button class="btn ${active ? 'btn-primary' : 'btn-ghost'} btn-sm" ${attrs}>${label}</button>`;
  }
  function drawControls() {
    const scopes = [['tanks', L('سطح مخازن', 'Tanks')], ['plants', L('تولید کارخانه‌ها', 'Plants production')], ['pumping', L('پمپاژ و بارگیری', 'Pumping & loading')], ['maint', L('تعمیرات و بازدید', 'Maintenance')], ['all', L('گزارش جامع (همه)', 'Full report (all)')]];
    document.getElementById('anScopes').innerHTML = scopes.map(([k, l]) => segBtn(S.scope === k, l, `data-scope="${k}"`)).join('');
    document.getElementById('anModes').innerHTML = [['daily', L('روزانه', 'Daily')], ['monthly', L('ماهانه', 'Monthly')], ['yearly', L('سالانه', 'Yearly')]].map(([k, l]) => segBtn(S.mode === k, l, `data-mode="${k}"`)).join('');
    const ys = new Set([currentJalaliYear()]);
    [state.tankReadings.map(r => r.datetime.slice(0, 10)), state.plantProd.map(r => r.date), state.pumpLoad.map(r => r.date), state.cm.map(r => r.date)].forEach(a => a.forEach(i => i && ys.add(jalaliYearOf(i))));
    const ysorted = [...ys].sort((a, b) => b - a);
    const yr = document.getElementById('anYear'); yr.innerHTML = ysorted.map(y => `<option value="${y}">${D(y)}</option>`).join(''); yr.value = S.jy;
    const mo = document.getElementById('anMonth'); mo.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${mName(i + 1)}</option>`).join(''); mo.value = S.jm;
    document.getElementById('anMonthWrap').style.display = S.mode === 'daily' ? '' : 'none';
    document.getElementById('anYear').parentElement.style.display = S.mode === 'yearly' ? 'none' : '';
    document.querySelectorAll('#anScopes [data-scope]').forEach(b => b.onclick = () => { S.scope = b.dataset.scope; render(); });
    document.querySelectorAll('#anModes [data-mode]').forEach(b => b.onclick = () => { S.mode = b.dataset.mode; render(); });
    yr.onchange = () => { S.jy = Number(yr.value); renderBody(); };
    mo.onchange = () => { S.jm = Number(mo.value); renderBody(); };
    RK.bindExport(document.getElementById('anExport'), getReport, () => 'Station-' + S.scope + '-' + S.mode + '-' + (S.jy || ''), (m) => showToast(m));
  }
  function destroyCharts() { Object.values(S.charts).forEach(c => { try { c.destroy(); } catch (e) { } }); S.charts = {}; }
  function sectionsFor(scope) { return scope === 'all' ? ['tanks', 'plants', 'pumping', 'maint'] : [scope]; }

  async function renderBody() {
    destroyCharts();
    const body = document.getElementById('anBody');
    if (typeof Chart === 'undefined') { try { await RK.ensure.chart(); } catch (e) { } }
    let out = '';
    const built = sectionsFor(S.scope).map(sc => ({ sc, d: BUILDERS[sc]() }));
    built.forEach(({ sc, d }) => {
      out += `<div class="card" style="margin-bottom:16px;"><div class="panel-title"><div><h3>${d.title}</h3><div class="sub">${periodTitle()}</div></div></div>
        <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">
          ${d.kpis.map(k => `<div class="kpi" style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--panel-2);"><div style="font-size:11px;color:var(--text-muted)">${k.label}</div><div style="font-size:17px;font-weight:700;color:var(--accent);margin-top:2px;">${k.value} <span style="font-size:10.5px;color:var(--text-dim);font-weight:400">${k.unit || ''}</span></div></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
          ${d.charts.map((c, i) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--panel);"><div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">${c.title}</div><div style="height:250px;position:relative;"><canvas id="anc_${sc}_${i}"></canvas></div></div>`).join('')}
        </div>
        ${d.rows ? `<div class="table-wrap" style="margin-top:14px;max-height:460px;overflow:auto;"><table><thead><tr>${d.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r => `<tr>${r.map(c => `<td class="cell-mono">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
        ${(d.extraTables || []).map(t => `<div style="margin-top:16px;"><div style="font-weight:700;font-size:13px;margin-bottom:6px;">${t.title}</div><div class="table-wrap" style="max-height:380px;overflow:auto;"><table><thead><tr>${t.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${t.rows.length ? t.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.head.length}" style="text-align:center;color:var(--text-dim)">${L('داده‌ای ثبت نشده', 'No data')}</td></tr>`}</tbody></table></div></div>`).join('')}
      </div>`;
    });
    body.innerHTML = out;
    if (typeof Chart !== 'undefined') {
      built.forEach(({ sc, d }) => d.charts.forEach((c, i) => {
        const cv = document.getElementById(`anc_${sc}_${i}`); if (!cv) return;
        S.charts[`${sc}_${i}`] = new Chart(cv.getContext('2d'), c.cfg());
      }));
    } else { body.insertAdjacentHTML('afterbegin', `<div class="card" style="color:var(--text-muted)">${L('نمایش نمودارها نیاز به اتصال اینترنت دارد.', 'Charts need an internet connection.')}</div>`); }
    S.last = built;
  }

  async function getReport() {
    const built = sectionsFor(S.scope).map(sc => ({ sc, d: BUILDERS[sc]() }));
    const sections = [];
    for (const { d } of built) {
      for (let i = 0; i < d.charts.length; i++) {
        const c = d.charts[i];
        let cfg = c.cfg();
        // export charts use light colors on white background
        const lightFix = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && (v === '#8db3c2' || v === '#52708a')) ? '#52708a' : (v === 'rgba(255,255,255,0.07)' ? 'rgba(10,50,65,0.08)' : v)));
        let img = '';
        try { img = await RK.chartImage(lightFix(cfg), c.type === 'doughnut' ? 520 : 900, c.type === 'doughnut' ? 340 : 360); } catch (e) { }
        sections.push({ title: i === 0 ? d.title + ' — ' + c.title : c.title, kpis: i === 0 ? d.kpis : null, chart: img, table: null });
      }
      if (d.rows) sections.push({ title: d.title + ' — ' + L('جدول تفصیلی', 'Detailed table'), table: { head: d.head, rows: d.rows } });
      (d.extraTables || []).forEach(t => sections.push({ title: t.title, table: { head: t.head, rows: t.rows } }));
    }
    return {
      title: L('گزارش جامع ایستگاه توزیع آب پارس', 'Pars Water Distribution Station — Comprehensive Report'),
      subtitle: periodTitle(),
      meta: [[L('بازه گزارش', 'Report scope'), periodTitle()], [L('بخش', 'Section'), L('ایستگاه توزیع آب پارس', 'Pars Water Distribution Station')]],
      sections
    };
  }

  function render() { drawControls(); renderBody(); }

  /* ---------- integrate into cmm.html ---------- */
  function install() {
    if (document.getElementById('view-analytics')) return;
    const anchor = document.getElementById('view-report');
    if (!anchor) return;
    const v = document.createElement('div'); v.className = 'view'; v.id = 'view-analytics'; v.innerHTML = html();
    anchor.parentNode.insertBefore(v, anchor);
    // nav item (before annual report)
    const navReport = document.querySelector('.nav-item[data-view="report"]');
    const item = document.createElement('div'); item.className = 'nav-item'; item.dataset.view = 'analytics';
    item.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> <span id="anNavLabel">${L('تحلیل و آمار جامع', 'Analytics & statistics')}</span>`;
    item.addEventListener('click', () => switchView('analytics'));
    navReport.parentNode.insertBefore(item, navReport);
    VIEW_META.analytics = { title: L('تحلیل و آمار جامع', 'Analytics & statistics'), sub: L('گزارش‌های روزانه، ماهانه و سالانه مخازن، تولید، پمپاژ و تعمیرات', 'Daily, monthly & yearly reports: tanks, production, pumping and maintenance') };
    const orig = window.switchView;
    window.switchView = function (view) {
      orig(view);
      if (view === 'analytics') {
        VIEW_META.analytics.title = L('تحلیل و آمار جامع', 'Analytics & statistics');
        document.getElementById('pageTitle').textContent = VIEW_META.analytics.title;
        document.getElementById('pageSub').textContent = VIEW_META.analytics.sub;
        const p = isoToJalaliParts(todayISO()); if (!S.jy) { S.jy = p.year; S.jm = p.month; }
        render();
      }
    };
    window.addEventListener('rostampour-lang-changed', () => { document.getElementById('anNavLabel').textContent = L('تحلیل و آمار جامع', 'Analytics & statistics'); const act = document.querySelector('.view.active'); if (act && act.id === 'view-analytics') { document.getElementById('view-analytics').innerHTML = html(); render(); } });
    window.addEventListener('message', (ev) => { if (ev.data && ev.data.rostampourTheme) { const act = document.querySelector('.view.active'); if (act && act.id === 'view-analytics') setTimeout(renderBody, 50); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
