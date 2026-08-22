import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, WarningCircle } from '@phosphor-icons/react';
import AuthLayout from '../components/layout/AuthLayout';
import PasswordField from '../components/ui/PasswordField';
import { useAuthStore } from '../store/useAuthStore';
import { apiErrorMessage } from '../api/axiosInstance';

export default function RegisterPage() {
  const user = useAuthStore((s) => s.user);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your account'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Takes a moment. Your projects stay yours.">
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="alert alert--error" role="alert">
            <WarningCircle size={15} weight="fill" />
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="reg-username">Username</label>
          <div className="field__wrap">
            <input
              id="reg-username"
              value={form.username}
              onChange={update('username')}
              autoComplete="username"
              placeholder="How you want to be shown"
              minLength={3}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <div className="field__wrap">
            <input
              id="reg-email"
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
          id="reg-password"
          label="Password"
          hint="At least 8 characters."
          value={form.password}
          onChange={update('password')}
          autoComplete="new-password"
          minLength={8}
        />

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Creating account' : 'Create account'}
          {!busy && <ArrowRight size={15} weight="bold" />}
        </button>
      </form>

      <p className="auth__foot">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
