/* =========================================================================
   PFD — دوقلوی دیجیتال ایستگاه توزیع آب پارس (تب PFD در بخش ایستگاه)
   نقشه یکپارچه: کارخانه‌ها ← مخزن ایستگاه ← پمپاژ GRP/PE ← مخازن ۱۵۰۰۰ و ۲۰۰۰۰،
   و بارگیری تانکر. سطح مخازن و تولید کارخانه‌ها از ثبت‌های واقعی برنامه خوانده
   می‌شود. وضعیت شیر/پمپ و مقادیر سناریو فقط روی همین دستگاه ذخیره می‌شود و روی
   داده‌های ثبت‌شده اثری ندارد.
   API:  PFD.render(state)  — state = { tankReadings, plantProd, pumpLoad }
   ========================================================================= */
(function (global) {
  'use strict';
  var LS = 'rostampour-pfd-v1';
  var CAP = { st: 2400, t15: 15000, t20: 20000 }, MIN = 1000;
  // سایت: دبی هر پمپ، حداقل و حداکثر مخزن ایستگاه از کاربر. دبی پمپ بارگیری و دوش‌ها نمونه است.
  var P = { pump: 420, tankerPump: 240, bay: 40 };
  var NS = 'http://www.w3.org/2000/svg';
  var S = null, hz = 0, svg = null, root = null, real = null, touched = false, K = null;
  var DT = 0.1;

  function fa(n, d) { return Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d || 0 }); }
  function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ S: S, touched: touched })); } catch (e) { } }

  /* ---------- real data adapter ---------- */
  function latest(rows, pred, dateKey) {
    var a = rows.filter(pred).sort(function (x, y) { return String(x[dateKey]).localeCompare(String(y[dateKey])); });
    return a.length ? a[a.length - 1] : null;
  }
  function readReal(st) {
    var r = { t20: null, t15: null, f1: null, fB: null, pumpAvg: null, tankerDay: null, dates: {} };
    var a = latest(st.tankReadings || [], function (x) { return x.tankKey === 't20000'; }, 'datetime');
    var b = latest(st.tankReadings || [], function (x) { return x.tankKey === 't15000'; }, 'datetime');
    if (a) { r.t20 = +a.volume; r.dates.t20 = a.datetime; }
    if (b) { r.t15 = +b.volume; r.dates.t15 = b.datetime; }
    var n = latest(st.plantProd || [], function (x) { return x.plant === 'norouzheh'; }, 'date');
    var o = latest(st.plantProd || [], function (x) { return x.plant === 'bonab'; }, 'date');
    if (n) { r.f1 = +n.volume / 24; r.dates.f1 = n.date; }
    if (o) { r.fB = +o.volume / 24; r.dates.fB = o.date; }
    var pm = latest(st.pumpLoad || [], function (x) { return x.type === 'mainpump'; }, 'date');
    var tl = latest(st.pumpLoad || [], function (x) { return x.type === 'tankerload'; }, 'date');
    if (pm) { r.pumpAvg = +pm.volume / 24; r.dates.pump = pm.date; }
    if (tl) { r.tankerDay = +tl.volume; r.dates.tanker = tl.date; }
    return r;
  }
  function fresh() {
    var pumpsOn = 2;
    if (real && real.pumpAvg != null) pumpsOn = Math.max(real.pumpAvg > 0 ? 1 : 0, Math.min(4, Math.round(real.pumpAvg / P.pump)));
    var arr = [0, 0, 0, 0]; for (var i = 0; i < pumpsOn; i++) arr[i] = 1;
    return {
      valves: { out: 1, suc: 1, tnk: 1, f1: 1, fB: 1, in15: 1, in20: 1, o15: 1, o20: 1 },
      pumps: arr, tp: 1, loading: 0, bays: [1, 1, 0, 0, 0, 0], fac: { f1: 1, fB: 1 },
      q: { f1: real && real.f1 != null ? Math.round(real.f1) : 450, fB: real && real.fB != null ? Math.round(real.fB) : 450 },
      v: { st: 1700, t15: real && real.t15 != null ? real.t15 : 7500, t20: real && real.t20 != null ? real.t20 : 11000 },
      d15: 380, d20: 460
    };
  }

  /* ---------- hydraulic model ---------- */
  function tankerAvg() { return real && real.tankerDay != null ? real.tankerDay / 24 : 0; }
  function flows(v) {
    var f = {}, V = S.valves;
    f.in1 = S.fac.f1 && V.f1 ? S.q.f1 : 0; f.inB = S.fac.fB && V.fB ? S.q.fB : 0;
    var run = S.pumps.reduce(function (a, b) { return a + b * P.pump; }, 0);
    var acc15 = V.in15 && v.t15 < CAP.t15 - 1, acc20 = V.in20 && v.t20 < CAP.t20 - 1;
    var nAcc = (acc15 ? 1 : 0) + (acc20 ? 1 : 0);
    f.rawPump = V.suc ? run : 0;
    f.deadhead = f.rawPump > 0 && (!V.out || !nAcc);
    f.pump = (V.suc && V.out && nAcc) ? run : 0;
    var nb = S.bays.reduce(function (a, b) { return a + b; }, 0);
    var tOk = V.tnk && S.tp;
    f.loading = !!(S.loading && tOk && nb > 0);
    f.tanker = f.loading ? Math.min(P.tankerPump, nb * P.bay) : (tOk ? tankerAvg() : 0);
    f.tankerWanted = !!(S.loading && nb > 0 && !tOk);
    var out = f.pump + f.tanker, avail = Math.max(0, v.st - MIN) / DT + f.in1 + f.inB;
    var k = out > avail && out > 0 ? avail / out : 1;
    f.starve = k < 1; f.pump *= k; f.tanker *= k;
    f.to15 = acc15 ? f.pump / nAcc : 0; f.to20 = acc20 ? f.pump / nAcc : 0;
    f.o15 = V.o15 ? Math.min(S.d15, v.t15 / DT + f.to15) : 0;
    f.o20 = V.o20 ? Math.min(S.d20, v.t20 / DT + f.to20) : 0;
    f.net = f.in1 + f.inB - f.pump - f.tanker; return f;
  }
  function run(h) {
    var v = { st: S.v.st, t15: S.v.t15, t20: S.v.t20 }, n = Math.round(h / DT);
    for (var i = 0; i < n; i++) {
      var f = flows(v);
      v.st = Math.max(0, Math.min(CAP.st, v.st + f.net * DT));
      v.t15 = Math.max(0, Math.min(CAP.t15, v.t15 + (f.to15 - f.o15) * DT));
      v.t20 = Math.max(0, Math.min(CAP.t20, v.t20 + (f.to20 - f.o20) * DT));
    }
    return v;
  }

  /* ---------- drawing helpers ---------- */
  function el(t, a, p) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; }
  function txt(s, x, y, o, cls, p) { var e = el('text', Object.assign({ x: x, y: y, 'text-anchor': 'middle' }, o || {}), p); e.textContent = s; if (cls) e.setAttribute('class', cls); return e; }
  function pipe(pts, on, w) { el('path', { d: 'M' + pts.map(function (p) { return p.join(' '); }).join(' L'), 'class': 'pfd-flow' + (on > 0.5 ? '' : ' off'), style: w ? 'stroke-width:' + w : '' }); }
  function color(p) { return p < 15 ? 'var(--red)' : p < 30 ? 'var(--amber)' : 'var(--accent-2)'; }
  function bind(g, fn) { g.addEventListener('click', fn); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }); }
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
    var lvl = Math.max(0, Math.min(1, vol / cap)), pct = Math.round(lvl * 100), id = 'pfdc' + x + '_' + y;
    var d = el('defs', {}); var cp = el('clipPath', { id: id }, d); el('rect', { x: x, y: y, width: w, height: h, rx: 8 }, cp);
    el('rect', { x: x, y: y, width: w, height: h, rx: 8, fill: 'var(--panel-2)', stroke: 'var(--border-strong)', 'stroke-width': 2 });
    el('rect', { x: x, y: y + h * (1 - lvl), width: w, height: h * lvl, fill: color(pct), opacity: .85, 'clip-path': 'url(#' + id + ')' });
    var t = txt(fa(pct) + '٪', x + w / 2, y + h / 2 + 7, { 'font-size': 20, 'font-weight': 800 }); t.setAttribute('style', 'paint-order:stroke;stroke:var(--panel);stroke-width:3px');
    txt(name, x + w / 2, y - 8, { 'font-size': 12, 'font-weight': 700 });
    if (min) { var my = y + h * (1 - min / cap); el('line', { x1: x - 6, x2: x + w + 6, y1: my, y2: my, stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }); txt('حداقل ' + fa(min), x + w + 8, my - 4, { 'font-size': 10.5, 'font-weight': 600, 'text-anchor': 'start' }, 'pfd-small'); }
    txt(fa(Math.round(vol)) + ' / ' + fa(cap) + ' م³', x + w / 2 - (w > 200 ? 70 : 0), y + h + 16, { 'font-size': 10.5 }, 'pfd-small');
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

  function draw() {
    if (!svg) return;
    var v = run(hz), f = flows(v); svg.textContent = '';
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
    tank(400, 260, 240, 160, v.st, CAP.st, 'مخزن ایستگاه', MIN);
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
    kpi(v, f);
  }

  /* ---------- side panel ---------- */
  function setK(id, t, c) { var e = K[id]; e.textContent = t; e.className = c || ''; }
  function kpi(v, f) {
    function pc(a, b) { return Math.round(a / b * 100); }
    [['k1', v.st, CAP.st], ['k2', v.t15, CAP.t15], ['k3', v.t20, CAP.t20]].forEach(function (a) {
      var p = pc(a[1], a[2]), st = a[0] === 'k1';
      setK(a[0], st ? fa(Math.round(a[1])) + ' م³' : fa(p) + '٪', st ? (a[1] >= MIN + 300 ? 'good' : a[1] >= MIN ? 'mid' : 'bad') : (p >= 30 ? 'good' : p >= 15 ? 'mid' : 'bad'));
    });
    setK('k4', fa(f.in1 + f.inB) + ' م³/س'); setK('k5', fa(Math.round(f.pump)) + ' م³/س');
    setK('k6', real && real.tankerDay != null ? fa(Math.round(real.tankerDay)) + ' م³' : '—');
    K.hzv.textContent = fa(hz); K.d15v.textContent = fa(S.d15); K.d20v.textContent = fa(S.d20); K.stv.textContent = fa(Math.round(S.v.st));
    K.loadBtn.textContent = S.loading ? 'پایان بارگیری' : 'شروع بارگیری تانکر';
    K.loadBtn.setAttribute('aria-pressed', S.loading ? 'true' : 'false');
    var L = []; function add(c, t) { L.push([c, t]); }
    if (f.deadhead) add('bad', 'پمپ‌ها روشن‌اند ولی مسیر خروجی (شیر GRP یا هر دو شیر ورودی مخازن) بسته است؛ خطر کار پمپ بدون خروجی.');
    if (f.starve || v.st <= MIN + 1) add('bad', 'مخزن ایستگاه به حداقل مجاز (' + fa(MIN) + ' م³) رسیده؛ برداشت پمپ‌ها فقط به اندازه ورودی کارخانه‌ها ممکن است.');
    else if (f.net < 0) { var h = (v.st - MIN) / (-f.net); add(h < 2 ? 'bad' : 'warn', 'مخزن ایستگاه با نرخ ' + fa(-f.net) + ' م³/س کم می‌شود؛ حدود ' + fa(h, 1) + ' ساعت تا رسیدن به حداقل ' + fa(MIN) + ' م³.'); }
    else if (f.net > 0 && v.st >= CAP.st - 1) add('warn', 'مخزن ایستگاه پر است؛ ورودی کارخانه‌ها بیش از برداشت است.');
    if (f.tankerWanted) add('warn', 'بارگیری تانکر شروع شده ولی شیر تانکر بسته یا پمپ بارگیری خاموش است.');
    if (!S.fac.f1 && !S.fac.fB) add('bad', 'هر دو کارخانه خارج از مدارند؛ ورودی به ایستگاه صفر است.');
    if (v.t20 >= CAP.t20 - 1 || v.t15 >= CAP.t15 - 1) add('warn', 'یکی از مخازن ذخیره پر است و ورودی‌اش بسته می‌شود.');
    if (v.t15 / CAP.t15 < .15 || v.t20 / CAP.t20 < .15) add('warn', 'سطح یکی از مخازن ذخیره زیر ۱۵٪ است.');
    if (!L.length) add('ok', 'همه چیز در حالت عادی است و تعادل ایستگاه برقرار است.');
    K.alerts.innerHTML = L.map(function (a) { return '<div class="pfd-alert ' + a[0] + '">' + a[1] + '</div>'; }).join('');
    var src = [];
    if (real) {
      if (real.dates.t20) src.push('مخزن ۲۰۰۰۰: ' + fa(Math.round(real.t20)) + ' م³ (' + real.dates.t20.slice(0, 10) + ')');
      if (real.dates.t15) src.push('مخزن ۱۵۰۰۰: ' + fa(Math.round(real.t15)) + ' م³ (' + real.dates.t15.slice(0, 10) + ')');
      if (real.dates.f1) src.push('تولید نورویژه: ' + fa(Math.round(real.f1 * 24)) + ' م³ در روز (' + real.dates.f1 + ')');
      if (real.dates.fB) src.push('تولید بناب: ' + fa(Math.round(real.fB * 24)) + ' م³ در روز (' + real.dates.fB + ')');
      if (real.dates.pump) src.push('پمپاژ اصلی: ' + fa(Math.round(real.pumpAvg * 24)) + ' م³ در روز (' + real.dates.pump + ')');
      if (real.dates.tanker) src.push('بارگیری تانکر: ' + fa(Math.round(real.tankerDay)) + ' م³ در روز (' + real.dates.tanker + ')');
    }
    K.src.innerHTML = src.length ? src.map(function (s) { return '<li>' + s + '</li>'; }).join('') : '<li>هنوز داده‌ای ثبت نشده؛ از مقادیر نمونه استفاده می‌شود.</li>';
  }

  var CSS = '.pfd-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}.pfd-side .pfd-kpis{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.pfd-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 24px}' +
    '.pfd-box{overflow-x:auto}#pfdMap{display:block;width:100%;min-width:900px;height:auto}#pfdMap text{font-family:var(--font);fill:var(--text)}.pfd-small{font-size:11px;fill:var(--text-muted)!important}' +
    '.pfd-node{cursor:pointer}.pfd-node:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px}' +
    '.pfd-flow{stroke:var(--accent-2);stroke-width:4;fill:none;stroke-dasharray:8 8;animation:pfdDash 1s linear infinite}.pfd-flow.off{stroke:var(--border-strong);animation:none;stroke-dasharray:none}@keyframes pfdDash{to{stroke-dashoffset:-16}}' +
    '@media(prefers-reduced-motion:reduce){.pfd-flow{animation:none}}' +
    '.pfd-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pfd-kpi{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--panel-2)}.pfd-kpi b{display:block;font-size:18px;font-weight:800}.pfd-kpi span{font-size:12px;color:var(--text-muted)}' +
    '.pfd-kpi .good{color:var(--green)}.pfd-kpi .mid{color:var(--amber)}.pfd-kpi .bad{color:var(--red)}' +
    '.pfd-alerts{display:grid;gap:6px;margin-top:12px}.pfd-alert{padding:8px 12px;border-radius:10px;font-weight:600;font-size:13px;border:1px solid var(--border)}' +
    '.pfd-alert.ok{background:var(--green-soft);color:var(--green)}.pfd-alert.warn{background:var(--amber-soft);color:var(--amber)}.pfd-alert.bad{background:var(--red-soft);color:var(--red)}' +
    '.pfd-lbl{display:block;font-weight:600;margin:12px 0 4px;font-size:13px}.pfd-side input[type=range]{width:100%;accent-color:var(--accent-2)}.pfd-side input[type=number]{width:100%;padding:6px 8px;border-radius:8px;border:1px solid var(--border-strong);background:var(--panel);color:var(--text);font:inherit}' +
    '.pfd-row{display:flex;justify-content:space-between;color:var(--text-muted);font-size:12px}.pfd-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
    '.pfd-src{margin:8px 0 0;padding:0 18px 0 0;font-size:12px;color:var(--text-muted)}.pfd-legend{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--text-muted);font-size:12px;margin-top:10px}.pfd-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-inline-end:5px}';

  function build(host) {
    if (!document.getElementById('pfd-style')) { var st = document.createElement('style'); st.id = 'pfd-style'; st.textContent = CSS; document.head.appendChild(st); }
    host.innerHTML =
      '<div class="pfd-grid"><div class="card"><div class="panel-title"><div><h3>PFD · نقشه یکپارچه ایستگاه</h3><div class="sub">روی شیر، پمپ، کارخانه یا دوش کلیک کنید تا اثرش را روی مخازن ببینید</div></div></div>' +
      '<div class="pfd-box"><svg id="pfdMap" viewBox="0 0 1300 900" role="img" aria-label="نقشه شماتیک یکپارچه ایستگاه"></svg></div>' +
      '<div class="pfd-legend"><span><i style="background:var(--green)"></i>شیر باز / تجهیز در مدار</span><span><i style="background:var(--red)"></i>شیر بسته / خارج از مدار</span><span><i style="background:var(--accent-2)"></i>جریان فعال</span></div></div>' +
      '<aside class="card pfd-side" aria-live="polite"><div class="panel-title"><h3>وضعیت و سناریو</h3></div>' +
      '<div class="pfd-kpis">' +
      '<div class="pfd-kpi"><span>مخزن ایستگاه</span><b id="pfdK1">—</b></div><div class="pfd-kpi"><span>مخزن ۱۵۰۰۰</span><b id="pfdK2">—</b></div>' +
      '<div class="pfd-kpi"><span>مخزن ۲۰۰۰۰</span><b id="pfdK3">—</b></div><div class="pfd-kpi"><span>تولید کارخانه‌ها</span><b id="pfdK4">—</b></div>' +
      '<div class="pfd-kpi"><span>پمپاژ اصلی</span><b id="pfdK5">—</b></div><div class="pfd-kpi"><span>بارگیری تانکر (آخرین روز ثبت)</span><b id="pfdK6">—</b></div></div>' +
      '<div class="pfd-ctl"><div><label class="pfd-lbl" for="pfdHz">افق پیش‌بینی: <span id="pfdHzv">۰</span> ساعت بعد</label><input id="pfdHz" type="range" min="0" max="24" value="0" step="1"><div class="pfd-row"><span>اکنون</span><span>۲۴ ساعت</span></div></div>' +
      '<div>' +
      '<label class="pfd-lbl" for="pfdStv">حجم فعلی مخزن ایستگاه (م³): <span id="pfdStvv"></span></label><input id="pfdStv" type="number" min="0" max="' + CAP.st + '" step="10"></div>' +
      '<div><label class="pfd-lbl" for="pfdD15">مصرف خروجی مخزن ۱۵۰۰۰: <span id="pfdD15v"></span> م³/س</label><input id="pfdD15" type="range" min="0" max="900" step="10"></div>' +
      '<div>' +
      '<label class="pfd-lbl" for="pfdD20">مصرف خروجی مخزن ۲۰۰۰۰: <span id="pfdD20v"></span> م³/س</label><input id="pfdD20" type="range" min="0" max="900" step="10"></div></div>' +
      '<div class="pfd-btns"><button class="btn" id="pfdLoad" type="button" aria-pressed="false"></button><button class="btn" id="pfdSync" type="button">همگام‌سازی با آخرین ثبت‌ها</button></div>' +
      '<div id="pfdAlerts" class="pfd-alerts"></div>' +
      '<div class="panel-title" style="margin-top:14px"><h3 style="font-size:13px">منبع داده‌ها</h3></div><ul class="pfd-src" id="pfdSrc"></ul>' +
      '<p class="pfd-small" style="font-size:11.5px;margin:10px 0 0;color:var(--text-dim)">بارگیری تانکر پیوسته نیست؛ بدون «شروع بارگیری»، میانگین روزانه (حجم ثبت‌شده ÷ ۲۴) در محاسبه می‌آید. وضعیت شیرها فقط روی این دستگاه می‌ماند. دبی پمپ بارگیری و دوش‌ها نمونه است.</p></aside></div>';
    svg = host.querySelector('#pfdMap');
    var g = function (i) { return host.querySelector('#' + i); };
    K = { k1: g('pfdK1'), k2: g('pfdK2'), k3: g('pfdK3'), k4: g('pfdK4'), k5: g('pfdK5'), k6: g('pfdK6'), hzv: g('pfdHzv'), d15v: g('pfdD15v'), d20v: g('pfdD20v'), stv: g('pfdStvv'), alerts: g('pfdAlerts'), src: g('pfdSrc'), loadBtn: g('pfdLoad') };
    function sync() { g('pfdHz').value = hz; g('pfdStv').value = Math.round(S.v.st); g('pfdD15').value = S.d15; g('pfdD20').value = S.d20; }
    K.sync = sync;
    g('pfdHz').addEventListener('input', function (e) { hz = +e.target.value; draw(); });
    g('pfdStv').addEventListener('input', function (e) { S.v.st = Math.max(0, Math.min(CAP.st, +e.target.value || 0)); touch(); });
    g('pfdD15').addEventListener('input', function (e) { S.d15 = +e.target.value; touch(); });
    g('pfdD20').addEventListener('input', function (e) { S.d20 = +e.target.value; touch(); });
    K.loadBtn.addEventListener('click', function () { S.loading = S.loading ? 0 : 1; touch(); });
    g('pfdSync').addEventListener('click', function () { S = fresh(); hz = 0; touched = false; save(); sync(); draw(); });
  }

  function render(st) {
    root = document.getElementById('pfdMount'); if (!root) return;
    real = readReal(st || {});
    if (!S) { var saved = load(); if (saved && saved.S && saved.touched) { S = saved.S; touched = true; } else S = fresh(); }
    else if (!touched) S = fresh();
    if (!svg || !root.contains(svg)) build(root);
    // keep real tank levels in sync when the user has not edited the scenario
    if (touched) { /* user scenario kept; real values shown in the source list */ }
    K.sync(); draw();
  }
  global.PFD = { render: render };
})(window);
