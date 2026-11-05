import crypto from 'node:crypto';
import { LOCAL } from './_db.js';

export class HttpError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
    this.expose = true;
  }
}
export const bad = (m) => new HttpError(400, m);

/* ---------- sessions (token signat) ---------- */
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return `${process.env.ADMIN_PASSWORD || (LOCAL ? 'admin' : '')}|${process.env.SUPABASE_SERVICE_KEY || 'local'}|gh2`;
}
const b64 = (s) => Buffer.from(s).toString('base64url');
const sig = (s) => crypto.createHmac('sha256', secret()).update(s).digest('base64url');

export function sign(payload, ttlSeconds) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${sig(body)}`;
}
export function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, s] = token.split('.');
  const good = sig(body);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || (LOCAL ? 'admin' : '');
}
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------- límit d'intents de login ---------- */
const attempts = new Map();
export function throttle(key, max = 15, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  if (a.length >= max) throw new HttpError(429, 'Massa intents. Espera uns minuts i torna-ho a provar.');
  a.push(now);
  attempts.set(key, a);
}

/* ---------- noms ---------- */
export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* ---------- dates i hores ---------- */
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
export const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}
export const todayMadrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
export const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export function span(entrada, sortida) {
  const s = toMin(entrada);
  let e = toMin(sortida);
  if (e <= s) e += 1440; // passa de mitjanit
  return [s, e];
}
export function calcHores(entrada, sortida) {
  const [s, e] = span(entrada, sortida);
  return Math.round(((e - s) / 60) * 100) / 100;
}
