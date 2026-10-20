import { useState } from 'react';
import { Link } from 'react-router';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AsyncView, Notice, PageHeader, StatusBadge } from '../components/ui.jsx';
import { money, niceTime } from '../format.js';

// Customers see and cancel their own orders; the studio sees every order.
export default function Orders() {
  const { user } = useAuth();
  const studio = user.role === 'studio';
  const orders = useApi('/orders');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  async function cancel(order) {
    if (!window.confirm(`Cancel your order for “${order.painting.title}”? The painting will go back on sale.`)) return;
    setBusy(order.id);
    setNotice(null);
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST' });
      setNotice({ kind: 'success', text: 'Order cancelled. The painting is back on sale.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      orders.reload();
    }
  }

  return (
    <>
      <PageHeader
        title={studio ? 'Orders' : 'My orders'}
        subtitle={studio ? 'Every painting sold through the site, newest first.' : 'Paintings you’ve bought. Cancelling puts a painting back on sale.'}
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <AsyncView
        state={orders}
        isEmpty={(d) => d.orders.length === 0}
        emptyTitle="No orders yet"
        emptyIcon="bag"
        empty={studio ? 'Orders appear here as soon as a customer buys a painting.' : <>Find something you love in the <Link to="/">gallery</Link>.</>}
      >
        {(d) => (
          <div className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Painting</th>
                  {studio && <th>Customer</th>}
                  <th>Price</th>
                  <th>Placed</th>
                  <th>Status</th>
                  {!studio && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {d.orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="with-thumb">
                        {o.painting.imageUrl ? <img className="thumb" src={o.painting.imageUrl} alt="" /> : <span className="thumb" />}
                        <div>
                          <div className="cell-main">{o.painting.title}</div>
                          <div className="cell-sub">by {o.painting.artist}</div>
                        </div>
                      </div>
                    </td>
                    {studio && <td><div className="cell-main">{o.customer.name}</div><div className="cell-sub">{o.customer.email}</div></td>}
                    <td className="cell-main">{money(o.price)}</td>
                    <td className="nowrap muted">{niceTime(o.createdAt)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    {!studio && (
                      <td>
                        <div className="row-actions">
                          {o.status === 'placed' && (
                            <button type="button" className="danger small" onClick={() => cancel(o)} disabled={busy !== null}>
                              {busy === o.id ? 'Cancelling…' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </>
  );
}
