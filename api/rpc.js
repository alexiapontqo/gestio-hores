import { list, get, insert, update, remove, getConfig, saveConfig } from './_db.js';
import {
  HttpError, bad, sign, verify, adminPassword, safeEqual, throttle, norm,
  isDate, isTime, addDays, mondayOf, todayMadrid, span, calcHores,
} from './_lib.js';

const fullName = (w) => [w.nom, w.cognom1, w.cognom2].filter(Boolean).join(' ');
const pubWorker = (w) => ({ id: w.id, nom: fullName(w), fa_restaurant: !!w.fa_restaurant, fa_catering: !!w.fa_catering });
const pubConfig = (c) => ({ restaurants: c.restaurants, feines: c.feines, tancades: c.tancades });
const strip = ({ _col, ...o }) => o;

function range(p, maxDays = 400) {
  if (!isDate(p.from) || !isDate(p.to) || p.from > p.to) throw bad('Període no vàlid.');
  if (Date.parse(p.to) - Date.parse(p.from) > maxDays * 86400000) throw bad('Període massa llarg.');
  return { gte: p.from, lte: p.to };
}

/* ================= LOGIN ================= */
const ipOf = (req) => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();

async function login(p, req) {
  throttle('w:' + ipOf(req));
  const user = norm(p.usuari);
  const pass = String(p.contrasenya || '').trim();
  if (!user || !pass) throw bad('Escriu l\'usuari i la contrasenya.');
  const workers = await list('treballadors');
  const w = workers.find((x) => x.actiu !== false && norm(x.usuari) === user && String(x.contrasenya) === pass);
  if (!w) throw new HttpError(401, 'Usuari o contrasenya incorrectes.');
  return { token: sign({ r: 'w', id: w.id }, 30 * 86400) };
}

async function loginAdmin(p, req) {
  throttle('a:' + ipOf(req), 8);
  const real = adminPassword();
  if (!real) throw new HttpError(500, 'Falta configurar ADMIN_PASSWORD a Vercel.');
  if (!safeEqual(String(p.contrasenya || ''), real)) throw new HttpError(401, 'Contrasenya incorrecta.');
  return { token: sign({ r: 'a' }, 7 * 86400) };
}

/* ================= HORES (compartit) ================= */
async function saveHour(p, workerId, admin) {
  const cfg = await getConfig();
  const tipus = p.tipus;
  if (tipus !== 'restaurant' && tipus !== 'catering') throw bad('Tipus no vàlid.');

  let dia = p.dia;
  let lloc = '';
  let catering = '';
  if (tipus === 'catering') {
    const cat = await get(p.catering);
    if (!cat || cat._col !== 'caterings') throw bad('Selecciona un càtering.');
    dia = cat.dia;
    catering = cat.id;
  } else {
    lloc = String(p.lloc || '').trim();
    if (!lloc) throw bad('Selecciona el restaurant.');
  }
  if (!isDate(dia)) throw bad('Data no vàlida.');
  const feina = String(p.feina || '').trim();
  if (!feina) throw bad('Selecciona la feina.');
  if (!isTime(p.entrada) || !isTime(p.sortida)) throw bad('Indica l\'hora d\'inici i de final.');
  if (p.entrada === p.sortida) throw bad('L\'hora d\'inici i la de final no poden ser iguals.');
  const hores = calcHores(p.entrada, p.sortida);
  if (hores > 18) throw bad('Un torn no pot passar de 18 hores. Revisa les hores.');

  let cotxe = false;
  let km = 0;
  if (tipus === 'catering' && p.cotxe) {
    cotxe = true;
    km = Math.round(Number(p.km) * 10) / 10;
    if (!(km > 0)) throw bad('Indica els km que has fet amb el cotxe.');
    if (km > 1000) throw bad('Els km semblen massa alts. Revisa\'ls.');
  }
  const nota = String(p.nota || '').trim().slice(0, 300);

  let existing = null;
  if (p.id) {
    existing = await get(p.id);
    if (!existing || existing._col !== 'hores' || existing.treballador !== workerId) throw bad('No s\'ha trobat l\'entrada.');
  }

  if (!admin) {
    if (dia > todayMadrid()) throw bad('No es poden registrar hores de dies que encara no han passat.');
    const tanc = cfg.tancades || [];
    if (tanc.includes(mondayOf(dia)) || (existing && tanc.includes(mondayOf(existing.dia))))
      throw bad('Aquesta setmana ja està tancada. Contacta amb l\'administració.');
  }

  // solapaments el mateix dia
  const [s, e] = span(p.entrada, p.sortida);
  const same = await list('hores', { treballador: workerId, dia });
  for (const o of same) {
    if (existing && o.id === existing.id) continue;
    const [s2, e2] = span(o.entrada, o.sortida);
    if (s < e2 && s2 < e) throw bad(`Aquest horari se sobreposa amb un altre que ja tens registrat (${o.entrada}–${o.sortida}).`);
  }

  const rec = { treballador: workerId, dia, tipus, lloc, catering, feina, entrada: p.entrada, sortida: p.sortida, hores, cotxe, km, nota };
  const saved = existing ? await update(existing.id, rec) : await insert('hores', { ...rec, creat_per: admin ? 'admin' : 'treballador' });
  return strip(saved);
}

async function deleteHour(p, workerId, admin) {
  const h = await get(p.id);
  if (!h || h._col !== 'hores') throw bad('No s\'ha trobat l\'entrada.');
  if (!admin) {
    if (h.treballador !== workerId) throw bad('No s\'ha trobat l\'entrada.');
    const cfg = await getConfig();
    if ((cfg.tancades || []).includes(mondayOf(h.dia))) throw bad('Aquesta setmana ja està tancada. Contacta amb l\'administració.');
  }
  await remove(h.id);
  return { deleted: true };
}

/* ================= TREBALLADOR ================= */
const W = {
  async w_me(s) {
    const cfg = await getConfig();
    return { worker: pubWorker(s.worker), config: pubConfig(cfg), today: todayMadrid() };
  },
  async w_hours(s, p) {
    const r = range(p, 62);
    return (await list('hores', { treballador: s.worker.id, dia: r })).map(strip);
  },
  async w_hour_save(s, p) {
    return saveHour(p, s.worker.id, false);
  },
  async w_hour_delete(s, p) {
    return deleteHour(p, s.worker.id, false);
  },
  async w_caterings(s, p) {
    return (await list('caterings', { dia: range(p, 62) })).map(strip);
  },
  async w_disp_rest(s, p) {
    return (await list('disp_rest', { treballador: s.worker.id, dia: range(p, 62) })).map(strip);
  },
  async w_disp_rest_set(s, p) {
    if (!isDate(p.dia)) throw bad('Data no vàlida.');
    if (p.dia < todayMadrid()) throw bad('Aquest dia ja ha passat.');
    const cur = (await list('disp_rest', { treballador: s.worker.id, dia: p.dia }))[0];
    const dinar = !!p.dinar;
    const sopar = !!p.sopar;
    if (!dinar && !sopar) {
      if (cur) await remove(cur.id);
      return { dia: p.dia, dinar: false, sopar: false };
    }
    const rec = { treballador: s.worker.id, dia: p.dia, dinar, sopar };
    return strip(cur ? await update(cur.id, rec) : await insert('disp_rest', rec));
  },
  async w_disp_cat(s) {
    const today = todayMadrid();
    const caterings = await list('caterings', { dia: { gte: today } });
    const mine = await list('disp_cat', { treballador: s.worker.id, dia: { gte: today } });
    return { caterings: caterings.map(strip), mine: mine.map(strip) };
  },
  async w_disp_cat_set(s, p) {
    const cat = await get(p.catering);
    if (!cat || cat._col !== 'caterings') throw bad('Càtering no trobat.');
    if (cat.dia < todayMadrid()) throw bad('Aquest càtering ja ha passat.');
    const cur = (await list('disp_cat', { treballador: s.worker.id, catering: cat.id }))[0];
    if (p.estat !== 'si' && p.estat !== 'no') {
      if (cur) await remove(cur.id);
      return { catering: cat.id, estat: null };
    }
    const rec = { treballador: s.worker.id, catering: cat.id, dia: cat.dia, estat: p.estat };
    return strip(cur ? await update(cur.id, rec) : await insert('disp_cat', rec));
  },
};

/* ================= ADMINISTRADOR ================= */
const A = {
  async a_boot() {
    const [workers, cfg] = await Promise.all([list('treballadors'), getConfig()]);
    const { _id, ...config } = cfg;
    return { workers: workers.map(strip), config, today: todayMadrid() };
  },

  async a_config_save(s, p) {
    const clean = (arr, what) => {
      if (!Array.isArray(arr)) throw bad(`Llista de ${what} no vàlida.`);
      const out = [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
      if (!out.length) throw bad(`Cal almenys un element a ${what}.`);
      if (out.length > 60) throw bad(`Massa elements a ${what}.`);
      return out;
    };
    const preu_km = Number(p.preu_km);
    if (!(preu_km >= 0 && preu_km <= 5)) throw bad('Preu per km no vàlid.');
    const cfg = await saveConfig({
      restaurants: clean(p.restaurants, 'restaurants'),
      feines: clean(p.feines, 'feines'),
      preu_km,
    });
    const { _id, ...config } = cfg;
    return config;
  },

  async a_week_close(s, p) {
    if (!isDate(p.week) || mondayOf(p.week) !== p.week) throw bad('Setmana no vàlida.');
    const cfg = await getConfig();
    const set = new Set(cfg.tancades || []);
    p.closed ? set.add(p.week) : set.delete(p.week);
    const next = await saveConfig({ tancades: [...set].sort() });
    return { tancades: next.tancades };
  },

  async a_worker_save(s, p) {
    const nom = String(p.nom || '').trim();
    const usuari = String(p.usuari || '').trim().replace(/\s+/g, ' ');
    const contrasenya = String(p.contrasenya || '').trim();
    if (!nom) throw bad('Falta el nom.');
    if (!usuari) throw bad('Falta l\'usuari.');
    if (contrasenya.length < 3 || contrasenya.length > 30) throw bad('La contrasenya ha de tenir entre 3 i 30 caràcters.');
    const preu_hora = Math.round(Number(p.preu_hora) * 100) / 100;
    if (!(preu_hora >= 0 && preu_hora <= 200)) throw bad('Preu per hora no vàlid.');

    const all = await list('treballadors');
    const clash = all.find((w) => w.id !== p.id && norm(w.usuari) === norm(usuari) && String(w.contrasenya) === contrasenya);
    if (clash) throw bad('Ja hi ha algú amb aquest mateix usuari i contrasenya. Canvia la contrasenya.');

    const rec = {
      nom,
      cognom1: String(p.cognom1 || '').trim(),
      cognom2: String(p.cognom2 || '').trim(),
      usuari,
      contrasenya,
      preu_hora,
      nota: String(p.nota || '').trim().slice(0, 300),
      fa_restaurant: !!p.fa_restaurant,
      fa_catering: !!p.fa_catering,
      actiu: p.actiu !== false,
    };
    if (p.id) {
      const cur = await get(p.id);
      if (!cur || cur._col !== 'treballadors') throw bad('Treballador no trobat.');
      return strip(await update(p.id, rec));
    }
    const codi = Math.max(0, ...all.map((w) => w.codi || 0)) + 1;
    return strip(await insert('treballadors', { ...rec, codi }));
  },

  async a_worker_delete(s, p) {
    const w = await get(p.id);
    if (!w || w._col !== 'treballadors') throw bad('Treballador no trobat.');
    const has = await list('hores', { treballador: w.id }, { limit: 1 });
    if (has.length) throw bad('Aquest treballador té hores registrades. Desactiva\'l en comptes d\'eliminar-lo.');
    for (const col of ['disp_rest', 'disp_cat']) {
      for (const r of await list(col, { treballador: w.id })) await remove(r.id);
    }
    await remove(w.id);
    return { deleted: true };
  },

  async a_hours(s, p) {
    return (await list('hores', { dia: range(p, 400) })).map(strip);
  },
  async a_hour_save(s, p) {
    const w = await get(p.treballador);
    if (!w || w._col !== 'treballadors') throw bad('Selecciona el treballador.');
    return saveHour(p, w.id, true);
  },
  async a_hour_delete(s, p) {
    return deleteHour(p, null, true);
  },

  async a_caterings(s, p) {
    const r = range(p, 800);
    const [caterings, disp, hores] = await Promise.all([
      list('caterings', { dia: r }),
      list('disp_cat', { dia: r }),
      list('hores', { dia: r, tipus: 'catering' }),
    ]);
    return { caterings: caterings.map(strip), disp: disp.map(strip), hores: hores.map(strip) };
  },
  async a_catering_save(s, p) {
    if (!isDate(p.dia)) throw bad('Data no vàlida.');
    const client = String(p.client || '').trim();
    const lloc = String(p.lloc || '').trim();
    if (!client) throw bad('Falta el nom del client.');
    if (!lloc) throw bad('Falta el lloc.');
    const rec = {
      dia: p.dia,
      client: client.slice(0, 80),
      lloc: lloc.slice(0, 80),
      hora: isTime(p.hora) ? p.hora : '',
      nota: String(p.nota || '').trim().slice(0, 300),
    };
    if (p.id) {
      const cur = await get(p.id);
      if (!cur || cur._col !== 'caterings') throw bad('Càtering no trobat.');
      const saved = await update(p.id, rec);
      if (cur.dia !== rec.dia) {
        for (const h of await list('hores', { catering: cur.id })) await update(h.id, { dia: rec.dia });
        for (const d of await list('disp_cat', { catering: cur.id })) await update(d.id, { dia: rec.dia });
      }
      return strip(saved);
    }
    return strip(await insert('caterings', rec));
  },
  async a_catering_delete(s, p) {
    const c = await get(p.id);
    if (!c || c._col !== 'caterings') throw bad('Càtering no trobat.');
    const has = await list('hores', { catering: c.id }, { limit: 1 });
    if (has.length) throw bad('Aquest càtering té hores registrades. No es pot eliminar.');
    for (const d of await list('disp_cat', { catering: c.id })) await remove(d.id);
    await remove(c.id);
    return { deleted: true };
  },

  async a_disp_rest(s, p) {
    return (await list('disp_rest', { dia: range(p, 62) })).map(strip);
  },
};

/* ================= DISPATCH ================= */
async function dispatch(body, req) {
  const { action, token, ...p } = body || {};
  if (action === 'login') return login(p, req);
  if (action === 'login_admin') return loginAdmin(p, req);

  const s = verify(token);
  if (!s) throw new HttpError(401, 'Sessió caducada. Torna a entrar.');

  if (typeof action === 'string' && action.startsWith('w_') && W[action]) {
    if (s.r !== 'w') throw new HttpError(403, 'No autoritzat.');
    const worker = await get(s.id);
    if (!worker || worker._col !== 'treballadors' || worker.actiu === false) throw new HttpError(401, 'Sessió caducada. Torna a entrar.');
    return W[action]({ ...s, worker }, p);
  }
  if (typeof action === 'string' && action.startsWith('a_') && A[action]) {
    if (s.r !== 'a') throw new HttpError(403, 'No autoritzat.');
    return A[action](s, p);
  }
  throw bad('Acció desconeguda.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Mètode no permès.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const data = await dispatch(body, req);
    res.status(200).json({ ok: true, data });
  } catch (e) {
    const status = e.status || 500;
    if (!e.expose) console.error(e);
    res.status(status).json({ ok: false, error: e.expose ? e.message : 'Error del servidor. Torna-ho a provar.' });
  }
}
