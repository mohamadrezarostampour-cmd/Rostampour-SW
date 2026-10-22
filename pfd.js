/* =========================================================================
   PFD — دوقلوی دیجیتال ایستگاه توزیع آب پارس (تب PFD در بخش ایستگاه)
   کارخانه‌ها ← مخزن ایستگاه ← پمپاژ GRP/PE ← مخازن ۱۵۰۰۰ و ۲۰۰۰۰، و بارگیری تانکر.
   سطح مخازن، تولید کارخانه‌ها، پمپاژ و بارگیری از ثبت‌های واقعی برنامه خوانده می‌شود.
   وضعیت شیر/پمپ و مقادیر سناریو فقط روی همین دستگاه ذخیره می‌شود.

   قابلیت‌ها: بازپخش تاریخی، پیش‌بینی مصرف از سابقه، پیشنهاد چیدمان پمپ‌ها،
   تراز جرمی (کشف ناترازی/نشت)، سناریوهای رویداد، حالت اتاق کنترل، تصویر PFD برای گزارش‌ها.
   API: PFD.render(state) · PFD.snapshot(state, isoDate) · PFD.balance(state)
   ========================================================================= */
(function (global) {
  'use strict';
  var LS = 'rostampour-pfd-v1';
  var CAP = { st: 2400, t15: 15000, t20: 20000 }, MIN = 1000;
  var P = { pump: 420, tankerPump: 240, bay: 40 };      // دبی هر پمپ از سایت؛ پمپ بارگیری و دوش‌ها نمونه
  var NS = 'http://www.w3.org/2000/svg';
  var S = null, hz = 0, svg = null, root = null, real = null, touched = false, K = null, appState = {};
  var prof = null, scn = null, replayDate = null, clockStart = new Date(), tv = false, tvTimer = null, dates = [];
  var DT = 0.1, STATIC = false;
  var SCENARIOS = [
    { id: 'power', label: 'قطع برق ۴ ساعته', start: 0, dur: 4, fx: { pumps: 0, f1: 0, fB: 0 } },
    { id: 'f1', label: 'خرابی کارخانه نورویژه (۱۲ ساعت)', start: 0, dur: 12, fx: { f1: 0 } },
    { id: 'fB', label: 'خرابی کارخانه بناب (۱۲ ساعت)', start: 0, dur: 12, fx: { fB: 0 } },
    { id: 'grp', label: 'بسته شدن خط GRP (۳ ساعت)', start: 0, dur: 3, fx: { grp: 0 } },
    { id: 'peak', label: 'اوج مصرف ۳۰٪ بیشتر (۲۴ ساعت)', start: 0, dur: 24, fx: { dem: 1.3 } }
  ];

  function fa(n, d) { return Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d || 0 }); }
  function fd(iso) { try { if (typeof fmtDate === 'function') return fmtDate(iso); } catch (e) { } return iso; }
  function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ S: S, touched: touched })); } catch (e) { } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ================= real data ================= */
  function dayOf(x) { return String(x).slice(0, 10); }
  function latest(rows, pred, key, upTo) {
    var a = rows.filter(function (x) { return pred(x) && (!upTo || dayOf(x[key]) <= upTo); }).sort(function (x, y) { return String(x[key]).localeCompare(String(y[key])); });
    return a.length ? a[a.length - 1] : null;
  }
  function readReal(st, upTo) {
    var r = { t20: null, t15: null, f1: null, fB: null, pumpAvg: null, tankerDay: null, dates: {} };
    var a = latest(st.tankReadings || [], function (x) { return x.tankKey === 't20000'; }, 'datetime', upTo);
    var b = latest(st.tankReadings || [], function (x) { return x.tankKey === 't15000'; }, 'datetime', upTo);
    if (a) { r.t20 = +a.volume; r.dates.t20 = a.datetime; }
    if (b) { r.t15 = +b.volume; r.dates.t15 = b.datetime; }
    var n = latest(st.plantProd || [], function (x) { return x.plant === 'norouzheh'; }, 'date', upTo);
    var o = latest(st.plantProd || [], function (x) { return x.plant === 'bonab'; }, 'date', upTo);
    if (n) { r.f1 = +n.volume / 24; r.dates.f1 = n.date; }
    if (o) { r.fB = +o.volume / 24; r.dates.fB = o.date; }
    var pm = latest(st.pumpLoad || [], function (x) { return x.type === 'mainpump'; }, 'date', upTo);
    var tl = latest(st.pumpLoad || [], function (x) { return x.type === 'tankerload'; }, 'date', upTo);
    if (pm) { r.pumpAvg = +pm.volume / 24; r.dates.pump = pm.date; }
    if (tl) { r.tankerDay = +tl.volume; r.dates.tanker = tl.date; }
    return r;
  }
  function allDates(st) {
    var m = {};
    (st.plantProd || []).forEach(function (x) { m[x.date] = 1; });
    (st.pumpLoad || []).forEach(function (x) { m[x.date] = 1; });
    (st.tankReadings || []).forEach(function (x) { m[dayOf(x.datetime)] = 1; });
    return Object.keys(m).sort().slice(-90);
  }

  /* ---- مصرف خروجی مخازن از سابقه: تراز هر بازه بین دو قرائت (پمپاژ روز، نیمی برای هر مخزن) ---- */
  function buildProfile(st, upTo) {
    var pumpByDay = {};
    (st.pumpLoad || []).forEach(function (r) { if (r.type === 'mainpump') pumpByDay[r.date] = +r.volume / 24; });
    function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
    var out = {};
    [['t15000', 't15'], ['t20000', 't20']].forEach(function (k) {
      var rs = (st.tankReadings || []).filter(function (r) { return r.tankKey === k[0] && (!upTo || dayOf(r.datetime) <= upTo); })
        .sort(function (a, b) { return String(a.datetime).localeCompare(String(b.datetime)); });
      var bins = [[], [], [], [], [], []], all = [];
      for (var i = 1; i < rs.length; i++) {
        var a = rs[i - 1], b = rs[i], ta = new Date(a.datetime).getTime(), tb = new Date(b.datetime).getTime(), gap = (tb - ta) / 3.6e6;
        if (!(gap >= 1 && gap <= 14)) continue;
        var share = pumpByDay[dayOf(b.datetime)]; if (share == null) continue; share /= 2;
        var d = share - ((+b.volume) - (+a.volume)) / gap; if (!(d >= 0 && d < 3000)) continue;
        var mid = new Date((ta + tb) / 2), h = mid.getHours() + mid.getMinutes() / 60;
        bins[Math.floor(h / 4)].push(d); all.push(d);
      }
      out[k[1]] = { bins: bins.map(avg), mean: avg(all), n: all.length };
    });
    return out;
  }
  function clockHour(t) { var h = clockStart.getHours() + clockStart.getMinutes() / 60 + t; return ((h % 24) + 24) % 24; }
  function dmd(key, t, st) {
    var base;
    var p = prof && prof[key];
    if (st.dmode === 'auto' && p && p.n >= 3) { var b = p.bins[Math.floor(clockHour(t) / 4)]; base = b != null ? b : p.mean; }
    else base = key === 't15' ? st.d15 : st.d20;
    return Math.max(0, base);
  }

  /* ================= state ================= */
  function tankerAvg() { return real && real.tankerDay != null ? real.tankerDay / 24 : 0; }
  function fresh() {
    var pumpsOn = 2;
    if (real && real.pumpAvg != null) pumpsOn = Math.max(real.pumpAvg > 0 ? 1 : 0, Math.min(4, Math.round(real.pumpAvg / P.pump)));
    var arr = [0, 0, 0, 0]; for (var i = 0; i < pumpsOn; i++) arr[i] = 1;
    return {
      valves: { out: 1, suc: 1, tnk: 1, f1: 1, fB: 1, in15: 1, in20: 1, o15: 1, o20: 1 },
      pumps: arr, tp: 1, loading: 0, bays: [1, 1, 0, 0, 0, 0], fac: { f1: 1, fB: 1 },
      q: { f1: real && real.f1 != null ? Math.round(real.f1) : 450, fB: real && real.fB != null ? Math.round(real.fB) : 450 },
      v: { st: 1700, t15: real && real.t15 != null ? real.t15 : 7500, t20: real && real.t20 != null ? real.t20 : 11000 },
      d15: 380, d20: 460, dmode: 'auto'
    };
  }

  /* ================= hydraulic model ================= */
  function mods(t) {
    var m = { pumps: 1, f1: 1, fB: 1, grp: 1, dem: 1 };
    if (scn && t >= scn.start && t < scn.start + scn.dur) for (var k in scn.fx) m[k] = scn.fx[k];
    return m;
  }
  function flows(v, t, st, dt) {
    var f = {}, V = st.valves, m = mods(t);
    f.in1 = st.fac.f1 && V.f1 && m.f1 ? st.q.f1 : 0; f.inB = st.fac.fB && V.fB && m.fB ? st.q.fB : 0;
    var run = st.pumps.reduce(function (a, b) { return a + b * P.pump; }, 0) * m.pumps;
    var acc15 = V.in15 && v.t15 < CAP.t15 - 1, acc20 = V.in20 && v.t20 < CAP.t20 - 1;
    var nAcc = (acc15 ? 1 : 0) + (acc20 ? 1 : 0), outOpen = V.out && m.grp;
    f.rawPump = V.suc ? run : 0;
    f.deadhead = f.rawPump > 0 && (!outOpen || !nAcc);
    f.pump = (V.suc && outOpen && nAcc) ? run : 0;
    var nb = st.bays.reduce(function (a, b) { return a + b; }, 0), tOk = V.tnk && st.tp;
    f.loading = !!(st.loading && tOk && nb > 0);
    f.tanker = f.loading ? Math.min(P.tankerPump, nb * P.bay) : (tOk ? tankerAvg() : 0);
    f.tankerWanted = !!(st.loading && nb > 0 && !tOk);
    var out = f.pump + f.tanker, avail = Math.max(0, v.st - MIN) / dt + f.in1 + f.inB;
    var k = out > avail && out > 0 ? avail / out : 1;
    f.starve = k < 1; f.pump *= k; f.tanker *= k;
    f.to15 = acc15 ? f.pump / nAcc : 0; f.to20 = acc20 ? f.pump / nAcc : 0;
    var d15 = dmd('t15', t, st) * m.dem, d20 = dmd('t20', t, st) * m.dem;
    f.d15 = d15; f.d20 = d20;
    f.o15 = V.o15 ? Math.min(d15, v.t15 / dt + f.to15) : 0;
    f.o20 = V.o20 ? Math.min(d20, v.t20 / dt + f.to20) : 0;
    f.net = f.in1 + f.inB - f.pump - f.tanker; return f;
  }
  function sim(st, h, dt) {
    var v = { st: st.v.st, t15: st.v.t15, t20: st.v.t20 }, n = Math.round(h / dt);
    var r = { minSt: v.st, maxSt: v.st, min15: v.t15, min20: v.t20, tMin: null, t15low: null, t20low: null, tMin15: 0, tMin20: 0, dead: false, full: false };
    for (var i = 0; i < n; i++) {
      var f = flows(v, i * dt, st, dt), tt = (i + 1) * dt;
      v.st = Math.max(0, Math.min(CAP.st, v.st + f.net * dt));
      v.t15 = Math.max(0, Math.min(CAP.t15, v.t15 + (f.to15 - f.o15) * dt));
      v.t20 = Math.max(0, Math.min(CAP.t20, v.t20 + (f.to20 - f.o20) * dt));
      if (f.deadhead) r.dead = true; if (v.st >= CAP.st - 1) r.full = true;
      if (v.st < r.minSt) r.minSt = v.st; if (v.st > r.maxSt) r.maxSt = v.st;
      if (v.t15 < r.min15) { r.min15 = v.t15; } if (v.t20 < r.min20) { r.min20 = v.t20; }
      if (r.tMin == null && v.st <= MIN + 1) r.tMin = tt;
      if (r.t15low == null && v.t15 < .2 * CAP.t15) r.t15low = tt;
      if (r.t20low == null && v.t20 < .2 * CAP.t20) r.t20low = tt;
    }
    r.v = v; return r;
  }

  /* ---- پیشنهاد چیدمان پمپ‌ها: کمترین تعداد پمپی که ۲۴ ساعت را بدون رسیدن به حداقل ایمن می‌گذراند ---- */
  function suggest() {
    var opts = [];
    for (var n = 0; n <= 4; n++) {
      var st = clone(S); st.pumps = [0, 0, 0, 0].map(function (_, i) { return i < n ? 1 : 0; }); st.loading = S.loading;
      var r = sim(st, 24, 0.25);
      var ok = r.tMin == null && r.min15 >= .15 * CAP.t15 && r.min20 >= .15 * CAP.t20 && !r.dead;
      opts.push({ n: n, r: r, ok: ok, score: Math.min(r.minSt - MIN, (r.min15 / CAP.t15 - .15) * 4000, (r.min20 / CAP.t20 - .15) * 4000) });
    }
    var cur = S.pumps.reduce(function (a, b) { return a + b; }, 0);
    var feas = opts.filter(function (o) { return o.ok && !o.r.full; }); if (!feas.length) feas = opts.filter(function (o) { return o.ok; });
    var best = feas.length ? feas[0] : opts.slice().sort(function (a, b) { return b.score - a.score; })[0];
    return { opts: opts, best: best, cur: cur, ok: !!feas.length };
  }

  /* ---- تراز جرمی: تولید کارخانه‌ها − (پمپاژ اصلی + بارگیری تانکر) ---- */
  function balance(st, days) {
    var byDay = {};
    function slot(d) { return byDay[d] || (byDay[d] = { P: null, M: null, T: null }); }
    (st.plantProd || []).forEach(function (x) { var s = slot(x.date); s.P = (s.P || 0) + (+x.volume || 0); });
    (st.pumpLoad || []).forEach(function (x) { var s = slot(x.date); if (x.type === 'mainpump') s.M = (s.M || 0) + (+x.volume || 0); else if (x.type === 'tankerload') s.T = (s.T || 0) + (+x.volume || 0); });
    var keys = (days && days.length ? days.filter(function (d) { return byDay[d]; }) : Object.keys(byDay)).sort();
    var rows = [];
    keys.forEach(function (d) {
      var s = byDay[d]; if (s.P == null || s.M == null) return;
      var out = s.M + (s.T || 0), res = s.P - out, a = Math.abs(res);
      rows.push({ date: d, P: s.P, out: out, res: res, status: a > (CAP.st - MIN) ? 'bad' : a > 600 ? 'warn' : 'ok' });
    });
    return rows;
  }
  function balanceSummary(rows) {
    var last = rows.slice(-7); if (!last.length) return null;
    var mean = last.reduce(function (a, r) { return a + r.res; }, 0) / last.length;
    var meanP = last.reduce(function (a, r) { return a + r.P; }, 0) / last.length;
    return { mean: mean, pct: meanP ? mean / meanP * 100 : 0, n: last.length, bad: last.filter(function (r) { return r.status !== 'ok'; }).length };
  }

  /* ================= drawing ================= */
  function el(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; }
  function txt(s, x, y, o, cls, p) { var e = el('text', Object.assign({ x: x, y: y, 'text-anchor': 'middle' }, o || {}), p); e.textContent = s; if (cls) e.setAttribute('class', cls); return e; }
  function pipe(pts, on, w) { el('path', { d: 'M' + pts.map(function (p) { return p.join(' '); }).join(' L'), 'class': 'pfd-flow' + (on > 0.5 ? '' : ' off'), style: w ? 'stroke-width:' + w : '' }); }
  function color(p) { return p < 15 ? 'var(--red)' : p < 30 ? 'var(--amber)' : 'var(--accent-2)'; }
  function bind(g, fn) { if (STATIC) return; g.addEventListener('click', fn); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }); }
  function touch() { touched = true; save(); draw(); }
  function valve(x, y, key, label, lx, ly) {
    var open = S.valves[key];
    var g = el('g', { 'class': 'pfd-node', tabindex: 0, role: 'button', 'aria-pressed': !!open, 'aria-label': label + (open ? ' باز' : ' بسته') });
    el('rect', { x: x - 22, y: y - 18, width: 44, height: 36, fill: 'transparent' }, g);
    el('path', { d: 'M' + (x - 12) + ' ' + (y - 9) + ' L' + (x + 12) + ' ' + (y + 9) + ' L' + (x + 12) + ' ' + (y - 9) + ' L' + (x - 12) + ' ' + (y + 9) + ' Z', fill: open ? 'var(--green)' : 'var(--red)', stroke: 'var(--panel)', 'stroke-width': 1.5 }, g);
    txt(label, x + (lx || 0), y + (ly || -16), { 'font-size': 10.5, 'font-weight': 600 }, 'pfd-small', g);
    bind(g, function () { S.valves[key] = open ? 0 : 1; touch(); });
  }
  function pump(x, y, on, label, fn, r) {
    var g = el('g', { 'class': 'pfd-node', tabindex: 0, role: 'button', 'aria-pressed': !!on, 'aria-label': label + (on ? ' روشن' : ' خاموش') });
    el('circle', { cx: x, cy: y, r: r || 17, fill: 'var(--panel-2)', stroke: on ? 'var(--green)' : 'var(--red)', 'stroke-width': 3 }, g);
    el('path', { d: 'M' + (x - 6) + ' ' + (y - 8) + ' L' + (x + 8) + ' ' + y + ' L' + (x - 6) + ' ' + (y + 8) + ' Z', fill: on ? 'var(--green)' : 'var(--red)' }, g);
    txt(label, x, y + (r || 17) + 15, { 'font-size': 11, 'font-weight': 600 }, null, g); bind(g, fn);
  }
  function tank(x, y, w, h, vol, cap, name, min) {
    var unknown = vol == null, lvl = unknown ? 0 : Math.max(0, Math.min(1, vol / cap)), pct = Math.round(lvl * 100), id = 'pfdc' + x + '_' + y;
    var d = el('defs', {}); var cp = el('clipPath', { id: id }, d); el('rect', { x: x, y: y, width: w, height: h, rx: 8 }, cp);
    el('rect', { x: x, y: y, width: w, height: h, rx: 8, fill: 'var(--panel-2)', stroke: 'var(--border-strong)', 'stroke-width': 2 });
    if (!unknown) el('rect', { x: x, y: y + h * (1 - lvl), width: w, height: h * lvl, fill: color(pct), opacity: .85, 'clip-path': 'url(#' + id + ')' });
    var t = txt(unknown ? '—' : fa(pct) + '٪', x + w / 2, y + h / 2 + 7, { 'font-size': 20, 'font-weight': 800 }); t.setAttribute('style', 'paint-order:stroke;stroke:var(--panel);stroke-width:3px');
    txt(name, x + w / 2, y - 8, { 'font-size': 12, 'font-weight': 700 });
    if (min) { var my = y + h * (1 - min / cap); el('line', { x1: x - 6, x2: x + w + 6, y1: my, y2: my, stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }); txt('حداقل ' + fa(min), x + w + 8, my - 4, { 'font-size': 10.5, 'font-weight': 600, 'text-anchor': 'start' }, 'pfd-small'); }
    txt(unknown ? 'سطح ثبت نمی‌شود' : fa(Math.round(vol)) + ' / ' + fa(cap) + ' م³', x + w / 2 - (w > 200 ? 70 : 0), y + h + 16, { 'font-size': 10.5 }, 'pfd-small');
  }
  function factory(x, y, w, h, name, on, key, q) {
    var g = el('g', { 'class': 'pfd-node', tabindex: 0, role: 'button', 'aria-pressed': !!on, 'aria-label': name + (on ? ' در مدار' : ' خارج از مدار') });
    el('rect', { x: x, y: y, width: w, height: h, rx: 10, fill: 'var(--panel)', stroke: on ? 'var(--green)' : 'var(--red)', 'stroke-width': 2.5 }, g);
    for (var i = 0; i < 5; i++) el('circle', { cx: x + 24, cy: y + 48 + i * 30, r: 11, fill: 'var(--amber-soft)', stroke: 'var(--amber)', 'stroke-width': 2 }, g);
    for (var j = 0; j < 3; j++) el('rect', { x: x + 62, y: y + 44 + j * 38, width: w - 190, height: 28, rx: 4, fill: 'var(--amber-soft)', stroke: 'var(--amber)', 'stroke-width': 1.5 }, g);
    for (var k = 0; k < 5; k++) el('circle', { cx: x + 70 + k * 28, cy: y + h - 20, r: 8, fill: 'var(--amber-soft)', stroke: 'var(--amber)', 'stroke-width': 2 }, g);
    txt(name, x + w / 2, y + h + 20, { 'font-size': 13, 'font-weight': 700 }, null, g);
    var t = txt(on ? fa(q) + ' م³/ساعت' : 'خارج از مدار', x + w / 2, y + 26, { 'font-size': 12, 'font-weight': 700 }, null, g);
    t.setAttribute('style', 'fill:' + (on ? 'var(--green)' : 'var(--red)'));
    bind(g, function () { S.fac[key] = on ? 0 : 1; touch(); });
  }
  /* رسم فقط نقشه (روی svg جاری) */
  function paint(v, f, opt) {
    svg.textContent = '';
    var vs = opt && opt.noStation ? null : v.st;
    pipe([[90, 440], [90, 60], [660, 60]], f.pump);
    pipe([[660, 60], [780, 60]], f.pump);
    pipe([[780, 60], [780, 130]], f.to15);
    pipe([[780, 60], [1010, 60]], f.to20);
    pipe([[780, 235], [780, 305]], f.o15);
    pipe([[1090, 140], [1090, 215]], f.o20);
    pipe([[520, 480], [250, 480], [250, 240]], f.pump > 0 ? 1 : 0);
    var py = [240, 310, 380, 440];
    py.forEach(function (y, i) { var on = S.pumps[i] && S.valves.suc && f.pump > 0; pipe([[250, y], [190, y]], on ? 1 : 0); pipe([[150, y], [90, y]], on ? 1 : 0); });
    pipe([[520, 420], [520, 480]], f.pump + f.tanker);
    pipe([[520, 480], [700, 480], [760, 480], [760, 570], [300, 570], [300, 830]], f.loading ? 1 : 0);
    for (var i = 0; i < 6; i++) { var y = 600 + i * 46; pipe([[300, y], [150, y]], S.bays[i] && f.loading ? 1 : 0, 3); }
    pipe([[1180, 690], [1180, 350], [640, 350]], f.in1);
    pipe([[805, 690], [805, 395], [640, 395]], f.inB);
    tank(400, 260, 240, 160, vs, CAP.st, 'مخزن ایستگاه', MIN);
    tank(710, 130, 140, 105, v.t15, CAP.t15, 'مخزن ۱۵۰۰۰');
    tank(1010, 20, 160, 120, v.t20, CAP.t20, 'مخزن ۲۰۰۰۰');
    factory(500, 640, 360, 220, 'کارخانه تولید بناب', S.fac.fB, 'fB', S.q.fB);
    factory(900, 640, 360, 220, 'کارخانه تولید ۱ (نورویژه)', S.fac.f1, 'f1', S.q.f1);
    [[760, 690, 'TK2'], [1130, 690, 'TK1']].forEach(function (t) { el('rect', { x: t[0], y: t[1], width: 90, height: 100, rx: 6, fill: 'var(--panel-2)', stroke: 'var(--accent-2)', 'stroke-width': 2 }); txt(t[2], t[0] + 45, t[1] + 56, { 'font-size': 16, 'font-weight': 800 }); });
    valve(180, 60, 'out', 'شیر خروجی');
    valve(390, 480, 'suc', 'شیر مکش پمپ‌ها');
    valve(600, 480, 'tnk', 'شیر تانکر');
    valve(900, 350, 'f1', 'شیر کارخانه ۱', 0, -18);
    valve(720, 395, 'fB', 'شیر بناب', 0, 22);
    valve(780, 95, 'in15', 'شیر ورودی ۱۵۰۰۰', -62, 4);
    valve(900, 60, 'in20', 'شیر ورودی ۲۰۰۰۰', 0, -16);
    valve(780, 282, 'o15', 'شیر خروجی', -45, 4);
    valve(1090, 178, 'o20', 'شیر خروجی', -45, 4);
    py.forEach(function (y, i) { pump(170, y, S.pumps[i], 'پمپ ' + fa(i + 1), function () { S.pumps[i] = S.pumps[i] ? 0 : 1; touch(); }); });
    pump(680, 480, S.tp, 'پمپ بارگیری', function () { S.tp = S.tp ? 0 : 1; touch(); }, 19);
    for (var b = 0; b < 6; b++) {
      (function (b) {
        var y = 600 + b * 46, on = S.bays[b];
        var g = el('g', { 'class': 'pfd-node', tabindex: 0, role: 'button', 'aria-pressed': !!on, 'aria-label': 'دوش ' + fa(b + 1) + (on ? ' فعال' : ' غیرفعال') });
        el('rect', { x: 34, y: y - 15, width: 112, height: 30, rx: 7, fill: 'var(--panel-2)', stroke: on ? 'var(--green)' : 'var(--border-strong)', 'stroke-width': on ? 2.5 : 1.5 }, g);
        txt('دوش ' + fa(b + 1) + (on ? ' · انتخاب' : ' · خاموش'), 90, y + 5, { 'font-size': 11.5, 'font-weight': 600 }, null, g);
        bind(g, function () { S.bays[b] = on ? 0 : 1; touch(); });
      })(b);
    }
    txt('دوش‌های بارگیری تانکر', 90, 572, { 'font-size': 12, 'font-weight': 700 });
    txt('خط لوله GRP', 400, 44, { 'font-size': 13, 'font-weight': 700 });
    el('rect', { x: 645, y: 48, width: 30, height: 24, rx: 4, fill: 'var(--panel)', stroke: 'var(--text-muted)', 'stroke-width': 1.5 }); txt('GRP|PE', 660, 38, { 'font-size': 10 }, 'pfd-small');
    txt('خط لوله PE', 720, 44, { 'font-size': 12, 'font-weight': 700 });
    txt('خروجی مخزن ۱۵۰۰۰ · ' + fa(Math.round(f.o15)) + ' م³/س', 780, 323, { 'font-size': 11.5, 'font-weight': 600 });
    txt('خروجی مخزن ۲۰۰۰۰ · ' + fa(Math.round(f.o20)) + ' م³/س', 1090, 232, { 'font-size': 11.5, 'font-weight': 600 });
    txt('پمپاژ اصلی · ' + fa(Math.round(f.pump)) + ' م³/س', 170, 205, { 'font-size': 12, 'font-weight': 700 });
    txt((f.loading ? 'در حال بارگیری · ' : 'میانگین بارگیری · ') + fa(Math.round(f.tanker)) + ' م³/س', 480, 545, { 'font-size': 11.5, 'font-weight': 600 });
    if (scn && !STATIC) txt('سناریو فعال: ' + scn.label, 650, 14, { 'font-size': 12, 'font-weight': 700 }).setAttribute('style', 'fill:var(--red)');
  }
  function draw() {
    if (!svg || STATIC) return;
    var v = sim(S, hz, DT).v, f = flows(v, hz, S, DT);
    paint(v, f); panels(v, f);
  }

  /* ================= panels ================= */
  function setK(id, t, c) { var e = K[id]; e.textContent = t; e.className = c || ''; }
  function hoursTxt(h) { return h < 1 ? 'کمتر از یک ساعت' : 'حدود ' + fa(h, 1) + ' ساعت'; }
  function panels(v, f) {
    function pc(a, b) { return Math.round(a / b * 100); }
    [['k1', v.st, CAP.st], ['k2', v.t15, CAP.t15], ['k3', v.t20, CAP.t20]].forEach(function (a) {
      var p = pc(a[1], a[2]), st = a[0] === 'k1';
      setK(a[0], st ? fa(Math.round(a[1])) + ' م³' : fa(p) + '٪', st ? (a[1] >= MIN + 300 ? 'good' : a[1] >= MIN ? 'mid' : 'bad') : (p >= 30 ? 'good' : p >= 15 ? 'mid' : 'bad'));
    });
    setK('k4', fa(f.in1 + f.inB) + ' م³/س'); setK('k5', fa(Math.round(f.pump)) + ' م³/س');
    setK('k6', real && real.tankerDay != null ? fa(Math.round(real.tankerDay)) + ' م³' : '—');
    K.hzv.textContent = fa(hz); K.d15v.textContent = fa(Math.round(f.d15)); K.d20v.textContent = fa(Math.round(f.d20)); K.stv.textContent = fa(Math.round(S.v.st));
    K.loadBtn.textContent = S.loading ? 'پایان بارگیری' : 'شروع بارگیری تانکر';
    K.loadBtn.setAttribute('aria-pressed', S.loading ? 'true' : 'false');
    var auto = S.dmode === 'auto' && prof && prof.t15 && prof.t20 && prof.t15.n >= 3 && prof.t20.n >= 3;
    K.d15.disabled = K.d20.disabled = !!auto;
    K.modeA.setAttribute('aria-pressed', S.dmode === 'auto' ? 'true' : 'false'); K.modeM.setAttribute('aria-pressed', S.dmode === 'auto' ? 'false' : 'true');
    K.modeNote.textContent = S.dmode === 'auto' ? (auto ? 'مصرف از سابقه ' + fa(prof.t15.n + prof.t20.n) + ' بازه قرائت برآورد شده (فرض: پمپاژ بین دو مخزن مساوی تقسیم می‌شود).' : 'سابقه کافی نیست (حداقل ۳ بازه برای هر مخزن)؛ از مقدار دستی استفاده می‌شود.') : 'مصرف را با لغزنده‌ها تعیین می‌کنید.';
    K.replayBadge.hidden = !replayDate; K.replayBadge.textContent = replayDate ? 'نمایش تاریخی: ' + fd(replayDate) : '';
    K.rdate.textContent = replayDate ? fd(replayDate) : (dates.length ? 'اکنون (آخرین ثبت‌ها)' : '—');
    K.clock.textContent = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date().toLocaleDateString('fa-IR');

    /* هشدارها + پیش‌بینی ۴۸ ساعت */
    var L = []; function add(c, t) { L.push([c, t]); }
    if (f.deadhead) add('bad', 'پمپ‌ها روشن‌اند ولی مسیر خروجی (شیر GRP یا هر دو شیر ورودی مخازن) بسته است؛ خطر کار پمپ بدون خروجی.');
    if (f.starve || v.st <= MIN + 1) add('bad', 'مخزن ایستگاه به حداقل مجاز (' + fa(MIN) + ' م³) رسیده؛ برداشت پمپ‌ها فقط به اندازه ورودی کارخانه‌ها ممکن است.');
    else if (f.net < 0) { var h = (v.st - MIN) / (-f.net); add(h < 2 ? 'bad' : 'warn', 'مخزن ایستگاه با نرخ ' + fa(-f.net) + ' م³/س کم می‌شود؛ ' + hoursTxt(h) + ' تا رسیدن به حداقل ' + fa(MIN) + ' م³.'); }
    else if (f.net > 0 && v.st >= CAP.st - 1) add('warn', 'مخزن ایستگاه پر است؛ ورودی کارخانه‌ها بیش از برداشت است.');
    if (f.tankerWanted) add('warn', 'بارگیری تانکر شروع شده ولی شیر تانکر بسته یا پمپ بارگیری خاموش است.');
    if (!S.fac.f1 && !S.fac.fB) add('bad', 'هر دو کارخانه خارج از مدارند؛ ورودی به ایستگاه صفر است.');
    if (v.t20 >= CAP.t20 - 1 || v.t15 >= CAP.t15 - 1) add('warn', 'یکی از مخازن ذخیره پر است و ورودی‌اش بسته می‌شود.');
    var pr = sim(S, 48, 0.25);
    if (pr.t20low != null && S.v.t20 >= .2 * CAP.t20) add('warn', 'پیش‌بینی: مخزن ۲۰۰۰۰ ' + hoursTxt(pr.t20low) + ' دیگر به ۲۰٪ می‌رسد.');
    if (pr.t15low != null && S.v.t15 >= .2 * CAP.t15) add('warn', 'پیش‌بینی: مخزن ۱۵۰۰۰ ' + hoursTxt(pr.t15low) + ' دیگر به ۲۰٪ می‌رسد.');
    if (pr.tMin != null && S.v.st > MIN + 1) add('warn', 'پیش‌بینی: مخزن ایستگاه ' + hoursTxt(pr.tMin) + ' دیگر به حداقل می‌رسد.');
    if (!L.length) add('ok', 'همه چیز در حالت عادی است و تا ۴۸ ساعت آینده مشکلی پیش‌بینی نمی‌شود.');
    K.alerts.innerHTML = L.map(function (a) { return '<div class="pfd-alert ' + a[0] + '">' + a[1] + '</div>'; }).join('');

    /* نتیجه سناریو */
    if (scn) {
      var r = sim(S, 24, 0.25), lines = [];
      lines.push('کمترین حجم مخزن ایستگاه: ' + fa(Math.round(r.minSt)) + ' م³' + (r.tMin != null ? ' (رسیدن به حداقل: ' + hoursTxt(r.tMin) + ' بعد)' : ''));
      lines.push('کمترین سطح مخزن ۱۵۰۰۰: ' + fa(Math.round(r.min15 / CAP.t15 * 100)) + '٪ · مخزن ۲۰۰۰۰: ' + fa(Math.round(r.min20 / CAP.t20 * 100)) + '٪');
      if (r.dead) lines.push('در این سناریو پمپ‌ها بدون مسیر خروجی کار می‌کنند.');
      K.scnRes.innerHTML = '<b>نتیجه ' + scn.label + '</b><br>' + lines.join('<br>'); K.scnRes.hidden = false;
    } else K.scnRes.hidden = true;
    K.scnBtns.forEach(function (b) { b.btn.setAttribute('aria-pressed', scn && scn.id === b.id ? 'true' : 'false'); });

    /* پیشنهاد چیدمان پمپ‌ها */
    var sg = suggest(), msg;
    if (sg.best.n === sg.cur && sg.ok) msg = '<div class="pfd-alert ok">چیدمان فعلی (' + fa(sg.cur) + ' پمپ) برای ۲۴ ساعت آینده مناسب است.</div>';
    else if (sg.ok) msg = '<div class="pfd-alert warn">پیشنهاد: ' + fa(sg.best.n) + ' پمپ روشن باشد (اکنون ' + fa(sg.cur) + ' پمپ). با این چیدمان مخزن ایستگاه تا ۲۴ ساعت آینده بالای حداقل می‌ماند و مخازن ذخیره زیر ۱۵٪ نمی‌روند.</div>';
    else msg = '<div class="pfd-alert bad">هیچ چیدمانی تمام ۲۴ ساعت را بدون افت پوشش نمی‌دهد. بهترین گزینه: ' + fa(sg.best.n) + ' پمپ. ورودی کارخانه‌ها یا مصرف را بررسی کنید.</div>';
    K.sugg.innerHTML = msg + '<table class="pfd-tbl"><thead><tr><th>تعداد پمپ</th><th>کمترین حجم ایستگاه</th><th>کمترین ۱۵۰۰۰</th><th>کمترین ۲۰۰۰۰</th><th>نتیجه</th></tr></thead><tbody>' +
      sg.opts.map(function (o) { return '<tr' + (o.n === sg.best.n ? ' class="best"' : '') + '><td>' + fa(o.n) + '</td><td>' + fa(Math.round(o.r.minSt)) + '</td><td>' + fa(Math.round(o.r.min15 / CAP.t15 * 100)) + '٪</td><td>' + fa(Math.round(o.r.min20 / CAP.t20 * 100)) + '٪</td><td>' + (o.ok ? (o.r.full ? 'مناسب (ایستگاه پر می‌شود)' : 'مناسب') : (o.r.dead ? 'بدون مسیر خروجی' : (o.r.tMin != null ? 'ایستگاه به حداقل می‌رسد' : 'مخزن ذخیره زیر ۱۵٪'))) + '</td></tr>'; }).join('') + '</tbody></table>';

    /* تراز جرمی */
    var rows = balance(appState).slice(-7), sm = balanceSummary(balance(appState)), bhtml = '';
    if (!rows.length) bhtml = '<div class="pfd-alert">برای تراز جرمی، تولید کارخانه‌ها و پمپاژ اصلی همان روز باید ثبت شده باشد.</div>';
    else {
      if (sm) {
        var big = Math.abs(sm.pct) > 3;
        bhtml += '<div class="pfd-alert ' + (big || sm.bad ? 'warn' : 'ok') + '">میانگین اختلاف ' + fa(sm.n) + ' روز اخیر: ' + fa(Math.round(sm.mean)) + ' م³ در روز (' + fa(Math.abs(sm.pct), 1) + '٪ تولید). ' +
          (big ? 'اختلاف پایدار است؛ احتمال نشت، خطای کنتور یا ثبت اشتباه را بررسی کنید.' : sm.bad ? 'برخی روزها ناتراز بوده‌اند.' : 'تراز در محدوده عادی است.') + '</div>';
      }
      bhtml += '<table class="pfd-tbl"><thead><tr><th>تاریخ</th><th>تولید</th><th>پمپاژ + بارگیری</th><th>اختلاف</th><th>وضعیت</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + fd(r.date) + '</td><td>' + fa(Math.round(r.P)) + '</td><td>' + fa(Math.round(r.out)) + '</td><td>' + fa(Math.round(r.res)) + '</td><td class="' + r.status + '">' + (r.status === 'ok' ? 'عادی' : r.status === 'warn' ? 'مشکوک' : 'ناتراز') + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    K.bal.innerHTML = bhtml;

    var src = [];
    if (real) {
      if (real.dates.t20) src.push('مخزن ۲۰۰۰۰: ' + fa(Math.round(real.t20)) + ' م³ (' + fd(dayOf(real.dates.t20)) + ')');
      if (real.dates.t15) src.push('مخزن ۱۵۰۰۰: ' + fa(Math.round(real.t15)) + ' م³ (' + fd(dayOf(real.dates.t15)) + ')');
      if (real.dates.f1) src.push('تولید نورویژه: ' + fa(Math.round(real.f1 * 24)) + ' م³ در روز (' + fd(real.dates.f1) + ')');
      if (real.dates.fB) src.push('تولید بناب: ' + fa(Math.round(real.fB * 24)) + ' م³ در روز (' + fd(real.dates.fB) + ')');
      if (real.dates.pump) src.push('پمپاژ اصلی: ' + fa(Math.round(real.pumpAvg * 24)) + ' م³ در روز (' + fd(real.dates.pump) + ')');
      if (real.dates.tanker) src.push('بارگیری تانکر: ' + fa(Math.round(real.tankerDay)) + ' م³ در روز (' + fd(real.dates.tanker) + ')');
    }
    K.src.innerHTML = src.length ? src.map(function (s) { return '<li>' + s + '</li>'; }).join('') : '<li>هنوز داده‌ای ثبت نشده؛ از مقادیر نمونه استفاده می‌شود.</li>';
  }

  /* ================= snapshot for reports ================= */
  var LIGHT = { '--bg': '#ffffff', '--panel': '#ffffff', '--panel-2': '#eaf4f5', '--border-strong': '#c2d3da', '--text': '#0f2438', '--text-muted': '#52708a', '--accent-2': '#1565c0', '--green': '#1f9d76', '--red': '#d43439', '--amber': '#c47f16', '--amber-soft': '#f6e7c9' };
  function snapshot(st, iso) {
    return new Promise(function (resolve) {
      var keep = { svg: svg, real: real, S: S, hz: hz, scn: scn, prof: prof, start: clockStart, STATIC: STATIC, K: K };
      try {
        var tmp = document.createElementNS(NS, 'svg'); tmp.setAttribute('xmlns', NS); tmp.setAttribute('viewBox', '0 -26 1300 926'); tmp.setAttribute('width', 1300); tmp.setAttribute('height', 926);
        svg = tmp; STATIC = true; scn = null; hz = 0;
        real = readReal(st, iso); prof = buildProfile(st, iso); clockStart = new Date(iso + 'T12:00:00');
        S = fresh(); S.dmode = 'auto';
        var v = { st: S.v.st, t15: S.v.t15, t20: S.v.t20 }, f = flows(v, 0, S, DT);
        paint(v, f, { noStation: true });
        var cap = txt('PFD · وضعیت ایستگاه در تاریخ ' + fd(iso), 330, -6, { 'font-size': 17, 'font-weight': 700 });
        var style = document.createElementNS(NS, 'style');
        style.textContent = "text{font-family:Tahoma,'Segoe UI',Arial,sans-serif;fill:#0f2438}.pfd-small{fill:#52708a}.pfd-flow{stroke:#1565c0;stroke-width:4;fill:none;stroke-dasharray:8 8}.pfd-flow.off{stroke:#c2d3da;stroke-dasharray:none}";
        tmp.insertBefore(style, tmp.firstChild);
        var bg = document.createElementNS(NS, 'rect'); bg.setAttribute('y', -26); bg.setAttribute('width', 1300); bg.setAttribute('height', 926); bg.setAttribute('fill', '#ffffff'); tmp.insertBefore(bg, style.nextSibling);
        var s = new XMLSerializer().serializeToString(tmp).replace(/var\((--[a-z0-9-]+)\)/g, function (m, n) { return LIGHT[n] || '#000000'; });
        var img = new Image();
        img.onload = function () {
          try { var c = document.createElement('canvas'); c.width = 1950; c.height = 1389; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/png')); } catch (e) { resolve(''); }
        };
        img.onerror = function () { resolve(''); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      } catch (e) { resolve(''); }
      finally { svg = keep.svg; real = keep.real; S = keep.S; hz = keep.hz; scn = keep.scn; prof = keep.prof; clockStart = keep.start; STATIC = keep.STATIC; }
    });
  }

  /* ================= UI ================= */
  var CSS = '.pfd-stack{display:grid;gap:16px}.pfd-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;align-items:start}' +
    '.pfd-box{overflow-x:auto}#pfdMap{display:block;width:100%;min-width:900px;height:auto}#pfdMap text{font-family:var(--font);fill:var(--text)}.pfd-small{font-size:11px;fill:var(--text-muted)!important}' +
    '.pfd-node{cursor:pointer}.pfd-node:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}' +
    '.pfd-flow{stroke:var(--accent-2);stroke-width:4;fill:none;stroke-dasharray:8 8;animation:pfdDash 1s linear infinite}.pfd-flow.off{stroke:var(--border-strong);animation:none;stroke-dasharray:none}@keyframes pfdDash{to{stroke-dashoffset:-16}}' +
    '@media(prefers-reduced-motion:reduce){.pfd-flow{animation:none}}' +
    '.pfd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.pfd-kpi{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--panel-2)}.pfd-kpi b{display:block;font-size:18px;font-weight:800}.pfd-kpi span{font-size:12px;color:var(--text-muted)}' +
    '.pfd-kpi .good{color:var(--green)}.pfd-kpi .mid{color:var(--amber)}.pfd-kpi .bad{color:var(--red)}' +
    '.pfd-alerts{display:grid;gap:6px;margin-top:12px}.pfd-alert{padding:8px 12px;border-radius:10px;font-weight:600;font-size:13px;border:1px solid var(--border);margin-bottom:6px}' +
    '.pfd-alert.ok{background:var(--green-soft);color:var(--green)}.pfd-alert.warn{background:var(--amber-soft);color:var(--amber)}.pfd-alert.bad{background:var(--red-soft);color:var(--red)}' +
    '.pfd-lbl{display:block;font-weight:600;margin:12px 0 4px;font-size:13px}.pfd-card input[type=range]{width:100%;accent-color:var(--accent-2)}.pfd-card input[type=number]{width:100%;padding:6px 8px;border-radius:8px;border:1px solid var(--border-strong);background:var(--panel);color:var(--text);font:inherit}' +
    '.pfd-row{display:flex;justify-content:space-between;color:var(--text-muted);font-size:12px}.pfd-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}' +
    '.pfd-btns .btn[aria-pressed=true]{border-color:var(--accent-2);color:var(--accent-2);background:var(--accent-soft)}' +
    '.pfd-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 24px}' +
    '.pfd-src{margin:8px 0 0;padding:0 18px 0 0;font-size:12px;color:var(--text-muted)}.pfd-legend{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--text-muted);font-size:12px;margin-top:10px}.pfd-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-inline-end:5px}' +
    '.pfd-tbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}.pfd-tbl th,.pfd-tbl td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:right}.pfd-tbl th{color:var(--text-muted);font-weight:600}.pfd-tbl tr.best td{background:var(--accent-soft);font-weight:700}.pfd-tbl td.ok{color:var(--green)}.pfd-tbl td.warn{color:var(--amber)}.pfd-tbl td.bad{color:var(--red)}' +
    '.pfd-badge{display:inline-block;padding:3px 12px;border-radius:99px;background:var(--amber-soft);color:var(--amber);font-weight:700;font-size:12px}.pfd-res{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--panel-2);border:1px solid var(--border);font-size:12.5px;line-height:1.9}' +
    '.pfd-tvhead{display:none}' +
    '.pfd-tv{position:fixed;inset:0;z-index:9999;background:var(--bg);overflow:auto;padding:16px max(16px,env(safe-area-inset-left,0px))}.pfd-tv .pfd-notv{display:none!important}.pfd-tv .pfd-tvhead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.pfd-tv .pfd-tvhead h2{margin:0;font-size:22px}' +
    '.pfd-tv .pfd-stack{display:flex;flex-direction:column}.pfd-tv .pfd-tvhead{order:-2}.pfd-tv .pfd-status{order:-1}.pfd-tv #pfdMap{pointer-events:none}.pfd-tv .pfd-kpi b{font-size:30px}.pfd-tv .pfd-kpi span{font-size:14px}.pfd-tv .pfd-alert{font-size:16px}.pfd-tv .pfd-tvclock{font-size:24px;font-weight:800}';

  function build(host) {
    if (!document.getElementById('pfd-style')) { var st = document.createElement('style'); st.id = 'pfd-style'; st.textContent = CSS; document.head.appendChild(st); }
    host.innerHTML =
      '<div class="pfd-stack">' +
      '<div class="pfd-tvhead"><h2>ایستگاه توزیع آب پارس · PFD</h2><span class="pfd-tvclock" id="pfdClock"></span><button class="btn" id="pfdTvExit" type="button">خروج از حالت اتاق کنترل</button></div>' +
      '<div class="card pfd-notv"><div class="pfd-btns" style="margin:0"><button class="btn" id="pfdTv" type="button">حالت اتاق کنترل (نمایش تمام‌صفحه)</button><span class="pfd-badge" id="pfdReplayBadge" hidden></span></div>' +
      '<label class="pfd-lbl" for="pfdReplay">بازپخش تاریخی: <span id="pfdRdate"></span></label><input id="pfdReplay" type="range" min="0" max="0" value="0" step="1"><div class="pfd-row"><span>قدیمی‌ترین ثبت</span><span>اکنون</span></div></div>' +
      '<div class="card"><div class="panel-title pfd-notv"><div><h3>PFD · نقشه یکپارچه ایستگاه</h3><div class="sub">روی شیر، پمپ، کارخانه یا دوش کلیک کنید تا اثرش را روی مخازن ببینید</div></div></div>' +
      '<div class="pfd-box"><svg id="pfdMap" viewBox="0 0 1300 900" role="img" aria-label="نقشه شماتیک یکپارچه ایستگاه"></svg></div>' +
      '<div class="pfd-legend pfd-notv"><span><i style="background:var(--green)"></i>شیر باز / تجهیز در مدار</span><span><i style="background:var(--red)"></i>شیر بسته / خارج از مدار</span><span><i style="background:var(--accent-2)"></i>جریان فعال</span></div></div>' +
      '<div class="card pfd-card pfd-status"><div class="panel-title"><h3>وضعیت، هشدار و پیش‌بینی</h3></div>' +
      '<div class="pfd-kpis"><div class="pfd-kpi"><span>مخزن ایستگاه</span><b id="pfdK1">—</b></div><div class="pfd-kpi"><span>مخزن ۱۵۰۰۰</span><b id="pfdK2">—</b></div><div class="pfd-kpi"><span>مخزن ۲۰۰۰۰</span><b id="pfdK3">—</b></div>' +
      '<div class="pfd-kpi"><span>تولید کارخانه‌ها</span><b id="pfdK4">—</b></div><div class="pfd-kpi"><span>پمپاژ اصلی</span><b id="pfdK5">—</b></div><div class="pfd-kpi"><span>بارگیری تانکر (آخرین روز ثبت)</span><b id="pfdK6">—</b></div></div>' +
      '<div id="pfdAlerts" class="pfd-alerts"></div></div>' +
      '<div class="pfd-cols pfd-notv">' +
      '<div class="card pfd-card"><div class="panel-title"><h3>کنترل و شبیه‌ساز</h3></div>' +
      '<div class="pfd-ctl"><div><label class="pfd-lbl" for="pfdHz">افق پیش‌بینی: <span id="pfdHzv">۰</span> ساعت بعد</label><input id="pfdHz" type="range" min="0" max="24" value="0" step="1"><div class="pfd-row"><span>اکنون</span><span>۲۴ ساعت</span></div></div>' +
      '<div><label class="pfd-lbl" for="pfdStv">حجم فعلی مخزن ایستگاه (م³): <span id="pfdStvv"></span></label><input id="pfdStv" type="number" min="0" max="' + CAP.st + '" step="10"></div></div>' +
      '<div class="pfd-btns"><span style="font-size:13px;font-weight:600">مصرف مخازن ۱۵۰۰۰ و ۲۰۰۰۰:</span><button class="btn" id="pfdModeA" type="button" aria-pressed="true">خودکار (از سابقه)</button><button class="btn" id="pfdModeM" type="button" aria-pressed="false">دستی</button></div>' +
      '<div class="pfd-row" id="pfdModeNote" style="margin-top:6px"></div>' +
      '<div class="pfd-ctl"><div><label class="pfd-lbl" for="pfdD15">مصرف مخزن ۱۵۰۰۰: <span id="pfdD15v"></span> م³/س</label><input id="pfdD15" type="range" min="0" max="900" step="10"></div>' +
      '<div><label class="pfd-lbl" for="pfdD20">مصرف مخزن ۲۰۰۰۰: <span id="pfdD20v"></span> م³/س</label><input id="pfdD20" type="range" min="0" max="900" step="10"></div></div>' +
      '<div class="pfd-btns"><button class="btn" id="pfdLoad" type="button" aria-pressed="false"></button><button class="btn" id="pfdSync" type="button">همگام‌سازی با آخرین ثبت‌ها</button></div></div>' +
      '<div class="card pfd-card"><div class="panel-title"><h3>سناریوهای رویداد</h3></div><div class="pfd-btns" id="pfdScn" style="margin-top:0"></div><div class="pfd-res" id="pfdScnRes" hidden></div>' +
      '<p class="pfd-small" style="font-size:11.5px;margin:10px 0 0;color:var(--text-dim)">سناریو از همین لحظه روی مدل اعمال می‌شود. با «افق پیش‌بینی» می‌توانید اثرش را در ساعت‌های بعد روی نقشه ببینید.</p></div>' +
      '<div class="card pfd-card"><div class="panel-title"><h3>پیشنهاد چیدمان پمپ‌ها (۲۴ ساعت آینده)</h3></div><div id="pfdSugg"></div></div>' +
      '<div class="card pfd-card"><div class="panel-title"><h3>تراز جرمی (تولید − پمپاژ − بارگیری)</h3></div><div id="pfdBal"></div></div>' +
      '<div class="card pfd-card"><div class="panel-title"><h3>منبع داده‌ها</h3></div><ul class="pfd-src" id="pfdSrc"></ul>' +
      '<p class="pfd-small" style="font-size:11.5px;margin:10px 0 0;color:var(--text-dim)">بارگیری تانکر پیوسته نیست؛ بدون «شروع بارگیری»، میانگین روزانه (حجم ثبت‌شده ÷ ۲۴) در محاسبه می‌آید. وضعیت شیرها فقط روی این دستگاه می‌ماند. دبی پمپ بارگیری و دوش‌ها نمونه است.</p></div>' +
      '</div></div>';
    svg = host.querySelector('#pfdMap');
    var g = function (i) { return host.querySelector('#' + i); };
    K = { k1: g('pfdK1'), k2: g('pfdK2'), k3: g('pfdK3'), k4: g('pfdK4'), k5: g('pfdK5'), k6: g('pfdK6'), hzv: g('pfdHzv'), d15v: g('pfdD15v'), d20v: g('pfdD20v'), stv: g('pfdStvv'), alerts: g('pfdAlerts'), src: g('pfdSrc'), loadBtn: g('pfdLoad'),
      d15: g('pfdD15'), d20: g('pfdD20'), modeA: g('pfdModeA'), modeM: g('pfdModeM'), modeNote: g('pfdModeNote'), replayBadge: g('pfdReplayBadge'), rdate: g('pfdRdate'), clock: g('pfdClock'), scnRes: g('pfdScnRes'), sugg: g('pfdSugg'), bal: g('pfdBal'), replay: g('pfdReplay'), scnBtns: [] };
    SCENARIOS.concat([{ id: 'none', label: 'حذف سناریو' }]).forEach(function (sc) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = sc.label; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { scn = sc.id === 'none' ? null : sc; draw(); });
      g('pfdScn').appendChild(b); K.scnBtns.push({ id: sc.id, btn: b });
    });
    K.sync = function () { g('pfdHz').value = hz; g('pfdStv').value = Math.round(S.v.st); K.d15.value = S.d15; K.d20.value = S.d20; };
    g('pfdHz').addEventListener('input', function (e) { hz = +e.target.value; draw(); });
    g('pfdStv').addEventListener('input', function (e) { S.v.st = Math.max(0, Math.min(CAP.st, +e.target.value || 0)); touch(); });
    K.d15.addEventListener('input', function (e) { S.d15 = +e.target.value; touch(); });
    K.d20.addEventListener('input', function (e) { S.d20 = +e.target.value; touch(); });
    K.modeA.addEventListener('click', function () { S.dmode = 'auto'; touch(); });
    K.modeM.addEventListener('click', function () { S.dmode = 'manual'; touch(); });
    K.loadBtn.addEventListener('click', function () { S.loading = S.loading ? 0 : 1; touch(); });
    g('pfdSync').addEventListener('click', function () { S = fresh(); hz = 0; touched = false; scn = null; save(); K.sync(); draw(); });
    K.replay.addEventListener('input', function (e) {
      var i = +e.target.value; replayDate = i >= dates.length - 1 ? null : dates[i];
      real = readReal(appState, replayDate || undefined); prof = buildProfile(appState, replayDate || undefined);
      clockStart = replayDate ? new Date(replayDate + 'T12:00:00') : new Date();
      S = fresh(); hz = 0; if (!replayDate && touched) { var sv = load(); if (sv && sv.S) S = sv.S; }
      K.sync(); draw();
    });
    g('pfdTv').addEventListener('click', function () { setTv(true); });
    g('pfdTvExit').addEventListener('click', function () { setTv(false); });
  }
  function setTv(on) {
    tv = on; root.classList.toggle('pfd-tv', on);
    try { if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () { }); else if (!on && document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
    clearInterval(tvTimer); if (on) { replayDate = null; tvTimer = setInterval(function () { clockStart = new Date(); draw(); }, 30000); }
    draw();
  }

  function render(st) {
    root = document.getElementById('pfdMount'); if (!root) return;
    appState = st || appState;
    dates = allDates(appState);
    real = readReal(appState, replayDate || undefined); prof = buildProfile(appState, replayDate || undefined);
    if (!replayDate) clockStart = new Date();
    if (!S) { var saved = load(); if (saved && saved.S && saved.touched) { S = saved.S; touched = true; if (!S.dmode) S.dmode = 'auto'; } else S = fresh(); }
    else if (!touched || replayDate) S = fresh();
    if (!svg || !root.contains(svg)) build(root);
    K.replay.max = Math.max(0, dates.length - 1); K.replay.value = replayDate ? Math.max(0, dates.indexOf(replayDate)) : Math.max(0, dates.length - 1);
    K.sync(); draw();
  }
  global.PFD = { render: render, snapshot: function (st, iso) { return snapshot(st || appState, iso); }, balance: function (st, days) { return balance(st || appState, days); } };
})(window);
