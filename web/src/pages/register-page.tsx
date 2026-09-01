import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthHeroPanel } from '@/components/auth-hero-panel';
import { AuthSheetLayout } from '@/components/auth-sheet-layout';
import { PastelBlobs } from '@/components/pastel-blobs';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse } from '@/types/auth';
import './auth.css';

export function RegisterPage() {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data } = await api.post<AuthResponse>('/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        account_type: 'student',
      });
      setSession('student', data.token, data.user);
      navigate(StudentRoutes.home, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the account.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <PastelBlobs />
      <Link to="/" className="back-pill" aria-label="Back to home">
        ← Home
      </Link>
      <AuthHeroPanel kicker="Student" />

      <AuthSheetLayout>
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span className="auth-role-chip">Student</span>
            <h2>Create account</h2>
          </div>

          <label className="field">
            <span>Full name</span>
            <input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              autoComplete="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Min 8 characters"
              required
            />
          </label>

          <label className="field">
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Repeat password"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-btn" disabled={submitting} type="submit">
            {submitting ? 'Creating…' : 'Sign Up'}
          </button>

          <p className="auth-footer">
            Already have an account? <Link to={StudentRoutes.login}>Sign in</Link>
          </p>
        </form>
      </AuthSheetLayout>
    </div>
  );
}

/** Blocks team signup attempts under the student portal. */
export function TeamRegisterBlocked() {
  return <Navigate to="/staff/login" replace />;
}
