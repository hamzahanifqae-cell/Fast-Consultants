import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { PageEmpty, SectionProgress } from '@/components/page-fill';
import { RejectionFeedback } from '@/components/rejection-feedback';
import { AppShell } from '@/components/shell';
import { SponsorshipLetterDocument } from '@/components/sponsorship-letter-document';
import { api, getApiErrorMessage } from '@/lib/api';
import type { FormTemplateAnswers, FormTemplateAssignment } from '@/types/auth';
import './dashboard.css';

function emptyAnswers(item: FormTemplateAssignment): FormTemplateAnswers {
  const next: FormTemplateAnswers = {};
  for (const field of item.fields) {
    next[field.key] = field.type === 'checkbox' ? false : '';
  }
  return next;
}

function statusPillClass(status: FormTemplateAssignment['status']): string {
  if (status === 'approved') return ' success';
  if (status === 'rejected') return ' danger';
  if (status === 'awaiting_student') return ' warn';
  return '';
}

export function StudentFormTemplatesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, FormTemplateAnswers>>({});

  const templatesQuery = useQuery({
    queryKey: ['student-form-templates'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormTemplateAssignment[] }>(
        '/student/form-templates',
      );
      return data.data;
    },
  });

  const items = templatesQuery.data ?? [];

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const item of items) {
        if (next[item.id]) continue;
        next[item.id] = {
          ...emptyAnswers(item),
          ...(item.answers ?? {}),
        };
      }
      return next;
    });
  }, [items]);

  const progress = useMemo(() => {
    const total = items.length;
    const action = items.filter(
      (item) => item.status === 'awaiting_student' || item.status === 'rejected',
    ).length;
    const review = items.filter((item) => item.status === 'awaiting_review').length;
    const approved = items.filter((item) => item.status === 'approved').length;

    if (total === 0) {
      return {
        percent: 0,
        title: 'No letters',
        description: '',
      };
    }
    if (action > 0) {
      return {
        percent: Math.round((approved / total) * 100),
        title: 'Action needed',
        description: `${action} to complete`,
      };
    }
    if (review > 0) {
      return {
        percent: Math.round(((approved + review * 0.5) / total) * 100),
        title: 'In review',
        description: `${review} with staff`,
      };
    }
    return {
      percent: 100,
      title: 'Complete',
      description: '',
    };
  }, [items]);

  const submit = useMutation({
    mutationFn: async ({ id, answers }: { id: number; answers: FormTemplateAnswers }) => {
      await api.put(`/student/form-templates/${id}/answers`, { answers });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-form-templates'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not submit Sponsorship letter.')),
  });

  function updateDraft(id: number, key: string, value: string | boolean) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {}),
        [key]: value,
      },
    }));
  }

  function onSubmit(event: FormEvent, item: FormTemplateAssignment) {
    event.preventDefault();
    const answers = drafts[item.id] ?? emptyAnswers(item);
    submit.mutate({ id: item.id, answers });
  }

  return (
    <AppShell badge="Student" title="Form templates">
      <div className="page-stack">
        <SectionProgress
          loading={templatesQuery.isLoading}
          title={progress.title}
          percent={progress.percent}
        />

        {error ? <p className="form-error">{error}</p> : null}

        {!templatesQuery.isLoading && items.length === 0 ? (
          <PageEmpty title="No letters" />
        ) : null}

        <div className="stack-list">
          {templatesQuery.isLoading ? <p className="muted">Loading…</p> : null}
          {items.map((item) => {
            const canEdit = item.status === 'awaiting_student' || item.status === 'rejected';
            const answers = drafts[item.id] ?? emptyAnswers(item);

            if (!canEdit) {
              return <SponsorshipLetterDocument key={item.id} item={item} />;
            }

            return (
              <div key={item.id} className="receipt-card form-letter-card">
                <div className="receipt-card-head">
                  <h2>{item.title}</h2>
                  <span className={`status-pill${statusPillClass(item.status)}`}>
                    {item.status_label}
                  </span>
                </div>

                {item.instructions ? <p className="field-hint">{item.instructions}</p> : null}
                {item.status === 'rejected' && item.rejection_reason ? (
                  <RejectionFeedback reason={item.rejection_reason} />
                ) : null}

                <form className="org-form" onSubmit={(event) => onSubmit(event, item)}>
                  {item.fields.map((field) => {
                    if (field.type === 'checkbox') {
                      return (
                        <label key={field.key} className="field checkbox-field">
                          <input
                            type="checkbox"
                            checked={Boolean(answers[field.key])}
                            onChange={(event) =>
                              updateDraft(item.id, field.key, event.target.checked)
                            }
                          />
                          <span>
                            {field.label}
                            {field.required ? ' *' : ''}
                          </span>
                        </label>
                      );
                    }

                    if (field.type === 'textarea') {
                      return (
                        <label key={field.key} className="field">
                          <span>
                            {field.label}
                            {field.required ? ' *' : ''}
                          </span>
                          <textarea
                            rows={3}
                            value={String(answers[field.key] ?? '')}
                            onChange={(event) =>
                              updateDraft(item.id, field.key, event.target.value)
                            }
                            required={field.required}
                          />
                        </label>
                      );
                    }

                    return (
                      <label key={field.key} className="field">
                        <span>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </span>
                        <input
                          type="text"
                          value={String(answers[field.key] ?? '')}
                          onChange={(event) =>
                            updateDraft(item.id, field.key, event.target.value)
                          }
                          required={field.required}
                        />
                      </label>
                    );
                  })}
                  <button type="submit" className="primary-btn" disabled={submit.isPending}>
                    {submit.isPending ? 'Submitting…' : 'Submit'}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
