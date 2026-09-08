import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { AppShell } from '@/components/shell';
import { SponsorshipLetterDocument } from '@/components/sponsorship-letter-document';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { api, getApiErrorMessage } from '@/lib/api';
import type { FormTemplateAssignment, FormTemplateDefinition } from '@/types/auth';
import './dashboard.css';

export function ConsultantFormTemplatesPage() {
  const queryClient = useQueryClient();
  const { studentId, selectStudent, clearStudent } = useDepartmentStudentParam();

  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['consultant-form-templates-catalog'],
    queryFn: async () => {
      const { data } = await api.get<{ data: FormTemplateDefinition[] }>(
        '/consultant/form-templates/catalog',
      );
      return data.data;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ['consultant-form-templates', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: FormTemplateAssignment[] }>(
        '/consultant/form-templates',
        { params: { student_id: studentId } },
      );
      return data.data;
    },
  });

  const letter = catalogQuery.data?.[0] ?? null;
  const items = templatesQuery.data ?? [];
  const awaitingStudent = useMemo(
    () => items.filter((item) => item.status === 'awaiting_student'),
    [items],
  );
  const awaitingReview = useMemo(
    () => items.filter((item) => item.status === 'awaiting_review'),
    [items],
  );
  const approved = useMemo(
    () => items.filter((item) => item.status === 'approved'),
    [items],
  );

  const sendLetter = useMutation({
    mutationFn: async () => {
      await api.post('/consultant/form-templates', {
        student_id: studentId,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-form-templates', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send letter.')),
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: {
      id: number;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      await api.patch(`/consultant/form-templates/${payload.id}/status`, payload);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-form-templates', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update status.')),
  });

  const deleteLetter = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/consultant/form-templates/${id}`);
    },
    onSuccess: async (_data, id) => {
      setError(null);
      setViewingId((current) => (current === id ? null : current));
      await queryClient.invalidateQueries({ queryKey: ['consultant-form-templates', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not delete letter.')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!studentId) {
      setError('Select a student first.');
      return;
    }
    sendLetter.mutate();
  }

  function confirmDelete(id: number) {
    if (!window.confirm('Delete this Sponsorship letter?')) return;
    deleteLetter.mutate(id);
  }

  return (
    <AppShell badge="Form templates" title="Form templates">
      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={selectStudent}
        onClear={() => {
          clearStudent();
          setError(null);
          setViewingId(null);
        }}>
        {error ? <p className="form-error">{error}</p> : null}

        <div className="org-layout form-templates-layout">
          <section className="panel form-templates-send">
            <h2>Sponsorship letter</h2>
            <form className="org-form" onSubmit={onSubmit}>
              <button
                type="submit"
                className="primary-btn"
                disabled={sendLetter.isPending || !letter}>
                {sendLetter.isPending ? 'Sending…' : 'Send to student'}
              </button>
            </form>
          </section>

          <section className="panel form-templates-status">
            <h2>Awaiting student</h2>
            {awaitingStudent.length === 0 && !templatesQuery.isLoading ? (
              <p className="muted form-templates-empty">None</p>
            ) : null}
            <div className="stack-list">
              {awaitingStudent.map((item) => (
                <div key={item.id} className="stack-item">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.status_label}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn danger"
                    disabled={deleteLetter.isPending}
                    onClick={() => confirmDelete(item.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <h2 className="form-templates-history-title">Awaiting review</h2>
            {awaitingReview.length === 0 && !templatesQuery.isLoading ? (
              <p className="muted form-templates-empty">None</p>
            ) : null}

            <div className="stack-list">
              {awaitingReview.map((item) => {
                const reason = reasons[item.id] ?? '';
                return (
                  <div key={item.id} className="form-review-card">
                    <div className="form-review-card-head">
                      <span className="status-pill warn">In review</span>
                      <button
                        type="button"
                        className="ghost-btn danger"
                        disabled={deleteLetter.isPending}
                        onClick={() => confirmDelete(item.id)}>
                        Delete
                      </button>
                    </div>

                    <SponsorshipLetterDocument item={item} showHeader={false} />

                    <div className="form-review-actions">
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({ id: item.id, status: 'approved' })
                        }>
                        Approve
                      </button>

                      <div className="reject-reason-card">
                        <label className="field reject-reason-field">
                          <span className="sr-only">Rejection reason</span>
                          <textarea
                            rows={3}
                            value={reason}
                            onChange={(event) =>
                              setReasons((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            placeholder="Reason for rejection"
                          />
                        </label>
                        <div className="reject-reason-card-footer">
                          <span />
                          <button
                            type="button"
                            className="ghost-btn danger"
                            disabled={updateStatus.isPending || reason.trim().length === 0}
                            onClick={() =>
                              updateStatus.mutate({
                                id: item.id,
                                status: 'rejected',
                                rejection_reason: reason.trim(),
                              })
                            }>
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="form-templates-history-title">Approved</h2>
            {approved.length === 0 && !templatesQuery.isLoading ? (
              <p className="muted form-templates-empty">None</p>
            ) : null}
            <div className="stack-list">
              {approved.map((item) => {
                const open = viewingId === item.id;
                return (
                  <div key={item.id} className="form-approved-card">
                    {open ? (
                      <>
                        <div className="stack-item">
                          <div>
                            <strong>{item.title}</strong>
                            <span className="status-pill success">{item.status_label}</span>
                          </div>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => setViewingId(null)}>
                            Hide
                          </button>
                        </div>
                        <SponsorshipLetterDocument item={item} showHeader={false} />
                      </>
                    ) : (
                      <div className="stack-item">
                        <div>
                          <strong>{item.title}</strong>
                          <span className="status-pill success">{item.status_label}</span>
                        </div>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setViewingId(item.id)}>
                          View
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </DepartmentStudentGate>
    </AppShell>
  );
}
