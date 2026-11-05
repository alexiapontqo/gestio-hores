// Capa d'accés a dades. En producció: Supabase (taula "registres").
// En local (LOCAL_DEV=1): memòria, carregada des de supabase/seed.json.
import fs from 'node:fs';
import crypto from 'node:crypto';

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
export const LOCAL = process.env.LOCAL_DEV === '1';

export class ConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.status = 500;
    this.expose = true;
  }
}

const DEFAULT_CONFIG = {
  restaurants: ['Quinze Ous', 'Quina Barra', 'Tacollona'],
  feines: ['Sala', 'Cuina', 'Barra', 'Runner', 'Rentaplats', 'Altres'],
  preu_km: 0.26,
  tancades: [],
};

/* ---------- memòria (només local) ---------- */
let mem = null;
function memInit() {
  if (mem) return mem;
  mem = [];
  try {
    const seed = JSON.parse(fs.readFileSync(new URL('../supabase/seed.json', import.meta.url), 'utf8'));
    for (const w of seed.treballadors) mem.push({ id: crypto.randomUUID(), col: 'treballadors', data: w });
    mem.push({ id: crypto.randomUUID(), col: 'config', data: seed.config });
  } catch {
    /* sense seed */
  }
  return mem;
}

/* ---------- filtres ---------- */
// filtres: { camp: valor | { gte, lte, eq, in:[...] } }
function matches(data, filters) {
  for (const [f, v] of Object.entries(filters || {})) {
    const x = data[f];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (v.gte !== undefined && !(String(x) >= v.gte)) return false;
      if (v.lte !== undefined && !(String(x) <= v.lte)) return false;
      if (v.eq !== undefined && String(x) !== String(v.eq)) return false;
      if (v.in !== undefined && !v.in.map(String).includes(String(x))) return false;
    } else if (String(x) !== String(v)) return false;
  }
  return true;
}

function qs(col, filters) {
  const p = new URLSearchParams();
  p.append('col', `eq.${col}`);
  for (const [f, v] of Object.entries(filters || {})) {
    const k = `data->>${f}`;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (v.gte !== undefined) p.append(k, `gte.${v.gte}`);
      if (v.lte !== undefined) p.append(k, `lte.${v.lte}`);
      if (v.eq !== undefined) p.append(k, `eq.${v.eq}`);
      if (v.in !== undefined) p.append(k, `in.(${v.in.join(',')})`);
    } else p.append(k, `eq.${v}`);
  }
  return p;
}

async function rest(method, query, body, extraHeaders = {}) {
  if (!URL_BASE || !KEY)
    throw new ConfigError('Falta configurar la base de dades (SUPABASE_URL i SUPABASE_SERVICE_KEY a Vercel).');
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...extraHeaders };
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  const r = await fetch(`${URL_BASE}/rest/v1/registres${query ? '?' + query : ''}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) {
    console.error('Supabase', r.status, txt);
    if (r.status === 404 || /relation .* does not exist|PGRST205/.test(txt))
      throw new ConfigError("Falta crear la taula a Supabase. Executa el fitxer supabase/setup.sql.");
    if (r.status === 401 || r.status === 403)
      throw new ConfigError('La clau de Supabase no és vàlida. Revisa SUPABASE_SERVICE_KEY a Vercel.');
    throw new Error(`Supabase ${r.status}`);
  }
  return txt ? JSON.parse(txt) : null;
}

const flat = (row) => ({ id: row.id, _col: row.col, ...row.data });

/* ---------- API ---------- */
export async function list(col, filters = {}, { limit } = {}) {
  if (LOCAL) {
    const out = memInit()
      .filter((r) => r.col === col && matches(r.data, filters))
      .map(flat);
    return limit ? out.slice(0, limit) : out;
  }
  const out = [];
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const p = qs(col, filters);
    p.set('select', 'id,col,data');
    p.set('order', 'id');
    const size = limit ? Math.min(PAGE, limit - out.length) : PAGE;
    p.set('limit', String(size));
    p.set('offset', String(offset));
    const rows = await rest('GET', p.toString());
    out.push(...rows.map(flat));
    if (rows.length < size || (limit && out.length >= limit)) break;
    offset += size;
  }
  return out;
}

export async function get(id) {
  if (!id || typeof id !== 'string') return null;
  if (LOCAL) {
    const r = memInit().find((x) => x.id === id);
    return r ? flat(r) : null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await rest('GET', `id=eq.${id}&select=id,col,data`);
  return rows[0] ? flat(rows[0]) : null;
}

export async function insert(col, data) {
  if (LOCAL) {
    const row = { id: crypto.randomUUID(), col, data: { ...data } };
    memInit().push(row);
    return flat(row);
  }
  const rows = await rest('POST', 'select=id,col,data', { col, data }, { Prefer: 'return=representation' });
  return flat(rows[0]);
}

export async function update(id, patch) {
  const cur = await get(id);
  if (!cur) return null;
  const { id: _i, _col, ...data } = cur;
  const next = { ...data, ...patch };
  if (LOCAL) {
    memInit().find((x) => x.id === id).data = next;
    return { id, _col, ...next };
  }
  const rows = await rest('PATCH', `id=eq.${id}&select=id,col,data`, { data: next }, { Prefer: 'return=representation' });
  return flat(rows[0]);
}

export async function remove(id) {
  if (LOCAL) {
    const m = memInit();
    const i = m.findIndex((x) => x.id === id);
    if (i >= 0) m.splice(i, 1);
    return;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await rest('DELETE', `id=eq.${id}`);
}

export async function getConfig() {
  const rows = await list('config', {}, { limit: 1 });
  if (rows[0]) {
    const { id, _col, ...c } = rows[0];
    return { ...DEFAULT_CONFIG, ...c, _id: id };
  }
  const row = await insert('config', DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, _id: row.id };
}

export async function saveConfig(patch) {
  const cfg = await getConfig();
  const { _id, ...rest_ } = cfg;
  await update(_id, { ...rest_, ...patch });
  return getConfig();
}
