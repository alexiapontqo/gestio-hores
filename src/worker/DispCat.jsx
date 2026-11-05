import { call } from '../api.js';
import { Empty, ErrorBox, Spinner, useLoad, useToast } from '../ui.jsx';
import { catSort, fmtLong } from '../util.js';

export default function DispCat() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useLoad(() => call('w_disp_cat'), []);

  async function answer(c, estat) {
    const prev = data;
    const cur = (data.mine.find((m) => m.catering === c.id) || {}).estat;
    const next = cur === estat ? null : estat; // tocar la mateixa opció la treu
    setData((d) => ({ ...d, mine: [...d.mine.filter((m) => m.catering !== c.id), ...(next ? [{ catering: c.id, estat: next }] : [])] }));
    try {
      await call('w_disp_cat_set', { catering: c.id, estat: next });
    } catch (e) {
      setData(prev);
      toast(e.message, 'err');
    }
  }

  return (
    <div className="card">
      <p className="muted sm">Aquí només apareixen els càterings que s'han publicat. Indica si hi pots anar.</p>
      {loading && <Spinner />}
      {error && <ErrorBox msg={error} onRetry={reload} />}
      {data && !data.caterings.length && <Empty>Ara mateix no hi ha cap càtering obert.</Empty>}
      {data &&
        [...data.caterings].sort(catSort).map((c) => {
          const est = (data.mine.find((m) => m.catering === c.id) || {}).estat;
          return (
            <div className="cat" key={c.id}>
              <div>
                <div className="t">{c.client}</div>
                <div className="muted sm">{fmtLong(c.dia)}{c.hora ? `, a les ${c.hora}` : ''}</div>
                <div className="muted sm">{c.lloc}</div>
                {c.nota && <div className="muted sm">{c.nota}</div>}
              </div>
              <div className="tg">
                <button className={est === 'si' ? 'on' : ''} aria-pressed={est === 'si'} onClick={() => answer(c, 'si')}>Hi puc anar</button>
                <button className={`no ${est === 'no' ? 'on' : ''}`} aria-pressed={est === 'no'} onClick={() => answer(c, 'no')}>No puc</button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
