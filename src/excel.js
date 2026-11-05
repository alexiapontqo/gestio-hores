import XLSX from 'xlsx-js-style';
import { cmp, catSort, dayShort, displayNames, fmtFull } from './util.js';

const serial = (d) => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000);
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const r1 = (n) => Math.round((n || 0) * 10) / 10;

const line = { style: 'thin', color: { rgb: 'D0D7D2' } };
const border = { top: line, bottom: line, left: line, right: line };
const HEAD = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '15803D' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border };
const BODY = { border };
const TOT = { font: { bold: true }, fill: { fgColor: { rgb: 'E5F3E9' } }, border };
const MONEY = '#,##0.00 "€"';
const HRS = '0.00';

const s = (v, st = BODY) => ({ v: v ?? '', t: 's', s: st });
const n = (v, z, st = BODY, f) => ({ v, t: 'n', z, s: st, ...(f ? { f } : {}) });

export function buildWorkbook({ from, to, workers, hours, caterings, config }) {
  const names = displayNames(workers);
  const wMap = new Map(workers.map((w) => [w.id, w]));
  const cMap = new Map(caterings.map((c) => [c.id, c]));
  const preuKm = Number(config.preu_km) || 0;
  const nameOf = (id) => names.get(id) || '(treballador eliminat)';

  /* ---------- RESUM ---------- */
  const agg = new Map();
  for (const h of hours) {
    const a = agg.get(h.treballador) || { r: 0, c: 0, km: 0 };
    if (h.tipus === 'catering') a.c += h.hores || 0;
    else a.r += h.hores || 0;
    a.km += h.km || 0;
    agg.set(h.treballador, a);
  }
  const rows = [...agg.entries()].map(([id, a]) => ({ id, name: nameOf(id), w: wMap.get(id), ...a })).sort((x, y) => cmp(x.name, y.name));

  const head = ['Treballador', 'Hores restaurant', 'Hores càtering', 'Total hores', 'Preu/hora', 'Import hores', 'Km (cotxe propi)', 'Preu/km', 'Import km', 'TOTAL A PAGAR', 'Observacions'];
  const aoa = [[{ v: 'Quinze Ous - Hores treballades', t: 's', s: { font: { bold: true, sz: 14 } } }], [{ v: `Període: del ${fmtFull(from)} al ${fmtFull(to)}`, t: 's' }], [], head.map((h) => s(h, HEAD))];
  const first = 5;
  let sums = { b: 0, c: 0, d: 0, f: 0, g: 0, i: 0, j: 0 };
  rows.forEach((r, i) => {
    const k = first + i;
    const b = r2(r.r), c = r2(r.c), d = r2(b + c);
    const preu = Number(r.w?.preu_hora) || 0;
    const f = r2(d * preu);
    const g = r1(r.km);
    const iV = r2(g * preuKm);
    const j = r2(f + iV);
    sums = { b: sums.b + b, c: sums.c + c, d: sums.d + d, f: sums.f + f, g: sums.g + g, i: sums.i + iV, j: sums.j + j };
    aoa.push([
      s(r.name),
      n(b, HRS), n(c, HRS), n(d, HRS, BODY, `B${k}+C${k}`),
      n(preu, MONEY),
      n(f, MONEY, BODY, `D${k}*E${k}`),
      n(g, '0.0'),
      n(preuKm, MONEY),
      n(iV, MONEY, BODY, `G${k}*H${k}`),
      n(j, MONEY, { ...BODY, font: { bold: true } }, `F${k}+I${k}`),
      s(r.w?.nota || ''),
    ]);
  });
  const last = first + rows.length - 1;
  const sumF = (col) => (rows.length ? `SUM(${col}${first}:${col}${last})` : undefined);
  aoa.push([
    s('TOTAL', TOT),
    n(r2(sums.b), HRS, TOT, sumF('B')), n(r2(sums.c), HRS, TOT, sumF('C')), n(r2(sums.d), HRS, TOT, sumF('D')),
    s('', TOT),
    n(r2(sums.f), MONEY, TOT, sumF('F')),
    n(r1(sums.g), '0.0', TOT, sumF('G')),
    s('', TOT),
    n(r2(sums.i), MONEY, TOT, sumF('I')),
    n(r2(sums.j), MONEY, TOT, sumF('J')),
    s('', TOT),
  ]);
  const wsR = XLSX.utils.aoa_to_sheet(aoa);
  wsR['!cols'] = [{ wch: 32 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 34 }];
  wsR['!rows'] = [{ hpt: 22 }, {}, {}, { hpt: 34 }];
  if (rows.length) wsR['!autofilter'] = { ref: `A4:K${last}` };

  /* ---------- DETALL ---------- */
  const dHead = ['Treballador', 'Data', 'Dia', 'Tipus', 'Restaurant', 'Càtering (client)', 'Lloc càtering', 'Feina', 'Inici', 'Final', 'Hores', 'Cotxe propi', 'Km', 'Nota'];
  const sorted = [...hours].sort((a, b) => cmp(nameOf(a.treballador), nameOf(b.treballador)) || cmp(a.dia, b.dia) || cmp(a.entrada, b.entrada));
  const dAoa = [dHead.map((h) => s(h, HEAD))];
  for (const h of sorted) {
    const c = cMap.get(h.catering);
    dAoa.push([
      s(nameOf(h.treballador)),
      n(serial(h.dia), 'dd/mm/yyyy'),
      s(dayShort(h.dia).replace('.', '')),
      s(h.tipus === 'catering' ? 'Càtering' : 'Restaurant'),
      s(h.tipus === 'restaurant' ? h.lloc : ''),
      s(h.tipus === 'catering' ? c?.client || '' : ''),
      s(h.tipus === 'catering' ? c?.lloc || '' : ''),
      s(h.feina),
      s(h.entrada), s(h.sortida),
      n(r2(h.hores), HRS),
      s(h.cotxe ? 'Sí' : ''),
      h.km ? n(r1(h.km), '0.0') : s(''),
      s(h.nota || ''),
    ]);
  }
  const wsD = XLSX.utils.aoa_to_sheet(dAoa);
  wsD['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 6 }, { wch: 11 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 13 }, { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 11 }, { wch: 8 }, { wch: 34 }];
  wsD['!rows'] = [{ hpt: 30 }];
  if (sorted.length) wsD['!autofilter'] = { ref: `A1:N${sorted.length + 1}` };

  /* ---------- CÀTERINGS ---------- */
  const byCat = new Map();
  for (const h of hours) {
    if (h.tipus !== 'catering') continue;
    const a = byCat.get(h.catering) || { people: new Set(), h: 0, km: 0 };
    a.people.add(h.treballador);
    a.h += h.hores || 0;
    a.km += h.km || 0;
    byCat.set(h.catering, a);
  }
  const cRows = [...byCat.entries()].map(([id, a]) => ({ c: cMap.get(id) || { dia: '', client: '(eliminat)', lloc: '' }, ...a })).sort((x, y) => catSort(x.c, y.c));
  const cAoa = [['Data', 'Client', 'Lloc', 'Treballadors', 'Hores totals', 'Km totals'].map((h) => s(h, HEAD))];
  for (const r of cRows) cAoa.push([r.c.dia ? n(serial(r.c.dia), 'dd/mm/yyyy') : s(''), s(r.c.client), s(r.c.lloc), n(r.people.size, '0'), n(r2(r.h), HRS), n(r1(r.km), '0.0')]);
  const wsC = XLSX.utils.aoa_to_sheet(cAoa);
  wsC['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 26 }, { wch: 13 }, { wch: 13 }, { wch: 11 }];
  wsC['!rows'] = [{ hpt: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsR, 'Resum');
  XLSX.utils.book_append_sheet(wb, wsD, 'Detall');
  XLSX.utils.book_append_sheet(wb, wsC, 'Caterings');
  const fn = (d) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
  return { wb, filename: `Hores_${fn(from)}_a_${fn(to)}.xlsx`, people: rows.length };
}

export function downloadExcel(args) {
  const { wb, filename } = buildWorkbook(args);
  XLSX.writeFile(wb, filename);
  return filename;
}
