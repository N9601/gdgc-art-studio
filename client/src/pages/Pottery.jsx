import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AsyncView, Field, Notice, StatusBadge } from '../components/ui.jsx';
import { addDays, niceDate } from '../format.js';
import { StatusFilter } from './Bookings.jsx';

const STATUSES = ['requested', 'accepted', 'declined', 'cancelled'];

export default function Pottery() {
  const { user } = useAuth();
  return user.role === 'studio' ? <StudioPottery /> : <CustomerPottery />;
}

// ---------------------------------------------------------------- customer

function CustomerPottery() {
  const options = useApi('/options');
  const requests = useApi('/pottery');
  const [editing, setEditing] = useState(null); // the request being edited, or null for a new one
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  async function cancel(r) {
    if (!window.confirm(`Cancel your request for ${r.quantity} × ${r.item.name}?`)) return;
    setBusy(r.id);
    setNotice(null);
    try {
      await api(`/pottery/${r.id}/cancel`, { method: 'POST' });
      setNotice({ kind: 'success', text: 'Request cancelled.' });
      if (editing?.id === r.id) setEditing(null);
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      requests.reload();
    }
  }

  return (
    <section>
      <h1>Custom pottery</h1>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="two-col">
        <div className="card pad">
          <h2>{editing ? `Edit request #${editing.id}` : 'New request'}</h2>
          <AsyncView state={options}>
            {(opt) => (
              <PotteryForm
                key={editing?.id ?? 'new'}
                options={opt}
                initial={editing}
                onSaved={(saved) => {
                  setNotice({ kind: 'success', text: editing ? 'Request updated.' : `Request sent: ${saved.quantity} × ${saved.item.name}.` });
                  setEditing(null);
                  requests.reload();
                }}
                onStopEditing={() => setEditing(null)}
                onConflict={() => requests.reload()}
              />
            )}
          </AsyncView>
        </div>

        <div>
          <h2>My requests</h2>
          <AsyncView state={requests} isEmpty={(d) => d.requests.length === 0} empty="No pottery requests yet.">
            {(d) => (
              <ul className="list">
                {d.requests.map((r) => (
                  <li key={r.id} className="card pad row-item">
                    <div>
                      <strong>{r.quantity} × {r.item.name}</strong> · {r.glaze.name}
                      <div className="muted">Needed by {niceDate(r.neededBy)}</div>
                      {r.notes && <div className="muted wrap">“{r.notes}”</div>}
                    </div>
                    <div className="row-actions">
                      <StatusBadge status={r.status} />
                      {r.status === 'requested' && (
                        <>
                          <button type="button" className="secondary" onClick={() => setEditing(r)} disabled={busy !== null}>Edit</button>
                          <button type="button" className="danger" onClick={() => cancel(r)} disabled={busy !== null}>
                            {busy === r.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        </div>
      </div>
    </section>
  );
}

const EMPTY_REQUEST = { itemId: '', glazeId: '', quantity: '1', neededBy: '', notes: '' };

function PotteryForm({ options, initial, onSaved, onStopEditing, onConflict }) {
  const [form, setForm] = useState(initial
    ? { itemId: initial.item.id, glazeId: initial.glaze.id, quantity: String(initial.quantity), neededBy: initial.neededBy, notes: initial.notes }
    : EMPTY_REQUEST);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const minDate = addDays(options.today, 14);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const body = { ...form, quantity: Number(form.quantity) };
      const { request } = initial
        ? await api(`/pottery/${initial.id}`, { method: 'PUT', body })
        : await api('/pottery', { method: 'POST', body });
      if (!initial) setForm(EMPTY_REQUEST);
      onSaved(request);
    } catch (err) {
      setErrors(err.fields ?? {});
      setFormError(err.message); // e.g. the studio accepted it a moment ago, so it can't be edited
      if (err.status === 409) onConflict();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      {formError && <Notice notice={{ kind: 'error', text: formError }} onClose={() => setFormError(null)} />}
      <Field label="Item" error={errors.itemId}>
        <select value={form.itemId} onChange={set('itemId')} required>
          <option value="" disabled>Choose an item</option>
          {options.potteryItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </Field>
      <Field label="Glaze" error={errors.glazeId}>
        <select value={form.glazeId} onChange={set('glazeId')} required>
          <option value="" disabled>Choose a glaze</option>
          {options.glazes.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Field>
      <Field label="Quantity" error={errors.quantity} hint="1 to 12.">
        <input type="number" min={1} max={12} step={1} value={form.quantity} onChange={set('quantity')} required />
      </Field>
      <Field label="Needed by" error={errors.neededBy} hint={`On or after ${niceDate(minDate)} (at least 14 days away).`}>
        <input type="date" min={minDate} value={form.neededBy} onChange={set('neededBy')} required />
      </Field>
      <Field label="Notes (optional)" error={errors.notes}>
        <textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={500} />
      </Field>
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Send request'}</button>
        {initial && <button type="button" className="secondary" onClick={onStopEditing}>Stop editing</button>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- studio

function StudioPottery() {
  const requests = useApi('/pottery');
  const [filter, setFilter] = useState('requested');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  async function act(r, action) {
    setBusy(r.id);
    setNotice(null);
    try {
      const { request } = await api(`/pottery/${r.id}/${action}`, { method: 'POST' });
      setNotice({ kind: 'success', text: `Request #${request.id} ${request.status}.` });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      requests.reload();
    }
  }

  const shown = (d) => d.requests.filter((r) => filter === 'all' || r.status === filter);

  return (
    <section>
      <div className="page-head">
        <h1>Pottery requests</h1>
        <StatusFilter value={filter} onChange={setFilter} statuses={STATUSES} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <AsyncView state={requests} isEmpty={(d) => shown(d).length === 0}
        empty={filter === 'all' ? 'No pottery requests yet.' : `No ${filter === 'requested' ? 'new' : filter} requests.`}>
        {(d) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Customer</th><th>Item</th><th>Glaze</th><th>Qty</th><th>Needed by</th><th>Notes</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {shown(d).map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.customer.name}<div className="muted">{r.customer.email}</div></td>
                    <td>{r.item.name}</td>
                    <td>{r.glaze.name}</td>
                    <td>{r.quantity}</td>
                    <td>{niceDate(r.neededBy)}</td>
                    <td className="wrap">{r.notes || <span className="muted">—</span>}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="nowrap">
                      {r.status === 'requested' && (
                        <>
                          <button type="button" onClick={() => act(r, 'accept')} disabled={busy !== null}>Accept</button>{' '}
                          <button type="button" className="danger" onClick={() => act(r, 'decline')} disabled={busy !== null}>Decline</button>
                        </>
                      )}
                    </td>
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
