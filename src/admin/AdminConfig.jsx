import { useState } from 'react';
import { call } from '../api.js';
import { Field, useToast } from '../ui.jsx';
import { fmtDM, addDays } from '../util.js';

function ListEditor({ title, hint, items, onChange, placeholder }) {
  const [v, setV] = useState('');
  const add = () => {
    const t = v.trim();
    if (t && !items.includes(t)) onChange([...items, t]);
    setV('');
  };
  return (
    <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
      <h2>{title}</h2>
      {hint && <p className="muted sm">{hint}</p>}
      <div className="chips">
        {items.map((i) => (
          <span className="chip x" key={i}>{i}<button aria-label={`Treure ${i}`} onClick={() => onChange(items.filter((x) => x !== i))}>&times;</button></span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button className="btn" onClick={add}>Afegir</button>
      </div>
    </div>
  );
}

export default function AdminConfig({ config, setConfig }) {
  const toast = useToast();
  const [restaurants, setR] = useState(config.restaurants);
  const [feines, setF] = useState(config.feines);
  const [km, setKm] = useState(String(config.preu_km));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const c = await call('a_config_save', { restaurants, feines, preu_km: Number(km) });
      setConfig(c);
      toast('Configuració guardada');
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }
  async function reopen(w) {
    try {
      const r = await call('a_week_close', { week: w, closed: false });
      setConfig({ ...config, tancades: r.tancades });
      toast('Setmana reoberta');
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  return (
    <section className="card">
      <h2>Configuració</h2>
      <ListEditor title="Restaurants" hint="Els treballadors trien un d'aquests quan registren hores de restaurant." items={restaurants} onChange={setR} placeholder="Nom del restaurant" />
      <ListEditor title="Feines" hint="Llista de feines que poden triar (sala, cuina, barra...)." items={feines} onChange={setF} placeholder="Nova feina" />
      <Field label="Preu per km (€)" hint="S'aplica als km amb cotxe propi dels càterings. Es veu a l'Excel."><input type="number" step="0.01" min="0" value={km} onChange={(e) => setKm(e.target.value)} style={{ maxWidth: 160 }} /></Field>
      <button className="btn green" onClick={save} disabled={busy}>{busy ? 'Guardant...' : 'Guardar configuració'}</button>
      <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
        <h2>Setmanes tancades</h2>
        {!(config.tancades || []).length ? <p className="muted sm">Cap setmana tancada. Es tanquen des de la pestanya Resum.</p> : (
          [...config.tancades].sort().reverse().map((w) => (
            <div className="avrow" key={w}><span>{fmtDM(w)} a {fmtDM(addDays(w, 6))}</span><button className="btn sm" onClick={() => reopen(w)}>Reobrir</button></div>
          ))
        )}
      </div>
      <p className="muted sm">La contrasenya de l'administrador es canvia a Vercel (variable ADMIN_PASSWORD).</p>
    </section>
  );
}
