import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthHeroPanel } from '@/components/auth-hero-panel';
import { AuthSheetLayout } from '@/components/auth-sheet-layout';
import { PastelBlobs } from '@/components/pastel-blobs';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import './auth.css';

type RegisterSuccess = {
  message?: string;
  approval_status?: string;
};

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { data } = await api.post<RegisterSuccess>('/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        account_type: 'student',
      });
      setSuccess(
        data.message ??
          'Account created. Leads staff will review your request. You can sign in after it is approved.',
      );
      setName('');
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
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
            <p className="muted" style={{ margin: '8px 0 0', fontWeight: 500 }}>
              After you sign up, Leads staff must approve your account before you can sign in.
            </p>
          </div>

          {success ? (
            <div className="form-success" style={{ display: 'grid', gap: 10 }}>
              <strong>Request submitted</strong>
              <p style={{ margin: 0 }}>{success}</p>
              <p className="auth-footer" style={{ margin: 0 }}>
                <Link to={StudentRoutes.login}>Go to sign in</Link>
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}

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
