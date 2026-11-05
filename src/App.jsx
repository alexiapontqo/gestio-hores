import { useEffect, useState } from 'react';
import { call, session } from './api.js';
import { ToastProvider } from './ui.jsx';
import AdminApp from './admin/AdminApp.jsx';
import WorkerApp from './worker/WorkerApp.jsx';

function Landing({ onPick }) {
  return (
    <div className="center">
      <div className="box">
        <h1>Gestió d'Hores</h1>
        <p className="sub">Quinze Ous</p>
        <button className="btn green big" onClick={() => onPick('w')}>Treballador</button>
        <button className="btn slate big" onClick={() => onPick('a')}>Administrador</button>
      </div>
    </div>
  );
}

function Login({ role, onBack, onDone }) {
  const [usuari, setUsuari] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = role === 'a';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!admin && !usuari.trim()) return setErr('Escriu el teu nom d\'usuari.');
    if (!pass) return setErr('Escriu la contrasenya.');
    setBusy(true);
    try {
      const r = await call(admin ? 'login_admin' : 'login', admin ? { contrasenya: pass } : { usuari, contrasenya: pass });
      onDone({ role, token: r.token });
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="box" onSubmit={submit} noValidate>
        <button type="button" className="back" onClick={onBack}>&larr; Tornar</button>
        <h1>{admin ? 'Administrador' : 'Entrar'}</h1>
        {!admin && <input type="text" placeholder="Usuari (nom i cognom)" aria-label="Usuari" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={usuari} onChange={(e) => setUsuari(e.target.value)} autoFocus />}
        <input type="password" placeholder="Contrasenya" aria-label="Contrasenya" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus={admin} />
        {err && <p className="err" role="alert">{err}</p>}
        <button className={`btn ${admin ? 'slate' : 'green'}`} disabled={busy}>{busy ? 'Entrant...' : 'Entrar'}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [sess, setSess] = useState(() => session.get());
  const [pick, setPick] = useState(null);

  useEffect(() => {
    const f = () => { setSess(null); setPick(null); };
    window.addEventListener('gh-logout', f);
    return () => window.removeEventListener('gh-logout', f);
  }, []);

  const logout = () => { setSess(null); setPick(null); };
  let screen;
  if (sess?.role === 'w') screen = <WorkerApp onLogout={logout} />;
  else if (sess?.role === 'a') screen = <AdminApp onLogout={logout} />;
  else if (!pick) screen = <Landing onPick={setPick} />;
  else screen = <Login role={pick} onBack={() => setPick(null)} onDone={(s) => { session.set(s); setSess(s); }} />;

  return <ToastProvider>{screen}</ToastProvider>;
}
