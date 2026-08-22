import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, WarningCircle } from '@phosphor-icons/react';
import AuthLayout from '../components/layout/AuthLayout';
import PasswordField from '../components/ui/PasswordField';
import { useAuthStore } from '../store/useAuthStore';
import { apiErrorMessage } from '../api/axiosInstance';

export default function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not log in'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to open your schemas.">
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="login-email">Email</label>
          <div className="field__wrap">
            <input
              id="login-email"
              type="email"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          value={form.password}
          onChange={update('password')}
          autoComplete="current-password"
        />

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Signing in' : 'Sign in'}
          {!busy && <ArrowRight size={15} weight="bold" />}
        </button>
      </form>

      <p className="auth__foot">
        No account yet? <Link to="/register">Create one</Link>
      </p>
    </AuthLayout>
  );
}
