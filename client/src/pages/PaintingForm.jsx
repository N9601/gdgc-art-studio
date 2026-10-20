import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { ErrorState, Field, Loading, Notice, PageHeader, StatusBadge } from '../components/ui.jsx';
import { money } from '../format.js';

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
      navigate('/paintings');
    } catch (err) {
      setErrors(err.fields ?? {});
      setNotice({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  const back = <Link className="back" to="/paintings"><Icon name="arrowLeft" size={16} /> Back to paintings</Link>;
  if (load.loading) return <>{back}<Loading /></>;
  if (load.error) return <>{back}<ErrorState error={load.error} onRetry={fetchPainting} /></>;
  const sold = form.status === 'sold';
  const price = Number(form.price);

  return (
    <>
      {back}
      <PageHeader
        title={editing ? 'Edit painting' : 'Add a painting'}
        subtitle={editing ? 'Changes show in the gallery straight away.' : 'It goes on sale as soon as you save it.'}
      />
      {sold && <Notice notice={{ kind: 'error', text: 'This painting has been sold, so it can no longer be edited.' }} inline />}
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="split">
        <form onSubmit={submit} className="card card-pad form">
          <fieldset disabled={sold || busy}>
            <Field label="Title" error={errors.title}><input value={form.title} onChange={set('title')} required maxLength={200} /></Field>
            <Field label="Artist" error={errors.artist}><input value={form.artist} onChange={set('artist')} required maxLength={120} /></Field>
            <Field label="Description" error={errors.description}>
              <textarea rows={4} value={form.description} onChange={set('description')} maxLength={2000} />
            </Field>
            <Field label="Price (₹, whole rupees)" error={errors.price}>
              <input type="number" min={1} step={1} value={form.price} onChange={set('price')} required />
            </Field>
            <Field label="Image URL" error={errors.imageUrl} hint="Optional. For example /images/p-001.jpg">
              <input value={form.imageUrl} onChange={set('imageUrl')} maxLength={500} />
            </Field>
            <button type="submit">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add painting'}</button>
          </fieldset>
        </form>

        <div className="stack">
          <span className="field-label">Preview</span>
          <div className="card painting" style={{ maxWidth: 340 }}>
            <div className="painting-media">
              {form.imageUrl
                ? <img src={form.imageUrl} alt="" />
                : <div className="no-image"><Icon name="image" size={28} />No image</div>}
              <StatusBadge status={form.status ?? 'available'} />
            </div>
            <div className="painting-body">
              <h2>{form.title || 'Untitled'}</h2>
              <p className="artist">by {form.artist || 'Artist name'}</p>
              {form.description && <p className="description">{form.description}</p>}
              <div className="painting-foot"><span className="price">{price > 0 ? money(price) : '₹—'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
