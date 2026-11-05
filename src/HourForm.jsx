import { useMemo, useState } from 'react';
import { Field } from './ui.jsx';
import { calcHores, catLabel, catSort, fmtH, fmtLong, lastUsed, rememberUsed, sortWorkers, fullName } from './util.js';

// Formulari compartit entre treballador i administrador.
// kind: 'restaurant' | 'catering'
export default function HourForm({ kind, config, caterings = [], initial, bounds, workers, onSubmit, onCancel, today }) {
  const last = lastUsed();
  const rest = config.restaurants || [];
  const feines = useMemo(() => {
    const f = [...(config.feines || [])];
    if (initial?.feina && !f.includes(initial.feina)) f.push(initial.feina);
    return f;
  }, [config, initial]);
  const llocs = useMemo(() => {
    const l = [...rest];
    if (initial?.lloc && !l.includes(initial.lloc)) l.push(initial.lloc);
    return l;
  }, [rest, initial]);

  const clamp = (d) => (bounds ? (d < bounds.min ? bounds.min : d > bounds.max ? bounds.max : d) : d);
  const [f, setF] = useState({
    treballador: initial?.treballador || '',
    dia: initial?.dia || clamp(today),
    lloc: initial?.lloc || (llocs.includes(last.lloc) ? last.lloc : llocs.length === 1 ? llocs[0] : ''),
    catering: initial?.catering || '',
    feina: initial?.feina || (feines.includes(last.feina) ? last.feina : ''),
    entrada: initial?.entrada || '',
    sortida: initial?.sortida || '',
    cotxe: !!initial?.cotxe,
    km: initial?.km ? String(initial.km) : '',
    nota: initial?.nota || '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const cats = useMemo(() => [...caterings].sort(catSort), [caterings]);
  const chosen = cats.find((c) => c.id === f.catering);
  const hores = calcHores(f.entrada, f.sortida);
  const isCat = kind === 'catering';
  const L1 = isCat ? 'Sortida' : 'Entrada';
  const L2 = isCat ? 'Tornada' : 'Sortida';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (workers && !f.treballador) return setErr('Selecciona el treballador.');
    if (isCat && !f.catering) return setErr('Selecciona el càtering.');
    if (!isCat && !f.lloc) return setErr('Selecciona el restaurant.');
    if (!isCat && !f.dia) return setErr('Indica la data.');
    if (!f.feina) return setErr('Selecciona la feina.');
    if (!f.entrada || !f.sortida) return setErr(isCat ? 'Indica l\'hora de sortida i la de tornada.' : 'Indica l\'hora d\'entrada i la de sortida.');
    if (f.entrada === f.sortida) return setErr('Les dues hores no poden ser iguals.');
    if (isCat && f.cotxe && !(Number(f.km) > 0)) return setErr('Indica els km que has fet amb el cotxe.');
    if (hores > 12 && !window.confirm(`Això són ${fmtH(hores)} seguides. Està bé?`)) return;
    setBusy(true);
    try {
      const payload = { tipus: kind, feina: f.feina, entrada: f.entrada, sortida: f.sortida, nota: f.nota };
      if (initial?.id) payload.id = initial.id;
      if (workers) payload.treballador = f.treballador;
      if (isCat) Object.assign(payload, { catering: f.catering, cotxe: f.cotxe, km: f.cotxe ? Number(f.km) : 0 });
      else Object.assign(payload, { dia: f.dia, lloc: f.lloc });
      await onSubmit(payload);
      rememberUsed({ feina: f.feina, ...(isCat ? {} : { lloc: f.lloc }) });
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ boxShadow: 'none', padding: 0 }} noValidate>
      <h2>{isCat ? 'Càtering' : 'Restaurant'}</h2>

      {workers && (
        <Field label="Treballador">
          <select value={f.treballador} onChange={set('treballador')} disabled={!!initial?.id}>
            <option value="">Selecciona...</option>
            {sortWorkers(workers).map((w) => (
              <option key={w.id} value={w.id}>{fullName(w)}</option>
            ))}
          </select>
        </Field>
      )}

      {isCat ? (
        <>
          <Field label="Càtering">
            <select value={f.catering} onChange={set('catering')}>
              <option value="">Selecciona el càtering...</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{catLabel(c)}</option>
              ))}
            </select>
          </Field>
          {!cats.length && <p className="info">No hi ha cap càtering publicat en aquest període. Si no hi surt el teu, avisa l'administració.</p>}
          {chosen && <p className="muted sm">Data: {fmtLong(chosen.dia)}{chosen.hora ? ` · a les ${chosen.hora}` : ''}</p>}
        </>
      ) : (
        <>
          <Field label="Data">
            <input type="date" value={f.dia} min={bounds?.min} max={bounds?.max} onChange={set('dia')} />
          </Field>
          <Field label="Restaurant">
            <select value={f.lloc} onChange={set('lloc')}>
              <option value="">Selecciona...</option>
              {llocs.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </>
      )}

      <Field label="Feina">
        <select value={f.feina} onChange={set('feina')}>
          <option value="">Selecciona...</option>
          {feines.map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>

      <div className="grid2">
        <Field label={L1}>
          <input type="time" value={f.entrada} onChange={set('entrada')} />
        </Field>
        <Field label={L2}>
          <input type="time" value={f.sortida} onChange={set('sortida')} />
        </Field>
      </div>
      {hores > 0 && <p className={hores > 12 ? 'warn' : 'muted sm'}>Total: <strong>{fmtH(hores)}</strong>{f.sortida <= f.entrada ? ' (acaba l\'endemà)' : ''}</p>}

      {isCat && (
        <>
          <label className="check">
            <input type="checkbox" checked={f.cotxe} onChange={set('cotxe')} />
            Cotxe propi
          </label>
          {f.cotxe && (
            <Field label="Km totals (anada i tornada)">
              <input type="number" inputMode="decimal" min="0" step="0.1" value={f.km} onChange={set('km')} placeholder="Ex.: 84" />
            </Field>
          )}
        </>
      )}

      <Field label="Nota (opcional)">
        <input type="text" value={f.nota} onChange={set('nota')} maxLength={300} />
      </Field>

      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel·lar</button>
        <button type="submit" className="btn green" disabled={busy}>{busy ? 'Guardant...' : 'Guardar'}</button>
      </div>
    </form>
  );
}
