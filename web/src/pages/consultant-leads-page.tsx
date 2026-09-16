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
  whatsapp: string | null;
  city: string | null;
  address: string | null;
  visa_refusal: string | null;
  marital_status: string | null;
  date_of_birth: string | null;
  preferred_country: string | null;
  study_level: string | null;
  education_level: string | null;
  intended_program: string | null;
  budget_range: string | null;
  preferred_intake: string | null;
  intake_year: string | null;
  qualification: string | null;
  grade: string | null;
  passing_year: string | null;
  english_status: string | null;
  english_score: string | null;
  english_tests: { test: string; score: string }[] | null;
  travel_history: string | null;
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

type AccountRequest = {
  id: number;
  name: string;
  email: string;
  account_approval_status: 'pending' | 'approved' | 'rejected' | string;
  account_approval_status_label: string;
  account_approved_at: string | null;
  account_rejection_reason: string | null;
  reviewed_by: { id: number; name: string; email: string } | null;
  created_at: string | null;
};

type WorkspaceTab = 'enquiries' | 'accounts';
type AccountFilter = 'pending' | 'approved' | 'rejected';
type EnquiryFilter = 'pending' | 'approved';
type ClassificationFilter = 'all' | 'interested' | 'future' | 'ignore';

const ACCOUNT_FILTERS: { value: AccountFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const ENQUIRY_FILTERS: { value: EnquiryFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
];

const CLASSIFICATION_FILTERS: { value: ClassificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'interested', label: 'Interested' },
  { value: 'future', label: 'For future' },
  { value: 'ignore', label: 'Ignore' },
];

function isApprovedLead(lead: Lead): boolean {
  return lead.status === 'converted' || Boolean(lead.converted_user);
}

function matchesLeadSearch(lead: Lead, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    lead.name,
    lead.email,
    lead.phone,
    lead.whatsapp,
    lead.city,
    lead.preferred_country,
    lead.intended_program,
    lead.study_level,
    lead.education_level,
    lead.classification_label,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function matchesAccountSearch(request: AccountRequest, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [request.name, request.email, request.account_approval_status_label]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

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
  const [workspace, setWorkspace] = useState<WorkspaceTab>('enquiries');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('pending');
  const [enquiryFilter, setEnquiryFilter] = useState<EnquiryFilter>('pending');
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all');
  const [enquirySearch, setEnquirySearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<ConvertResult['credentials'] | null>(
    null,
  );

  const canManage =
    isSuperAdminUser(user) ||
    hasPermission(user, 'leads.manage') ||
    user?.staff_department === 'leads';

  const leadsQuery = useQuery({
    queryKey: ['consultant-leads'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Lead[] }>('/consultant/leads');
      return data.data;
    },
    refetchInterval: 8000,
    enabled: workspace === 'enquiries',
  });

  const accountsQuery = useQuery({
    queryKey: ['consultant-account-requests', accountFilter],
    queryFn: async () => {
      const { data } = await api.get<{ data: AccountRequest[] }>('/consultant/account-requests', {
        params: { status: accountFilter },
      });
      return data.data;
    },
    refetchInterval: 8000,
    enabled: workspace === 'accounts',
  });

  const pendingAccountsQuery = useQuery({
    queryKey: ['consultant-account-requests', 'pending'],
    queryFn: async () => {
      const { data } = await api.get<{ data: AccountRequest[] }>('/consultant/account-requests', {
        params: { status: 'pending' },
      });
      return data.data;
    },
    refetchInterval: 8000,
  });

  const leads = leadsQuery.data ?? [];
  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const statusMatch =
          enquiryFilter === 'approved' ? isApprovedLead(lead) : !isApprovedLead(lead);
        const classificationMatch =
          classificationFilter === 'all' || lead.classification === classificationFilter;
        return statusMatch && classificationMatch && matchesLeadSearch(lead, enquirySearch);
      }),
    [leads, enquiryFilter, classificationFilter, enquirySearch],
  );
  const selected = useMemo(
    () => filteredLeads.find((item) => item.id === selectedId) ?? filteredLeads[0] ?? null,
    [filteredLeads, selectedId],
  );

  const accounts = accountsQuery.data ?? [];
  const filteredAccounts = useMemo(
    () => accounts.filter((request) => matchesAccountSearch(request, accountSearch)),
    [accounts, accountSearch],
  );
  const selectedAccount = useMemo(
    () =>
      filteredAccounts.find((item) => item.id === selectedAccountId) ??
      filteredAccounts[0] ??
      null,
    [filteredAccounts, selectedAccountId],
  );

  const pendingCount = pendingAccountsQuery.data?.length ?? 0;
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
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create credentials.')),
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
      await queryClient.invalidateQueries({ queryKey: ['consultant-leads'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not dismiss lead.')),
  });

  const clearCredentials = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a lead.');
      const { data } = await api.post<{ data: Lead }>(
        `/consultant/leads/${selected.id}/clear-credentials`,
      );
      return data.data;
    },
    onSuccess: async (lead) => {
      setError(null);
      setCreatedCredentials(null);
      setSelectedId(lead.id);
      await queryClient.invalidateQueries({ queryKey: ['consultant-leads'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not clear credentials.')),
  });

  const approveAccount = useMutation({
    mutationFn: async () => {
      if (!selectedAccount) throw new Error('Select an account request.');
      const { data } = await api.post<{ data: AccountRequest; message?: string }>(
        `/consultant/account-requests/${selectedAccount.id}/approve`,
      );
      return data;
    },
    onSuccess: async (payload) => {
      setError(null);
      setAccountMessage(payload.message ?? 'Account approved.');
      setSelectedAccountId(payload.data.id);
      await queryClient.invalidateQueries({ queryKey: ['consultant-account-requests'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not approve account.')),
  });

  const rejectAccount = useMutation({
    mutationFn: async () => {
      if (!selectedAccount) throw new Error('Select an account request.');
      const { data } = await api.post<{ data: AccountRequest; message?: string }>(
        `/consultant/account-requests/${selectedAccount.id}/reject`,
        { reason: rejectReason.trim() || null },
      );
      return data;
    },
    onSuccess: async (payload) => {
      setError(null);
      setRejectReason('');
      setAccountMessage(payload.message ?? 'Account request rejected.');
      setSelectedAccountId(payload.data.id);
      await queryClient.invalidateQueries({ queryKey: ['consultant-account-requests'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not reject account.')),
  });

  function selectLead(lead: Lead) {
    setSelectedId(lead.id);
    setCreatedCredentials(null);
    setStaffNotes(lead.staff_notes ?? '');
    setError(null);
  }

  function selectAccount(request: AccountRequest) {
    setSelectedAccountId(request.id);
    setRejectReason('');
    setAccountMessage(null);
    setError(null);
  }

  return (
    <AppShell title="Leads" badge="Admissions">
      <div className="leads-page">
        <header className="leads-page-intro">
          <div>
            <p className="leads-kicker">Admissions intake</p>
            <h2>Review enquiry forms, account requests, and issue student access</h2>
          </div>
        </header>

        <div className="leads-workspace-tabs" role="tablist" aria-label="Leads workspace">
          <button
            type="button"
            role="tab"
            aria-selected={workspace === 'enquiries'}
            className={`leads-workspace-tab${workspace === 'enquiries' ? ' active' : ''}`}
            onClick={() => {
              setWorkspace('enquiries');
              setError(null);
            }}>
            Enquiries
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspace === 'accounts'}
            className={`leads-workspace-tab${workspace === 'accounts' ? ' active' : ''}`}
            onClick={() => {
              setWorkspace('accounts');
              setError(null);
              setAccountMessage(null);
            }}>
            Account requests
            {pendingCount > 0 ? <span className="count">{pendingCount}</span> : null}
          </button>
        </div>

        {workspace === 'enquiries' ? (
          <div className="leads-workspace">
            <aside className="leads-inbox panel">
              <div className="leads-inbox-head">
                <div>
                  <h3>Inbox</h3>
                  <p className="muted">
                    {leadsQuery.isLoading
                      ? 'Loading…'
                      : `${filteredLeads.length} ${enquiryFilter} lead${filteredLeads.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>

              <div className="leads-filters" role="tablist" aria-label="Enquiry filters">
                {ENQUIRY_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={enquiryFilter === item.value}
                    className={`leads-filter${enquiryFilter === item.value ? ' active' : ''}`}
                    onClick={() => {
                      setEnquiryFilter(item.value);
                      setSelectedId(null);
                      setError(null);
                      setCreatedCredentials(null);
                    }}>
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="leads-filters" role="tablist" aria-label="Classification filters">
                {CLASSIFICATION_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={classificationFilter === item.value}
                    className={`leads-filter${classificationFilter === item.value ? ' active' : ''}`}
                    onClick={() => {
                      setClassificationFilter(item.value);
                      setSelectedId(null);
                      setError(null);
                    }}>
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="leads-inbox-search">
                <span className="sr-only">Search leads</span>
                <input
                  type="search"
                  value={enquirySearch}
                  onChange={(event) => {
                    setEnquirySearch(event.target.value);
                    setSelectedId(null);
                  }}
                  placeholder="Search by name, email, destination…"
                  autoComplete="off"
                />
              </label>

              <div className="leads-list">
                {!leadsQuery.isLoading && filteredLeads.length === 0 ? (
                  <div className="leads-empty">
                    <strong>
                      {enquirySearch.trim()
                        ? 'No matching leads'
                        : enquiryFilter === 'approved'
                          ? 'No approved leads'
                          : classificationFilter !== 'all'
                            ? `No ${CLASSIFICATION_FILTERS.find((item) => item.value === classificationFilter)?.label.toLowerCase() ?? ''} leads`
                            : 'No pending leads'}
                    </strong>
                    <p>
                      {enquirySearch.trim()
                        ? 'Try a different name, email, or destination.'
                        : enquiryFilter === 'approved'
                          ? 'Leads with student credentials created will appear here.'
                          : classificationFilter !== 'all'
                            ? 'Try another classification filter or check Approved.'
                            : 'New enquiries from the leading page will appear here automatically.'}
                    </p>
                  </div>
                ) : null}

                {filteredLeads.map((lead) => {
                  const approved = isApprovedLead(lead);
                  const when = formatWhen(lead.created_at);
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      className={`leads-list-item${selected?.id === lead.id ? ' active' : ''}`}
                      onClick={() => selectLead(lead)}>
                      <span className="leads-list-main">
                        <span className="leads-avatar" aria-hidden>
                          {initials(lead.name) || 'L'}
                        </span>
                        <span className="leads-list-copy">
                          <strong className="leads-list-name">{lead.name}</strong>
                          <span className="leads-list-email">{lead.email}</span>
                          <span className="leads-list-meta">
                            {lead.preferred_country ? (
                              <span className="leads-meta-chip">{lead.preferred_country}</span>
                            ) : null}
                            {lead.intended_program ? (
                              <span className="leads-meta-chip">{lead.intended_program}</span>
                            ) : null}
                            {lead.study_level || lead.education_level ? (
                              <span className="leads-meta-chip">
                                {lead.study_level || lead.education_level}
                              </span>
                            ) : null}
                            {when ? <span className="leads-meta-time">{when}</span> : null}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`lead-tag leads-list-status ${
                          approved ? 'approved' : lead.classification ?? 'pending'
                        }`}>
                        {approved ? 'Approved' : (lead.classification_label ?? 'Pending')}
                      </span>
                    </button>
                  );
                })}
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
                        <Field label="Mobile" value={selected.phone || '—'} />
                        <Field label="WhatsApp" value={selected.whatsapp || '—'} />
                        <Field label="Date of birth" value={selected.date_of_birth || '—'} />
                        <Field label="Visa refusal" value={selected.visa_refusal || '—'} />
                        <Field label="Marital status" value={selected.marital_status || '—'} />
                        <Field label="City" value={selected.city || '—'} />
                        <Field label="Address" value={selected.address || '—'} />
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
                        <Field label="Passing year" value={selected.passing_year || '—'} />
                        <Field
                          label="English tests"
                          value={
                            (selected.english_tests ?? []).length > 0
                              ? selected.english_tests!
                                  .map((entry) =>
                                    entry.score
                                      ? `${entry.test} — ${entry.score}`
                                      : entry.test,
                                  )
                                  .join('; ')
                              : selected.english_status || selected.english_score
                                ? [selected.english_status, selected.english_score]
                                    .filter(Boolean)
                                    .join(' · ')
                                : '—'
                          }
                        />
                        <Field label="Travel history" value={selected.travel_history || '—'} />
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
                      {canManage ? (
                        <div className="leads-action-buttons" style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            className="ghost-btn danger"
                            disabled={clearCredentials.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Clear credentials for ${selected.converted_user?.email}? The student account will be deleted.`,
                                )
                              ) {
                                clearCredentials.mutate();
                              }
                            }}>
                            {clearCredentials.isPending ? 'Clearing…' : 'Clear student credentials'}
                          </button>
                        </div>
                      ) : null}
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
        ) : (
          <div className="leads-workspace">
            <aside className="leads-inbox panel">
              <div className="leads-inbox-head">
                <div>
                  <h3>Account requests</h3>
                  <p className="muted">
                    {accountsQuery.isLoading
                      ? 'Loading…'
                      : `${filteredAccounts.length} request${filteredAccounts.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>

              <div className="leads-filters" role="tablist" aria-label="Account request filters">
                {ACCOUNT_FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={accountFilter === item.value}
                    className={`leads-filter${accountFilter === item.value ? ' active' : ''}`}
                    onClick={() => {
                      setAccountFilter(item.value);
                      setSelectedAccountId(null);
                      setAccountMessage(null);
                      setError(null);
                    }}>
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="leads-inbox-search">
                <span className="sr-only">Search account requests</span>
                <input
                  type="search"
                  value={accountSearch}
                  onChange={(event) => {
                    setAccountSearch(event.target.value);
                    setSelectedAccountId(null);
                  }}
                  placeholder="Search by name or email…"
                  autoComplete="off"
                />
              </label>

              <div className="leads-list">
                {!accountsQuery.isLoading && filteredAccounts.length === 0 ? (
                  <div className="leads-empty">
                    <strong>
                      {accountSearch.trim() ? 'No matching requests' : 'No account requests'}
                    </strong>
                    <p>
                      {accountSearch.trim()
                        ? 'Try a different name or email.'
                        : 'Students who create an account from sign-in will appear here for review.'}
                    </p>
                  </div>
                ) : null}

                {filteredAccounts.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className={`leads-list-item${selectedAccount?.id === request.id ? ' active' : ''}`}
                    onClick={() => selectAccount(request)}>
                    <span className="leads-list-main">
                      <span className="leads-avatar" aria-hidden>
                        {initials(request.name) || 'S'}
                      </span>
                      <span className="leads-list-copy">
                        <strong className="leads-list-name">{request.name}</strong>
                        <span className="leads-list-email">{request.email}</span>
                        {request.created_at ? (
                          <span className="leads-list-meta">
                            <span className="leads-meta-time">
                              Requested {formatWhen(request.created_at)}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className={`lead-tag leads-list-status ${request.account_approval_status}`}>
                      {request.account_approval_status_label}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="leads-detail panel">
              {!selectedAccount ? (
                <div className="leads-empty">
                  <strong>Select a request</strong>
                  <p>Choose a student account request to approve or reject sign-in access.</p>
                </div>
              ) : (
                <>
                  <div className="leads-detail-head">
                    <div className="leads-detail-identity">
                      <span className="leads-avatar large" aria-hidden>
                        {initials(selectedAccount.name) || 'S'}
                      </span>
                      <div>
                        <h3>{selectedAccount.name}</h3>
                        <p>
                          {selectedAccount.email}
                          {selectedAccount.created_at
                            ? ` · Requested ${formatWhen(selectedAccount.created_at)}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="leads-detail-badges">
                      <span className={`lead-tag ${selectedAccount.account_approval_status}`}>
                        {selectedAccount.account_approval_status_label}
                      </span>
                    </div>
                  </div>

                  {selectedAccount.account_approval_status === 'pending' ? (
                    <div className="leads-notice warning">
                      This student created an account and is waiting for Leads approval before they can
                      sign in.
                    </div>
                  ) : null}

                  {selectedAccount.account_approval_status === 'approved' ? (
                    <div className="leads-notice success">
                      Approved
                      {selectedAccount.reviewed_by
                        ? ` by ${selectedAccount.reviewed_by.name}`
                        : ''}
                      . The student can sign in now.
                    </div>
                  ) : null}

                  {selectedAccount.account_approval_status === 'rejected' ? (
                    <div className="leads-notice">
                      Rejected
                      {selectedAccount.reviewed_by
                        ? ` by ${selectedAccount.reviewed_by.name}`
                        : ''}
                      .
                      {selectedAccount.account_rejection_reason ? (
                        <p>{selectedAccount.account_rejection_reason}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="leads-sections">
                    <section>
                      <h4>Applicant</h4>
                      <div className="leads-fields">
                        <Field label="Name" value={selectedAccount.name} />
                        <Field label="Email" value={selectedAccount.email} />
                        <Field
                          label="Requested"
                          value={formatWhen(selectedAccount.created_at) || '—'}
                        />
                        <Field
                          label="Reviewed by"
                          value={selectedAccount.reviewed_by?.name || '—'}
                        />
                      </div>
                    </section>
                  </div>

                  {canManage && selectedAccount.account_approval_status === 'pending' ? (
                    <section className="leads-actions">
                      <h4>Review decision</h4>
                      <label className="field">
                        <span>Rejection reason (optional)</span>
                        <textarea
                          rows={3}
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          placeholder="Shown to the student if you reject"
                        />
                      </label>
                      <div className="btn-row leads-action-buttons">
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={approveAccount.isPending || rejectAccount.isPending}
                          onClick={() => approveAccount.mutate()}>
                          {approveAccount.isPending ? 'Approving…' : 'Approve account'}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn danger"
                          disabled={approveAccount.isPending || rejectAccount.isPending}
                          onClick={() => rejectAccount.mutate()}>
                          {rejectAccount.isPending ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {accountMessage ? <p className="form-success">{accountMessage}</p> : null}
                  {error ? <p className="form-error">{error}</p> : null}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
