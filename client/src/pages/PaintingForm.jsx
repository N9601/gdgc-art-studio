import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { ErrorState, Field, Loading, Notice } from '../components/ui.jsx';

const blank = { title: '', artist: '', description: '', price: '', imageUrl: '' };

// Studio only: add a painting, or edit one that is still available.
export default function PaintingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [load, setLoad] = useState({ loading: editing, error: null });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  async function fetchPainting() {
    setLoad({ loading: true, error: null });
    try {
      const { painting } = await api(`/paintings/${id}`);
      setForm({ ...painting, price: String(painting.price), imageUrl: painting.imageUrl ?? '' });
      setLoad({ loading: false, error: null });
    } catch (error) {
      setLoad({ loading: false, error });
    }
  }
  useEffect(() => { if (editing) fetchPainting(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setNotice(null);
    const body = { ...form, price: Number(form.price) };
    try {
      await api(editing ? `/paintings/${id}` : '/paintings', { method: editing ? 'PUT' : 'POST', body });
      navigate('/');
    } catch (err) {
      setErrors(err.fields ?? {});
      setNotice({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  if (load.loading) return <Loading />;
  if (load.error) return <ErrorState error={load.error} onRetry={fetchPainting} />;
  const sold = form.status === 'sold';

  return (
    <section className="narrow">
      <p><Link to="/">← Back to paintings</Link></p>
      <h1>{editing ? 'Edit painting' : 'Add a painting'}</h1>
      {sold && <Notice notice={{ kind: 'error', text: 'This painting has been sold, so it can no longer be edited.' }} />}
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <form onSubmit={submit} className="form">
        <fieldset disabled={sold || busy}>
          <Field label="Title" error={errors.title}><input value={form.title} onChange={set('title')} required maxLength={200} /></Field>
          <Field label="Artist" error={errors.artist}><input value={form.artist} onChange={set('artist')} required maxLength={120} /></Field>
          <Field label="Description" error={errors.description}>
            <textarea rows={4} value={form.description} onChange={set('description')} maxLength={2000} />
          </Field>
          <Field label="Price (₹, whole rupees)" error={errors.price}>
            <input type="number" min={1} step={1} value={form.price} onChange={set('price')} required />
          </Field>
          <Field label="Image URL" error={errors.imageUrl} hint="Optional. A link to the picture, e.g. /images/p-001.jpg">
            <input value={form.imageUrl} onChange={set('imageUrl')} maxLength={500} />
          </Field>
          <button type="submit">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add painting'}</button>
        </fieldset>
      </form>
    </section>
  );
}
