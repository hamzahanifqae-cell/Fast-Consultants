import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { hasPermission, isSuperAdminUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import './dashboard.css';

type Lead = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  preferred_country: string | null;
  study_level: string | null;
  education_level: string | null;
  intended_program: string | null;
  budget_range: string | null;
  preferred_intake: string | null;
  intake_year: string | null;
  qualification: string | null;
  grade: string | null;
  english_status: string | null;
  english_score: string | null;
  services: string[];
  contact_method: string | null;
  contact_time: string | null;
  timeline: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  status_label: string | null;
  classification: string | null;
  classification_label: string | null;
  classification_score: number | null;
  classification_reason: string | null;
  classification_model: string | null;
  classified_at: string | null;
  converted_user: { id: number; name: string; email: string } | null;
  converted_at: string | null;
  dismissed_at: string | null;
  staff_notes: string | null;
  created_at: string | null;
};

type ConvertResult = {
  lead: Lead;
  credentials: { email: string; password: string; login_url: string };
};

type FilterKey = 'all' | 'new' | 'classified' | 'converted' | 'dismissed';

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'classified', label: 'Classified' },
  { value: 'converted', label: 'Converted' },
  { value: 'dismissed', label: 'Dismissed' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="leads-field">
      <span className="leads-field-label">{label}</span>
      <span className="leads-field-value">{value}</span>
    </div>
  );
}

export function ConsultantLeadsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<ConvertResult['credentials'] | null>(
    null,
  );

  const canManage =
    isSuperAdminUser(user) ||
    hasPermission(user, 'leads.manage') ||
    user?.staff_department === 'leads';

  const leadsQuery = useQuery({
    queryKey: ['consultant-leads', filter],
    queryFn: async () => {
      const { data } = await api.get<{ data: Lead[] }>('/consultant/leads', {
        params: filter === 'all' ? undefined : { status: filter },
      });
      return data.data;
    },
    refetchInterval: 8000,
  });

  const leads = leadsQuery.data ?? [];
  const selected = useMemo(
    () => leads.find((item) => item.id === selectedId) ?? leads[0] ?? null,
    [leads, selectedId],
  );

  const score = selected?.classification_score ?? null;

  const convert = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a lead.');
      const { data } = await api.post<{ data: ConvertResult }>(
        `/consultant/leads/${selected.id}/convert`,
        {
          password,
          password_confirmation: passwordConfirmation,
          staff_notes: staffNotes.trim() || null,
        },
      );
      return data.data;
    },
    onSuccess: async (payload) => {
      setError(null);
      setPassword('');
      setPasswordConfirmation('');
      setCreatedCredentials(payload.credentials);
      setSelectedId(payload.lead.id);
      await queryClient.invalidateQueries({ queryKey: ['consultant-leads'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create student credentials.')),
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a lead.');
      await api.post(`/consultant/leads/${selected.id}/dismiss`, {
        staff_notes: staffNotes.trim() || null,
      });
    },
    onSuccess: async () => {
      setError(null);
      setCreatedCredentials(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-leads'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not dismiss lead.')),
  });

  function selectLead(lead: Lead) {
    setSelectedId(lead.id);
    setCreatedCredentials(null);
    setStaffNotes(lead.staff_notes ?? '');
    setError(null);
  }

  return (
    <AppShell title="Leads" badge="Admissions">
      <div className="leads-page">
        <header className="leads-page-intro">
          <div>
            <p className="leads-kicker">Admissions intake</p>
            <h2>Review enquiry forms and issue student access</h2>
          </div>
          <p className="leads-page-copy">
            Public applications from <code>/apply</code> land here. Check the model assessment, then
            create login credentials or dismiss the lead.
          </p>
        </header>

        <div className="leads-workspace">
          <aside className="leads-inbox panel">
            <div className="leads-inbox-head">
              <div>
                <h3>Inbox</h3>
                <p className="muted">
                  {leadsQuery.isLoading ? 'Loading…' : `${leads.length} lead${leads.length === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>

            <div className="leads-filters" role="tablist" aria-label="Lead filters">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.value}
                  className={`leads-filter${filter === item.value ? ' active' : ''}`}
                  onClick={() => setFilter(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="leads-list">
              {!leadsQuery.isLoading && leads.length === 0 ? (
                <div className="leads-empty">
                  <strong>No leads in this view</strong>
                  <p>New enquiries from the leading page will appear here automatically.</p>
                </div>
              ) : null}

              {leads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className={`leads-list-item${selected?.id === lead.id ? ' active' : ''}`}
                  onClick={() => selectLead(lead)}>
                  <span className="leads-avatar" aria-hidden>
                    {initials(lead.name) || 'L'}
                  </span>
                  <span className="leads-list-copy">
                    <strong>{lead.name}</strong>
                    <span>{lead.email}</span>
                    <span className="leads-list-meta">
                      {[lead.preferred_country, lead.intended_program, formatWhen(lead.created_at)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={`lead-tag ${lead.classification ?? 'pending'}`}>
                    {lead.classification_label ?? 'Pending'}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="leads-detail panel">
            {!selected ? (
              <div className="leads-empty">
                <strong>Select a lead</strong>
                <p>Choose an enquiry from the inbox to review details and take action.</p>
              </div>
            ) : (
              <>
                <div className="leads-detail-head">
                  <div className="leads-detail-identity">
                    <span className="leads-avatar large" aria-hidden>
                      {initials(selected.name) || 'L'}
                    </span>
                    <div>
                      <h3>{selected.name}</h3>
                      <p>
                        {selected.city || 'City not provided'}
                        {selected.created_at ? ` · Received ${formatWhen(selected.created_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="leads-detail-badges">
                    <span className="leads-status">{selected.status_label ?? selected.status}</span>
                    <span className={`lead-tag ${selected.classification ?? 'pending'}`}>
                      {selected.classification_label ?? 'Awaiting model'}
                    </span>
                  </div>
                </div>

                <div className={`leads-assessment ${selected.classification ?? 'pending'}`}>
                  <div className="leads-assessment-top">
                    <div>
                      <p className="leads-kicker">Model assessment</p>
                      <strong>{selected.classification_label ?? 'Processing'}</strong>
                    </div>
                    {score != null ? (
                      <div className="leads-score" aria-label={`Score ${score} out of 100`}>
                        <span className="leads-score-value">{score}</span>
                        <span className="leads-score-label">/ 100</span>
                      </div>
                    ) : null}
                  </div>
                  {score != null ? (
                    <div className="leads-score-bar" aria-hidden>
                      <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                    </div>
                  ) : null}
                  <p>
                    {selected.classification_reason ||
                      (selected.status === 'new'
                        ? 'Classification is still running in the background…'
                        : 'No model reason yet.')}
                  </p>
                  {selected.classification_model ? (
                    <p className="leads-assessment-meta">Engine · {selected.classification_model}</p>
                  ) : null}
                </div>

                <div className="leads-sections">
                  <section>
                    <h4>Contact</h4>
                    <div className="leads-fields">
                      <Field label="Email" value={selected.email} />
                      <Field label="Phone" value={selected.phone || '—'} />
                      <Field label="City" value={selected.city || '—'} />
                      <Field
                        label="Preferred contact"
                        value={
                          [selected.contact_method, selected.contact_time]
                            .filter(Boolean)
                            .join(' · ') || '—'
                        }
                      />
                    </div>
                  </section>

                  <section>
                    <h4>Study plans</h4>
                    <div className="leads-fields">
                      <Field label="Destination" value={selected.preferred_country || '—'} />
                      <Field
                        label="Study level"
                        value={selected.study_level || selected.education_level || '—'}
                      />
                      <Field label="Program" value={selected.intended_program || '—'} />
                      <Field
                        label="Intake"
                        value={
                          [selected.preferred_intake, selected.intake_year]
                            .filter(Boolean)
                            .join(' ') || '—'
                        }
                      />
                      <Field label="Budget" value={selected.budget_range || '—'} />
                    </div>
                  </section>

                  <section>
                    <h4>Academic profile</h4>
                    <div className="leads-fields">
                      <Field label="Qualification" value={selected.qualification || '—'} />
                      <Field label="CGPA / percentage" value={selected.grade || '—'} />
                      <Field label="English status" value={selected.english_status || '—'} />
                      <Field label="Test score" value={selected.english_score || '—'} />
                    </div>
                  </section>
                </div>

                <section className="leads-services-block">
                  <h4>Requested support</h4>
                  {(selected.services ?? []).length ? (
                    <div className="leads-service-chips">
                      {selected.services.map((service) => (
                        <span key={service}>{service}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No services selected.</p>
                  )}
                </section>

                {selected.message ? (
                  <section className="leads-message-block">
                    <h4>Message</h4>
                    <p>{selected.message}</p>
                  </section>
                ) : null}

                {selected.converted_user ? (
                  <div className="leads-notice success">
                    Student account already exists for <strong>{selected.converted_user.email}</strong>.
                    They can sign in at <code>/student/login</code>.
                  </div>
                ) : null}

                {createdCredentials ? (
                  <div className="leads-notice success">
                    <strong>Student login created</strong>
                    <div className="leads-credentials">
                      <div>
                        <span>Email</span>
                        <code>{createdCredentials.email}</code>
                      </div>
                      <div>
                        <span>Password</span>
                        <code>{createdCredentials.password}</code>
                      </div>
                    </div>
                    <p>Share these details with the student securely, then ask them to sign in.</p>
                  </div>
                ) : null}

                <section className="leads-actions">
                  <h4>Staff action</h4>
                  <label className="field">
                    <span>Internal notes</span>
                    <textarea
                      rows={3}
                      value={staffNotes}
                      onChange={(event) => setStaffNotes(event.target.value)}
                      disabled={!canManage || selected.status === 'converted'}
                      placeholder="Optional notes for your team"
                    />
                  </label>

                  {canManage && selected.status !== 'converted' && selected.status !== 'dismissed' ? (
                    <div className="leads-action-grid">
                      <label className="field">
                        <span>New student password</span>
                        <input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Minimum 8 characters"
                        />
                      </label>
                      <label className="field">
                        <span>Confirm password</span>
                        <input
                          type="password"
                          value={passwordConfirmation}
                          onChange={(event) => setPasswordConfirmation(event.target.value)}
                          placeholder="Re-enter password"
                        />
                      </label>
                      <div className="leads-action-buttons">
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={
                            convert.isPending ||
                            password.trim().length < 8 ||
                            password !== passwordConfirmation
                          }
                          onClick={() => convert.mutate()}>
                          {convert.isPending ? 'Creating…' : 'Create student credentials'}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn danger"
                          disabled={dismiss.isPending}
                          onClick={() => dismiss.mutate()}>
                          Dismiss lead
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {error ? <p className="form-error">{error}</p> : null}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
