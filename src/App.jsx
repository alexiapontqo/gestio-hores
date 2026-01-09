import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nrfzusafylgyxbklzitm.supabase.co',
  'sb_publishable_F3IZ0QQPqDdnoZE8zEHz9g_2kDZ-1yd'
);

const ADMIN_PASSWORD = '15ous';

const sortWorkers = (workers) => {
  return [...workers].sort((a, b) => {
    const nameA = `${a.name} ${a.surname1} ${a.surname2 || ''}`.trim();
    const nameB = `${b.name} ${b.surname1} ${b.surname2 || ''}`.trim();
    return nameA.localeCompare(nameB, 'ca');
  });
};

export default function App() {
  const [view, setView] = useState('menu');
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ workers: [], locations: [], entries: [], nextPin: 1041 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [w, l, e, c] = await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('entries').select('*'),
      supabase.from('config').select('*').eq('key', 'nextPin').single()
    ]);
    setData({
      workers: sortWorkers((w.data || []).map(x => ({...x, surname1: x.surname1, surname2: x.surname2 || ''}))),
      locations: (l.data || []).map(x => ({...x, prices: x.prices || {migdia:60,vespre:60,both:120}})),
      entries: (e.data || []).map(x => ({
        id: x.id, odId: x.od_id, name: x.name, date: x.date, locId: x.loc_id, locName: x.loc_name,
        type: x.type, shift: x.shift, job: x.job, horaIn: x.hora_in, horaOut: x.hora_out,
        horaIn2: x.hora_in2, horaOut2: x.hora_out2, horari: x.horari, hours: x.hours,
        rate: x.rate, customRate: x.custom_rate, plus: x.plus || 0, total: x.total,
        note: x.note, car: x.car, km: x.km || 0, kmCost: x.km_cost || 0
      })),
      nextPin: c.data ? parseInt(c.data.value) : 1041
    });
    setLoading(false);
  };

  const save = async (newData) => { setData(newData); };

  if (loading) return <div className="p-8 text-center">Carregant...</div>;
  if (view === 'menu') return <Menu onWorker={() => setView('pin')} onAdmin={() => setView('adminLogin')} />;
  if (view === 'adminLogin') return <AdminLogin onBack={() => setView('menu')} onOk={() => setView('admin')} />;
  if (view === 'pin') return <Pin data={data} onBack={() => setView('menu')} onOk={w => { setUser(w); setView('worker'); }} />;
  if (view === 'worker') return <Worker user={user} data={data} save={save} reload={loadData} onOut={() => { setUser(null); setView('menu'); }} />;
  return <Admin data={data} save={save} reload={loadData} onOut={() => setView('menu')} />;
}

function Menu({ onWorker, onAdmin }) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow p-6 w-full max-w-xs text-center">
        <h1 className="text-xl font-bold mb-6">Gestió d'Hores</h1>
        <button onClick={onWorker} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold mb-3">Treballador</button>
        <button onClick={onAdmin} className="w-full bg-gray-700 text-white py-4 rounded-lg font-bold">Administrador</button>
      </div>
    </div>
  );
}

function AdminLogin({ onBack, onOk }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    if (pass === ADMIN_PASSWORD) onOk();
    else { setErr('Contrasenya incorrecta'); setPass(''); }
  };
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow p-6 w-full max-w-xs">
        <button onClick={onBack} className="text-gray-500 mb-4">← Tornar</button>
        <h1 className="text-xl font-bold text-center mb-4">Admin</h1>
        <input type="password" placeholder="Contrasenya" value={pass} onChange={e => { setPass(e.target.value); setErr(''); }} className="w-full p-4 border-2 rounded-lg text-center text-xl mb-3" />
        {err && <p className="text-red-500 text-center mb-3">{err}</p>}
        <button onClick={go} className="w-full bg-gray-700 text-white py-4 rounded-lg font-bold">Entrar</button>
      </div>
    </div>
  );
}

function Pin({ data, onBack, onOk }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    const w = data.workers.find(x => x.pin === pin);
    if (w) onOk(w); else { setErr('PIN incorrecte'); setPin(''); }
  };
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow p-6 w-full max-w-xs">
        <button onClick={onBack} className="text-gray-500 mb-4">← Tornar</button>
        <h1 className="text-xl font-bold text-center mb-4">PIN</h1>
        <input type="password" inputMode="numeric" value={pin} onChange={e => { setPin(e.target.value); setErr(''); }} className="w-full p-4 border-2 rounded-lg text-center text-2xl mb-3" maxLength="4" />
        {err && <p className="text-red-500 text-center mb-3">{err}</p>}
        <button onClick={go} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold">Entrar</button>
      </div>
    </div>
  );
}

function Worker({ user, data, save, reload, onOut }) {
  const [mode, setMode] = useState('list');
  const [form, setForm] = useState({ date: '', locId: '', shift: '', job: '', h1: '', h2: '', h3: '', h4: '', note: '', car: false, km: '' });
  const [delId, setDelId] = useState(null);
  const [saving, setSaving] = useState(false);

  const jobs = ['Cuina', 'Sala', 'Neteja', 'Producció', 'Muntatge'];
  const rests = data.locations.filter(l => l.type === 'restaurant');
  const cats = data.locations.filter(l => l.type === 'catering' && l.active);
  const mine = data.entries.filter(e => e.odId === user.id).sort((a, b) => b.date.localeCompare(a.date));
  const loc = data.locations.find(l => l.id === form.locId);
  const totalH = mine.reduce((s, e) => s + (e.hours || 0), 0);
  const shifts = { migdia: 'Migdia', vespre: 'Vespre', both: 'Migdia+Vespre', extra: 'Hores extres' };

  const getH = () => {
    if (form.shift === 'both') {
      if (!form.h1 || !form.h2 || !form.h3 || !form.h4) return 0;
      const [a1, b1] = form.h1.split(':').map(Number);
      const [c1, d1] = form.h2.split(':').map(Number);
      const [a2, b2] = form.h3.split(':').map(Number);
      const [c2, d2] = form.h4.split(':').map(Number);
      let m1 = (c1 * 60 + d1) - (a1 * 60 + b1);
      let m2 = (c2 * 60 + d2) - (a2 * 60 + b2);
      if (m1 < 0) m1 += 1440;
      if (m2 < 0) m2 += 1440;
      return Math.round((m1 + m2) / 6) / 10;
    }
    if (!form.h1 || !form.h2) return 0;
    const [a, b] = form.h1.split(':').map(Number);
    const [c, d] = form.h2.split(':').map(Number);
    let m = (c * 60 + d) - (a * 60 + b);
    if (m < 0) m += 1440;
    return Math.round(m / 6) / 10;
  };
  const hrs = getH();

  const addRest = async () => {
    if (!form.date || !form.locId || !form.shift || !form.job) return alert('Omple tot');
    if (form.shift === 'both') { if (!form.h1 || !form.h2 || !form.h3 || !form.h4) return alert('Omple totes les hores'); }
    else { if (!form.h1 || !form.h2) return alert('Omple les hores'); }
    setSaving(true);
    const p = loc?.prices || { migdia: 60, vespre: 60, both: 120 };
    const horari = form.shift === 'both' ? form.h1 + '-' + form.h2 + ' / ' + form.h3 + '-' + form.h4 : form.h1 + '-' + form.h2;
    await supabase.from('entries').insert([{ id: Date.now() + '', od_id: user.id, name: user.name, date: form.date, loc_id: form.locId, loc_name: loc?.name || '', type: 'restaurant', shift: form.shift, job: form.job, hora_in: form.h1, hora_out: form.h2, hora_in2: form.h3 || null, hora_out2: form.h4 || null, horari, hours: hrs, rate: user.rate, total: form.shift === 'extra' ? hrs * user.rate : p[form.shift], note: form.note }]);
    await reload();
    setForm({ date: '', locId: '', shift: '', job: '', h1: '', h2: '', h3: '', h4: '', note: '', car: false, km: '' });
    setMode('list');
    setSaving(false);
  };

  const addCat = async () => {
    if (!form.date || !form.locId || !form.job || !form.h1 || !form.h2) return alert('Omple tot');
    setSaving(true);
    const km = form.car ? parseFloat(form.km || 0) : 0;
    await supabase.from('entries').insert([{ id: Date.now() + '', od_id: user.id, name: user.name, date: form.date, loc_id: form.locId, loc_name: loc?.name || '', type: 'catering', job: form.job, hora_in: form.h1, hora_out: form.h2, hours: hrs, rate: user.rate, car: form.car, km, km_cost: km * 0.26, total: hrs * user.rate + km * 0.26, note: form.note }]);
    await reload();
    setForm({ date: '', locId: '', shift: '', job: '', h1: '', h2: '', h3: '', h4: '', note: '', car: false, km: '' });
    setMode('list');
    setSaving(false);
  };

  const del = async (id) => { await supabase.from('entries').delete().eq('id', id); await reload(); setDelId(null); };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-600 text-white p-4 flex justify-between">
        <span className="font-bold">{user.name} {user.surname1}</span>
        <button onClick={onOut} className="bg-white text-green-600 px-3 py-1 rounded">Sortir</button>
      </div>
      <div className="p-3 max-w-md mx-auto">
        {mode === 'list' && <>
          <div className="bg-white rounded-lg shadow p-4 mb-3">
            <p className="text-gray-500 text-sm">Total hores</p>
            <p className="text-3xl font-bold text-green-600 mb-3">{totalH}h</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setMode('rest'); setForm({ ...form, date: new Date().toISOString().split('T')[0] }); }} className="bg-green-600 text-white p-3 rounded-lg">+ Restaurant</button>
              <button onClick={() => { setMode('cat'); setForm({ ...form, date: new Date().toISOString().split('T')[0] }); }} className="bg-blue-600 text-white p-3 rounded-lg">+ Càtering</button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow">
            <h2 className="p-3 font-bold border-b">Historial</h2>
            {mine.length === 0 ? <p className="p-4 text-gray-400">Sense entrades</p> : mine.map(e => (
              <div key={e.id} className="p-3 border-b">
                {delId === e.id ? (
                  <div className="bg-red-50 p-3 rounded flex gap-2">
                    <button onClick={() => del(e.id)} className="bg-red-500 text-white px-4 py-2 rounded">Sí</button>
                    <button onClick={() => setDelId(null)} className="bg-gray-300 px-4 py-2 rounded">No</button>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{e.locName}</p>
                      <p className="text-sm text-gray-500">{e.date} · {e.job}</p>
                      <p className="text-xs text-gray-400">{e.horari || (e.horaIn + '-' + e.horaOut)} ({e.hours}h)</p>
                      {e.shift && <p className="text-xs text-blue-600">{shifts[e.shift]}</p>}
                      {e.km > 0 && <p className="text-xs text-gray-400">🚗 {e.km}km</p>}
                      {e.note && <p className="text-xs text-purple-600">📝 {e.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{e.hours}h</p>
                      <button onClick={() => setDelId(e.id)} className="text-red-500 text-sm">Eliminar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>}
        {mode === 'rest' && (
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h2 className="font-bold">Restaurant</h2>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full p-3 border rounded-lg" />
            <select value={form.locId} onChange={e => setForm({ ...form, locId: e.target.value })} className="w-full p-3 border rounded-lg">
              <option value="">Lloc...</option>
              {rests.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {form.locId && <div className="grid grid-cols-2 gap-2">
              {['migdia', 'vespre', 'both', 'extra'].map(s => (
                <button key={s} onClick={() => setForm({ ...form, shift: s, h3: '', h4: '' })} className={`p-2 rounded border text-sm ${form.shift === s ? 'bg-green-600 text-white' : ''}`}>
                  {shifts[s]}{s !== 'extra' && loc?.prices && <span className="block text-xs">{loc.prices[s]}€</span>}
                </button>
              ))}
            </div>}
            <select value={form.job} onChange={e => setForm({ ...form, job: e.target.value })} className="w-full p-3 border rounded-lg">
              <option value="">Feina...</option>
              {jobs.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">{form.shift === 'both' ? 'Entrada migdia' : 'Entrada'}</label><input type="time" value={form.h1} onChange={e => setForm({ ...form, h1: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="text-xs text-gray-500">{form.shift === 'both' ? 'Sortida migdia' : 'Sortida'}</label><input type="time" value={form.h2} onChange={e => setForm({ ...form, h2: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
            </div>
            {form.shift === 'both' && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500">Entrada vespre</label><input type="time" value={form.h3} onChange={e => setForm({ ...form, h3: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
                <div><label className="text-xs text-gray-500">Sortida vespre</label><input type="time" value={form.h4} onChange={e => setForm({ ...form, h4: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              </div>
            )}
            {hrs > 0 && <p className="bg-green-100 p-2 rounded text-center">Total: {hrs}h</p>}
            <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full p-3 border rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('list')} className="p-3 bg-gray-200 rounded-lg">Cancel·lar</button>
              <button onClick={addRest} disabled={saving} className="p-3 bg-green-600 text-white rounded-lg">{saving ? 'Guardant...' : 'Guardar'}</button>
            </div>
          </div>
        )}
        {mode === 'cat' && (
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h2 className="font-bold">Càtering</h2>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full p-3 border rounded-lg" />
            <select value={form.locId} onChange={e => setForm({ ...form, locId: e.target.value })} className="w-full p-3 border rounded-lg">
              <option value="">Càtering...</option>
              {cats.length === 0 ? <option disabled>No n'hi ha</option> : cats.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={form.job} onChange={e => setForm({ ...form, job: e.target.value })} className="w-full p-3 border rounded-lg">
              <option value="">Feina...</option>
              {jobs.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500">Sortida</label><input type="time" value={form.h1} onChange={e => setForm({ ...form, h1: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="text-xs text-gray-500">Tornada</label><input type="time" value={form.h2} onChange={e => setForm({ ...form, h2: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
            </div>
            {hrs > 0 && <p className="bg-blue-100 p-2 rounded text-center">Total: {hrs}h</p>}
            <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <input type="checkbox" checked={form.car} onChange={e => setForm({ ...form, car: e.target.checked })} className="w-5 h-5" />
              <span>Cotxe propi</span>
            </label>
            {form.car && <input type="number" placeholder="Km" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} className="w-full p-3 border rounded-lg" />}
            <input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full p-3 border rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('list')} className="p-3 bg-gray-200 rounded-lg">Cancel·lar</button>
              <button onClick={addCat} disabled={saving} className="p-3 bg-green-600 text-white rounded-lg">{saving ? 'Guardant...' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Admin({ data, save, reload, onOut }) {
  const [tab, setTab] = useState('resum');
  const [period, setPeriod] = useState('setmana');
  const [off, setOff] = useState(0);
  const [by, setBy] = useState('worker');
  const [nw, setNw] = useState({ n: '', s1: '', s2: '', r: 12 });
  const [nc, setNc] = useState({ n: '', d: '' });
  const [editId, setEditId] = useState(null);
  const [editV, setEditV] = useState({});
  const [delId, setDelId] = useState(null);
  const [editW, setEditW] = useState(null);
  const [editWV, setEditWV] = useState({});
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const ws = new Date(now); ws.setDate(now.getDate() - now.getDay() + 1 + off * 7);
  const we = new Date(ws); we.setDate(ws.getDate() + 6);
  const ms = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const me = new Date(now.getFullYear(), now.getMonth() + off + 1, 0);

  const ents = data.entries.filter(e => { const d = new Date(e.date); return period === 'setmana' ? d >= ws && d <= we : d >= ms && d <= me; });
  const calc = e => (e.hours * (e.customRate || e.rate)) + (e.kmCost || 0) + (e.plus || 0);
  const fmt = d => d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });

  const sortedWorkers = sortWorkers(data.workers);
  const byW = sortedWorkers.map(w => ({ w, ent: ents.filter(e => e.odId === w.id) })).filter(x => x.ent.length);
  const byL = data.locations.map(l => ({ l, ent: ents.filter(e => e.locId === l.id) })).filter(x => x.ent.length);

  const addW = async () => {
    if (!nw.n || !nw.s1) return alert('Omple nom i primer cognom');
    setSaving(true);
    const pin = data.nextPin.toString().padStart(4, '0');
    await supabase.from('workers').insert([{ id: Date.now() + '', name: nw.n.toUpperCase(), surname1: nw.s1.toUpperCase(), surname2: nw.s2 ? nw.s2.toUpperCase() : '', pin, rate: +nw.r }]);
    await supabase.from('config').update({ value: (data.nextPin + 1).toString() }).eq('key', 'nextPin');
    await reload();
    setNw({ n: '', s1: '', s2: '', r: 12 });
    alert('PIN: ' + pin);
    setSaving(false);
  };

  const updW = async (id) => {
    setSaving(true);
    await supabase.from('workers').update({ name: editWV.n.toUpperCase(), surname1: editWV.s1.toUpperCase(), surname2: editWV.s2 ? editWV.s2.toUpperCase() : '', rate: +editWV.r }).eq('id', id);
    await reload();
    setEditW(null);
    setSaving(false);
  };

  const delW = async (id) => { await supabase.from('workers').delete().eq('id', id); await reload(); };

  const addC = async () => {
    if (!nc.n || !nc.d) return alert('Omple tot');
    setSaving(true);
    await supabase.from('locations').insert([{ id: Date.now() + '', name: nc.n + ' - ' + nc.d, date: nc.d, type: 'catering', active: true }]);
    await reload();
    setNc({ n: '', d: '' });
    setSaving(false);
  };

  const toggleLoc = async (id, active) => { await supabase.from('locations').update({ active: !active }).eq('id', id); await reload(); };
  const delLoc = async (id) => { await supabase.from('locations').delete().eq('id', id); await reload(); };

  const exp = () => {
    let c = '\uFEFF' + 'LLOC;NOM;DATA;HORES;TOTAL\n';
    ents.forEach(e => { c += e.locName + ';' + e.name + ';' + e.date + ';' + e.hours + ';' + calc(e).toFixed(2) + '\n'; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv' })); a.download = 'hores.csv'; a.click();
  };

  const del = async (id) => { await supabase.from('entries').delete().eq('id', id); await reload(); setDelId(null); };
  const upd = async (id) => {
    setSaving(true);
    await supabase.from('entries').update({ hours: editV.h, custom_rate: editV.r, plus: editV.p }).eq('id', id);
    await reload();
    setEditId(null);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-700 text-white p-4 flex justify-between">
        <span className="font-bold">Admin</span>
        <button onClick={onOut} className="bg-white text-gray-700 px-3 py-1 rounded">Sortir</button>
      </div>
      <div className="p-3 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow mb-3 flex">
          {['resum', 'treballadors', 'caterings'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm ${tab === t ? 'border-b-2 border-gray-700 font-bold' : 'text-gray-400'}`}>{t}</button>
          ))}
        </div>
        {tab === 'resum' && <div className="space-y-3">
          <div className="bg-white rounded-lg shadow p-3 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => { setPeriod('setmana'); setOff(0); }} className={`flex-1 py-2 rounded ${period === 'setmana' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Setmana</button>
              <button onClick={() => { setPeriod('mes'); setOff(0); }} className={`flex-1 py-2 rounded ${period === 'mes' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Mes</button>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={() => setOff(off - 1)} className="px-4 py-2 bg-gray-200 rounded">←</button>
              <span className="font-bold text-sm">{period === 'setmana' ? fmt(ws) + ' - ' + fmt(we) : ms.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setOff(off + 1)} className="px-4 py-2 bg-gray-200 rounded">→</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBy('worker')} className={`flex-1 py-2 rounded text-sm ${by === 'worker' ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}>Treballador</button>
              <button onClick={() => setBy('lloc')} className={`flex-1 py-2 rounded text-sm ${by === 'lloc' ? 'bg-gray-700 text-white' : 'bg-gray-200'}`}>Lloc</button>
            </div>
            <button onClick={exp} className="w-full bg-green-600 text-white py-3 rounded-lg">📥 CSV</button>
          </div>
          {by === 'worker' && byW.map(({ w, ent }) => (
            <div key={w.id} className="bg-white rounded-lg shadow">
              <div className="p-3 bg-gray-50 flex justify-between border-b">
                <span className="font-bold">{w.name} {w.surname1}</span>
                <span className="font-bold text-green-600">{ent.reduce((s, e) => s + calc(e), 0).toFixed(2)}€</span>
              </div>
              {ent.map(e => (
                <div key={e.id} className="p-3 border-b">
                  {delId === e.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => del(e.id)} className="bg-red-500 text-white px-3 py-1 rounded">Sí</button>
                      <button onClick={() => setDelId(null)} className="bg-gray-200 px-3 py-1 rounded">No</button>
                    </div>
                  ) : editId === e.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-xs">Hores</label><input type="number" value={editV.h} onChange={x => setEditV({ ...editV, h: +x.target.value })} className="w-full p-2 border rounded" /></div>
                        <div><label className="text-xs">€/h</label><input type="number" value={editV.r} onChange={x => setEditV({ ...editV, r: +x.target.value })} className="w-full p-2 border rounded" /></div>
                        <div><label className="text-xs">Plus</label><input type="number" value={editV.p} onChange={x => setEditV({ ...editV, p: +x.target.value })} className="w-full p-2 border rounded" /></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => upd(e.id)} disabled={saving} className="bg-green-600 text-white px-3 py-1 rounded">{saving ? '...' : 'OK'}</button>
                        <button onClick={() => setEditId(null)} className="bg-gray-200 px-3 py-1 rounded">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <div><p className="font-medium">{e.locName}</p><p className="text-sm text-gray-500">{e.date} · {e.hours}h</p></div>
                      <div className="text-right">
                        <p className="font-bold">{calc(e).toFixed(2)}€</p>
                        <button onClick={() => { setEditId(e.id); setEditV({ h: e.hours, r: e.customRate || e.rate, p: e.plus || 0 }); }} className="text-blue-500 text-xs mr-1">Editar</button>
                        <button onClick={() => setDelId(e.id)} className="text-red-500 text-xs">Elim</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {by === 'lloc' && byL.map(({ l, ent }) => (
            <div key={l.id} className="bg-white rounded-lg shadow">
              <div className="p-3 bg-gray-50 flex justify-between border-b">
                <span className="font-bold">{l.name}</span>
                <span className="font-bold text-green-600">{ent.reduce((s, e) => s + calc(e), 0).toFixed(2)}€</span>
              </div>
              {ent.map(e => (
                <div key={e.id} className="p-3 border-b flex justify-between">
                  <div><p className="font-medium">{e.name}</p><p className="text-sm text-gray-500">{e.date} · {e.hours}h</p></div>
                  <p className="font-bold">{calc(e).toFixed(2)}€</p>
                </div>
              ))}
            </div>
          ))}
          {ents.length === 0 && <p className="bg-white rounded-lg shadow p-6 text-center text-gray-400">Sense entrades</p>}
        </div>}
        {tab === 'treballadors' && <div className="space-y-3">
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            <input placeholder="Nom" value={nw.n} onChange={e => setNw({ ...nw, n: e.target.value })} className="w-full p-3 border rounded" />
            <div className="flex gap-2">
              <input placeholder="1r cognom" value={nw.s1} onChange={e => setNw({ ...nw, s1: e.target.value })} className="flex-1 p-3 border rounded" />
              <input placeholder="2n cognom" value={nw.s2} onChange={e => setNw({ ...nw, s2: e.target.value })} className="flex-1 p-3 border rounded" />
            </div>
            <div className="flex gap-2">
              <div className="w-24"><label className="text-xs text-gray-500">€/hora</label><input type="number" value={nw.r} onChange={e => setNw({ ...nw, r: e.target.value })} className="w-full p-3 border rounded" /></div>
              <button onClick={addW} disabled={saving} className="flex-1 bg-green-600 text-white p-3 rounded">{saving ? 'Creant...' : 'Crear'}</button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow divide-y">
            {sortedWorkers.map(w => (
              <div key={w.id} className="p-4">
                {editW === w.id ? (
                  <div className="space-y-2">
                    <input value={editWV.n} onChange={e => setEditWV({ ...editWV, n: e.target.value })} className="w-full p-2 border rounded" placeholder="Nom" />
                    <div className="flex gap-2">
                      <input value={editWV.s1} onChange={e => setEditWV({ ...editWV, s1: e.target.value })} className="flex-1 p-2 border rounded" placeholder="1r cognom" />
                      <input value={editWV.s2} onChange={e => setEditWV({ ...editWV, s2: e.target.value })} className="flex-1 p-2 border rounded" placeholder="2n cognom" />
                    </div>
                    <div className="flex gap-2">
                      <input type="number" value={editWV.r} onChange={e => setEditWV({ ...editWV, r: e.target.value })} className="w-20 p-2 border rounded" />
                      <button onClick={() => updW(w.id)} disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">{saving ? '...' : 'Guardar'}</button>
                      <button onClick={() => setEditW(null)} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <div><p className="font-medium">{w.name} {w.surname1} {w.surname2}</p><p className="text-sm text-gray-500">PIN: {w.pin} · {w.rate}€/h</p></div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditW(w.id); setEditWV({ n: w.name, s1: w.surname1, s2: w.surname2 || '', r: w.rate }); }} className="text-blue-500">Editar</button>
                      <button onClick={() => delW(w.id)} className="text-red-500">Elim</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>}
        {tab === 'caterings' && <div className="space-y-3">
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            <input placeholder="Nom" value={nc.n} onChange={e => setNc({ ...nc, n: e.target.value })} className="w-full p-3 border rounded" />
            <div className="flex gap-2">
              <input type="date" value={nc.d} onChange={e => setNc({ ...nc, d: e.target.value })} className="flex-1 p-3 border rounded" />
              <button onClick={addC} disabled={saving} className="bg-green-600 text-white px-6 rounded">{saving ? '...' : '+'}</button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow divide-y">
            {data.locations.filter(l => l.type === 'restaurant').map(l => (
              <div key={l.id} className="p-4 flex justify-between"><span>{l.name}</span><span className="text-green-600 text-sm">Restaurant</span></div>
            ))}
            {data.locations.filter(l => l.type === 'catering').map(c => (
              <div key={c.id} className="p-4 flex justify-between">
                <span>{c.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => toggleLoc(c.id, c.active)} className={`px-2 py-1 rounded text-xs ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>{c.active ? 'On' : 'Off'}</button>
                  <button onClick={() => delLoc(c.id)} className="text-red-500 text-xs">Elim</button>
                </div>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
