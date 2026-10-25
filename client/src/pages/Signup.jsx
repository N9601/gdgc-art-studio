import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, Notice } from '../components/ui.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setErrors({});
    try {
      await signup(form.name, form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setErrors(err.fields ?? {});
      setNotice({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1>Create your account</h1>
        <p className="subtitle">It takes a few seconds. No card needed.</p>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} inline />
      <form onSubmit={submit} className="form">
        <Field label="Full name" error={errors.name}>
          <input value={form.name} onChange={set('name')} required autoComplete="name" placeholder="Asha Rao" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} maxLength={100} autoComplete="new-password" />
        </Field>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="auth-foot">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}
