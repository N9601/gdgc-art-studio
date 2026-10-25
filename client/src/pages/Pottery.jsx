import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView, Empty, Field, Notice, PageHeader, StatusBadge, Tabs } from '../components/ui.jsx';
import { addDays, niceDate } from '../format.js';
import { statusTabs } from './Bookings.jsx';

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
      if (editing?.id === r.id) setEditing(null); // it can't be edited either
    } finally {
      setBusy(null);
      requests.reload();
    }
  }

  return (
    <>
      <PageHeader title="Custom pottery" subtitle="Pick a piece, a glaze and a quantity. You can edit or cancel until the studio accepts." />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="split">
        <section className="card card-pad">
          <div className="card-title">
            <h2><Icon name="vase" /> {editing ? `Edit request #${editing.id}` : 'New request'}</h2>
          </div>
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
                onConflict={(message) => {
                  // e.g. the studio accepted the request a moment ago: close the edit form and say why
                  if (editing) {
                    setEditing(null);
                    setNotice({ kind: 'error', text: message });
                  }
                  requests.reload();
                }}
              />
            )}
          </AsyncView>
        </section>

        <section className="stack">
          <h2>Your requests</h2>
          <AsyncView state={requests} isEmpty={(d) => d.requests.length === 0} emptyIcon="vase"
            emptyTitle="No requests yet" empty="Your custom pottery requests will appear here.">
            {(d) => (
              <ul className="list">
                {d.requests.map((r) => (
                  <li key={r.id} className="card list-item">
                    <span className="item-icon"><Icon name="vase" size={20} /></span>
                    <div className="list-item-main">
                      <div className="cell-main">{r.quantity} × {r.item.name}</div>
                      <div className="meta">
                        <span>{r.glaze.name} glaze</span>
                        <span><Icon name="clock" size={14} /> Needed by {niceDate(r.neededBy)}</span>
                      </div>
                      {r.notes && <div className="faint small wrap">“{r.notes}”</div>}
                    </div>
                    <div className="list-item-side">
                      <StatusBadge status={r.status} />
                      {r.status === 'requested' && (
                        <div className="row-actions">
                          <button type="button" className="secondary small" onClick={() => setEditing(r)} disabled={busy !== null}>Edit</button>
                          <button type="button" className="danger small" onClick={() => cancel(r)} disabled={busy !== null}>
                            {busy === r.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        </section>
      </div>
    </>
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
      if (err.status === 409) onConflict(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      {formError && <Notice notice={{ kind: 'error', text: formError }} onClose={() => setFormError(null)} inline />}
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
      <div className="form-row">
        <Field label="Quantity" error={errors.quantity} hint="1 to 12">
          <input type="number" min={1} max={12} step={1} value={form.quantity} onChange={set('quantity')} required />
        </Field>
        <Field label="Needed by" error={errors.neededBy} hint={`From ${niceDate(minDate)}`}>
          <input type="date" min={minDate} value={form.neededBy} onChange={set('neededBy')} required />
        </Field>
      </div>
      <Field label="Notes (optional)" error={errors.notes}>
        <textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={500} placeholder="Anything the potter should know" />
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

  return (
    <>
      <PageHeader title="Pottery requests" subtitle="Accept or decline custom pottery orders." />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <AsyncView state={requests}>
        {(d) => {
          const shown = d.requests.filter((r) => filter === 'all' || r.status === filter);
          return (
            <>
              <Tabs label="Filter requests" value={filter} onChange={setFilter} options={statusTabs(d.requests, STATUSES)} />
              {shown.length === 0 ? (
                <Empty icon="vase" title={filter === 'requested' ? 'All caught up' : 'Nothing here yet'}>
                  {filter === 'requested' ? 'There are no requests waiting for a decision.' : 'Requests will show up here.'}
                </Empty>
              ) : (
                <div className="card table-card">
                  <table>
                    <thead>
                      <tr><th>Request</th><th>Customer</th><th>Glaze</th><th>Qty</th><th>Needed by</th><th>Status</th><th aria-label="Actions" /></tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div className="with-thumb">
                              <span className="item-icon"><Icon name="vase" size={18} /></span>
                              <div>
                                <div className="cell-main">{r.item.name}</div>
                                <div className="cell-sub wrap">#{r.id}{r.notes ? ` · “${r.notes}”` : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td><div className="cell-main">{r.customer.name}</div><div className="cell-sub">{r.customer.email}</div></td>
                          <td>{r.glaze.name}</td>
                          <td className="cell-main">{r.quantity}</td>
                          <td className="nowrap">{niceDate(r.neededBy)}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td>
                            {r.status === 'requested' && (
                              <div className="row-actions">
                                <button type="button" className="success small" onClick={() => act(r, 'accept')} disabled={busy !== null}><Icon name="check" size={14} /> Accept</button>
                                <button type="button" className="danger small" onClick={() => act(r, 'decline')} disabled={busy !== null}>Decline</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
