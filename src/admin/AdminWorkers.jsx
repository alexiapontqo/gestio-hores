import { useMemo, useState } from 'react';
import { call } from '../api.js';
import { Empty, Field, Modal, Seg, useToast } from '../ui.jsx';
import { cmp, fullName, num, sortWorkers } from '../util.js';

function WorkerForm({ initial, workers, onSave, onDelete, onCancel }) {
  const [f, setF] = useState({
    nom: initial?.nom || '', cognom1: initial?.cognom1 || '', cognom2: initial?.cognom2 || '',
    usuari: initial?.usuari || '', contrasenya: initial?.contrasenya || '',
    preu_hora: initial ? String(initial.preu_hora) : '12', nota: initial?.nota || '',
    fa_restaurant: initial ? !!initial.fa_restaurant : true, fa_catering: initial ? !!initial.fa_catering : true,
    actiu: initial ? initial.actiu !== false : true,
  });
  const [userTouched, setUserTouched] = useState(!!initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((s) => {
      const n = { ...s, [k]: v };
      if (!userTouched && (k === 'nom' || k === 'cognom1')) n.usuari = [n.nom, n.cognom1].filter(Boolean).join(' ');
      return n;
    });
  };
  const gen = () => {
    const used = new Set(workers.map((w) => String(w.contrasenya)));
    let p;
    do p = String(1000 + Math.floor(Math.random() * 9000)); while (used.has(p));
    setF((s) => ({ ...s, contrasenya: p }));
  };
  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!f.nom.trim()) return setErr('Escriu el nom.');
    if (!f.usuari.trim()) return setErr('Escriu l\'usuari.');
    if (f.contrasenya.trim().length < 3) return setErr('La contrasenya ha de tenir almenys 3 caràcters.');
    if (!(Number(f.preu_hora) >= 0)) return setErr('Indica el preu per hora.');
    setBusy(true);
    try {
      await onSave({ ...f, id: initial?.id, preu_hora: Number(f.preu_hora) });
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card" style={{ boxShadow: 'none', padding: 0 }} noValidate>
      <div className="grid2">
        <Field label="Nom"><input type="text" value={f.nom} onChange={set('nom')} autoFocus={!initial} /></Field>
        <Field label="Primer cognom"><input type="text" value={f.cognom1} onChange={set('cognom1')} /></Field>
      </div>
      <Field label="Segon cognom (opcional)"><input type="text" value={f.cognom2} onChange={set('cognom2')} /></Field>
      <div className="grid2">
        <Field label="Usuari" hint="El que escriu per entrar"><input type="text" value={f.usuari} onChange={(e) => { setUserTouched(true); set('usuari')(e); }} autoCapitalize="none" /></Field>
        <Field label="Contrasenya">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={f.contrasenya} onChange={set('contrasenya')} autoCapitalize="none" />
            <button type="button" className="btn sm" onClick={gen}>Generar</button>
          </div>
        </Field>
      </div>
      <Field label="Preu per hora (€)"><input type="number" inputMode="decimal" min="0" step="0.25" value={f.preu_hora} onChange={set('preu_hora')} /></Field>
      <Field label="Alguna cosa especial" hint="Només la veus tu i surt a l'Excel (columna Observacions)."><input type="text" value={f.nota} onChange={set('nota')} maxLength={300} placeholder="Ex.: cobra a part, ve d'ETT, preu pactat..." /></Field>
      <label className="check"><input type="checkbox" checked={f.fa_restaurant} onChange={set('fa_restaurant')} />Va al restaurant (veu "Disp. restaurant")</label>
      <label className="check"><input type="checkbox" checked={f.fa_catering} onChange={set('fa_catering')} />Va a càterings (veu "Disp. càtering")</label>
      <label className="check"><input type="checkbox" checked={f.actiu} onChange={set('actiu')} />Actiu (si el desactives, ja no pot entrar)</label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel·lar</button>
        <button type="submit" className="btn green" disabled={busy}>{busy ? 'Guardant...' : 'Guardar'}</button>
      </div>
      {initial && <button type="button" className="link danger" onClick={onDelete} style={{ justifySelf: 'start' }}>Eliminar treballador</button>}
    </form>
  );
}

export default function AdminWorkers({ workers, setWorkers }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [view, setView] = useState('actius');
  const [modal, setModal] = useState(null);

  const dup = useMemo(() => {
    const c = {};
    workers.forEach((w) => { const k = fullName(w).toLowerCase(); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [workers]);
  const nq = q.trim().toLowerCase();
  const list = sortWorkers(workers).filter((w) =>
    (view === 'tots' || (view === 'actius' ? w.actiu !== false : w.actiu === false)) &&
    (!nq || `${fullName(w)} ${w.usuari}`.toLowerCase().includes(nq)));
  const nActius = workers.filter((w) => w.actiu !== false).length;

  async function save(p) {
    const w = await call('a_worker_save', p);
    setWorkers((all) => (p.id ? all.map((x) => (x.id === w.id ? w : x)) : [...all, w]));
    toast(p.id ? 'Treballador guardat' : 'Treballador afegit');
    setModal(null);
  }
  async function del() {
    const w = modal.initial;
    if (!window.confirm(`Eliminar ${fullName(w)}? Només es pot eliminar si no té hores registrades.`)) return;
    try {
      await call('a_worker_delete', { id: w.id });
      setWorkers((all) => all.filter((x) => x.id !== w.id));
      toast('Treballador eliminat');
      setModal(null);
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  return (
    <section className="card">
      <div className="ch">
        <h2>Treballadors <span className="muted sm">({nActius} actius)</span></h2>
        <button className="btn green sm" onClick={() => setModal({})}>+ Afegir treballador</button>
      </div>
      <div className="toolbar">
        <Seg label="Veure" value={view} onChange={setView} options={[['actius', 'Actius'], ['inactius', 'Inactius'], ['tots', 'Tots']]} />
        <input type="text" className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cercar per nom o usuari" aria-label="Cercar" />
      </div>
      {!list.length ? <Empty>No hi ha cap treballador amb aquest filtre.</Empty> : (
        <div className="tw">
          <table>
            <thead><tr><th>Treballador</th><th>Usuari</th><th>Contrasenya</th><th className="r">Preu/h</th><th>Va a</th><th>Alguna cosa especial</th><th /></tr></thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className={`click ${w.actiu === false ? 'off' : ''}`} onClick={() => setModal({ initial: w })}>
                  <td>{fullName(w)} {dup[fullName(w).toLowerCase()] > 1 && <span className="tag amber" title="Hi ha més d'un treballador amb aquest nom">nom repetit</span>} {w.actiu === false && <span className="tag gray">inactiu</span>}</td>
                  <td>{w.usuari}</td>
                  <td>{w.contrasenya}</td>
                  <td className="r">{num(w.preu_hora)} €</td>
                  <td>{w.fa_restaurant && <span className="tag">Rest.</span>} {w.fa_catering && <span className="tag blue">Càt.</span>}</td>
                  <td>{w.nota}</td>
                  <td><button className="link">Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted sm">Ordenats alfabèticament per nom. Toca una fila per canviar-ne el preu, la contrasenya o les dades.</p>
      {modal && (
        <Modal title={modal.initial ? fullName(modal.initial) : 'Afegir treballador'} onClose={() => setModal(null)}>
          <WorkerForm initial={modal.initial} workers={workers} onSave={save} onDelete={del} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </section>
  );
}
