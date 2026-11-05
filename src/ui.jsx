import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ---------- avisos ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const show = useCallback((msg, kind = 'ok') => setT({ msg, kind, id: Math.random() }), []);
  useEffect(() => {
    if (!t) return undefined;
    const x = setTimeout(() => setT(null), t.kind === 'err' ? 5500 : 2600);
    return () => clearTimeout(x);
  }, [t]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className={`toast ${t.kind}`} role="status" key={t.id}>
          {t.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- càrrega de dades ---------- */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(
    async (silent) => {
      const id = ++seq.current;
      if (!silent) setState({ data: null, loading: true, error: null });
      try {
        const data = await fn();
        if (id === seq.current) setState({ data, loading: false, error: null });
      } catch (e) {
        if (id === seq.current) setState({ data: null, loading: false, error: e.message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );
  useEffect(() => {
    run(false);
  }, [run]);
  return { ...state, reload: () => run(true), setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

/* ---------- peces ---------- */
export function Spinner({ label = 'Carregant...' }) {
  return (
    <div className="spinner" role="status">
      <span className="dot" /> {label}
    </div>
  );
}

export function ErrorBox({ msg, onRetry }) {
  return (
    <div className="errbox" role="alert">
      <p>{msg}</p>
      {onRetry && (
        <button className="btn ghost" onClick={onRetry}>
          Tornar-ho a provar
        </button>
      )}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

export function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function WeekNav({ label, onPrev, onNext, prevOff, nextOff, sub }) {
  return (
    <div className="weeknav">
      <button className="sq" onClick={onPrev} disabled={prevOff} aria-label="Anterior">
        &larr;
      </button>
      <div className="wl">
        <strong>{label}</strong>
        {sub && <span>{sub}</span>}
      </div>
      <button className="sq" onClick={onNext} disabled={nextOff} aria-label="Següent">
        &rarr;
      </button>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mhead">
          <h2>{title}</h2>
          <button className="sq" onClick={onClose} aria-label="Tancar">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
