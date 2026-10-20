import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AsyncView, Field, Notice, StatusBadge } from '../components/ui.jsx';
import { addDays, money, niceDate } from '../format.js';

const STATUSES = ['requested', 'confirmed', 'declined', 'cancelled'];

export default function Bookings() {
  const { user } = useAuth();
  return user.role === 'studio' ? <StudioBookings /> : <CustomerBookings />;
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
      setNotice({ kind: 'success', text: 'Booking cancelled.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy(null);
      bookings.reload();
      taken.reload();
    }
  }

  return (
    <section>
      <h1>Book a wall painting</h1>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="two-col">
        <div className="card pad">
          <h2>New booking</h2>
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
        </div>

        <div>
          <h2>My bookings</h2>
          <AsyncView state={bookings} isEmpty={(d) => d.bookings.length === 0} empty="No bookings yet. Pick a date to get started.">
            {(d) => (
              <ul className="list">
                {d.bookings.map((b) => (
                  <li key={b.id} className="card pad row-item">
                    <div>
                      <strong>{niceDate(b.date)}</strong> · {b.wallSqft} sq ft · {money(b.price)}
                      <div className="muted wrap">{b.address}</div>
                    </div>
                    <div className="row-actions">
                      <StatusBadge status={b.status} />
                      {b.canCancel && (
                        <button type="button" className="danger" onClick={() => cancel(b)} disabled={busy !== null}>
                          {busy === b.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                      {!b.canCancel && ['requested', 'confirmed'].includes(b.status) && (
                        <span className="muted small">Too close to the date to cancel</span>
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
      {formError && <Notice notice={{ kind: 'error', text: formError }} onClose={() => setFormError(null)} />}
      <Field label="Date" error={errors.date || (dateTaken ? 'This date is already booked. Please pick another.' : null)}
        hint={`Between ${niceDate(minDate)} and ${niceDate(maxDate)}.`}>
        <input type="date" min={minDate} max={maxDate} value={form.date} onChange={set('date')} required />
      </Field>
      <Field label="Wall size (sq ft)" error={errors.wallSqft} hint="10 to 500 sq ft.">
        <input type="number" min={10} max={500} step={1} value={form.wallSqft} onChange={set('wallSqft')} required />
      </Field>
      <Field label="Address" error={errors.address}>
        <textarea rows={3} value={form.address} onChange={set('address')} required minLength={5} maxLength={300} />
      </Field>
      <p className="price-line">
        Price: <strong>{validSize ? money(sqft * options.muralRatePerSqFt) : '—'}</strong>
        <span className="muted"> ({money(options.muralRatePerSqFt)} per sq ft)</span>
      </p>
      <button type="submit" disabled={busy || dateTaken}>{busy ? 'Booking…' : 'Request booking'}</button>

      <div className="taken">
        <span className="muted small">Already booked:</span>{' '}
        {taken.loading && !taken.data && <span className="muted small">checking…</span>}
        {taken.error && <span className="small field-error">couldn’t load booked dates (the server will still check).</span>}
        {taken.data && (takenDates.length === 0
          ? <span className="muted small">none, every date is open.</span>
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

  const shown = (d) => d.bookings.filter((b) => filter === 'all' || b.status === filter);

  return (
    <section>
      <div className="page-head">
        <h1>Wall bookings</h1>
        <StatusFilter value={filter} onChange={setFilter} statuses={STATUSES} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <AsyncView state={bookings} isEmpty={(d) => shown(d).length === 0}
        empty={filter === 'all' ? 'No bookings yet.' : `No ${filter} bookings.`}>
        {(d) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Customer</th><th>Wall</th><th>Price</th><th>Address</th><th>Status</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {shown(d).map((b) => (
                  <tr key={b.id}>
                    <td>{niceDate(b.date)}</td>
                    <td>{b.customer.name}<div className="muted">{b.customer.email}</div></td>
                    <td>{b.wallSqft} sq ft</td>
                    <td>{money(b.price)}</td>
                    <td className="wrap">{b.address}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="nowrap">
                      {b.status === 'requested' && (
                        <>
                          <button type="button" onClick={() => act(b, 'confirm')} disabled={busy !== null}>Confirm</button>{' '}
                          <button type="button" className="danger" onClick={() => act(b, 'decline')} disabled={busy !== null}>Decline</button>
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

export function StatusFilter({ value, onChange, statuses }) {
  return (
    <label className="filter">
      Show{' '}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">all</option>
        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}
