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

const getMonday = (d, offset) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const fmt = d => d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
const fmtDate = dateStr => dateStr.split('-').reverse().join('/');

const getDaysInMonth = (year, month) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < startPadding; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
};

export default function App() {
  const [view, setView] = useState('menu');
  const [user, setUser] = useState(null);
  const [data, setData] = useState({ workers: [], locations: [], entries: [], payments: [], availability: [], nextPin: 1041 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [w, l, e, p, a, c] = await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('locations').select('*'),
      supabase.from('entries').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('availability').select('*'),
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
        note: x.note, car: x.car, km: x.km || 0, kmCost: x.km_cost || 0,
        paid: x.paid || false, paidDate: x.paid_date
      })),
      payments: (p.data || []).map(x => ({ id: x.id, odId: x.od_id, name: x.name, date: x.date, amount: x.amount, locId: x.loc_id, locName: x.loc_name, kmCost: x.km_cost || 0 })),
      availability: (a.data || []).map(x => ({ 
        id: x.id, odId: x.worker_id, name: x.worker_name, date: x.date, 
        migdia: x.migdia, vespre: x.vespre,
        migdiaStatus: x.migdia_status || 'pending',
        vespreStatus: x.vespre_status || 'pending',
        migdiaLoc: x.migdia_loc || '',
        vespreLoc: x.vespre_loc || ''
      })),
      nextPin: c.data ? parseInt(c.data.value) : 1041
    });
    setLoading(false);
  };

  const reloadAvailability = async () => {
    const a = await supabase.from('availability').select('*');
    const newAvail = (a.data || []).map(x => ({ 
      id: x.id, odId: x.worker_id, name: x.worker_name, date: x.date, 
      migdia: x.migdia, vespre: x.vespre,
      migdiaStatus: x.migdia_status || 'pending',
      vespreStatus: x.vespre_status || 'pending',
      migdiaLoc: x.migdia_loc || '',
      vespreLoc: x.vespre_loc || ''
    }));
    setData(prev => ({ ...prev, availability: newAvail }));
    return newAvail;
  };

  const reloadEntries = async () => {
    const [e, p] = await Promise.all([
      supabase.from('entries').select('*'),
      supabase.from('payments').select('*')
    ]);
    setData(prev => ({
      ...prev,
      entries: (e.data || []).map(x => ({
        id: x.id, odId: x.od_id, name: x.name, date: x.date, locId: x.loc_id, locName: x.loc_name,
        type: x.type, shift: x.shift, job: x.job, horaIn: x.hora_in, horaOut: x.hora_out,
        horaIn2: x.hora_in2, horaOut2: x.hora_out2, horari: x.horari, hours: x.hours,
        rate: x.rate, customRate: x.custom_rate, plus: x.plus || 0, total: x.total,
        note: x.note, car: x.car, km: x.km || 0, kmCost: x.km_cost || 0,
        paid: x.paid || false, paidDate: x.paid_date
      })),
      payments: (p.data || []).map(x => ({ id: x.id, odId: x.od_id, name: x.name, date: x.date, amount: x.amount, locId: x.loc_id, locName: x.loc_name, kmCost: x.km_cost || 0 }))
    }));
  };

  if (loading) return <div className="p-8 text-center">Carregant...</div>;
  if (view === 'menu') return <Menu onWorker={() => setView('pin')} onAdmin={() => setView('adminLogin')} />;
  if (view === 'adminLogin') return <AdminLogin onBack={() => setView('menu')} onOk={() => setView('admin')} />;
  if (view === 'pin') return <Pin data={data} onBack={() => setView('menu')} onOk={w => { setUser(w); setView('worker'); }} />;
  if (view === 'worker') return <Worker user={user} data={data} reload={loadData} reloadAvailability={reloadAvailability} onOut={() => { setUser(null); setView('menu'); }} />;
  return <Admin data={data} reload={loadData} reloadEntries={reloadEntries} reloadAvailability={reloadAvailability} onOut={() => setView('menu')} />;
}

function Menu({ onWorker, onAdmin }) {
  return (<div className="min-h-screen bg-gray-100 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow p-6 w-full max-w-xs text-center"><h1 className="text-xl font-bold mb-6">Gestio d'Hores</h1><button onClick={onWorker} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold mb-3">Treballador</button><button onClick={onAdmin} className="w-full bg-gray-700 text-white py-4 rounded-lg font-bold">Administrador</button></div></div>);
}

function AdminLogin({ onBack, onOk }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const go = () => { if (pass === ADMIN_PASSWORD) onOk(); else { setErr('Contrasenya incorrecta'); setPass(''); } };
  return (<div className="min-h-screen bg-gray-100 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow p-6 w-full max-w-xs"><button onClick={onBack} className="text-gray-500 mb-4">← Tornar</button><h1 className="text-xl font-bold text-center mb-4">Admin</h1><input type="password" placeholder="Contrasenya" value={pass} onChange={e => { setPass(e.target.value); setErr(''); }} className="w-full p-4 border-2 rounded-lg text-center text-xl mb-3" />{err && <p className="text-red-500 text-center mb-3">{err}</p>}<button onClick={go} className="w-full bg-gray-700 text-white py-4 rounded-lg font-bold">Entrar</button></div></div>);
}

function Pin({ data, onBack, onOk }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const go = () => { const w = data.workers.find(x => x.pin === pin); if (w) onOk(w); else { setErr('PIN incorrecte'); setPin(''); } };
  return (<div className="min-h-screen bg-gray-100 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow p-6 w-full max-w-xs"><button onClick={onBack} className="text-gray-500 mb-4">← Tornar</button><h1 className="text-xl font-bold text-center mb-4">PIN</h1><input type="password" inputMode="numeric" value={pin} onChange={e => { setPin(e.target.value); setErr(''); }} className="w-full p-4 border-2 rounded-lg text-center text-2xl mb-3" maxLength="4" />{err && <p className="text-red-500 text-center mb-3">{err}</p>}<button onClick={go} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold">Entrar</button></div></div>);
}

function Worker({ user, data, reload, reloadAvailability, onOut }) {
  const [tab, setTab] = useState('hores');
  const [mode, setMode] = useState('list');
  const [off, setOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [form, setForm] = useState({ date: '', locId: '', shift: '', job: '', h1: '', h2: '', h3: '', h4: '', note: '', car: false, km: '' });
  const [delId, setDelId] = useState(null);
  const [saving, setSaving] = useState(false);
  const jobs = ['Cuina', 'Sala', 'Neteja', 'Produccio', 'Muntatge'];
  const rests = data.locations.filter(l => l.type === 'restaurant');
  const cats = data.locations.filter(l => l.type === 'catering' && l.active === true);
  const loc = data.locations.find(l => l.id === form.locId);
  const shifts = { migdia: 'Migdia', vespre: 'Vespre', both: 'Migdia+Vespre', extra: 'Hores extres' };
  const now = new Date();
  const ws = getMonday(now, off);
  const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
  const mine = data.entries.filter(e => { if (e.odId !== user.id) return false; const [year, month, day] = e.date.split('-').map(Number); const d = new Date(year, month - 1, day, 12, 0, 0); return d >= ws && d <= we; }).sort((a, b) => b.date.localeCompare(a.date));
  const totalH = mine.reduce((s, e) => s + (e.hours || 0), 0);
  const getH = () => { if (form.shift === 'both') { if (!form.h1 || !form.h2 || !form.h3 || !form.h4) return 0; const [a1, b1] = form.h1.split(':').map(Number); const [c1, d1] = form.h2.split(':').map(Number); const [a2, b2] = form.h3.split(':').map(Number); const [c2, d2] = form.h4.split(':').map(Number); let m1 = (c1 * 60 + d1) - (a1 * 60 + b1); let m2 = (c2 * 60 + d2) - (a2 * 60 + b2); if (m1 < 0) m1 += 1440; if (m2 < 0) m2 += 1440; return Math.round((m1 + m2) / 6) / 10; } if (!form.h1 || !form.h2) return 0; const [a, b] = form.h1.split(':').map(Number); const [c, d] = form.h2.split(':').map(Number); let m = (c * 60 + d) - (a * 60 + b); if (m < 0) m += 1440; return Math.round(m / 6) / 10; };
  const hrs = getH();
  const addRest = async () => { if (!form.date || !form.locId || !form.shift || !form.job) return alert('Omple tot'); if (form.shift === 'both') { if (!form.h1 || !form.h2 || !form.h3 || !form.h4) return alert('Omple totes les hores'); } else { if (!form.h1 || !form.h2) return alert('Omple les hores'); } setSaving(true); const p = loc?.prices || { migdia: 60, vespre: 60, both: 120 }; const horari = form.shift === 'both' ? form.h1 + '-' + form.h2 + ' / ' + form.h3 + '-' + form.h4 : form.h1 + '-' + form.h2; await supabase.from('entries').insert([{ id: Date.now() + '', od_id: user.id, name: user.name + ' ' + user.surname1, date: form.date, loc_id: form.locId, loc_name: loc?.name || '', type: 'restaurant', shift: form.shift, job: form.job, hora_in: form.h1, hora_out: form.h2, hora_in2: form.h3 || null, hora_out2: form.h4 || null, horari, hours: hrs, rate: user.rate, total: form.shift === 'extra' ? hrs * user.rate : p[form.shift], note: form.note, paid: false }]); await reload(); setForm({ date: '', locId: '', shift: '', job: '', h1: '', h2: '', h3: '', h4: '', note: '', car: false, km: '' }); setMode('list'); setSaving(false); };
  const addCat = async () => { if (!form.date || !form.locId || !form.job || !form.h1 || !form.h2) return alert('Omple tot'); setSaving(true); const km = form.car ? parseFloat(form.km || 0) : 0; await supabase.from('entries').insert([{ id: Date.now() + '', od_id: user.id, name: user.name + ' ' + user.surname1, date: form.date, loc_id: form.locId, loc_name: loc?.name || '', type: 'catering', job: form.job, hora_in: form.h1, hora_out: form.h2, hours: hrs, rate: user.rate, car: form.car, km, km_cost: km * 0.26, total: hrs * user.rate + km * 0.26, note: form.note, paid: false }]); await reload(); setForm({ date: '', locId: '', shift: '', job: '', h1: '', h2: '', h3: '', h4: '', note: '', car: false, km: '' }); setMode('list'); setSaving(false); };
  const del = async (id) => { await supabase.from('entries').delete().eq('id', id); await reload(); setDelId(null); };

  const calMonth = new Date(now.getFullYear(), now.getMonth() + monthOff, 1);
  const calDays = getDaysInMonth(calMonth.getFullYear(), calMonth.getMonth());
  const myAvail = data.availability.filter(a => a.odId === user.id);
  
  const getAvail = (day) => {
    if (!day) return null;
    const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return myAvail.find(a => a.date === dateStr);
  };

  const toggleAvail = async (day, tipo) => {
    const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = myAvail.find(a => a.date === dateStr);
    if (existing) {
      const newVal = tipo === 'migdia' ? !existing.migdia : !existing.vespre;
      const updates = tipo === 'migdia' 
        ? { migdia: newVal, migdia_status: 'pending' } 
        : { vespre: newVal, vespre_status: 'pending' };
      await supabase.from('availability').update(updates).eq('id', existing.id);
    } else {
      const newAvail = { 
        id: Date.now() + '', 
        worker_id: user.id, 
        worker_name: user.name + ' ' + user.surname1, 
        date: dateStr, 
        migdia: tipo === 'migdia', 
        vespre: tipo === 'vespre',
        migdia_status: 'pending',
        vespre_status: 'pending',
        migdia_loc: '',
        vespre_loc: ''
      };
      await supabase.from('availability').insert([newAvail]);
    }
    await reloadAvailability();
  };

  const getStatusStyle = (available, status) => {
    if (!available) return { text: 'X', bg: 'bg-red-100 text-red-600' };
    if (status === 'confirmed') return { text: 'OK', bg: 'bg-green-500 text-white' };
    if (status === 'cancelled') return { text: 'X', bg: 'bg-red-500 text-white' };
    return { text: '?', bg: 'bg-yellow-400 text-white' };
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-600 text-white p-4 flex justify-between"><span className="font-bold">{user.name} {user.surname1}</span><button onClick={onOut} className="bg-white text-green-600 px-3 py-1 rounded">Sortir</button></div>
      <div className="p-3 max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow mb-3 flex">
          <button onClick={() => setTab('hores')} className={`flex-1 py-3 text-sm ${tab === 'hores' ? 'border-b-2 border-green-600 font-bold' : 'text-gray-400'}`}>Hores</button>
          <button onClick={() => setTab('dispo')} className={`flex-1 py-3 text-sm ${tab === 'dispo' ? 'border-b-2 border-green-600 font-bold' : 'text-gray-400'}`}>Disponibilitat</button>
        </div>

        {tab === 'hores' && <>
          {mode === 'list' && <><div className="bg-white rounded-lg shadow p-4 mb-3"><div className="flex justify-between items-center mb-3"><button onClick={() => setOff(off - 1)} className="px-3 py-1 bg-gray-200 rounded">←</button><span className="font-bold text-sm">{fmt(ws)} - {fmt(we)}</span><button onClick={() => setOff(off + 1)} className="px-3 py-1 bg-gray-200 rounded">→</button></div><p className="text-gray-500 text-sm text-center">Total hores setmana</p><p className="text-3xl font-bold text-green-600 text-center mb-3">{totalH}h</p><div className="grid grid-cols-2 gap-2"><button onClick={() => { setMode('rest'); setForm({ ...form, date: new Date().toISOString().split('T')[0] }); }} className="bg-green-600 text-white p-3 rounded-lg">+ Restaurant</button><button onClick={() => { setMode('cat'); setForm({ ...form, date: new Date().toISOString().split('T')[0] }); }} className="bg-blue-600 text-white p-3 rounded-lg">+ Catering</button></div></div><div className="bg-white rounded-lg shadow"><h2 className="p-3 font-bold border-b">Historial setmana</h2>{mine.length === 0 ? <p className="p-4 text-gray-400">Sense entrades aquesta setmana</p> : mine.map(e => (<div key={e.id} className="p-3 border-b">{delId === e.id ? (<div className="bg-red-50 p-3 rounded flex gap-2"><button onClick={() => del(e.id)} className="bg-red-500 text-white px-4 py-2 rounded">Si</button><button onClick={() => setDelId(null)} className="bg-gray-300 px-4 py-2 rounded">No</button></div>) : (<div className="flex justify-between"><div><p className="font-medium">{e.locName}</p><p className="text-sm text-gray-500">{fmtDate(e.date)} - {e.job}</p><p className="text-xs text-gray-400">{e.horari || (e.horaIn + '-' + e.horaOut)}</p>{e.shift && <p className="text-xs text-blue-600">{shifts[e.shift]}</p>}{e.km > 0 && <p className="text-xs text-gray-400">{e.km}km</p>}{e.note && <p className="text-xs text-purple-600">{e.note}</p>}</div><div className="text-right"><p className="font-bold text-green-600">{e.hours}h</p><button onClick={() => setDelId(e.id)} className="text-red-500 text-sm">Eliminar</button></div></div>)}</div>))}</div></>}
          {mode === 'rest' && (<div className="bg-white rounded-lg shadow p-4 space-y-3"><h2 className="font-bold">Restaurant</h2><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full p-3 border rounded-lg" /><select value={form.locId} onChange={e => setForm({ ...form, locId: e.target.value })} className="w-full p-3 border rounded-lg"><option value="">Lloc...</option>{rests.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>{form.locId && <div className="grid grid-cols-2 gap-2">{['migdia', 'vespre', 'both', 'extra'].map(s => (<button key={s} onClick={() => setForm({ ...form, shift: s, h3: '', h4: '' })} className={`p-2 rounded border text-sm ${form.shift === s ? 'bg-green-600 text-white' : ''}`}>{shifts[s]}</button>))}</div>}<select value={form.job} onChange={e => setForm({ ...form, job: e.target.value })} className="w-full p-3 border rounded-lg"><option value="">Feina...</option>{jobs.map(j => <option key={j} value={j}>{j}</option>)}</select><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-500">{form.shift === 'both' ? 'Entrada migdia' : 'Entrada'}</label><input type="time" value={form.h1} onChange={e => setForm({ ...form, h1: e.target.value })} className="w-full p-3 border rounded-lg" /></div><div><label className="text-xs text-gray-500">{form.shift === 'both' ? 'Sortida migdia' : 'Sortida'}</label><input type="time" value={form.h2} onChange={e => setForm({ ...form, h2: e.target.value })} className="w-full p-3 border rounded-lg" /></div></div>{form.shift === 'both' && (<div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-500">Entrada vespre</label><input type="time" value={form.h3} onChange={e => setForm({ ...form, h3: e.target.value })} className="w-full p-3 border rounded-lg" /></div><div><label className="text-xs text-gray-500">Sortida vespre</label><input type="time" value={form.h4} onChange={e => setForm({ ...form, h4: e.target.value })} className="w-full p-3 border rounded-lg" /></div></div>)}<input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full p-3 border rounded-lg" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode('list')} className="p-3 bg-gray-200 rounded-lg">Cancel·lar</button><button onClick={addRest} disabled={saving} className="p-3 bg-green-600 text-white rounded-lg">{saving ? 'Guardant...' : 'Guardar'}</button></div></div>)}
          {mode === 'cat' && (<div className="bg-white rounded-lg shadow p-4 space-y-3"><h2 className="font-bold">Catering</h2><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full p-3 border rounded-lg" /><select value={form.locId} onChange={e => setForm({ ...form, locId: e.target.value })} className="w-full p-3 border rounded-lg"><option value="">Catering...</option>{cats.length === 0 ? <option disabled>No hi ha caterings actius</option> : cats.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select><select value={form.job} onChange={e => setForm({ ...form, job: e.target.value })} className="w-full p-3 border rounded-lg"><option value="">Feina...</option>{jobs.map(j => <option key={j} value={j}>{j}</option>)}</select><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-500">Sortida</label><input type="time" value={form.h1} onChange={e => setForm({ ...form, h1: e.target.value })} className="w-full p-3 border rounded-lg" /></div><div><label className="text-xs text-gray-500">Tornada</label><input type="time" value={form.h2} onChange={e => setForm({ ...form, h2: e.target.value })} className="w-full p-3 border rounded-lg" /></div></div><label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"><input type="checkbox" checked={form.car} onChange={e => setForm({ ...form, car: e.target.checked })} className="w-5 h-5" /><span>Cotxe propi</span></label>{form.car && <input type="number" placeholder="Km" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} className="w-full p-3 border rounded-lg" />}<input placeholder="Nota (opcional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="w-full p-3 border rounded-lg" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode('list')} className="p-3 bg-gray-200 rounded-lg">Cancel·lar</button><button onClick={addCat} disabled={saving} className="p-3 bg-green-600 text-white rounded-lg">{saving ? 'Guardant...' : 'Guardar'}</button></div></div>)}
        </>}

        {tab === 'dispo' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setMonthOff(monthOff - 1)} className="px-3 py-1 bg-gray-200 rounded">←</button>
              <span className="font-bold">{calMonth.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setMonthOff(monthOff + 1)} className="px-3 py-1 bg-gray-200 rounded">→</button>
            </div>
            <div className="mb-3 p-2 bg-gray-50 rounded text-xs text-center">
              <span className="inline-block px-2 py-1 bg-yellow-400 text-white rounded mr-1">?</span> Pendent
              <span className="inline-block px-2 py-1 bg-green-500 text-white rounded mx-1">OK</span> Confirmat
              <span className="inline-block px-2 py-1 bg-red-500 text-white rounded ml-1">X</span> Cancel·lat
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {['Dl', 'Dm', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'].map(d => <div key={d} className="font-bold text-gray-500">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, i) => {
                if (!day) return <div key={i} />;
                const av = getAvail(day);
                const mStyle = getStatusStyle(av?.migdia, av?.migdiaStatus);
                const vStyle = getStatusStyle(av?.vespre, av?.vespreStatus);
                return (
                  <div key={i} className="border rounded p-1 text-center">
                    <div className="text-xs font-bold mb-1">{day}</div>
                    <button onClick={() => toggleAvail(day, 'migdia')} className={`w-full text-xs py-1 rounded mb-1 ${mStyle.bg}`}>{mStyle.text}M</button>
                    <button onClick={() => toggleAvail(day, 'vespre')} className={`w-full text-xs py-1 rounded ${vStyle.bg}`}>{vStyle.text}V</button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Clica per canviar disponibilitat</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Admin({ data, reload, reloadEntries, reloadAvailability, onOut }) {
  const [tab, setTab] = useState('resum');
  const [period, setPeriod] = useState('setmana');
  const [off, setOff] = useState(0);
  const [monthOff, setMonthOff] = useState(0);
  const [nw, setNw] = useState({ n: '', s1: '', s2: '', r: 12 });
  const [nc, setNc] = useState({ n: '', d: '' });
  const [editId, setEditId] = useState(null);
  const [editV, setEditV] = useState({});
  const [delId, setDelId] = useState(null);
  const [editW, setEditW] = useState(null);
  const [editWV, setEditWV] = useState({});
  const [payConfirm, setPayConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [addingShift, setAddingShift] = useState(null);
  const [searchText, setSearchText] = useState('');
  const now = new Date();
  const ws = getMonday(now, off);
  const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
  const ms = new Date(now.getFullYear(), now.getMonth() + off, 1); ms.setHours(0, 0, 0, 0);
  const me = new Date(now.getFullYear(), now.getMonth() + off + 1, 0); me.setHours(23, 59, 59, 999);
  const ents = data.entries.filter(e => { if (e.paid) return false; const [year, month, day] = e.date.split('-').map(Number); const d = new Date(year, month - 1, day, 12, 0, 0); return period === 'setmana' ? (d >= ws && d <= we) : (d >= ms && d <= me); });
  const calc = e => (e.total || 0) + (e.kmCost || 0) + (e.plus || 0);
  const shifts = { migdia: 'Migdia', vespre: 'Vespre', both: 'M+V', extra: 'Extra' };
  const groupByWorker = () => { const workerIds = [...new Set(ents.map(e => e.odId))]; return workerIds.map(wId => { const worker = data.workers.find(w => w.id === wId); if (!worker) return null; const workerEnts = ents.filter(e => e.odId === wId); const locationIds = [...new Set(workerEnts.map(e => e.locId))]; const byLocation = locationIds.map(locId => { const loc = data.locations.find(l => l.id === locId) || { name: 'Desconegut', type: 'other' }; const locEnts = workerEnts.filter(e => e.locId === locId).sort((a, b) => a.date.localeCompare(b.date)); return { loc, entries: locEnts, subtotal: locEnts.reduce((s, e) => s + calc(e), 0) }; }); return { worker, byLocation, total: workerEnts.reduce((s, e) => s + calc(e), 0), totalHours: workerEnts.reduce((s, e) => s + (e.hours || 0), 0), entries: workerEnts }; }).filter(Boolean).sort((a, b) => (a.worker.name + ' ' + a.worker.surname1).localeCompare(b.worker.name + ' ' + b.worker.surname1, 'ca')); };
  const grouped = groupByWorker();
  const sortedWorkers = sortWorkers(data.workers);
  
  const getPaymentPeriod = () => {
    if (period === 'setmana') {
      return `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
    } else {
      return `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}-01`;
    }
  };
  
  const paymentsByMonth = () => { const g = {}; data.payments.forEach(p => { const key = p.date.substring(0, 7); if (!g[key]) g[key] = { payments: [], total: 0 }; g[key].payments.push(p); g[key].total += p.amount; }); return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0])); };
  const addW = async () => { if (!nw.n || !nw.s1) return alert('Omple nom i primer cognom'); setSaving(true); const pin = data.nextPin.toString().padStart(4, '0'); await supabase.from('workers').insert([{ id: Date.now() + '', name: nw.n.toUpperCase(), surname1: nw.s1.toUpperCase(), surname2: nw.s2 ? nw.s2.toUpperCase() : '', pin, rate: +nw.r }]); await supabase.from('config').update({ value: (data.nextPin + 1).toString() }).eq('key', 'nextPin'); await reload(); setNw({ n: '', s1: '', s2: '', r: 12 }); alert('PIN: ' + pin); setSaving(false); };
  const updW = async (id) => { setSaving(true); await supabase.from('workers').update({ name: editWV.n.toUpperCase(), surname1: editWV.s1.toUpperCase(), surname2: editWV.s2 ? editWV.s2.toUpperCase() : '', rate: +editWV.r }).eq('id', id); await reload(); setEditW(null); setSaving(false); };
  const delW = async (id) => { await supabase.from('workers').delete().eq('id', id); await reload(); };
  const addC = async () => { if (!nc.n || !nc.d) return alert('Omple tot'); setSaving(true); await supabase.from('locations').insert([{ id: Date.now() + '', name: nc.n + ' - ' + nc.d, date: nc.d, type: 'catering', active: true }]); await reload(); setNc({ n: '', d: '' }); setSaving(false); };
  const toggleLoc = async (id, active) => { await supabase.from('locations').update({ active: !active }).eq('id', id); await reload(); };
  const delLoc = async (id) => { await supabase.from('locations').delete().eq('id', id); await reload(); };
  const saveEdit = async () => { setSaving(true); await supabase.from('entries').update({ total: editV.t, hours: editV.h, plus: editV.p }).eq('id', editId); await reloadEntries(); setEditId(null); setSaving(false); };
  const delEntry = async (id) => { await supabase.from('entries').delete().eq('id', id); await reloadEntries(); setDelId(null); };
  const confirmPay = async () => { setSaving(true); const paymentDate = getPaymentPeriod(); for (const e of payConfirm.entries) { await supabase.from('entries').update({ paid: true, paid_date: paymentDate }).eq('id', e.id); } await supabase.from('payments').insert([{ id: Date.now() + '', od_id: payConfirm.worker.id, name: (payConfirm.worker.name + ' ' + payConfirm.worker.surname1 + ' ' + (payConfirm.worker.surname2 || '')).trim(), date: paymentDate, amount: payConfirm.total }]); await reloadEntries(); setPayConfirm(null); setSaving(false); };
  
  const exp = () => {
    let c = '\uFEFF' + 'TREBALLADOR;LLOC;DATA;TORN;HORES;TOTAL;EUR/H\n';
    grouped.forEach(({ worker, byLocation, total }) => {
      const workerName = (worker.name + ' ' + worker.surname1 + ' ' + (worker.surname2 || '')).trim();
      byLocation.forEach(({ loc, entries, subtotal }) => {
        entries.forEach(e => {
          const t = Math.round(calc(e));
          const h = e.hours % 1 === 0 ? e.hours : e.hours;
          const eurh = e.hours > 0 ? Math.round(calc(e) / e.hours) : 0;
          c += ';' + loc.name + ';' + fmtDate(e.date) + ';' + (shifts[e.shift] || '') + ';' + h + ';' + t + ';' + eurh + '\n';
        });
        c += ';TOTAL ' + loc.name + ';;;;' + Math.round(subtotal) + ';\n';
      });
      c += workerName + ';;;;;\n';
      c += 'TOTAL ' + workerName + ';;;;' + Math.round(total) + ';\n';
      c += ';;;;;;;\n';
    });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv' })); 
    a.download = 'hores.csv'; 
    a.click(); 
  };
  
  const expWorkers = () => { let c = '\uFEFF' + 'NOM;COGNOM1;COGNOM2;PIN;PREU/HORA\n'; sortedWorkers.forEach(w => { c += w.name + ';' + w.surname1 + ';' + (w.surname2 || '') + ';' + w.pin + ';' + w.rate + '\n'; }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv' })); a.download = 'treballadors.csv'; a.click(); };

  const calMonth = new Date(now.getFullYear(), now.getMonth() + monthOff, 1);
  const calDays = getDaysInMonth(calMonth.getFullYear(), calMonth.getMonth());
  
  const buildDayData = (dateStr, availList) => {
    const dayAvail = availList.filter(a => a.date === dateStr);
    const day = parseInt(dateStr.split('-')[2]);
    return {
      day,
      dateStr,
      migdia: dayAvail.filter(a => a.migdia && a.migdiaStatus !== 'cancelled').map(a => ({ ...a })),
      vespre: dayAvail.filter(a => a.vespre && a.vespreStatus !== 'cancelled').map(a => ({ ...a })),
      migdiaCancelled: dayAvail.filter(a => a.migdia && a.migdiaStatus === 'cancelled').map(a => ({ ...a })),
      vespreCancelled: dayAvail.filter(a => a.vespre && a.vespreStatus === 'cancelled').map(a => ({ ...a }))
    };
  };

  const getAvailForDay = (day) => {
    if (!day) return { migdia: [], vespre: [], migdiaCancelled: [], vespreCancelled: [] };
    const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return buildDayData(dateStr, data.availability);
  };

  const updateStatus = async (availId, tipo, newStatus, newLoc = '') => {
    setSaving(true);
    const updates = tipo === 'migdia' 
      ? { migdia_status: newStatus, migdia_loc: newLoc } 
      : { vespre_status: newStatus, vespre_loc: newLoc };
    await supabase.from('availability').update(updates).eq('id', availId);
    const newAvailList = await reloadAvailability();
    if (selectedDay) {
      setSelectedDay(buildDayData(selectedDay.dateStr, newAvailList));
    }
    setSaving(false);
  };

  const addWorkerToDay = async (worker, tipo) => {
    setSaving(true);
    const dateStr = selectedDay.dateStr;
    const existing = data.availability.find(a => a.date === dateStr && a.odId === worker.id);
    
    if (existing) {
      const updates = tipo === 'migdia' 
        ? { migdia: true, migdia_status: 'confirmed', migdia_loc: '' } 
        : { vespre: true, vespre_status: 'confirmed', vespre_loc: '' };
      await supabase.from('availability').update(updates).eq('id', existing.id);
    } else {
      const newAvail = { 
        id: Date.now() + '', 
        worker_id: worker.id, 
        worker_name: worker.name + ' ' + worker.surname1, 
        date: dateStr, 
        migdia: tipo === 'migdia', 
        vespre: tipo === 'vespre',
        migdia_status: tipo === 'migdia' ? 'confirmed' : 'pending',
        vespre_status: tipo === 'vespre' ? 'confirmed' : 'pending',
        migdia_loc: '',
        vespre_loc: ''
      };
      await supabase.from('availability').insert([newAvail]);
    }
    
    const newAvailList = await reloadAvailability();
    setSelectedDay(buildDayData(dateStr, newAvailList));
    setAddingShift(null);
    setSearchText('');
    setSaving(false);
  };

  const getFilteredWorkers = (tipo) => {
    if (!searchText) return [];
    const currentIds = tipo === 'migdia' 
      ? [...selectedDay.migdia, ...selectedDay.migdiaCancelled].map(a => a.odId)
      : [...selectedDay.vespre, ...selectedDay.vespreCancelled].map(a => a.odId);
    return sortedWorkers.filter(w => {
      if (currentIds.includes(w.id)) return false;
      const fullName = (w.name + ' ' + w.surname1 + ' ' + (w.surname2 || '')).toLowerCase();
      return fullName.includes(searchText.toLowerCase());
    });
  };

  const getStatusBg = (status) => {
    if (status === 'confirmed') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const expCalendar = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let c = '\uFEFF' + 'DIA;MIGDIA;LLOC M;VESPRE;LLOC V\n';
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAvail = data.availability.filter(a => a.date === dateStr);
      const migdiaConfirmed = dayAvail.filter(a => a.migdia && a.migdiaStatus === 'confirmed').map(a => a.name.split(' ')[0]);
      const vespreConfirmed = dayAvail.filter(a => a.vespre && a.vespreStatus === 'confirmed').map(a => a.name.split(' ')[0]);
      const migdiaLocs = dayAvail.filter(a => a.migdia && a.migdiaStatus === 'confirmed' && a.migdiaLoc).map(a => a.migdiaLoc);
      const vespreLocs = dayAvail.filter(a => a.vespre && a.vespreStatus === 'confirmed' && a.vespreLoc).map(a => a.vespreLoc);
      c += d + ';' + migdiaConfirmed.join(', ') + ';' + [...new Set(migdiaLocs)].join(', ') + ';' + vespreConfirmed.join(', ') + ';' + [...new Set(vespreLocs)].join(', ') + '\n';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([c], { type: 'text/csv' }));
    a.download = 'disponibilitat_' + (month + 1) + '_' + year + '.csv';
    a.click();
  };

  const allLocs = data.locations.filter(l => l.type === 'restaurant' || (l.type === 'catering' && l.active));

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-700 text-white p-4 flex justify-between"><span className="font-bold">Admin</span><button onClick={onOut} className="bg-white text-gray-700 px-3 py-1 rounded">Sortir</button></div>
      <div className="p-3 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow mb-3 flex">{['resum', 'dispo', 'treballadors', 'caterings', 'pagaments'].map(t => (<button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-xs ${tab === t ? 'border-b-2 border-gray-700 font-bold' : 'text-gray-400'}`}>{t === 'dispo' ? 'Dispo' : t.charAt(0).toUpperCase() + t.slice(1)}</button>))}</div>

        {tab === 'resum' && (<div className="space-y-3"><div className="bg-white rounded-lg shadow p-3 space-y-3"><div className="flex gap-2"><button onClick={() => { setPeriod('setmana'); setOff(0); }} className={`flex-1 py-2 rounded ${period === 'setmana' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Setmana</button><button onClick={() => { setPeriod('mes'); setOff(0); }} className={`flex-1 py-2 rounded ${period === 'mes' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Mes</button></div><div className="flex justify-between items-center"><button onClick={() => setOff(off - 1)} className="px-4 py-2 bg-gray-200 rounded">←</button><span className="font-bold text-sm">{period === 'setmana' ? fmt(ws) + ' - ' + fmt(we) : ms.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}</span><button onClick={() => setOff(off + 1)} className="px-4 py-2 bg-gray-200 rounded">→</button></div><button onClick={exp} className="w-full bg-green-600 text-white py-3 rounded-lg">Descarregar CSV</button></div>
          {grouped.map(({ worker, byLocation, total, totalHours, entries }) => (<div key={worker.id} className="bg-white rounded-lg shadow overflow-hidden"><div className="p-3 bg-gray-700 text-white flex justify-between items-center"><span className="font-bold">{worker.name} {worker.surname1} {worker.surname2}</span><span className="font-bold text-green-300">{total.toFixed(2)}E</span></div>{byLocation.map(({ loc, entries: locEnts, subtotal }) => (<div key={loc.id || loc.name} className="border-b"><div className="p-2 bg-gray-100 flex justify-between items-center"><span className="font-medium text-sm">{loc.name}</span><span className="text-sm font-bold text-gray-600">{subtotal.toFixed(2)}E</span></div>{locEnts.map(e => (<div key={e.id} className="p-2 pl-4 border-t border-gray-100">{editId === e.id ? (<div className="space-y-2"><div className="grid grid-cols-3 gap-2"><div><label className="text-xs text-gray-500">Total E</label><input type="number" value={editV.t} onChange={x => setEditV({ ...editV, t: +x.target.value })} className="w-full p-2 border rounded text-sm" /></div><div><label className="text-xs text-gray-500">Hores</label><input type="number" step="0.1" value={editV.h} onChange={x => setEditV({ ...editV, h: +x.target.value })} className="w-full p-2 border rounded text-sm" /></div><div><label className="text-xs text-gray-500">Plus</label><input type="number" value={editV.p} onChange={x => setEditV({ ...editV, p: +x.target.value })} className="w-full p-2 border rounded text-sm" /></div></div><div className="flex gap-2"><button onClick={saveEdit} disabled={saving} className="bg-green-600 text-white px-3 py-1 rounded text-sm">{saving ? '...' : 'Guardar'}</button><button onClick={() => setEditId(null)} className="bg-gray-200 px-3 py-1 rounded text-sm">Cancel</button></div></div>) : delId === e.id ? (<div className="bg-red-50 p-2 rounded flex gap-2 items-center"><span className="text-sm">Eliminar?</span><button onClick={() => delEntry(e.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm">Si</button><button onClick={() => setDelId(null)} className="bg-gray-300 px-3 py-1 rounded text-sm">No</button></div>) : (<div className="flex justify-between items-center"><div className="text-sm"><span className="text-gray-500">{fmtDate(e.date)}</span>{e.shift && <span className="ml-2 text-blue-600">{shifts[e.shift]}</span>}<span className="ml-2 text-gray-400">{e.horaIn}-{e.horaOut}</span><span className="ml-2 text-gray-400">({e.hours}h - {e.hours > 0 ? (calc(e) / e.hours).toFixed(1) : 0}E/h)</span>{e.km > 0 && <span className="ml-2 text-orange-500">{e.km}km</span>}{e.plus > 0 && <span className="ml-2 text-purple-500">+{e.plus}E</span>}</div><div className="flex items-center gap-2"><span className="font-medium">{calc(e).toFixed(2)}E</span><button onClick={() => { setEditId(e.id); setEditV({ t: e.total || 0, h: e.hours || 0, p: e.plus || 0 }); }} className="text-blue-500 text-sm">Editar</button><button onClick={() => setDelId(e.id)} className="text-red-500 text-sm">Elim</button></div></div>)}</div>))}</div>))}<div className="p-3 bg-gray-50 flex justify-between items-center"><span className="text-sm text-gray-500">{entries.length} entrades - {totalHours}h</span><button onClick={() => setPayConfirm({ worker, total, entries })} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Pagar {total.toFixed(2)}E</button></div></div>))}
          {grouped.length === 0 && <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">Sense entrades pendents</div>}</div>)}

        {tab === 'dispo' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setMonthOff(monthOff - 1)} className="px-3 py-1 bg-gray-200 rounded">←</button>
              <span className="font-bold">{calMonth.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setMonthOff(monthOff + 1)} className="px-3 py-1 bg-gray-200 rounded">→</button>
            </div>
            <button onClick={expCalendar} className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4">Descarregar Excel</button>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {['Dl', 'Dm', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'].map(d => <div key={d} className="font-bold text-gray-500">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, i) => {
                if (!day) return <div key={i} />;
                const av = getAvailForDay(day);
                const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                return (
                  <div key={i} className="border rounded p-1 min-h-16 cursor-pointer hover:bg-gray-50" onClick={() => setSelectedDay({ day, dateStr, ...av })}>
                    <div className="text-xs font-bold text-center mb-1">{day}</div>
                    <div className="text-xs">
                      {av.migdia.length > 0 && <div className="bg-yellow-100 rounded px-1 mb-1 truncate"><span className="font-bold">M:</span> {av.migdia.length}</div>}
                      {av.vespre.length > 0 && <div className="bg-blue-100 rounded px-1 truncate"><span className="font-bold">V:</span> {av.vespre.length}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Clica un dia per gestionar disponibilitat</p>
          </div>
        )}

        {tab === 'treballadors' && (<div className="space-y-3"><div className="bg-white rounded-lg shadow p-4 space-y-2"><input placeholder="Nom" value={nw.n} onChange={e => setNw({ ...nw, n: e.target.value })} className="w-full p-3 border rounded" /><div className="flex gap-2"><input placeholder="1r cognom" value={nw.s1} onChange={e => setNw({ ...nw, s1: e.target.value })} className="flex-1 p-3 border rounded" /><input placeholder="2n cognom" value={nw.s2} onChange={e => setNw({ ...nw, s2: e.target.value })} className="flex-1 p-3 border rounded" /></div><div className="flex gap-2"><div className="w-24"><label className="text-xs text-gray-500">E/hora</label><input type="number" value={nw.r} onChange={e => setNw({ ...nw, r: e.target.value })} className="w-full p-3 border rounded" /></div><button onClick={addW} disabled={saving} className="flex-1 bg-green-600 text-white p-3 rounded">{saving ? 'Creant...' : 'Crear'}</button></div><button onClick={expWorkers} className="w-full bg-blue-600 text-white py-3 rounded-lg">Descarregar Treballadors</button></div><div className="bg-white rounded-lg shadow divide-y">{sortedWorkers.map(w => (<div key={w.id} className="p-4">{editW === w.id ? (<div className="space-y-2"><input value={editWV.n} onChange={e => setEditWV({ ...editWV, n: e.target.value })} className="w-full p-2 border rounded" placeholder="Nom" /><div className="flex gap-2"><input value={editWV.s1} onChange={e => setEditWV({ ...editWV, s1: e.target.value })} className="flex-1 p-2 border rounded" placeholder="1r cognom" /><input value={editWV.s2} onChange={e => setEditWV({ ...editWV, s2: e.target.value })} className="flex-1 p-2 border rounded" placeholder="2n cognom" /></div><div className="flex gap-2"><input type="number" value={editWV.r} onChange={e => setEditWV({ ...editWV, r: e.target.value })} className="w-20 p-2 border rounded" /><button onClick={() => updW(w.id)} disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">{saving ? '...' : 'Guardar'}</button><button onClick={() => setEditW(null)} className="bg-gray-200 px-4 py-2 rounded">Cancel</button></div></div>) : (<div className="flex justify-between"><div><p className="font-medium">{w.name} {w.surname1} {w.surname2}</p><p className="text-sm text-gray-500">PIN: {w.pin} - {w.rate}E/h</p></div><div className="flex gap-2"><button onClick={() => { setEditW(w.id); setEditWV({ n: w.name, s1: w.surname1, s2: w.surname2 || '', r: w.rate }); }} className="text-blue-500">Editar</button><button onClick={() => delW(w.id)} className="text-red-500">Elim</button></div></div>)}</div>))}</div></div>)}

        {tab === 'caterings' && (<div className="space-y-3"><div className="bg-white rounded-lg shadow p-4 space-y-2"><input placeholder="Nom" value={nc.n} onChange={e => setNc({ ...nc, n: e.target.value })} className="w-full p-3 border rounded" /><div className="flex gap-2"><input type="date" value={nc.d} onChange={e => setNc({ ...nc, d: e.target.value })} className="flex-1 p-3 border rounded" /><button onClick={addC} disabled={saving} className="bg-green-600 text-white px-6 rounded">{saving ? '...' : '+'}</button></div></div><div className="bg-white rounded-lg shadow divide-y">{data.locations.filter(l => l.type === 'restaurant').map(l => (<div key={l.id} className="p-4 flex justify-between"><span>{l.name}</span><span className="text-green-600 text-sm">Restaurant</span></div>))}{data.locations.filter(l => l.type === 'catering').map(c => (<div key={c.id} className="p-4 flex justify-between"><span>{c.name}</span><div className="flex gap-2"><button onClick={() => toggleLoc(c.id, c.active)} className={`px-2 py-1 rounded text-xs ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>{c.active ? 'On' : 'Off'}</button><button onClick={() => delLoc(c.id)} className="text-red-500 text-xs">Elim</button></div></div>))}</div></div>)}

        {tab === 'pagaments' && (<div className="space-y-3">{paymentsByMonth().length === 0 ? (<div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">No hi ha pagaments registrats</div>) : (paymentsByMonth().map(([monthKey, { payments, total }]) => (<div key={monthKey} className="bg-white rounded-lg shadow overflow-hidden"><div className="p-3 bg-gray-700 text-white flex justify-between"><span className="font-bold">{new Date(monthKey + '-01').toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}</span><span className="font-bold text-green-300">{total.toFixed(2)}E</span></div>{payments.map(p => (<div key={p.id} className="p-3 border-b flex justify-between items-center"><div><span className="text-gray-500 text-sm">{fmtDate(p.date)}</span><span className="ml-2 font-medium">{p.name}</span></div><span className="font-bold text-green-600">{p.amount.toFixed(2)}E</span></div>))}</div>)))}</div>)}
      </div>

      {payConfirm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"><h3 className="text-lg font-bold mb-4">Confirmar pagament</h3><p className="mb-2">Pagar a <strong>{payConfirm.worker.name} {payConfirm.worker.surname1}</strong>:</p><p className="text-3xl font-bold text-green-600 mb-4">{payConfirm.total.toFixed(2)}E</p><p className="text-sm text-gray-500 mb-4">Aixo marcara {payConfirm.entries.length} entrades com a pagades.</p><div className="flex gap-2"><button onClick={() => setPayConfirm(null)} className="flex-1 py-2 bg-gray-200 rounded">Cancel·lar</button><button onClick={confirmPay} disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded font-bold">{saving ? 'Processant...' : 'Confirmar'}</button></div></div></div>)}

      {selectedDay && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{selectedDay.day} {calMonth.toLocaleDateString('ca-ES', { month: 'long' })}</h3><button onClick={() => { setSelectedDay(null); setAddingShift(null); setSearchText(''); }} className="text-gray-500 text-xl">X</button></div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-yellow-600">MIGDIA</h4>
            <button onClick={() => { setAddingShift(addingShift === 'migdia' ? null : 'migdia'); setSearchText(''); }} className="text-xs bg-green-600 text-white px-2 py-1 rounded">+ Afegir</button>
          </div>
          {addingShift === 'migdia' && (
            <div className="mb-2 p-2 bg-gray-50 rounded">
              <input 
                type="text" 
                placeholder="Escriu nom..." 
                value={searchText} 
                onChange={e => setSearchText(e.target.value)} 
                className="w-full p-2 border rounded text-sm mb-2"
                autoFocus
              />
              {getFilteredWorkers('migdia').length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  {getFilteredWorkers('migdia').map(w => (
                    <button 
                      key={w.id} 
                      onClick={() => addWorkerToDay(w, 'migdia')} 
                      disabled={saving}
                      className="w-full text-left p-2 hover:bg-green-100 rounded text-sm"
                    >
                      {w.name} {w.surname1} {w.surname2}
                    </button>
                  ))}
                </div>
              )}
              {searchText && getFilteredWorkers('migdia').length === 0 && (
                <p className="text-xs text-gray-400">Cap resultat</p>
              )}
            </div>
          )}
          {selectedDay.migdia.length === 0 && !addingShift ? <p className="text-gray-400 text-sm">Ningu disponible</p> : (
            <div className="space-y-2">
              {selectedDay.migdia.map(a => (
                <div key={a.id} className={`p-2 rounded ${getStatusBg(a.migdiaStatus)}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{a.name}</span>
                    <div className="flex gap-1">
                      <button disabled={saving} onClick={() => updateStatus(a.id, 'migdia', 'confirmed', a.migdiaLoc || '')} className={`px-2 py-1 rounded text-xs ${a.migdiaStatus === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>OK</button>
                      <button disabled={saving} onClick={() => updateStatus(a.id, 'migdia', 'cancelled', '')} className="px-2 py-1 rounded text-xs bg-red-500 text-white">X</button>
                    </div>
                  </div>
                  {a.migdiaStatus === 'confirmed' && (
                    <select value={a.migdiaLoc || ''} onChange={(e) => updateStatus(a.id, 'migdia', 'confirmed', e.target.value)} className="w-full p-1 border rounded text-sm mt-1">
                      <option value="">Lloc...</option>
                      {allLocs.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
          {selectedDay.migdiaCancelled && selectedDay.migdiaCancelled.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2">Cancel·lats:</p>
              {selectedDay.migdiaCancelled.map(a => (
                <div key={a.id + 'mc'} className="p-2 rounded bg-red-50 text-red-600 flex justify-between items-center mb-1">
                  <span className="line-through">{a.name}</span>
                  <button disabled={saving} onClick={() => updateStatus(a.id, 'migdia', 'pending', '')} className="px-2 py-1 rounded text-xs bg-yellow-400 text-white">Recuperar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-blue-600">VESPRE</h4>
            <button onClick={() => { setAddingShift(addingShift === 'vespre' ? null : 'vespre'); setSearchText(''); }} className="text-xs bg-green-600 text-white px-2 py-1 rounded">+ Afegir</button>
          </div>
          {addingShift === 'vespre' && (
            <div className="mb-2 p-2 bg-gray-50 rounded">
              <input 
                type="text" 
                placeholder="Escriu nom..." 
                value={searchText} 
                onChange={e => setSearchText(e.target.value)} 
                className="w-full p-2 border rounded text-sm mb-2"
                autoFocus
              />
              {getFilteredWorkers('vespre').length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  {getFilteredWorkers('vespre').map(w => (
                    <button 
                      key={w.id} 
                      onClick={() => addWorkerToDay(w, 'vespre')} 
                      disabled={saving}
                      className="w-full text-left p-2 hover:bg-green-100 rounded text-sm"
                    >
                      {w.name} {w.surname1} {w.surname2}
                    </button>
                  ))}
                </div>
              )}
              {searchText && getFilteredWorkers('vespre').length === 0 && (
                <p className="text-xs text-gray-400">Cap resultat</p>
              )}
            </div>
          )}
          {selectedDay.vespre.length === 0 && !addingShift ? <p className="text-gray-400 text-sm">Ningu disponible</p> : (
            <div className="space-y-2">
              {selectedDay.vespre.map(a => (
                <div key={a.id + 'v'} className={`p-2 rounded ${getStatusBg(a.vespreStatus)}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{a.name}</span>
                    <div className="flex gap-1">
                      <button disabled={saving} onClick={() => updateStatus(a.id, 'vespre', 'confirmed', a.vespreLoc || '')} className={`px-2 py-1 rounded text-xs ${a.vespreStatus === 'confirmed' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>OK</button>
                      <button disabled={saving} onClick={() => updateStatus(a.id, 'vespre', 'cancelled', '')} className="px-2 py-1 rounded text-xs bg-red-500 text-white">X</button>
                    </div>
                  </div>
                  {a.vespreStatus === 'confirmed' && (
                    <select value={a.vespreLoc || ''} onChange={(e) => updateStatus(a.id, 'vespre', 'confirmed', e.target.value)} className="w-full p-1 border rounded text-sm mt-1">
                      <option value="">Lloc...</option>
                      {allLocs.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
          {selectedDay.vespreCancelled && selectedDay.vespreCancelled.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2">Cancel·lats:</p>
              {selectedDay.vespreCancelled.map(a => (
                <div key={a.id + 'vc'} className="p-2 rounded bg-red-50 text-red-600 flex justify-between items-center mb-1">
                  <span className="line-through">{a.name}</span>
                  <button disabled={saving} onClick={() => updateStatus(a.id, 'vespre', 'pending', '')} className="px-2 py-1 rounded text-xs bg-yellow-400 text-white">Recuperar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => { setSelectedDay(null); setAddingShift(null); setSearchText(''); }} className="w-full mt-4 py-2 bg-gray-200 rounded">Tancar</button>
      </div></div>)}
    </div>
  );
}
