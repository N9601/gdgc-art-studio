import { useState } from 'react';
import { Link } from 'react-router';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView, Empty, Notice, PageHeader, StatusBadge, Tabs } from '../components/ui.jsx';
import { money } from '../format.js';

function GallerySkeleton() {
  return (
    <ul className="grid" aria-label="Loading paintings">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="card painting skeleton-card">
          <div className="painting-media skeleton" />
          <div className="painting-body">
            <div className="skeleton skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton skeleton-line" style={{ width: '40%' }} />
            <div className="skeleton skeleton-line" style={{ width: '90%' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Paintings() {
  const { user } = useAuth();
  const studio = user.role === 'studio';
  const paintings = useApi('/paintings');
  const [filter, setFilter] = useState('all');
  const [buying, setBuying] = useState(null);
  const [notice, setNotice] = useState(null);

  const all = paintings.data?.paintings ?? [];
  const availableCount = all.filter((p) => p.status === 'available').length;

  async function buy(painting) {
    if (!window.confirm(`Buy “${painting.title}” for ${money(painting.price)}?`)) return;
    setBuying(painting.id);
    setNotice(null);
    try {
      // sends the price shown in the dialog, so a price changed meanwhile is refused (409), not charged
      await api('/orders', { method: 'POST', body: { paintingId: painting.id, price: painting.price } });
      setNotice({ kind: 'success', text: `Order placed for “${painting.title}”. You’ll find it under My orders.` });
    } catch (err) {
      // e.g. 409 "this painting has just been sold" when someone else was faster
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBuying(null);
      paintings.reload();
    }
  }

  return (
    <>
      <PageHeader
        title={studio ? 'Paintings' : 'Gallery'}
        subtitle={paintings.data
          ? `${all.length} original works · ${availableCount} available`
          : 'Original, one-of-a-kind paintings.'}
      >
        {studio && <Link className="button" to="/paintings/new"><Icon name="plus" size={16} /> Add painting</Link>}
      </PageHeader>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <AsyncView
        state={paintings}
        loading={<GallerySkeleton />}
        isEmpty={(d) => d.paintings.length === 0}
        emptyTitle="No paintings yet"
        emptyIcon="image"
        empty={studio ? 'Add the first painting to start selling.' : 'New work is on its way. Check back soon.'}
      >
        {(d) => {
          const shown = d.paintings.filter((p) => filter === 'all' || p.status === filter);
          return (
            <>
              <Tabs label="Filter paintings" value={filter} onChange={setFilter} options={[
                { value: 'all', label: 'All', count: d.paintings.length },
                { value: 'available', label: 'Available', count: availableCount },
                { value: 'sold', label: 'Sold', count: d.paintings.length - availableCount },
              ]} />
              {shown.length === 0 ? (
                <Empty title={filter === 'available' ? 'Everything has been sold' : 'Nothing sold yet'} icon="image">
                  {filter === 'available' ? 'Every painting has found a home. Check back soon.' : 'Sold paintings will show up here.'}
                </Empty>
              ) : (
                <ul className="grid">
                  {shown.map((p) => (
                    <li key={p.id} className={`card painting ${p.status === 'sold' ? 'is-sold' : ''}`}>
                      <div className="painting-media">
                        {p.imageUrl
                          ? <img src={p.imageUrl} alt={p.title} loading="lazy" />
                          : <div className="no-image"><Icon name="image" size={28} />No image</div>}
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="painting-body">
                        <h2 title={p.title}>{p.title}</h2>
                        <p className="artist">by {p.artist}</p>
                        <p className="description" title={p.description}>{p.description}</p>
                        <div className="painting-foot">
                          <span className="price">{money(p.price)}</span>
                          {!studio && p.status === 'available' && (
                            <button type="button" className="small" onClick={() => buy(p)} disabled={buying !== null}>
                              {buying === p.id ? 'Buying…' : 'Buy now'}
                            </button>
                          )}
                          {studio && p.status === 'available' && (
                            <Link className="button secondary small" to={`/paintings/${p.id}/edit`}><Icon name="edit" size={14} /> Edit</Link>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
