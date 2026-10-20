/* Plant specifications shared by the sections (4, 5) and the shell (reports / alerts). */
(function(){
'use strict';
const P = (key, fa, en, unit, agg, o) => Object.assign({ key, fa, en, unit, agg: agg || 'avg' }, o || {});
const eff = (a, b) => (base) => (base[a] > 0 && base[b] != null) ? (base[a] - base[b]) / base[a] * 100 : null;
const pair = (k, fa, en, unit, o) => [P('r' + k, fa + ' آب خام', en + ' raw water', unit, 'avg', o), P('p' + k, fa + ' آب محصول', en + ' product water', unit, 'avg', o)];
window.PLANT_SPECS = {};
window.PLANT_SPECS.sewage = {
  id: 'sewage', prefix: 'sw_', color: '#00a896', workOrders: false,
  title: { fa: 'تصفیه خانه فاضلاب', en: 'Wastewater Treatment Plant' },
  subtitle: { fa: 'بخش ۴ — آمار، تجهیزات، بازدید و تعمیرات', en: 'Section 4 — statistics, equipment, inspections & repairs' },
  categories: [
    { key: 'pump', fa: 'پمپ', en: 'Pump' }, { key: 'blower', fa: 'دمنده (بلوور)', en: 'Blower' },
    { key: 'membrane', fa: 'غشا / MBR', en: 'Membrane / MBR' }, { key: 'chlor', fa: 'کلرزنی', en: 'Chlorination' },
    { key: 'elec', fa: 'برق و ابزاردقیق', en: 'Electrical & instruments' }, { key: 'screen', fa: 'آشغالگیر / ورودی', en: 'Screen / inlet' },
    { key: 'other', fa: 'سایر', en: 'Other' }],
  groups: [
    { id: 'flow', fa: 'حجم‌ها و کلر', en: 'Volumes & chlorine',
      params: [
        P('inflow', 'حجم دبی فاضلاب ورودی', 'Inflow volume', 'm³', 'sum', { dec: 0, min: 0 }),
        P('permeate', 'حجم آب تولیدی پرمیت', 'Permeate produced', 'm³', 'sum', { dec: 0, min: 0 }),
        P('clUse', 'مصرف کلر', 'Chlorine consumption', 'L', 'sum', { dec: 1, min: 0 }),
        P('clFree', 'میانگین کلر آزاد آب تولیدی', 'Avg free chlorine of product water', 'mg/L', 'avg', { dec: 2, min: 0 })],
      derived: [{ key: 'rec', fa: 'نسبت تولید به ورودی', en: 'Permeate / inflow', unit: '%', dec: 1, fn: b => (b.inflow > 0 && b.permeate != null) ? b.permeate / b.inflow * 100 : null }],
      charts: [
        { title: { fa: 'حجم فاضلاب ورودی و آب پرمیت', en: 'Inflow vs permeate volume' }, type: 'bar', series: ['inflow', 'permeate'] },
        { title: { fa: 'مصرف کلر', en: 'Chlorine consumption' }, type: 'bar', series: ['clUse'], colors: ['#f5a524'] },
        { title: { fa: 'کلر آزاد آب تولیدی', en: 'Free chlorine (product)' }, series: ['clFree'], colors: ['#7c5cff'] }] },
    { id: 'quality', fa: 'کیفیت ورودی / خروجی', en: 'Inlet / outlet quality',
      params: [
        P('bodIn', 'BOD ورودی', 'BOD inlet', 'mg/L', 'avg', { dec: 1, min: 0 }), P('bodOut', 'BOD خروجی', 'BOD outlet', 'mg/L', 'avg', { dec: 1, min: 0 }),
        P('codIn', 'COD ورودی', 'COD inlet', 'mg/L', 'avg', { dec: 1, min: 0 }), P('codOut', 'COD خروجی', 'COD outlet', 'mg/L', 'avg', { dec: 1, min: 0 }),
        P('tssIn', 'TSS ورودی', 'TSS inlet', 'mg/L', 'avg', { dec: 1, min: 0 }), P('tssOut', 'TSS خروجی', 'TSS outlet', 'mg/L', 'avg', { dec: 1, min: 0 }),
        P('phIn', 'pH ورودی', 'pH inlet', '', 'avg', { dec: 2, min: 0, max: 14 }), P('phOut', 'pH خروجی', 'pH outlet', '', 'avg', { dec: 2, min: 0, max: 14 })],
      derived: [
        { key: 'bodEff', fa: 'راندمان حذف BOD', en: 'BOD removal', unit: '%', dec: 1, fn: eff('bodIn', 'bodOut') },
        { key: 'codEff', fa: 'راندمان حذف COD', en: 'COD removal', unit: '%', dec: 1, fn: eff('codIn', 'codOut') },
        { key: 'tssEff', fa: 'راندمان حذف TSS', en: 'TSS removal', unit: '%', dec: 1, fn: eff('tssIn', 'tssOut') }],
      charts: [
        { title: { fa: 'BOD ورودی و خروجی', en: 'BOD inlet / outlet' }, series: ['bodIn', 'bodOut'] },
        { title: { fa: 'COD ورودی و خروجی', en: 'COD inlet / outlet' }, series: ['codIn', 'codOut'] },
        { title: { fa: 'TSS ورودی و خروجی', en: 'TSS inlet / outlet' }, series: ['tssIn', 'tssOut'] },
        { title: { fa: 'pH ورودی و خروجی', en: 'pH inlet / outlet' }, series: ['phIn', 'phOut'], zero: false },
        { title: { fa: 'راندمان حذف آلاینده‌ها (٪)', en: 'Removal efficiency (%)' }, series: ['bodEff', 'codEff', 'tssEff'] }] }
  ],
  dashParams: ['inflow', 'permeate', 'clUse', 'clFree', 'bodIn', 'bodOut', 'codIn', 'codOut', 'tssIn', 'tssOut', 'phIn', 'phOut'],
  dashCharts: [
    { title: { fa: 'ورودی و پرمیت', en: 'Inflow & permeate' }, type: 'bar', series: ['inflow', 'permeate'] },
    { title: { fa: 'BOD / COD', en: 'BOD / COD' }, series: ['bodIn', 'bodOut', 'codIn', 'codOut'] }]
};
window.PLANT_SPECS.desal = {
  id: 'desal', prefix: 'ds_', color: '#1565c0', workOrders: true,
  title: { fa: 'کارخانه آبشیرین کن ۱', en: 'Desalination Plant 1' },
  subtitle: { fa: 'بخش ۵ — تولید، کیفیت، تعمیرات، بازدید و دستورکار', en: 'Section 5 — production, quality, maintenance, inspections & work orders' },
  categories: [
    { key: 'hp', fa: 'پمپ فشار قوی', en: 'High-pressure pump' }, { key: 'ro', fa: 'غشا / RO', en: 'Membrane / RO' },
    { key: 'pre', fa: 'پیش‌تصفیه / فیلتر', en: 'Pre-treatment / filter' }, { key: 'dose', fa: 'تزریق مواد شیمیایی', en: 'Chemical dosing' },
    { key: 'tank', fa: 'مخزن', en: 'Tank' }, { key: 'erd', fa: 'بازیافت انرژی', en: 'Energy recovery' },
    { key: 'elec', fa: 'برق و ابزاردقیق', en: 'Electrical & instruments' }, { key: 'other', fa: 'سایر', en: 'Other' }],
  groups: [
    { id: 'prod', fa: 'تولید و مخازن', en: 'Production & tanks',
      params: [
        P('prod', 'حجم آب تولیدی کارخانه', 'Plant water production', 'm³', 'sum', { dec: 0, min: 0 }),
        P('tkRaw', 'تراز مخزن آب خام', 'Raw water tank level', 'm³', 'avg', { dec: 0, min: 0 }),
        P('tkProd', 'تراز مخزن آب محصول', 'Product water tank level', 'm³', 'avg', { dec: 0, min: 0 }),
        P('outage', 'مدت قطعی برق', 'Power outage duration', 'h', 'sum', { dec: 1, min: 0, max: 24 }),
        P('rec', 'ریکاوری', 'Recovery', '%', 'avg', { dec: 1, min: 0, max: 100 })],
      charts: [
        { title: { fa: 'تولید روزانه', en: 'Production' }, type: 'bar', series: ['prod'] },
        { title: { fa: 'تراز مخازن', en: 'Tank levels' }, series: ['tkRaw', 'tkProd'] },
        { title: { fa: 'ریکاوری', en: 'Recovery' }, series: ['rec'], colors: ['#7c5cff'] },
        { title: { fa: 'مدت قطعی برق (ساعت)', en: 'Power outage (hours)' }, type: 'bar', series: ['outage'], colors: ['#d43439'] }] },
    { id: 'chem', fa: 'تزریق مواد شیمیایی', en: 'Chemical injection',
      params: [
        P('acid', 'تزریق اسید سولفوریک', 'Sulfuric acid injection', 'L', 'sum', { dec: 1, min: 0 }),
        P('smbs', 'تزریق سدیم متابی‌سولفیت', 'Sodium metabisulfite injection', 'L', 'sum', { dec: 1, min: 0 }),
        P('cl', 'تزریق کلر', 'Chlorine injection', 'L', 'sum', { dec: 1, min: 0 })],
      charts: [{ title: { fa: 'مصرف مواد شیمیایی', en: 'Chemical usage' }, type: 'bar', series: ['acid', 'smbs', 'cl'] }] },
    { id: 'qual', fa: 'کیفیت آب خام و محصول', en: 'Raw & product water quality',
      params: [].concat(
        pair('Orp', 'ORP', 'ORP', 'mV', { dec: 0 }), pair('Ph', 'pH', 'pH', '', { dec: 2, min: 0, max: 14 }),
        pair('Ec', 'EC', 'EC', 'µS/cm', { dec: 0, min: 0 }), pair('Tds', 'TDS', 'TDS', 'mg/L', { dec: 0, min: 0 }),
        pair('Tss', 'TSS', 'TSS', 'mg/L', { dec: 1, min: 0 }), pair('Th', 'TH', 'TH', 'mg/L', { dec: 1, min: 0 }),
        pair('Ntu', 'NTU', 'NTU', 'NTU', { dec: 2, min: 0 })),
      derived: [{ key: 'rej', fa: 'درصد حذف نمک (TDS)', en: 'TDS rejection', unit: '%', dec: 2, fn: b => (b.rTds > 0 && b.pTds != null) ? (b.rTds - b.pTds) / b.rTds * 100 : null }],
      charts: [
        { title: { fa: 'ORP', en: 'ORP' }, series: ['rOrp', 'pOrp'], zero: false },
        { title: { fa: 'pH', en: 'pH' }, series: ['rPh', 'pPh'], zero: false },
        { title: { fa: 'EC', en: 'EC' }, series: ['rEc', 'pEc'] },
        { title: { fa: 'TDS', en: 'TDS' }, series: ['rTds', 'pTds'] },
        { title: { fa: 'TSS', en: 'TSS' }, series: ['rTss', 'pTss'] },
        { title: { fa: 'TH', en: 'TH' }, series: ['rTh', 'pTh'] },
        { title: { fa: 'NTU', en: 'NTU' }, series: ['rNtu', 'pNtu'] },
        { title: { fa: 'درصد حذف نمک', en: 'Salt rejection' }, series: ['rej'], zero: false }] }
  ],
  dashParams: ['prod', 'tkRaw', 'tkProd', 'outage', 'rec', 'acid', 'smbs', 'cl', 'pTds', 'pEc', 'pPh', 'pNtu'],
  dashCharts: [
    { title: { fa: 'تولید', en: 'Production' }, type: 'bar', series: ['prod'] },
    { title: { fa: 'TDS آب خام و محصول', en: 'TDS raw / product' }, series: ['rTds', 'pTds'] }]
};
})();
