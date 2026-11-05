const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => iso(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const mondayOf = (s) => {
  const d = parse(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};
export const addMonths = (s, n) => {
  const d = parse(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return iso(d);
};
export const monthEnd = (s) => {
  const d = parse(s);
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

const MESOS = ['de gener', 'de febrer', 'de març', 'd\'abril', 'de maig', 'de juny', 'de juliol', 'd\'agost', 'de setembre', 'd\'octubre', 'de novembre', 'de desembre'];
const MESOS_NOM = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const DIES = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
const DIES_C = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];

export const dayName = (s) => DIES[parse(s).getDay()];
export const dayShort = (s) => DIES_C[parse(s).getDay()];
export const fmtDM = (s) => {
  const d = parse(s);
  return `${d.getDate()} ${MESOS[d.getMonth()]}`;
};
export const fmtLong = (s) => `${dayName(s)} ${fmtDM(s)}`;
export const fmtShort = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const fmtFull = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export const weekLabel = (mon) => `${fmtDM(mon)} - ${fmtDM(addDays(mon, 6))}`;
export const monthLabel = (s) => `${MESOS_NOM[parse(s).getMonth()]} ${parse(s).getFullYear()}`;

export function calcHores(a, b) {
  if (!a || !b || a === b) return 0;
  const m = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  let d = m(b) - m(a);
  if (d <= 0) d += 1440;
  return Math.round((d / 60) * 100) / 100;
}
export function fmtH(h) {
  const t = Math.round((h || 0) * 60);
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  if (!mm) return `${hh} h`;
  return hh ? `${hh} h ${mm} min` : `${mm} min`;
}
export const num = (n, d = 2) => Number(n || 0).toLocaleString('ca-ES', { minimumFractionDigits: 0, maximumFractionDigits: d });
export const euro = (n) => Number(n || 0).toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' });

export const cmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'ca', { sensitivity: 'base' });
export const fullName = (w) => [w.nom, w.cognom1, w.cognom2].filter(Boolean).join(' ');
export const sortWorkers = (arr) =>
  [...arr].sort((a, b) => cmp(a.nom, b.nom) || cmp(a.cognom1, b.cognom1) || cmp(a.cognom2, b.cognom2) || (a.codi || 0) - (b.codi || 0));

// id -> nom visible. Si hi ha dues persones amb el mateix nom, la segona surt amb (2), etc.
export function displayNames(workers) {
  const map = new Map();
  const seen = {};
  for (const w of [...workers].sort((a, b) => (a.codi || 0) - (b.codi || 0))) {
    const base = fullName(w);
    const key = base.toLowerCase();
    seen[key] = (seen[key] || 0) + 1;
    map.set(w.id, seen[key] > 1 ? `${base} (${seen[key]})` : base);
  }
  return map;
}

export const catSort = (a, b) => cmp(a.dia, b.dia) || cmp(a.client, b.client) || cmp(a.lloc, b.lloc);
export const catLabel = (c) => `${fmtShort(c.dia)} - ${c.client} - ${c.lloc}`;

export const sumHores = (rows) => Math.round(rows.reduce((t, h) => t + (h.hores || 0), 0) * 100) / 100;

// Períodes (administrador)
export function periodWeek(today, offset = 0) {
  const from = addDays(mondayOf(today), offset * 7);
  return { mode: 'setmana', from, to: addDays(from, 6) };
}
export function periodMonth(today, offset = 0) {
  const from = addMonths(today, offset);
  return { mode: 'mes', from: iso(new Date(parse(from).getFullYear(), parse(from).getMonth(), 1)), to: monthEnd(from) };
}
export function defaultPeriod(today) {
  const dow = (parse(today).getDay() + 6) % 7; // 0 = dilluns
  return periodWeek(today, dow <= 2 ? -1 : 0);
}
export function periodLabel(p) {
  if (p.mode === 'setmana') return weekLabel(p.from);
  if (p.mode === 'mes') return monthLabel(p.from);
  return `${fmtFull(p.from)} - ${fmtFull(p.to)}`;
}

const LAST = 'gh_last';
export const lastUsed = () => {
  try { return JSON.parse(localStorage.getItem(LAST)) || {}; } catch { return {}; }
};
export const rememberUsed = (o) => {
  try { localStorage.setItem(LAST, JSON.stringify({ ...lastUsed(), ...o })); } catch { /* res */ }
};
