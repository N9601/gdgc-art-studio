import { useState } from 'react';
import { Link } from 'react-router';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AsyncView, Notice, StatusBadge } from '../components/ui.jsx';
import { money } from '../format.js';

export default function Paintings() {
  const { user } = useAuth();
  const studio = user.role === 'studio';
  const paintings = useApi('/paintings');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [buying, setBuying] = useState(null);
  const [notice, setNotice] = useState(null);

  async function buy(painting) {
    if (!window.confirm(`Buy “${painting.title}” for ${money(painting.price)}?`)) return;
    setBuying(painting.id);
    setNotice(null);
    try {
      await api('/orders', { method: 'POST', body: { paintingId: painting.id } });
      setNotice({ kind: 'success', text: `Order placed for “${painting.title}”. You can see it under My orders.` });
    } catch (err) {
      // e.g. 409 "this painting has just been sold" when someone else was faster
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBuying(null);
      paintings.reload();
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>Paintings</h1>
        <div className="actions">
          <label className="check">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Available only
          </label>
          {studio && <Link className="button" to="/paintings/new">Add painting</Link>}
        </div>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <AsyncView
        state={paintings}
        isEmpty={(d) => d.paintings.filter((p) => !onlyAvailable || p.status === 'available').length === 0}
        empty={onlyAvailable ? 'Every painting has been sold. Check back soon!' : 'No paintings yet.'}
      >
        {(d) => (
          <ul className="grid">
            {d.paintings.filter((p) => !onlyAvailable || p.status === 'available').map((p) => (
              <li key={p.id} className="card painting">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.title} loading="lazy" />
                  : <div className="no-image">No image</div>}
                <div className="card-body">
                  <h2>{p.title}</h2>
                  <p className="muted">by {p.artist}</p>
                  <p className="description">{p.description}</p>
                  <div className="card-foot">
                    <strong>{money(p.price)}</strong>
                    <StatusBadge status={p.status} />
                  </div>
                  {!studio && p.status === 'available' && (
                    <button type="button" onClick={() => buy(p)} disabled={buying !== null}>
                      {buying === p.id ? 'Buying…' : 'Buy'}
                    </button>
                  )}
                  {studio && p.status === 'available' && (
                    <Link className="button secondary" to={`/paintings/${p.id}/edit`}>Edit</Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </section>
  );
}
