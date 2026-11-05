import { useState } from 'react';
import { call, session } from '../api.js';
import { ErrorBox, Spinner, useLoad } from '../ui.jsx';
import DispCat from './DispCat.jsx';
import DispRest from './DispRest.jsx';
import HoursTab from './HoursTab.jsx';
import { todayISO } from '../util.js';

export default function WorkerApp({ onLogout }) {
  const { data, error, reload } = useLoad(() => call('w_me'), []);
  const [tab, setTab] = useState('hores');
  const today = todayISO();

  const out = () => {
    session.clear();
    onLogout();
  };

  if (error) return <div className="wrap"><ErrorBox msg={error} onRetry={reload} /><button className="btn" onClick={out}>Sortir</button></div>;
  if (!data) return <div className="center"><Spinner /></div>;

  const { worker, config } = data;
  const tabs = [['hores', 'Hores']];
  if (worker.fa_restaurant) tabs.push(['rest', 'Disp. restaurant']);
  if (worker.fa_catering) tabs.push(['cat', 'Disp. càtering']);

  return (
    <>
      <header className="hdr">
        <strong>{worker.nom}</strong>
        <button className="out" onClick={out}>Sortir</button>
      </header>
      <main className="wrap">
        {tabs.length > 1 && (
          <nav className="tabs" aria-label="Seccions">
            {tabs.map(([k, t]) => (
              <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k} onClick={() => setTab(k)}>{t}</button>
            ))}
          </nav>
        )}
        {tab === 'hores' && <HoursTab config={config} today={today} />}
        {tab === 'rest' && <DispRest today={today} />}
        {tab === 'cat' && <DispCat />}
      </main>
    </>
  );
}
