/* =========================================================================
   Rostampour Report Kit  —  shared by all 5 sections
   Exports: PDF (html2canvas + jsPDF), Word (.doc via MHTML), Excel (SheetJS)
   Usage:
     const rep = { title, subtitle, meta:[[k,v]], sections:[{title, kpis:[{label,value,unit}],
                   chart: <Chart instance | dataURL>, table:{head:[], rows:[[]]}, note}] };
     RK.pdf(rep, 'file-name');  RK.word(rep, 'file-name');  RK.excel(rep, 'file-name');
   ========================================================================= */
(function (global) {
  'use strict';
  const RK = {};
  const CDN = {
    xlsx:        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    jspdf:       'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    chart:       'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js',
    docx:        'vendor-docx.js'
  };
  const loading = {};
  function loadScript(key, test) {
    if (test()) return Promise.resolve();
    if (loading[key]) return loading[key];
    loading[key] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = CDN[key]; s.onload = () => res(); s.onerror = () => rej(new Error('load ' + key));
      document.head.appendChild(s);
    });
    return loading[key];
  }
  RK.ensure = {
    xlsx: () => loadScript('xlsx', () => typeof XLSX !== 'undefined'),
    pdf: () => Promise.all([
      loadScript('jspdf', () => !!(global.jspdf && global.jspdf.jsPDF)),
      loadScript('html2canvas', () => typeof html2canvas !== 'undefined')]),
    chart: () => loadScript('chart', () => typeof Chart !== 'undefined'),
    docx: () => loadScript('docx', () => typeof docx !== 'undefined')
  };

  /* ---------- language / digits ---------- */
  RK.lang = () => { try { return localStorage.getItem('rostampour-lang') || 'fa'; } catch (e) { return 'fa'; } };
  RK.isFa = () => RK.lang() === 'fa';
  RK.toFa = (v) => String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  RK.toEn = (v) => String(v).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
  RK.digits = (v) => RK.isFa() ? RK.toFa(v) : String(v);
  RK.num = (n, dec) => {
    if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
    const d = (dec === undefined) ? (Number.isInteger(Number(n)) ? 0 : 2) : dec;
    return RK.digits(Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }));
  };
  RK.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- statistics ---------- */
  RK.stats = function (arr) {
    const v = arr.filter(x => x !== null && x !== undefined && x !== '' && !isNaN(Number(x))).map(Number);
    if (!v.length) return { n: 0, sum: 0, avg: null, min: null, max: null, last: null };
    const sum = v.reduce((a, b) => a + b, 0);
    return { n: v.length, sum, avg: sum / v.length, min: Math.min(...v), max: Math.max(...v), last: v[v.length - 1] };
  };

  /* ---------- logo (blue banner for in-app + reports) ---------- */
  let logoCache = null;
  RK.logo = async function () {
    if (logoCache !== null) return logoCache;
    try {
      const r = await fetch('report-logo.png'); const b = await r.blob();
      logoCache = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    } catch (e) { logoCache = ''; }
    return logoCache;
  };

  /* ---------- chart -> PNG (white background, offscreen, no animation) ---------- */
  RK.chartImage = async function (cfg, w, h) {
    await RK.ensure.chart();
    const c = document.createElement('canvas'); c.width = w || 900; c.height = h || 380;
    c.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(c);
    const base = JSON.parse(JSON.stringify(cfg));
    base.options = Object.assign({ responsive: false, animation: false, devicePixelRatio: 2 }, base.options || {});
    base.options.responsive = false; base.options.animation = false;
    const bg = { id: 'rkbg', beforeDraw(ch) { const x = ch.ctx; x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, ch.width, ch.height); x.restore(); } };
    base.plugins = [bg];
    const ch = new Chart(c.getContext('2d'), base);
    const url = ch.toBase64Image('image/png', 1);
    ch.destroy(); c.remove();
    return url;
  };
  function toDataUrl(chart) {
    if (!chart) return '';
    if (typeof chart === 'string') return chart;
    try { return chart.toBase64Image('image/png', 1); } catch (e) { return ''; }
  }

  /* ---------- HTML report body ---------- */
  const CSS = `
    .rk{font-family:'Vazirmatn','Tahoma','Segoe UI',Arial,sans-serif;color:#0f2438;background:#fff;width:794px;padding:0;box-sizing:border-box;}
    .rk *{box-sizing:border-box;}
    .rk-block{padding:0 28px;margin:0 0 10px;background:#fff;}
    .rk-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 28px 12px;background:#0b2a43;color:#fff;margin-bottom:14px;}
    .rk-head img{height:62px;}
    .rk-head .t{font-size:19px;font-weight:700;line-height:1.5;}
    .rk-head .s{font-size:12px;opacity:.85;margin-top:2px;}
    .rk-meta{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:11.5px;color:#52708a;border-bottom:2px solid #00a896;padding-bottom:8px;}
    .rk-meta b{color:#0f2438;}
    .rk h2{font-size:15px;margin:6px 0 8px;color:#fff;background:linear-gradient(90deg,#1565c0,#00a896);padding:6px 12px;border-radius:6px;}
    .rk-kpis{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}
    .rk-kpi{flex:1 1 118px;min-width:118px;border:1px solid #cfe3e6;border-radius:8px;padding:7px 10px;background:#f2f8fa;}
    .rk-kpi .l{font-size:10.5px;color:#52708a;}
    .rk-kpi .v{font-size:15.5px;font-weight:700;color:#1565c0;}
    .rk-kpi .u{font-size:10px;color:#8aa0b5;margin-inline-start:4px;}
    .rk img.chart{width:100%;display:block;border:1px solid #cfe3e6;border-radius:6px;margin:4px 0 8px;}
    .rk table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:6px;}
    .rk th{background:#0b2a43;color:#fff;padding:5px 6px;border:1px solid #0b2a43;text-align:center;font-weight:600;}
    .rk td{padding:4px 6px;border:1px solid #cfe3e6;text-align:center;}
    .rk td,.rk th{overflow-wrap:anywhere;word-break:break-word;}
    .rk tr:nth-child(even) td{background:#f2f8fa;}
    .rk .note{font-size:10.5px;color:#52708a;margin:4px 0;}
    .rk-foot{font-size:10px;color:#8aa0b5;text-align:center;padding:6px 0;}
  `;
  const ROWS_PER_BLOCK = 26;


  /* make sure nothing of a block sticks out of its box (wide tables, long words, RTL overflow to the left) —
     otherwise html2canvas would crop it; widen the render width until the whole block is inside */
  function fitBlock(root, el, base) {
    let W = base || 794;
    for (let i = 0; i < 8; i++) {
      root.style.width = W + 'px';
      const r = el.getBoundingClientRect(); let minL = r.left, maxR = r.right;
      el.querySelectorAll('*').forEach(n => { const b = n.getBoundingClientRect(); if (!b.width && !b.height) return; if (b.left < minL) minL = b.left; if (b.right > maxR) maxR = b.right; });
      const over = (r.left - minL) + (maxR - r.right);
      if (over <= 1 || W > 3000) break;
      W += Math.ceil(over) + 6;
    }
    return W;
  }

  /** Returns array of HTML strings (each is one non-splittable block) */
  RK.blocks = async function (rep) {
    const fa = RK.isFa();
    const logo = await RK.logo();
    const out = [];
    out.push(`<div class="rk-head">
        <div><div class="t">${RK.esc(rep.title)}</div><div class="s">${RK.esc(rep.subtitle || '')}</div></div>
        ${logo ? `<img src="${logo}" alt="logo">` : ''}
      </div>`);
    const now = new Date();
    const metaRows = [[fa ? 'تاریخ تهیه گزارش' : 'Generated', RK.digits(now.toLocaleDateString(fa ? 'fa-IR' : 'en-GB')) + ' ' + RK.digits(now.toTimeString().slice(0, 5))]].concat(rep.meta || []);
    out.push(`<div class="rk-block"><div class="rk-meta">${metaRows.map(m => `<span>${RK.esc(m[0])}: <b>${RK.esc(m[1])}</b></span>`).join('')}</div></div>`);
    for (const s of rep.sections || []) {
      let first = `<h2>${RK.esc(s.title)}</h2>`;
      if (s.kpis && s.kpis.length) first += `<div class="rk-kpis">${s.kpis.map(k => `<div class="rk-kpi"><div class="l">${RK.esc(k.label)}</div><div class="v">${RK.esc(k.value)}<span class="u">${RK.esc(k.unit || '')}</span></div></div>`).join('')}</div>`;
      const img = toDataUrl(s.chart);
      if (s.note) first += `<div class="note">${RK.esc(s.note)}</div>`;
      out.push(`<div class="rk-block">${first}</div>`);
      if (img) out.push(`<div class="rk-block"><img class="chart" src="${img}" alt="chart"></div>`);
      if (s.table && s.table.rows && s.table.rows.length) {
        const head = `<thead><tr>${s.table.head.map(h => `<th>${RK.esc(h)}</th>`).join('')}</tr></thead>`;
        for (let i = 0; i < s.table.rows.length; i += ROWS_PER_BLOCK) {
          const chunk = s.table.rows.slice(i, i + ROWS_PER_BLOCK);
          out.push(`<div class="rk-block"><table>${head}<tbody>${chunk.map(r => `<tr>${r.map(c => `<td>${RK.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        }
      } else if (s.table) {
        out.push(`<div class="rk-block"><div class="note">${fa ? 'داده‌ای برای این بخش ثبت نشده است.' : 'No data recorded for this section.'}</div></div>`);
      }
    }
    out.push(`<div class="rk-foot">${fa ? 'طراحی و توسعه‌دهنده: محمدرضا رستم‌پور — Rostampour Engineering Co.' : 'Designed & developed by Mohammad Reza Rostampour — Rostampour Engineering Co.'}</div>`);
    return out;
  };

  /* ---------- PDF ---------- */
  RK.pdf = async function (rep, filename) {
    await RK.ensure.pdf();
    const fa = RK.isFa();
    const blocks = await RK.blocks(rep);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-12000px;top:0;';
    host.innerHTML = `<style>${CSS}</style><div class="rk" dir="${fa ? 'rtl' : 'ltr'}"></div>`;
    document.body.appendChild(host);
    const root = host.querySelector('.rk');
    const { jsPDF } = global.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight();
    const margin = 14, usableH = PH - margin * 2 - 14;
    let y = margin, page = 1;
    try {
      const queue = blocks.slice();
      while (queue.length) {
        const html = queue.shift();
        root.innerHTML = html;
        const el = root.firstElementChild;
        const W = fitBlock(root, el);
        // a table block that would not fit on one page is split in two (never shrunk to unreadable size)
        const tb = el.querySelector('table'), trs = tb ? tb.querySelectorAll('tbody tr') : [];
        if (trs.length > 1 && el.getBoundingClientRect().height * ((PW - margin * 2) / W) > usableH) {
          const half = Math.ceil(trs.length / 2), head = tb.querySelector('thead') ? tb.querySelector('thead').outerHTML : '';
          const mk = (rows) => `<div class="rk-block"><table>${head}<tbody>${rows.map(r => r.outerHTML).join('')}</tbody></table></div>`;
          const all = Array.from(trs);
          queue.unshift(mk(all.slice(0, half)), mk(all.slice(half)));
          continue;
        }
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: Math.max(W + 40, 900), scrollX: 0, scrollY: 0 });
        const w = PW - margin * 2;
        const h = canvas.height * (w / canvas.width);
        if (y + h > PH - margin - 14 && y > margin) { pdf.addPage(); page++; y = margin; }
        if (h > usableH) { // very tall single block: scale down to fit
          const k = usableH / h; pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, y, w * k, usableH);
          y += usableH;
        } else {
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, y, w, h);
          y += h + 4;
        }
      }
      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(120);
        pdf.text(`Rostampour  |  ${i} / ${total}`, PW / 2, PH - 8, { align: 'center' });
      }
      pdf.save(filename + '.pdf');
    } finally { host.remove(); }
  };

  /* ---------- Word (.doc, MHTML with embedded images — opens in MS Word / LibreOffice) ---------- */
  function dataUrlParts(u) { const m = /^data:([^;]+);base64,(.*)$/.exec(u || ''); return m ? { type: m[1], b64: m[2] } : null; }
  RK.wordMHT = async function (rep, filename) {
    const fa = RK.isFa();
    const blocks = await RK.blocks(rep);
    const images = []; // {cid, type, b64}
    let n = 0;
    let body = blocks.join('\n').replace(/src="(data:image\/[^"]+)"/g, (all, u) => {
      const p = dataUrlParts(u); if (!p) return all;
      const ext = p.type.split('/')[1].replace('jpeg', 'jpg');
      const cid = `img${++n}.${ext}`;
      images.push({ cid, type: p.type, b64: p.b64 });
      return `src="${cid}"`;
    });
    body = body.replace(/<div class="rk-head">([\s\S]*?)<\/div>\s*(?=<div class="rk-block">)/, (m) => m); // keep as is
    const wordCss = CSS.replace(/display:flex;[^}]*?/g, '').replace(/\.rk\{[^}]*\}/, '.rk{font-family:Tahoma,Arial,sans-serif;}');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${RK.esc(rep.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:21cm 29.7cm;margin:1.5cm;} ${wordCss}
 .rk-head{background:#0b2a43;color:#fff;padding:10px;} .rk-head img{height:60px;float:${fa ? 'left' : 'right'};}
 .rk-kpi{display:inline-block;width:30%;margin:2px;vertical-align:top;} .rk-block{padding:0;}</style></head>
<body dir="${fa ? 'rtl' : 'ltr'}"><div class="rk">${body}</div></body></html>`;
    const B = '----=_NextPart_rostampour_' + Date.now();
    let mht = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n`;
    mht += `--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///report.htm\r\n\r\n`;
    mht += btoa(unescape(encodeURIComponent(html))).replace(/(.{76})/g, '$1\r\n') + '\r\n';
    images.forEach(im => {
      mht += `--${B}\r\nContent-Type: ${im.type}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${im.cid}\r\n\r\n${im.b64.replace(/(.{76})/g, '$1\r\n')}\r\n`;
    });
    mht += `--${B}--`;
    RK.download(new Blob([mht], { type: 'application/msword' }), filename + '.doc');
  };


  /* ---------- Word (.docx, real Office Open XML via bundled docx library; falls back to MHTML .doc) ---------- */
  function b64ToBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function imgSize(url) { return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 900, h: 360 }); im.src = url; }); }
  RK.word = async function (rep, filename) {
    try { await RK.ensure.docx(); } catch (e) { return RK.wordMHT(rep, filename); }
    const D = docx, fa = RK.isFa();
    const FONT = 'Tahoma';
    const NAVY = '0B2A43', TEAL = '00A896', BORDER = 'CFE3E6', ALT = 'F2F8FA';
    const run = (t, o) => new D.TextRun(Object.assign({ text: String(t == null ? '' : t), font: FONT, rightToLeft: fa }, o || {}));
    const para = (t, o, ro) => new D.Paragraph(Object.assign({ bidirectional: fa, alignment: fa ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT, spacing: { after: 80 }, children: [run(t, ro)] }, o || {}));
    const cellB = { style: D.BorderStyle.SINGLE, size: 4, color: BORDER };
    const borders = { top: cellB, bottom: cellB, left: cellB, right: cellB };
    const kids = [];
    const logo = await RK.logo();
    const header = [];
    if (logo) {
      const p = dataUrlParts(logo), sz = await imgSize(logo), h = 52;
      header.push(new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, fill: NAVY, color: 'auto' }, spacing: { before: 0, after: 0 }, alignment: D.AlignmentType.CENTER,
        children: [new D.ImageRun({ type: 'png', data: b64ToBytes(p.b64), transformation: { width: Math.round(h * sz.w / sz.h), height: h } })] }));
    }
    kids.push(...header);
    kids.push(para(rep.title, { spacing: { before: 160, after: 40 } }, { bold: true, size: 32, color: NAVY }));
    if (rep.subtitle) kids.push(para(rep.subtitle, {}, { size: 22, color: '52708A' }));
    const now = new Date();
    const metaRows = [[fa ? 'تاریخ تهیه گزارش' : 'Generated', RK.digits(now.toLocaleDateString(fa ? 'fa-IR' : 'en-GB')) + ' ' + RK.digits(now.toTimeString().slice(0, 5))]].concat(rep.meta || []);
    kids.push(para(metaRows.map(m => m[0] + ': ' + m[1]).join('   |   '), { border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } }, spacing: { after: 160 } }, { size: 18, color: '52708A' }));
    for (const s of rep.sections || []) {
      kids.push(new D.Paragraph({ bidirectional: fa, alignment: fa ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT, shading: { type: D.ShadingType.CLEAR, fill: '1565C0', color: 'auto' }, spacing: { before: 200, after: 100 }, keepNext: true, children: [run(s.title, { bold: true, size: 26, color: 'FFFFFF' })] }));
      if (s.kpis && s.kpis.length) {
        const per = 3, rowsK = [];
        for (let i = 0; i < s.kpis.length; i += per) {
          const grp = s.kpis.slice(i, i + per); while (grp.length < per) grp.push(null);
          rowsK.push(new D.TableRow({ children: grp.map(k => new D.TableCell({ width: { size: 100 / per, type: D.WidthType.PERCENTAGE }, borders, shading: { type: D.ShadingType.CLEAR, fill: ALT, color: 'auto' },
            children: k ? [para(k.label, { spacing: { after: 20 } }, { size: 16, color: '52708A' }), para((k.value || '') + (k.unit ? ' ' + k.unit : ''), { spacing: { after: 20 } }, { size: 24, bold: true, color: '1565C0' })] : [para('')] })) }));
        }
        kids.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, visuallyRightToLeft: fa, rows: rowsK }));
        kids.push(para('', { spacing: { after: 60 } }));
      }
      const img = toDataUrl(s.chart);
      if (img) {
        const p = dataUrlParts(img), sz = await imgSize(img), w = 560;
        kids.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 100 }, children: [new D.ImageRun({ type: 'png', data: b64ToBytes(p.b64), transformation: { width: w, height: Math.round(w * sz.h / sz.w) } })] }));
      }
      if (s.note) kids.push(para(s.note, {}, { size: 18, color: '52708A' }));
      if (s.table && s.table.rows && s.table.rows.length) {
        const nc = s.table.head.length, fs = nc > 9 ? 14 : nc > 6 ? 16 : 18;
        const mk = (t, head, alt) => new D.TableCell({ borders, verticalAlign: D.VerticalAlign.CENTER, shading: head ? { type: D.ShadingType.CLEAR, fill: NAVY, color: 'auto' } : (alt ? { type: D.ShadingType.CLEAR, fill: ALT, color: 'auto' } : undefined),
          children: [new D.Paragraph({ bidirectional: fa, alignment: D.AlignmentType.CENTER, children: [run(t, { size: fs, bold: !!head, color: head ? 'FFFFFF' : '0F2438' })] })] });
        const rows = [new D.TableRow({ tableHeader: true, children: s.table.head.map(h => mk(h, true)) }),
          ...s.table.rows.map((r, i) => new D.TableRow({ cantSplit: true, children: r.map(c => mk(c, false, i % 2 === 1)) }))];
        kids.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, visuallyRightToLeft: fa, rows }));
        kids.push(para('', { spacing: { after: 100 } }));
      } else if (s.table) kids.push(para(fa ? 'داده‌ای برای این بخش ثبت نشده است.' : 'No data recorded for this section.', {}, { size: 18, color: '8AA0B5' }));
    }
    kids.push(para(fa ? 'طراحی و توسعه‌دهنده: محمدرضا رستم‌پور — Rostampour Engineering Co.' : 'Designed & developed by Mohammad Reza Rostampour — Rostampour Engineering Co.', { alignment: D.AlignmentType.CENTER, spacing: { before: 200 } }, { size: 16, color: '8AA0B5' }));
    const wide = (rep.sections || []).some(s => s.table && s.table.head && s.table.head.length > 7);
    const doc = new D.Document({
      creator: 'Rostampour', title: rep.title,
      styles: { default: { document: { run: { font: FONT, rightToLeft: fa } } } },
      sections: [{ properties: { page: { size: { orientation: wide ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT }, margin: { top: 700, bottom: 700, left: 700, right: 700 } } }, children: kids }]
    });
    const blob = await D.Packer.toBlob(doc);
    RK.download(blob, filename + '.docx');
  };

  /* ---------- Excel ---------- */
  RK.excel = async function (rep, filename) {
    await RK.ensure.xlsx();
    const fa = RK.isFa();
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: fa }] };
    // summary sheet
    const sum = [[rep.title], [rep.subtitle || ''], ...(rep.meta || []).map(m => [m[0], m[1]]), []];
    (rep.sections || []).forEach(s => {
      if (s.kpis && s.kpis.length) { sum.push([s.title]); s.kpis.forEach(k => sum.push([k.label, k.value, k.unit || ''])); sum.push([]); }
    });
    const ws0 = XLSX.utils.aoa_to_sheet(sum); ws0['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws0, fa ? 'خلاصه' : 'Summary');
    const used = new Set([fa ? 'خلاصه' : 'Summary']);
    (rep.sections || []).forEach((s, i) => {
      if (!s.table || !s.table.rows) return;
      let name = String(s.title).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 28) || ('Sheet' + (i + 1));
      let k = 2, base = name; while (used.has(name)) name = base.slice(0, 25) + ' ' + (k++);
      used.add(name);
      const ws = XLSX.utils.aoa_to_sheet([s.table.head, ...s.table.rows]);
      ws['!cols'] = s.table.head.map((h, ci) => ({ wch: Math.max(12, String(h).length + 4) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, filename + '.xlsx');
  };

  RK.download = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  /** Standard 3-button export bar. Returns HTML string; wire with RK.bindExport(root, getReport, baseName) */
  RK.exportBarHTML = function () {
    const fa = RK.isFa();
    return `<div class="rk-exportbar" style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-primary" data-rk="pdf">📄 PDF</button>
      <button class="btn" data-rk="word">📝 Word</button>
      <button class="btn" data-rk="excel">📊 Excel</button></div>`;
  };
  RK.bindExport = function (root, getReport, baseName, toast) {
    root.querySelectorAll('[data-rk]').forEach(btn => {
      btn.onclick = async () => {
        const kind = btn.dataset.rk; const old = btn.textContent; btn.disabled = true; btn.textContent = '…';
        try {
          const rep = await getReport();
          const fname = (typeof baseName === 'function' ? baseName() : baseName) + '-' + new Date().toISOString().slice(0, 10);
          if (kind === 'pdf') await RK.pdf(rep, fname);
          if (kind === 'word') await RK.word(rep, fname);
          if (kind === 'excel') await RK.excel(rep, fname);
          if (toast) toast(RK.isFa() ? 'گزارش آماده شد' : 'Report ready');
        } catch (e) { console.error(e); if (toast) toast(RK.isFa() ? 'خطا در ساخت گزارش — اتصال اینترنت را بررسی کنید' : 'Report failed — check your connection'); }
        btn.disabled = false; btn.textContent = old;
      };
    });
  };

  /* ---------- Jalali helpers (shared) ---------- */
  const JF = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  const jp = (d) => { const o = {}; JF.formatToParts(d).forEach(p => { if (p.type === 'year' || p.type === 'month' || p.type === 'day') o[p.type] = parseInt(p.value, 10); }); return o; };
  const J = RK.J = {
    todayISO: () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    isoToJ: (iso) => jp(new Date(String(iso).slice(0, 10) + 'T00:00:00Z')),
    toISO: (jy, jm, jd) => {
      let g = new Date(Date.UTC(jy + 621, jm - 1, jd));
      for (let i = 0; i < 8; i++) { const p = jp(g); if (p.year === jy && p.month === jm && p.day === jd) return g.toISOString().slice(0, 10); g = new Date(g.getTime() + ((jy - p.year) * 365 + (jm - p.month) * 30 + (jd - p.day)) * 86400000); }
      return g.toISOString().slice(0, 10);
    },
    dim: (jy, jm) => { for (let d = 31; d >= 28; d--) { const p = J.isoToJ(J.toISO(jy, jm, d)); if (p.year === jy && p.month === jm && p.day === d) return d; } return 29; },
    str: (iso) => { if (!iso) return '—'; const p = J.isoToJ(iso); return RK.digits(p.year + '/' + String(p.month).padStart(2, '0') + '/' + String(p.day).padStart(2, '0')); },
    mFa: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    mEn: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'],
    mName: (m) => (RK.isFa() ? J.mFa : J.mEn)[m - 1],
    addDays: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    inRange: (iso, r) => { const d = String(iso || '').slice(0, 10); return d >= r.from && d <= r.to; }
  };

  /**
   * Comprehensive daily / monthly report bar.
   * RK.fullBar(hostEl, build, baseName, toast)
   *   build(range) -> report object (async ok). range = { kind:'daily'|'monthly', from, to, label, jy, jm, jd, days:[iso…] }
   */
  RK.fullBar = function (host, build, baseName, toast) {
    const fa = RK.isFa(), t = J.isoToJ(J.todayISO());
    const years = []; for (let y = t.year - 6; y <= t.year + 1; y++) years.push(y);
    const st = 'padding:8px 10px;border-radius:9px;border:1px solid var(--border-strong,#c5d3dc);background:var(--panel-2,#eef5f7);color:var(--text,#0f2438);font-family:inherit;font-size:13px;';
    host.innerHTML = `<div class="card" style="padding:14px 16px;margin-bottom:14px;border-inline-start:4px solid var(--mc,#1565c0)">
      <div style="font-weight:800;font-size:14px;margin-bottom:4px">📑 ${fa ? 'گزارش جامع و یکپارچه (روزانه / ماهانه)' : 'Comprehensive integrated report (daily / monthly)'}</div>
      <div style="font-size:12px;color:var(--text-muted,#52708a);margin-bottom:10px;line-height:1.9">${fa ? 'شامل همه اطلاعات ثبت‌شده در بازه انتخابی: ورودی‌ها، خروجی‌ها، مقادیر، تجهیزات، بازدیدها، تعمیرات و لاگ.' : 'Includes everything recorded in the chosen period: inputs, outputs, values, equipment, inspections, repairs and log.'}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="fbKind" style="${st}"><option value="daily">${fa ? 'روزانه' : 'Daily'}</option><option value="monthly" selected>${fa ? 'ماهانه' : 'Monthly'}</option></select>
        <select id="fbY" style="${st}">${years.map(y => `<option value="${y}" ${y === t.year ? 'selected' : ''}>${RK.digits(y)}</option>`).join('')}</select>
        <select id="fbM" style="${st}">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === t.month ? 'selected' : ''}>${J.mName(i + 1)}</option>`).join('')}</select>
        <select id="fbD" style="${st}">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === t.day ? 'selected' : ''}>${RK.digits(i + 1)}</option>`).join('')}</select>
        <button class="btn btn-primary" data-fb="pdf">📄 PDF</button><button class="btn" data-fb="word">📝 Word</button><button class="btn" data-fb="excel">📊 Excel</button>
      </div></div>`;
    const kindEl = host.querySelector('#fbKind'), dEl = host.querySelector('#fbD');
    const sync = () => { dEl.style.display = kindEl.value === 'daily' ? '' : 'none'; };
    kindEl.onchange = sync; sync();
    const range = () => {
      const kind = kindEl.value, jy = +host.querySelector('#fbY').value, jm = +host.querySelector('#fbM').value;
      let jd = Math.min(+dEl.value, J.dim(jy, jm));
      if (kind === 'daily') { const iso = J.toISO(jy, jm, jd); return { kind, from: iso, to: iso, label: J.str(iso), jy, jm, jd, days: [iso] }; }
      const from = J.toISO(jy, jm, 1), n = J.dim(jy, jm), days = []; for (let d = 1; d <= n; d++) days.push(J.toISO(jy, jm, d));
      return { kind, from, to: days[n - 1], label: J.mName(jm) + ' ' + RK.digits(jy), jy, jm, jd: 0, days };
    };
    host.querySelectorAll('[data-fb]').forEach(btn => btn.onclick = async () => {
      const k = btn.dataset.fb, old = btn.textContent; btn.disabled = true; btn.textContent = '…';
      try {
        const r = range(), rep = await build(r), name = (typeof baseName === 'function' ? baseName() : baseName) + '-' + (r.kind === 'daily' ? r.from : r.jy + '-' + String(r.jm).padStart(2, '0'));
        if (k === 'pdf') await RK.pdf(rep, name); else if (k === 'word') await RK.word(rep, name); else await RK.excel(rep, name);
        if (toast) toast(fa ? 'گزارش آماده شد' : 'Report ready');
      } catch (e) { console.error(e); if (toast) toast(fa ? 'خطا در ساخت گزارش — اتصال اینترنت را بررسی کنید' : 'Report failed — check your connection'); }
      btn.disabled = false; btn.textContent = old;
    });
  };

  global.RK = RK;
})(window);
