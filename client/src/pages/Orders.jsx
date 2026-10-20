import { useState } from 'react';
import { Link } from 'react-router';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AsyncView, Notice, StatusBadge } from '../components/ui.jsx';
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
      setNotice({ kind: 'success', text: 'Order cancelled.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      orders.reload();
    }
  }

  return (
    <section>
      <h1>{studio ? 'All orders' : 'My orders'}</h1>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <AsyncView
        state={orders}
        isEmpty={(d) => d.orders.length === 0}
        empty={studio ? 'No orders yet.' : <>You haven’t bought anything yet. <Link to="/">Browse paintings</Link></>}
      >
        {(d) => (
          <div className="table-wrap">
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
                    <td>{o.painting.title}<div className="muted">by {o.painting.artist}</div></td>
                    {studio && <td>{o.customer.name}<div className="muted">{o.customer.email}</div></td>}
                    <td>{money(o.price)}</td>
                    <td>{niceTime(o.createdAt)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    {!studio && (
                      <td>
                        {o.status === 'placed' && (
                          <button type="button" className="danger" onClick={() => cancel(o)} disabled={busy !== null}>
                            {busy === o.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </section>
  );
}
