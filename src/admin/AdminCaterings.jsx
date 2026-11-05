import { Fragment, useMemo, useState } from 'react';
import { call } from '../api.js';
import { Empty, ErrorBox, Field, Modal, Seg, Spinner, useLoad, useToast } from '../ui.jsx';
import { addDays, catSort, cmp, displayNames, fmtH, fmtLong, num, sumHores } from '../util.js';

function CateringForm({ initial, today, onSave, onCancel }) {
  const [f, setF] = useState({ dia: initial?.dia || today, client: initial?.client || '', lloc: initial?.lloc || '', hora: initial?.hora || '', nota: initial?.nota || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!f.dia) return setErr('Indica la data.');
    if (!f.client.trim()) return setErr('Escriu el nom del client.');
    if (!f.lloc.trim()) return setErr('Escriu el lloc.');
    setBusy(true);
    try {
      await onSave({ ...f, id: initial?.id });
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card" style={{ boxShadow: 'none', padding: 0 }} noValidate>
      <Field label="Data"><input type="date" value={f.dia} onChange={set('dia')} /></Field>
      <Field label="Nom del client"><input type="text" value={f.client} onChange={set('client')} maxLength={80} placeholder="Ex.: Boda Puig" autoFocus /></Field>
      <Field label="Lloc"><input type="text" value={f.lloc} onChange={set('lloc')} maxLength={80} placeholder="Ex.: Mas Rovira, Olot" /></Field>
      <Field label="Hora (opcional)"><input type="time" value={f.hora} onChange={set('hora')} /></Field>
      <Field label="Nota per als treballadors (opcional)"><input type="text" value={f.nota} onChange={set('nota')} maxLength={300} /></Field>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel·lar</button>
        <button type="submit" className="btn green" disabled={busy}>{busy ? 'Guardant...' : 'Guardar'}</button>
      </div>
    </form>
  );
}

export default function AdminCaterings({ workers, today }) {
  const toast = useToast();
  const [view, setView] = useState('propers');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'dia', dir: 1 });
  const [open, setOpen] = useState(null);
  const [modal, setModal] = useState(null); // {initial}
  const names = useMemo(() => displayNames(workers), [workers]);

  const rng = view === 'propers' ? [today, addDays(today, 700)] : view === 'passats' ? [addDays(today, -700), addDays(today, -1)] : [addDays(today, -365), addDays(today, 365)];
  const { data, loading, error, reload } = useLoad(() => call('a_caterings', { from: rng[0], to: rng[1] }), [view]);

  const nq = q.trim().toLowerCase();
  const list = (data?.caterings || [])
    .filter((c) => !nq || `${c.client} ${c.lloc}`.toLowerCase().includes(nq))
    .sort((a, b) => {
      const k = sort.key;
      const d = k === 'dia' ? cmp(a.dia, b.dia) : cmp(a[k], b[k]);
      return d * sort.dir || catSort(a, b);
    });

  const info = (c) => {
    const d = (data?.disp || []).filter((x) => x.catering === c.id);
    const hs = (data?.hores || []).filter((h) => h.catering === c.id);
    const perWorker = new Map();
    hs.forEach((h) => perWorker.set(h.treballador, (perWorker.get(h.treballador) || 0) + h.hores));
    return {
      si: d.filter((x) => x.estat === 'si').map((x) => x.treballador),
      no: d.filter((x) => x.estat === 'no').map((x) => x.treballador),
      perWorker,
      hores: sumHores(hs),
    };
  };
  const nm = (id) => names.get(id) || '(eliminat)';
  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  const arrow = (key) => (sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');

  async function save(payload) {
    await call('a_catering_save', payload);
    toast('Càtering guardat');
    setModal(null);
    reload();
  }
  async function del(c) {
    if (!window.confirm(`Eliminar el càtering "${c.client}" del ${fmtLong(c.dia)}?`)) return;
    try {
      await call('a_catering_delete', { id: c.id });
      toast('Càtering eliminat');
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  return (
    <section className="card">
      <div className="ch">
        <h2>Càterings</h2>
        <button className="btn green sm" onClick={() => setModal({})}>+ Nou càtering</button>
      </div>
      <p className="muted sm">Els treballadors només poden marcar disponibilitat i registrar hores dels càterings que publiques aquí.</p>
      <div className="toolbar">
        <Seg label="Veure" value={view} onChange={(v) => { setView(v); setOpen(null); setSort({ key: 'dia', dir: v === 'passats' ? -1 : 1 }); }} options={[['propers', 'Propers'], ['passats', 'Passats'], ['tots', 'Tots']]} />
        <input type="text" className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cercar per client o lloc" aria-label="Cercar" />
      </div>
      {loading && <Spinner />}
      {error && <ErrorBox msg={error} onRetry={reload} />}
      {data && !list.length && <Empty>{nq ? 'Cap càtering coincideix amb la cerca.' : view === 'propers' ? 'No hi ha càterings propers. Crea\'n un amb "Nou càtering".' : 'No hi ha càterings.'}</Empty>}
      {list.length > 0 && (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => sortBy('dia')}>Data{arrow('dia')}</th>
                <th className="sortable" onClick={() => sortBy('client')}>Client{arrow('client')}</th>
                <th className="sortable" onClick={() => sortBy('lloc')}>Lloc{arrow('lloc')}</th>
                <th>Hora</th><th>Disponibles</th><th className="r">Hores</th><th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const i = info(c);
                const isOpen = open === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="click" onClick={() => setOpen(isOpen ? null : c.id)}>
                      <td>{fmtLong(c.dia)}</td>
                      <td><strong>{c.client}</strong></td>
                      <td>{c.lloc}</td>
                      <td>{c.hora}</td>
                      <td><span className="tag">{i.si.length} sí</span> <span className="tag gray">{i.no.length} no</span></td>
                      <td className="r">{i.hores ? num(i.hores) : ''}</td>
                      <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <button className="link" onClick={() => setModal({ initial: c })}>Editar</button>{' '}
                        <button className="link danger" onClick={() => del(c)}>Eliminar</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail">
                        <td colSpan={7}>
                          {c.nota && <p className="muted sm" style={{ marginBottom: 10 }}>Nota: {c.nota}</p>}
                          <div className="cols">
                            <div><h4>Poden anar ({i.si.length})</h4>{i.si.length ? <div className="names">{i.si.map((id) => <span key={id} className="tag">{nm(id)}</span>)}</div> : <span className="muted sm">Ningú encara</span>}</div>
                            <div><h4>No poden ({i.no.length})</h4>{i.no.length ? <div className="names">{i.no.map((id) => <span key={id} className="tag gray">{nm(id)}</span>)}</div> : <span className="muted sm">Ningú</span>}</div>
                            <div><h4>Han registrat hores ({i.perWorker.size})</h4>{i.perWorker.size ? <div className="names">{[...i.perWorker].sort((a, b) => cmp(nm(a[0]), nm(b[0]))).map(([id, h]) => <span key={id} className="tag blue">{nm(id)}: {fmtH(h)}</span>)}</div> : <span className="muted sm">Cap</span>}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted sm">Toca una fila per veure qui pot anar-hi. Toca les capçaleres Data, Client o Lloc per ordenar.</p>
      {modal && (
        <Modal title={modal.initial ? 'Editar càtering' : 'Nou càtering'} onClose={() => setModal(null)}>
          <CateringForm initial={modal.initial} today={today} onSave={save} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </section>
  );
}
