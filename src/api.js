const KEY = 'gh_session';

export const session = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  },
  set(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* res */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* res */ }
  },
};

export async function call(action, params = {}) {
  const s = session.get();
  let r;
  try {
    r = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token: s?.token, ...params }),
    });
  } catch {
    throw new Error('No hi ha connexió. Revisa internet i torna-ho a provar.');
  }
  let j;
  try { j = await r.json(); } catch { throw new Error('El servidor no respon bé. Torna-ho a provar d\'aquí a un moment.'); }
  if (!j.ok) {
    const e = new Error(j.error || 'Error');
    e.status = r.status;
    if (r.status === 401 && action !== 'login' && action !== 'login_admin') {
      session.clear();
      window.dispatchEvent(new Event('gh-logout'));
    }
    throw e;
  }
  return j.data;
}
