import { useState } from 'react';
import { call, session } from '../api.js';
import { ErrorBox, Spinner, useLoad } from '../ui.jsx';
import AdminCaterings from './AdminCaterings.jsx';
import AdminConfig from './AdminConfig.jsx';
import AdminDisp from './AdminDisp.jsx';
import AdminHours from './AdminHours.jsx';
import AdminWorkers from './AdminWorkers.jsx';
import Resum from './Resum.jsx';
import { todayISO } from '../util.js';

export default function AdminApp({ onLogout }) {
  const { data, error, reload, setData } = useLoad(() => call('a_boot'), []);
  const [tab, setTab] = useState('resum');
  const today = todayISO();
  const out = () => { session.clear(); onLogout(); };

  if (error) return <div className="wrap"><ErrorBox msg={error} onRetry={reload} /><button className="btn" onClick={out}>Sortir</button></div>;
  if (!data) return <div className="center"><Spinner /></div>;

  const setWorkers = (fn) => setData((d) => ({ ...d, workers: typeof fn === 'function' ? fn(d.workers) : fn }));
  const setConfig = (c) => setData((d) => ({ ...d, config: c }));
  const { workers, config } = data;

  const tabs = [['resum', 'Resum i Excel'], ['hores', 'Hores'], ['caterings', 'Càterings'], ['treballadors', 'Treballadors'], ['disp', 'Disp. restaurant'], ['config', 'Configuració']];

  return (
    <>
      <header className="hdr admin">
        <strong>Administrador</strong>
        <button className="out" onClick={out}>Sortir</button>
      </header>
      <main className="wrap adm">
        <nav className="tabs admin-tabs" aria-label="Seccions">
          {tabs.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k} onClick={() => setTab(k)}>{t}</button>)}
        </nav>
        {tab === 'resum' && <Resum workers={workers} config={config} setConfig={setConfig} today={today} />}
        {tab === 'hores' && <AdminHours workers={workers} config={config} today={today} />}
        {tab === 'caterings' && <AdminCaterings workers={workers} today={today} />}
        {tab === 'treballadors' && <AdminWorkers workers={workers} setWorkers={setWorkers} />}
        {tab === 'disp' && <AdminDisp workers={workers} today={today} />}
        {tab === 'config' && <AdminConfig config={config} setConfig={setConfig} />}
      </main>
    </>
  );
}
