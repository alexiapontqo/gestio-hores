import { useMemo, useState } from 'react';
import { call } from '../api.js';
import { Empty, ErrorBox, Spinner, useLoad, useToast } from '../ui.jsx';
import { cmp, defaultPeriod, displayNames, euro, fmtH, num, sumHores } from '../util.js';
import PeriodPicker from './PeriodPicker.jsx';

export default function Resum({ workers, config, setConfig, today }) {
  const toast = useToast();
  const [period, setPeriod] = useState(() => defaultPeriod(today));
  const [busy, setBusy] = useState(false);
  const days = (Date.parse(period.to) - Date.parse(period.from)) / 86400000;
  const tooLong = days > 360;

  const { data, loading, error, reload } = useLoad(async () => {
    if (tooLong) return { hours: [], caterings: [] };
    const [hours, c] = await Promise.all([call('a_hours', { from: period.from, to: period.to }), call('a_caterings', { from: period.from, to: period.to })]);
    return { hours, caterings: c.caterings };
  }, [period.from, period.to]);

  const names = useMemo(() => displayNames(workers), [workers]);
  const wMap = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers]);
  const preuKm = Number(config.preu_km) || 0;

  const rows = useMemo(() => {
    const m = new Map();
    for (const h of data?.hours || []) {
      const a = m.get(h.treballador) || { id: h.treballador, r: 0, c: 0, km: 0 };
      if (h.tipus === 'catering') a.c += h.hores;
      else a.r += h.hores;
      a.km += h.km || 0;
      m.set(h.treballador, a);
    }
    return [...m.values()]
      .map((a) => ({ ...a, name: names.get(a.id) || '(eliminat)', amount: (a.r + a.c) * (Number(wMap.get(a.id)?.preu_hora) || 0) + a.km * preuKm }))
      .sort((x, y) => cmp(x.name, y.name));
  }, [data, names, wMap, preuKm]);

  const totR = rows.reduce((t, r) => t + r.r, 0);
  const totC = rows.reduce((t, r) => t + r.c, 0);
  const totKm = rows.reduce((t, r) => t + r.km, 0);
  const totAmt = rows.reduce((t, r) => t + r.amount, 0);
  const isWeek = period.mode === 'setmana';
  const closed = isWeek && (config.tancades || []).includes(period.from);

  async function download() {
    setBusy(true);
    try {
      const { downloadExcel } = await import('../excel.js');
      const fn = downloadExcel({ from: period.from, to: period.to, workers, hours: data.hours, caterings: data.caterings, config });
      toast(`Excel descarregat: ${fn}`);
    } catch (e) {
      console.error(e);
      toast('No s\'ha pogut crear l\'Excel. Torna-ho a provar.', 'err');
    }
    setBusy(false);
  }

  async function toggleClose() {
    const msg = closed
      ? 'Vols reobrir aquesta setmana? Els treballadors podran tornar a modificar-la.'
      : 'Vols tancar aquesta setmana? Els treballadors ja no podran afegir ni canviar hores d\'aquesta setmana.';
    if (!window.confirm(msg)) return;
    try {
      const r = await call('a_week_close', { week: period.from, closed: !closed });
      setConfig({ ...config, tancades: r.tancades });
      toast(closed ? 'Setmana reoberta' : 'Setmana tancada');
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  return (
    <>
      <section className="card excel">
        <div className="ch"><h2>Descarregar Excel</h2></div>
        <PeriodPicker value={period} onChange={setPeriod} today={today} />
        {tooLong && <p className="warn">El període és massa llarg (màxim un any).</p>}
        <button className="btn green big full" disabled={busy || loading || !!error || tooLong || !rows.length} onClick={download}>
          {loading ? 'Carregant...' : busy ? 'Preparant...' : 'Descarregar Excel'}
        </button>
        {!loading && !error && !tooLong && !rows.length && <p className="muted sm">No hi ha cap hora registrada en aquest període.</p>}
        {!loading && rows.length > 0 && (
          <p className="muted sm">L'Excel inclou 3 fulls: <strong>Resum</strong> (una fila per treballador, amb l'import a pagar), <strong>Detall</strong> (cada entrada) i <strong>Caterings</strong>.</p>
        )}
      </section>

      <section className="card">
        <div className="ch">
          <h2>Resum del període</h2>
          {isWeek && <button className="btn sm" onClick={toggleClose}>{closed ? 'Reobrir setmana' : 'Tancar setmana'}</button>}
        </div>
        {closed && <p className="closed">Setmana tancada: els treballadors no la poden modificar.</p>}
        {loading && <Spinner />}
        {error && <ErrorBox msg={error} onRetry={reload} />}
        {!loading && !error && (
          <>
            <div className="stats">
              <div className="stat"><div className="k">Treballadors</div><div className="v">{rows.length}</div></div>
              <div className="stat"><div className="k">Hores restaurant</div><div className="v">{num(totR)}</div></div>
              <div className="stat"><div className="k">Hores càtering</div><div className="v">{num(totC)}</div></div>
              <div className="stat"><div className="k">Km</div><div className="v">{num(totKm, 1)}</div></div>
              <div className="stat"><div className="k">Import estimat</div><div className="v">{euro(totAmt)}</div></div>
            </div>
            {!rows.length ? <Empty>Sense hores en aquest període.</Empty> : (
              <div className="tw">
                <table>
                  <thead>
                    <tr><th>Treballador</th><th className="r">Restaurant</th><th className="r">Càtering</th><th className="r">Total</th><th className="r">Km</th><th className="r">Import</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td className="r">{num(r.r)}</td>
                        <td className="r">{num(r.c)}</td>
                        <td className="r"><strong>{num(r.r + r.c)}</strong></td>
                        <td className="r">{r.km ? num(r.km, 1) : ''}</td>
                        <td className="r">{euro(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td>Total</td><td className="r">{num(totR)}</td><td className="r">{num(totC)}</td><td className="r">{num(totR + totC)}</td><td className="r">{num(totKm, 1)}</td><td className="r">{euro(totAmt)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="muted sm">Hores en decimal ({fmtH(1.5)} = 1,5). L'import usa el preu per hora de cada treballador i {euro(preuKm)} per km (es canvia a Configuració).</p>
          </>
        )}
      </section>
    </>
  );
}
