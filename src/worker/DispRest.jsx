import { useState } from 'react';
import { call } from '../api.js';
import { ErrorBox, Spinner, useLoad, useToast, WeekNav } from '../ui.jsx';
import { addDays, dayName, fmtDM, mondayOf, weekLabel } from '../util.js';

export default function DispRest({ today }) {
  const toast = useToast();
  const cur = mondayOf(today);
  const [week, setWeek] = useState(cur);
  const end = addDays(week, 6);
  const { data, loading, error, reload, setData } = useLoad(() => call('w_disp_rest', { from: week, to: end }), [week]);
  const [busy, setBusy] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const val = (d) => (data || []).find((x) => x.dia === d) || { dinar: false, sopar: false };

  async function setDay(d, next) {
    const prev = data;
    setData((rows) => [...(rows || []).filter((x) => x.dia !== d), { dia: d, ...next }]);
    try {
      await call('w_disp_rest_set', { dia: d, ...next });
    } catch (e) {
      setData(prev);
      toast(e.message, 'err');
    }
  }

  async function all(on) {
    setBusy(true);
    try {
      await Promise.all(days.filter((d) => d >= today).map((d) => call('w_disp_rest_set', { dia: d, dinar: on, sopar: on })));
      await reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <p className="muted sm">Marca els serveis en què pots fer extres al restaurant. Es guarda automàticament.</p>
      <WeekNav
        label={weekLabel(week)}
        sub={week === cur ? 'Aquesta setmana' : undefined}
        onPrev={() => setWeek(addDays(week, -7))}
        onNext={() => setWeek(addDays(week, 7))}
        prevOff={week <= cur}
        nextOff={week >= addDays(cur, 7 * 12)}
      />
      {loading && <Spinner />}
      {error && <ErrorBox msg={error} onRetry={reload} />}
      {data && (
        <>
          <div>
            {days.map((d) => {
              const v = val(d);
              const past = d < today;
              return (
                <div className={`avrow ${past ? 'past' : ''}`} key={d}>
                  <div className="d">
                    {dayName(d)}
                    <small>{fmtDM(d)}</small>
                  </div>
                  <div className="tg">
                    <button className={v.dinar ? 'on' : ''} disabled={past} aria-pressed={!!v.dinar} onClick={() => setDay(d, { dinar: !v.dinar, sopar: !!v.sopar })}>Dinar</button>
                    <button className={v.sopar ? 'on' : ''} disabled={past} aria-pressed={!!v.sopar} onClick={() => setDay(d, { dinar: !!v.dinar, sopar: !v.sopar })}>Sopar</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="two">
            <button className="btn sm" disabled={busy} onClick={() => all(true)}>Marcar tota la setmana</button>
            <button className="btn sm" disabled={busy} onClick={() => all(false)}>Esborrar la setmana</button>
          </div>
        </>
      )}
    </div>
  );
}
