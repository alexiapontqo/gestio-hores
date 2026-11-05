import { useState } from 'react';
import { call } from '../api.js';
import HourForm from '../HourForm.jsx';
import { Empty, ErrorBox, Spinner, useLoad, useToast, WeekNav } from '../ui.jsx';
import { addDays, catLabel, cmp, fmtH, fmtLong, mondayOf, num, sumHores, weekLabel } from '../util.js';

export default function HoursTab({ config, today }) {
  const toast = useToast();
  const curWeek = mondayOf(today);
  const [week, setWeek] = useState(curWeek);
  const [form, setForm] = useState(null); // { kind, initial }
  const end = addDays(week, 6);
  const closed = (config.tancades || []).includes(week);

  const { data, loading, error, reload } = useLoad(async () => {
    const [hours, cats] = await Promise.all([call('w_hours', { from: week, to: end }), call('w_caterings', { from: week, to: end })]);
    return { hours, cats };
  }, [week]);

  async function remove(h) {
    if (!window.confirm('Vols eliminar aquesta entrada?')) return;
    try {
      await call('w_hour_delete', { id: h.id });
      toast('Entrada eliminada');
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  async function save(payload) {
    await call('w_hour_save', payload);
    toast('Hores guardades');
    setForm(null);
    reload();
  }

  if (form) {
    return (
      <div className="card">
        <HourForm
          kind={form.kind}
          config={config}
          caterings={data?.cats || []}
          initial={form.initial}
          today={today}
          bounds={{ min: week, max: end < today ? end : today }}
          onSubmit={save}
          onCancel={() => setForm(null)}
        />
      </div>
    );
  }

  const hours = (data?.hours || []).slice().sort((a, b) => cmp(a.dia, b.dia) || cmp(a.entrada, b.entrada));
  const catMap = new Map((data?.cats || []).map((c) => [c.id, c]));
  const byDay = {};
  hours.forEach((h) => (byDay[h.dia] = byDay[h.dia] || []).push(h));
  const totR = sumHores(hours.filter((h) => h.tipus === 'restaurant'));
  const totC = sumHores(hours.filter((h) => h.tipus === 'catering'));
  const km = hours.reduce((t, h) => t + (h.km || 0), 0);
  const showReminder = !closed && (week === curWeek || week === addDays(curWeek, -7));

  return (
    <>
      <div className="card">
        <WeekNav
          label={weekLabel(week)}
          onPrev={() => setWeek(addDays(week, -7))}
          onNext={() => setWeek(addDays(week, 7))}
          nextOff={week >= curWeek}
          sub={week === curWeek ? 'Aquesta setmana' : undefined}
        />
        <div className="total">
          <div className="lbl">Total hores setmana</div>
          <div className="val">{loading ? '...' : fmtH(totR + totC)}</div>
          {!loading && (totR > 0 || totC > 0) && (
            <div className="split">Restaurant {fmtH(totR)} · Càtering {fmtH(totC)}{km > 0 ? ` · ${num(km, 1)} km` : ''}</div>
          )}
        </div>
        {closed ? (
          <p className="closed">Aquesta setmana està tancada. Ja no es pot modificar. Si hi ha cap error, avisa l'administració.</p>
        ) : (
          <div className="two">
            <button className="btn green" onClick={() => setForm({ kind: 'restaurant' })}>+ Restaurant</button>
            <button className="btn blue" onClick={() => setForm({ kind: 'catering' })}>+ Càtering</button>
          </div>
        )}
      </div>

      {showReminder && <p className="reminder">Recorda registrar les hores abans de diumenge a la tarda.</p>}

      <div className="card">
        <h2>Historial setmana</h2>
        {loading && <Spinner />}
        {error && <ErrorBox msg={error} onRetry={reload} />}
        {!loading && !error && !hours.length && <Empty>Sense entrades aquesta setmana</Empty>}
        {Object.keys(byDay).map((d) => (
          <div className="day" key={d}>
            <h3>{fmtLong(d)}</h3>
            {byDay[d].map((h) => {
              const c = catMap.get(h.catering);
              return (
                <div key={h.id} className={`entry ${h.tipus === 'catering' ? 'cat' : ''}`}>
                  <div className="top">
                    <span>{h.tipus === 'catering' ? (c ? `${c.client} - ${c.lloc}` : 'Càtering') : h.lloc}</span>
                    <span>{fmtH(h.hores)}</span>
                  </div>
                  <div className="meta">
                    {h.feina} · {h.entrada} a {h.sortida}
                    {h.cotxe ? ` · cotxe propi, ${num(h.km, 1)} km` : ''}
                  </div>
                  {h.nota && <div className="meta">{h.nota}</div>}
                  {!closed && (
                    <div className="acts">
                      <button className="link" onClick={() => setForm({ kind: h.tipus, initial: h })}>Editar</button>
                      <button className="link danger" onClick={() => remove(h)}>Eliminar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
