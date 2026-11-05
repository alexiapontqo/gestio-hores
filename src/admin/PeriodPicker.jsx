import { Seg } from '../ui.jsx';
import { periodLabel, periodMonth, periodWeek } from '../util.js';

const same = (a, b) => a.from === b.from && a.to === b.to;

export default function PeriodPicker({ value, onChange, today }) {
  const m = value.mode;
  const step = (k) => onChange(m === 'setmana' ? periodWeek(value.from, k) : periodMonth(value.from, k));
  const chips = [
    ['Setmana passada', periodWeek(today, -1)],
    ['Aquesta setmana', periodWeek(today, 0)],
    ['Mes passat', periodMonth(today, -1)],
    ['Aquest mes', periodMonth(today, 0)],
  ];
  const mode = (x) => {
    if (x === 'setmana') onChange(periodWeek(value.from, 0));
    else if (x === 'mes') onChange(periodMonth(value.from, 0));
    else onChange({ mode: 'rang', from: value.from, to: value.to });
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="chips">
        {chips.map(([t, p]) => (
          <button key={t} className={`chip ${same(p, value) ? 'on' : ''}`} onClick={() => onChange(p)}>{t}</button>
        ))}
      </div>
      <div className="toolbar">
        <Seg label="Tipus de període" value={m} onChange={mode} options={[['setmana', 'Setmana'], ['mes', 'Mes'], ['rang', 'Personalitzat']]} />
        {m !== 'rang' ? (
          <div className="toolbar">
            <button className="sq" onClick={() => step(-1)} aria-label="Anterior">&larr;</button>
            <strong style={{ minWidth: 170, textAlign: 'center' }}>{periodLabel(value)}</strong>
            <button className="sq" onClick={() => step(1)} aria-label="Següent">&rarr;</button>
          </div>
        ) : (
          <div className="toolbar">
            <input type="date" aria-label="Des de" style={{ width: 160 }} value={value.from} onChange={(e) => e.target.value && onChange({ mode: 'rang', from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to })} />
            <span>a</span>
            <input type="date" aria-label="Fins a" style={{ width: 160 }} value={value.to} onChange={(e) => e.target.value && onChange({ mode: 'rang', from: value.from > e.target.value ? e.target.value : value.from, to: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}
