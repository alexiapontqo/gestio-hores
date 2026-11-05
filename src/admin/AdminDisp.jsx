import { useMemo, useState } from 'react';
import { call } from '../api.js';
import { ErrorBox, Spinner, useLoad, WeekNav } from '../ui.jsx';
import { addDays, cmp, dayName, displayNames, fmtDM, mondayOf, weekLabel } from '../util.js';

export default function AdminDisp({ workers, today }) {
  const cur = mondayOf(today);
  const [week, setWeek] = useState(cur);
  const names = useMemo(() => displayNames(workers), [workers]);
  const { data, loading, error, reload } = useLoad(() => call('a_disp_rest', { from: week, to: addDays(week, 6) }), [week]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const who = (d, k) => (data || []).filter((x) => x.dia === d && x[k]).map((x) => names.get(x.treballador) || '(eliminat)').sort(cmp);

  return (
    <section className="card">
      <h2>Disponibilitat restaurant</h2>
      <p className="muted sm">Qui ha marcat que pot fer extres. La disponibilitat de càtering la veus dins de cada càtering (pestanya Càterings).</p>
      <WeekNav label={weekLabel(week)} sub={week === cur ? 'Aquesta setmana' : undefined} onPrev={() => setWeek(addDays(week, -7))} onNext={() => setWeek(addDays(week, 7))} />
      {loading && <Spinner />}
      {error && <ErrorBox msg={error} onRetry={reload} />}
      {data && (
        <div className="tw">
          <table>
            <thead><tr><th>Dia</th><th>Dinar</th><th>Sopar</th></tr></thead>
            <tbody>
              {days.map((d) => {
                const a = who(d, 'dinar');
                const b = who(d, 'sopar');
                return (
                  <tr key={d}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dayName(d)}<br /><span className="muted sm">{fmtDM(d)}</span></td>
                    <td><strong>{a.length || ''}</strong>{a.length > 0 && <div className="names cell-names">{a.map((n) => <span key={n} className="tag">{n}</span>)}</div>}</td>
                    <td><strong>{b.length || ''}</strong>{b.length > 0 && <div className="names cell-names">{b.map((n) => <span key={n} className="tag blue">{n}</span>)}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
