import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthHeroPanel } from '@/components/auth-hero-panel';
import { AuthSheetLayout } from '@/components/auth-sheet-layout';
import { PastelBlobs } from '@/components/pastel-blobs';
import { ThemeToggle } from '@/components/theme-toggle';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  homeForPortal,
  portalLabel,
  portalMatchesUser,
  type Portal,
} from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse } from '@/types/auth';
import './auth.css';

type Props = {
  portal: Portal;
};

export function LoginPage({ portal }: Props) {
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const label = portalLabel(portal);
  const isStudent = portal === 'student';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      const { data } = await api.post<AuthResponse>('/login', {
        email: trimmedEmail,
        password,
      });
      if (!portalMatchesUser(portal, data.user)) {
        setError(
          portal === 'student'
            ? 'Only student accounts can sign in here.'
            : portal === 'superadmin'
              ? 'Only Super Admin, Admin, or Consultant accounts can sign in here.'
              : 'Only department Staff accounts can sign in here. Admins must use the Super Admin portal.',
        );
        return;
      }
      setSession(portal, data.token, data.user);
      navigate(homeForPortal(portal), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not sign in.'));
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
      <div className="auth-theme-corner">
        <ThemeToggle />
      </div>
      <AuthHeroPanel kicker={label} />

      <AuthSheetLayout>
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span className="auth-role-chip">{label}</span>
            <h2>Sign in</h2>
          </div>

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
            <span className="field-top">
              <span>Password</span>
              <button
                type="button"
                className="text-link"
                onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
            <input
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-btn" disabled={submitting} type="submit">
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          {isStudent ? (
            <p className="auth-footer">
              Don’t have an account? <Link to="/student/register">Create account</Link>
            </p>
          ) : null}
        </form>
      </AuthSheetLayout>
    </div>
  );
}
