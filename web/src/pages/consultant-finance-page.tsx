import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useRef, useState } from 'react';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { PageStats } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { handoffLockMessage, useStudentHandoff } from '@/hooks/use-student-handoff';
import { api, getApiErrorMessage } from '@/lib/api';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import { prepareUploadFile } from '@/lib/prepare-upload-file';
import type { ChargeReceipt } from '@/types/auth';
import './dashboard.css';

export function ConsultantFinancePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { studentId, selectStudent, clearStudent, studentsQuery } = useDepartmentStudentParam();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const receiptsQuery = useQuery({
    queryKey: ['consultant-charge-receipts', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/consultant/charge-receipts', {
        params: { student_id: studentId },
      });
      return data.data;
    },
  });

  const handoffQuery = useStudentHandoff(studentId);
  const chargeLock = handoffLockMessage(handoffQuery.data, 'finance');

  const awaitingReview = useMemo(
    () => (receiptsQuery.data ?? []).filter((item) => item.status === 'awaiting_review'),
    [receiptsQuery.data],
  );
  const directoryCount = studentsQuery.data?.length ?? 0;
  const allSlips = receiptsQuery.data ?? [];
  const approvedSlips = allSlips.filter((item) => item.status === 'approved').length;

  const createReceipt = useMutation({
    mutationFn: async () => {
      if (!file || !studentId) throw new Error('Student and file are required.');
      const ready = await prepareUploadFile(file);
      const formData = new FormData();
      formData.append('student_id', String(studentId));
      formData.append('title', title.trim());
      formData.append('currency', 'PKR');
      if (amount.trim()) formData.append('amount', amount.trim());
      if (notes.trim()) formData.append('notes', notes.trim());
      formData.append('file', ready, ready.name);
      await api.post('/consultant/charge-receipts', formData);
    },
    onSuccess: async () => {
      setTitle('');
      setAmount('');
      setNotes('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-charge-receipts', studentId] });
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        setError(err.message);
        return;
      }
      setError(getApiErrorMessage(err, 'Could not create charge slip.'));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: {
      id: number;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      await api.patch(`/consultant/charge-receipts/${payload.id}/status`, payload);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-charge-receipts', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update slip.')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !studentId || !file) {
      setError('Title and file are required.');
      return;
    }
    createReceipt.mutate();
  }

  async function viewSlip(path: string, title: string, key: string) {
    setOpeningKey(key);
    setError(null);
    try {
      await openAuthenticatedFile(path, title);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open this slip.'));
    } finally {
      setOpeningKey(null);
    }
  }

  return (
    <AppShell
      badge="Finance"
      title="A/C & Finance">
      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={selectStudent}
        onClear={() => {
          clearStudent();
          setError(null);
        }}>
        {error ? <p className="form-error">{error}</p> : null}

        <PageStats
          items={[
            {
              label: 'Students',
              value: studentsQuery.isLoading ? '…' : directoryCount,
              hint: 'In the shared directory',
              icon: '🎓',
              tone: 'purple',
            },
            {
              label: 'Awaiting review',
              value: receiptsQuery.isLoading ? '…' : awaitingReview.length,
              hint: 'Payment screenshots',
              icon: '⏳',
              tone: 'gold',
            },
            {
              label: 'Approved',
              value: receiptsQuery.isLoading ? '…' : approvedSlips,
              hint: 'For this student',
              icon: '✓',
              tone: 'teal',
            },
            {
              label: 'All slips',
              value: receiptsQuery.isLoading ? '…' : allSlips.length,
              hint: 'Sent to this student',
              icon: '💳',
              tone: 'blue',
            },
          ]}
        />

        <div className="org-layout">
          <section className="panel">
            <h2>All slips for this student</h2>
            <div className="stack-list">
              {(receiptsQuery.data ?? []).map((receipt) => (
                <div key={receipt.id} className="stack-item">
                  <div>
                    <strong>{receipt.title}</strong>
                    <span>{receipt.status_label}</span>
                  </div>
                  <div className="org-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={
                        openingKey ===
                        (receipt.student_file
                          ? `list-student-${receipt.id}`
                          : `list-consultant-${receipt.id}`)
                      }
                      onClick={() =>
                        void viewSlip(
                          receipt.student_file
                            ? `/consultant/charge-receipts/${receipt.id}/student-file`
                            : `/consultant/charge-receipts/${receipt.id}/consultant-file`,
                          receipt.student_file?.original_name ??
                            receipt.consultant_file?.original_name ??
                            receipt.title,
                          receipt.student_file
                            ? `list-student-${receipt.id}`
                            : `list-consultant-${receipt.id}`,
                        )
                      }>
                      {openingKey === `list-student-${receipt.id}` ||
                      openingKey === `list-consultant-${receipt.id}`
                        ? 'Opening…'
                        : 'View'}
                    </button>
                  </div>
                </div>
              ))}
              {!receiptsQuery.isLoading && (receiptsQuery.data ?? []).length === 0 ? (
                <p className="muted">No slips sent to this student yet.</p>
              ) : null}
            </div>

            <h2 style={{ marginTop: 24 }}>Awaiting review</h2>
            <div className="stack-list">
              {awaitingReview.map((receipt) => {
                const reason = reasons[receipt.id] ?? '';
                return (
                  <div key={receipt.id} className="panel doc-review-card">
                    <div className="doc-review-head">
                      <div>
                        <span className="status-pill warn">Awaiting review</span>
                        <h2>{receipt.title}</h2>
                        <p>
                          {receipt.amount
                            ? `${receipt.currency ?? ''} ${receipt.amount}`
                            : 'No amount listed'}
                        </p>
                      </div>
                    </div>

                    <div className="org-actions" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="primary-btn doc-view-btn"
                        disabled={openingKey === `consultant-${receipt.id}`}
                        onClick={() =>
                          void viewSlip(
                            `/consultant/charge-receipts/${receipt.id}/consultant-file`,
                            receipt.consultant_file?.original_name ?? receipt.title,
                            `consultant-${receipt.id}`,
                          )
                        }>
                        {openingKey === `consultant-${receipt.id}`
                          ? 'Opening…'
                          : 'View finance slip'}
                      </button>
                      {receipt.student_file ? (
                        <button
                          type="button"
                          className="primary-btn doc-view-btn"
                          disabled={openingKey === `student-${receipt.id}`}
                          onClick={() =>
                            void viewSlip(
                              `/consultant/charge-receipts/${receipt.id}/student-file`,
                              receipt.student_file!.original_name,
                              `student-${receipt.id}`,
                            )
                          }>
                          {openingKey === `student-${receipt.id}`
                            ? 'Opening…'
                            : 'View student payment'}
                        </button>
                      ) : null}
                    </div>

                    <div className="doc-review-decide">
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: receipt.id, status: 'approved' })}>
                        Approve payment
                      </button>

                      <div className="reject-reason-card">
                        <div className="reject-reason-card-head">
                          <strong>Reject with reason</strong>
                          <span>Required when asking the student to re-upload</span>
                        </div>
                        <label className="field reject-reason-field">
                          <span className="sr-only">Rejection reason</span>
                          <textarea
                            rows={3}
                            value={reason}
                            onChange={(event) =>
                              setReasons((current) => ({
                                ...current,
                                [receipt.id]: event.target.value,
                              }))
                            }
                            placeholder="e.g. Amount is unreadable, please upload a clearer screenshot"
                          />
                        </label>
                        <div className="reject-reason-card-footer">
                          <p className="muted">The student will see this note on their charge receipts.</p>
                          <button
                            type="button"
                            className="ghost-btn danger"
                            disabled={updateStatus.isPending || reason.trim().length === 0}
                            onClick={() =>
                              updateStatus.mutate({
                                id: receipt.id,
                                status: 'rejected',
                                rejection_reason: reason.trim(),
                              })
                            }>
                            Reject payment
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!receiptsQuery.isLoading && awaitingReview.length === 0 ? (
                <p className="muted">No payment screenshots waiting for this student.</p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <h2>Send charge slip</h2>
            {chargeLock ? <p className="handoff-lock">{chargeLock}</p> : null}
            <form className="org-form" onSubmit={onSubmit}>
              <label className="field">
                <span>Title</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label className="field">
                <span>Amount (optional)</span>
                <input value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label className="field">
                <span>Notes</span>
                <input value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <label className="field">
                <span>Slip file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  required
                />
                <span className="muted" style={{ marginTop: 6, display: 'block', fontSize: '0.85rem' }}>
                  PDF, JPG, or PNG. Large images are compressed automatically.
                </span>
              </label>
              <button
                className="primary-btn"
                type="submit"
                disabled={createReceipt.isPending || Boolean(chargeLock)}>
                {createReceipt.isPending ? 'Sending…' : 'Send to student'}
              </button>
            </form>
          </section>
        </div>
      </DepartmentStudentGate>
    </AppShell>
  );
}
