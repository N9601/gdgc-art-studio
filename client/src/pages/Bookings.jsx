import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView, Empty, Field, Notice, PageHeader, StatusBadge, Tabs } from '../components/ui.jsx';
import { addDays, dateParts, money, niceDate } from '../format.js';

const STATUSES = ['requested', 'confirmed', 'declined', 'cancelled'];

export default function Bookings() {
  const { user } = useAuth();
  return user.role === 'studio' ? <StudioBookings /> : <CustomerBookings />;
}

export function DateTile({ date }) {
  const { month, day } = dateParts(date);
  return <div className="date-tile" aria-hidden="true"><span>{month}</span><strong>{day}</strong></div>;
}

// Status tabs with counts, shared by the studio's bookings and pottery pages.
export function statusTabs(items, statuses) {
  return [
    ...statuses.map((s) => ({ value: s, label: s, count: items.filter((i) => i.status === s).length })),
    { value: 'all', label: 'All', count: items.length },
  ];
}

// ---------------------------------------------------------------- customer

function CustomerBookings() {
  const options = useApi('/options');
  const taken = useApi('/bookings/taken-dates');
  const bookings = useApi('/bookings');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  async function cancel(b) {
    if (!window.confirm(`Cancel your wall painting booking on ${niceDate(b.date)}?`)) return;
    setBusy(b.id);
    setNotice(null);
    try {
      await api(`/bookings/${b.id}/cancel`, { method: 'POST' });
      setNotice({ kind: 'success', text: 'Booking cancelled. The date is free again.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      bookings.reload();
      taken.reload();
    }
  }

  return (
    <>
      <PageHeader title="Wall painting" subtitle="Book our artists to paint a mural on your wall. The studio confirms every booking." />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="split">
        <section className="card card-pad">
          <div className="card-title"><h2><Icon name="calendar" /> New booking</h2></div>
          <AsyncView state={options}>
            {(opt) => (
              <BookingForm
                options={opt}
                taken={taken}
                onBooked={(booking) => {
                  setNotice({ kind: 'success', text: `Booking requested for ${niceDate(booking.date)}. The studio will confirm it.` });
                  bookings.reload();
                  taken.reload();
                }}
                onConflict={() => taken.reload()}
              />
            )}
          </AsyncView>
        </section>

        <section className="stack">
          <h2>Your bookings</h2>
          <AsyncView state={bookings} isEmpty={(d) => d.bookings.length === 0} emptyIcon="calendar"
            emptyTitle="No bookings yet" empty="Pick a date and wall size to request your first mural.">
            {(d) => (
              <ul className="list">
                {d.bookings.map((b) => (
                  <li key={b.id} className="card list-item">
                    <DateTile date={b.date} />
                    <div className="list-item-main">
                      <div className="cell-main">{niceDate(b.date)}</div>
                      <div className="meta">
                        <span>{b.wallSqft} sq ft</span>
                        <span>{money(b.price)}</span>
                        <span className="wrap"><Icon name="mapPin" size={14} />{b.address}</span>
                      </div>
                    </div>
                    <div className="list-item-side">
                      <StatusBadge status={b.status} />
                      {b.canCancel && (
                        <button type="button" className="danger small" onClick={() => cancel(b)} disabled={busy !== null}>
                          {busy === b.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                      {!b.canCancel && ['requested', 'confirmed'].includes(b.status) && (
                        <span className="faint small">Can’t cancel within 3 days</span>
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

function BookingForm({ options, taken, onBooked, onConflict }) {
  const [form, setForm] = useState({ date: '', wallSqft: '', address: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const minDate = addDays(options.today, 7);
  const maxDate = addDays(options.today, 90);
  const sqft = Number(form.wallSqft);
  const validSize = Number.isInteger(sqft) && sqft >= 10 && sqft <= 500;
  const takenDates = taken.data?.dates ?? [];
  const dateTaken = takenDates.includes(form.date);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const { booking } = await api('/bookings', {
        method: 'POST',
        body: { date: form.date, wallSqft: sqft, address: form.address },
      });
      setForm({ date: '', wallSqft: '', address: '' });
      onBooked(booking);
    } catch (err) {
      setErrors(err.fields ?? {});
      setFormError(err.message); // e.g. "Sorry, that date has just been booked by someone else."
      if (err.status === 409) onConflict();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      {formError && <Notice notice={{ kind: 'error', text: formError }} onClose={() => setFormError(null)} inline />}
      <div className="form-row">
        <Field label="Date" error={errors.date || (dateTaken ? 'Already booked. Please pick another date.' : null)}>
          <input type="date" min={minDate} max={maxDate} value={form.date} onChange={set('date')} required />
        </Field>
        <Field label="Wall size (sq ft)" error={errors.wallSqft}>
          <input type="number" min={10} max={500} step={1} value={form.wallSqft} onChange={set('wallSqft')} required placeholder="10–500" />
        </Field>
      </div>
      <span className="field-hint">Dates from {niceDate(minDate)} to {niceDate(maxDate)}.</span>
      <Field label="Address" error={errors.address}>
        <textarea rows={3} value={form.address} onChange={set('address')} required minLength={5} maxLength={300} placeholder="House, street, area, city" />
      </Field>

      <div className="summary">
        <div>
          <div className="summary-label">Estimated price</div>
          <div className="faint small">{validSize ? `${sqft} sq ft × ${money(options.muralRatePerSqFt)}` : `${money(options.muralRatePerSqFt)} per sq ft`}</div>
        </div>
        <div className="summary-value">{validSize ? money(sqft * options.muralRatePerSqFt) : '₹—'}</div>
      </div>
      <button type="submit" disabled={busy || dateTaken}>{busy ? 'Booking…' : 'Request booking'}</button>

      <div className="chips">
        <span className="faint small">Already booked:</span>
        {taken.loading && !taken.data && <span className="faint small">checking…</span>}
        {taken.error && <span className="small field-error">couldn’t load booked dates (the server still checks).</span>}
        {taken.data && (takenDates.length === 0
          ? <span className="faint small">none, every date is open</span>
          : takenDates.map((d) => <span key={d} className="chip">{niceDate(d)}</span>))}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- studio

function StudioBookings() {
  const bookings = useApi('/bookings');
  const [filter, setFilter] = useState('requested');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  async function act(b, action) {
    setBusy(b.id);
    setNotice(null);
    try {
      const { booking } = await api(`/bookings/${b.id}/${action}`, { method: 'POST' });
      setNotice({ kind: 'success', text: `Booking on ${niceDate(booking.date)} ${booking.status}.` });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      bookings.reload();
    }
  }

  return (
    <>
      <PageHeader title="Wall bookings" subtitle="Confirm or decline mural requests. Declined dates open up again." />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <AsyncView state={bookings}>
        {(d) => {
          const shown = d.bookings.filter((b) => filter === 'all' || b.status === filter);
          return (
            <>
              <Tabs label="Filter bookings" value={filter} onChange={setFilter} options={statusTabs(d.bookings, STATUSES)} />
              {shown.length === 0 ? (
                <Empty icon="calendar" title={filter === 'requested' ? 'All caught up' : `No ${filter === 'all' ? '' : `${filter} `}bookings`}>
                  {filter === 'requested' ? 'There are no bookings waiting for a decision.' : 'Nothing to show here yet.'}
                </Empty>
              ) : (
                <div className="card table-card">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Customer</th><th>Wall</th><th>Price</th><th>Address</th><th>Status</th><th aria-label="Actions" /></tr>
                    </thead>
                    <tbody>
                      {shown.map((b) => (
                        <tr key={b.id}>
                          <td><div className="with-thumb"><DateTile date={b.date} /><span className="cell-main nowrap">{niceDate(b.date)}</span></div></td>
                          <td><div className="cell-main">{b.customer.name}</div><div className="cell-sub">{b.customer.email}</div></td>
                          <td className="nowrap">{b.wallSqft} sq ft</td>
                          <td className="cell-main">{money(b.price)}</td>
                          <td className="wrap muted">{b.address}</td>
                          <td><StatusBadge status={b.status} /></td>
                          <td>
                            {b.status === 'requested' && (
                              <div className="row-actions">
                                <button type="button" className="success small" onClick={() => act(b, 'confirm')} disabled={busy !== null}><Icon name="check" size={14} /> Confirm</button>
                                <button type="button" className="danger small" onClick={() => act(b, 'decline')} disabled={busy !== null}>Decline</button>
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
