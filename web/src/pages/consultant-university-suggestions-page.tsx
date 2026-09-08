import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, UniversitySuggestion } from '@/types/auth';
import './dashboard.css';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'metric', label: 'Matric' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree_certificate', label: 'Degree certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'english_test', label: 'IELTS score' },
  { value: 'recommendation_letter', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];

export function ConsultantUniversitySuggestionsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<DocumentType[]>([]);

  const suggestionsQuery = useQuery({
    queryKey: ['consultant-university-suggestions', 'pending'],
    queryFn: async () => {
      const { data } = await api.get<{ data: UniversitySuggestion[] }>(
        '/consultant/university-suggestions',
        { params: { status: 'pending' } },
      );
      return data.data;
    },
  });

  const accept = useMutation({
    mutationFn: async ({
      id,
      required_documents,
    }: {
      id: number;
      required_documents: DocumentType[];
    }) => {
      await api.post(`/consultant/university-suggestions/${id}/accept`, {
        required_documents,
      });
    },
    onSuccess: async () => {
      setError(null);
      setAcceptingId(null);
      setRequiredDocs([]);
      await queryClient.invalidateQueries({ queryKey: ['consultant-university-suggestions'] });
      await queryClient.invalidateQueries({ queryKey: ['consultant-universities'] });
      await queryClient.invalidateQueries({ queryKey: ['student-assigned-universities'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not accept suggestion.')),
  });

  const reject = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/consultant/university-suggestions/${id}/reject`);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-university-suggestions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not reject suggestion.')),
  });

  function toggleDoc(type: DocumentType) {
    setRequiredDocs((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function startAccept(id: number) {
    setAcceptingId(id);
    setRequiredDocs(['passport']);
    setError(null);
  }

  function confirmAccept() {
    if (acceptingId == null) return;
    if (requiredDocs.length === 0) {
      setError('Select at least one required document before accepting.');
      return;
    }
    accept.mutate({ id: acceptingId, required_documents: requiredDocs });
  }

  const list = suggestionsQuery.data ?? [];

  return (
    <AppShell
      badge="Universities"
      title="Student suggestions"
      backTo={routes.universities.root}
      backLabel="Universities">
      <div className="page-stack">
        <p className="muted" style={{ marginTop: 0 }}>
          <Link className="text-link-btn" to={routes.universities.share}>
            Open share page
          </Link>
        </p>

        {error ? <p className="form-error">{error}</p> : null}

        <section className="panel">
          <div className="suggestion-review-header">
            <div>
              <h2>Pending review</h2>
              <p className="muted">
                {suggestionsQuery.isLoading
                  ? 'Loading…'
                  : list.length === 0
                    ? 'No suggestions waiting for review.'
                    : `${list.length} suggestion${list.length === 1 ? '' : 's'} awaiting a decision.`}
              </p>
            </div>
            {list.length > 0 ? <span className="status-pill warn">Needs review</span> : null}
          </div>

          <div className="suggestion-review-list">
            {list.map((item) => {
              const isAccepting = acceptingId === item.id;
              const location = [item.city, item.country].filter(Boolean).join(', ');

              return (
                <article
                  key={item.id}
                  className={`suggestion-review-card${isAccepting ? ' is-open' : ''}`}>
                  <div className="suggestion-review-main">
                    <div className="suggestion-review-copy">
                      <div className="suggestion-review-title-row">
                        <h3>{item.name}</h3>
                        <span className="status-pill warn">Pending</span>
                      </div>
                      {location ? <p className="suggestion-review-location">{location}</p> : null}
                      {item.student ? (
                        <dl className="suggestion-review-meta">
                          <div>
                            <dt>Student</dt>
                            <dd>{item.student.name}</dd>
                          </div>
                          <div>
                            <dt>Email</dt>
                            <dd>{item.student.email}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </div>

                    {!isAccepting ? (
                      <div className="suggestion-review-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={accept.isPending || reject.isPending}
                          onClick={() => startAccept(item.id)}>
                          Accept
                        </button>
                        <button
                          type="button"
                          className="ghost-btn danger suggestion-reject-btn"
                          disabled={accept.isPending || reject.isPending}
                          onClick={() => reject.mutate(item.id)}>
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isAccepting ? (
                    <div className="suggestion-accept-panel">
                      <div className="suggestion-accept-copy">
                        <h4>Required documents</h4>
                      </div>
                      <div className="suggestion-doc-grid">
                        {DOCUMENT_TYPES.map((doc) => {
                          const active = requiredDocs.includes(doc.value);
                          return (
                            <label
                              key={doc.value}
                              className={`suggestion-doc-chip${active ? ' is-active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggleDoc(doc.value)}
                              />
                              <span>{doc.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="suggestion-review-actions">
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={accept.isPending}
                          onClick={confirmAccept}>
                          {accept.isPending ? 'Accepting…' : 'Confirm & share'}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={accept.isPending}
                          onClick={() => {
                            setAcceptingId(null);
                            setRequiredDocs([]);
                          }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
