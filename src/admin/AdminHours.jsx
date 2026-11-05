import { useMemo, useState } from 'react';
import { call } from '../api.js';
import HourForm from '../HourForm.jsx';
import { Empty, ErrorBox, Modal, Seg, Spinner, useLoad, useToast } from '../ui.jsx';
import { addDays, cmp, defaultPeriod, displayNames, dayShort, fmtH, fmtShort, num, sortWorkers, fullName } from '../util.js';
import PeriodPicker from './PeriodPicker.jsx';

export default function AdminHours({ workers, config, today }) {
  const toast = useToast();
  const [period, setPeriod] = useState(() => defaultPeriod(today));
  const [wf, setWf] = useState('');
  const [tf, setTf] = useState('');
  const [modal, setModal] = useState(null); // { kind, initial }
  const names = useMemo(() => displayNames(workers), [workers]);

  const { data, loading, error, reload } = useLoad(() => call('a_hours', { from: period.from, to: period.to }), [period.from, period.to]);
  const cats = useLoad(() => call('a_caterings', { from: addDays(period.from, -45), to: addDays(period.to, 45) }), [period.from, period.to]);
  const catMap = new Map((cats.data?.caterings || []).map((c) => [c.id, c]));

  const rows = (data || [])
    .filter((h) => (!wf || h.treballador === wf) && (!tf || h.tipus === tf))
    .sort((a, b) => cmp(a.dia, b.dia) || cmp(names.get(a.treballador), names.get(b.treballador)) || cmp(a.entrada, b.entrada));
  const total = rows.reduce((t, h) => t + h.hores, 0);

  async function save(payload) {
    await call('a_hour_save', payload);
    toast('Hores guardades');
    setModal(null);
    reload();
  }
  async function del(h) {
    if (!window.confirm(`Eliminar les hores de ${names.get(h.treballador)} del ${fmtShort(h.dia)}?`)) return;
    try {
      await call('a_hour_delete', { id: h.id });
      toast('Entrada eliminada');
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  return (
    <section className="card">
      <div className="ch">
        <h2>Hores registrades</h2>
        <button className="btn green sm" onClick={() => setModal({ kind: 'restaurant' })}>+ Afegir hores</button>
      </div>
      <PeriodPicker value={period} onChange={setPeriod} today={today} />
      <div className="toolbar">
        <select value={wf} onChange={(e) => setWf(e.target.value)} aria-label="Treballador">
          <option value="">Tots els treballadors</option>
          {sortWorkers(workers).map((w) => <option key={w.id} value={w.id}>{fullName(w)}</option>)}
        </select>
        <select value={tf} onChange={(e) => setTf(e.target.value)} aria-label="Tipus">
          <option value="">Restaurant i càtering</option>
          <option value="restaurant">Només restaurant</option>
          <option value="catering">Només càtering</option>
        </select>
        {!loading && <span className="muted sm">{rows.length} entrades · {num(total)} h</span>}
      </div>
      {loading && <Spinner />}
      {error && <ErrorBox msg={error} onRetry={reload} />}
      {data && !rows.length && <Empty>No hi ha entrades amb aquests filtres.</Empty>}
      {rows.length > 0 && (
        <div className="tw">
          <table>
            <thead><tr><th>Data</th><th>Treballador</th><th>Lloc</th><th>Feina</th><th>Horari</th><th className="r">Hores</th><th className="r">Km</th><th>Nota</th><th /></tr></thead>
            <tbody>
              {rows.map((h) => {
                const c = catMap.get(h.catering);
                return (
                  <tr key={h.id}>
                    <td>{dayShort(h.dia)} {fmtShort(h.dia)}</td>
                    <td>{names.get(h.treballador) || '(eliminat)'}</td>
                    <td><span className={`tag ${h.tipus === 'catering' ? 'blue' : ''}`}>{h.tipus === 'catering' ? 'Càtering' : 'Restaurant'}</span> {h.tipus === 'catering' ? (c ? `${c.client} - ${c.lloc}` : '') : h.lloc}</td>
                    <td>{h.feina}</td>
                    <td>{h.entrada} a {h.sortida}</td>
                    <td className="r">{num(h.hores)}</td>
                    <td className="r">{h.km ? num(h.km, 1) : ''}</td>
                    <td>{h.nota}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="link" onClick={() => setModal({ kind: h.tipus, initial: h })}>Editar</button>{' '}
                      <button className="link danger" onClick={() => del(h)}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={modal.initial ? 'Editar hores' : 'Afegir hores'} onClose={() => setModal(null)}>
          {!modal.initial && <Seg label="Tipus" value={modal.kind} onChange={(k) => setModal({ kind: k })} options={[['restaurant', 'Restaurant'], ['catering', 'Càtering']]} />}
          <HourForm
            key={modal.kind}
            kind={modal.kind}
            config={config}
            caterings={cats.data?.caterings || []}
            initial={modal.initial}
            workers={workers.filter((w) => w.actiu !== false || w.id === modal.initial?.treballador)}
            today={today}
            onSubmit={save}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      <p className="muted sm">Com a administrador pots afegir o corregir hores encara que la setmana estigui tancada.</p>
    </section>
  );
}
