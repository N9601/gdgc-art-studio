import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, Notice } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await login(email, password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1>Welcome back</h1>
        <p className="subtitle">Log in to buy paintings, book a wall or order pottery.</p>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} inline />
      <form onSubmit={submit} className="form">
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <button type="submit" className="block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="auth-foot">New here? <Link to="/signup">Create a customer account</Link></p>
    </AuthLayout>
  );
}
