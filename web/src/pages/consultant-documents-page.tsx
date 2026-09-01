import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { PageEmpty, PageStats, PageTips } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { api, getApiErrorMessage } from '@/lib/api';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import type { StudentDocument } from '@/types/auth';
import './dashboard.css';

export function ConsultantDocumentsPage() {
  const queryClient = useQueryClient();
  const { studentId, selectStudent, clearStudent, studentsQuery } = useDepartmentStudentParam();

  const documentsQuery = useQuery({
    queryKey: ['consultant-documents', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/consultant/documents', {
        params: { student_id: studentId },
      });
      return data.data;
    },
  });

  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  const docs = documentsQuery.data ?? [];
  const pending = useMemo(() => docs.filter((item) => item.status === 'pending'), [docs]);
  const approved = useMemo(() => docs.filter((item) => item.status === 'approved'), [docs]);
  const directoryCount = studentsQuery.data?.length ?? 0;

  const updateStatus = useMutation({
    mutationFn: async (payload: {
      id: number;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      await api.patch(`/consultant/documents/${payload.id}/status`, payload);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-documents', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update document.')),
  });

  async function viewDocument(document: StudentDocument) {
    setOpeningId(document.id);
    setError(null);
    try {
      await openAuthenticatedFile(
        `/consultant/documents/${document.id}/download`,
        document.original_name || document.title,
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open this document.'));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <AppShell
      badge="Documents"
      title="Documents">
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
              label: 'Pending review',
              value: documentsQuery.isLoading ? '…' : pending.length,
              hint: 'Need approve / reject',
              icon: '⏳',
              tone: 'gold',
            },
            {
              label: 'Approved',
              value: documentsQuery.isLoading ? '…' : approved.length,
              hint: 'Still viewable anytime',
              icon: '✓',
              tone: 'teal',
            },
            {
              label: 'All uploads',
              value: documentsQuery.isLoading ? '…' : docs.length,
              hint: 'For this student',
              icon: '📄',
              tone: 'blue',
            },
          ]}
        />
        <PageTips
          title="Review checklist"
          items={[
            'Open the file before approving or rejecting.',
            'Approved files stay available for Student Info and Super Admin.',
            'Always leave a short rejection reason.',
          ]}
        />
        <div className="stack-list">
          {documentsQuery.isLoading ? <p className="muted">Loading documents…</p> : null}
          {!documentsQuery.isLoading && pending.length === 0 ? (
            <PageEmpty
              title="No pending documents"
            />
          ) : null}
          {!documentsQuery.isLoading && approved.length > 0 ? (
            <div className="panel">
              <h2>Approved documents</h2>
              <div className="stack-list">
                {approved.map((document) => (
                  <div key={`approved-${document.id}`} className="stack-item">
                    <div>
                      <strong>
                        {document.title}, {document.type_label}
                      </strong>
                      <span>{document.original_name}</span>
                    </div>
                    <div className="doc-row-actions">
                      <span className="status-pill">{document.status_label}</span>
                      <button
                        type="button"
                        className="primary-btn doc-view-btn"
                        disabled={openingId === document.id}
                        onClick={() => void viewDocument(document)}>
                        {openingId === document.id ? 'Opening…' : 'View document'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {pending.map((document) => {
            const reason = reasons[document.id] ?? '';
            return (
              <div key={document.id} className="panel doc-review-card">
                <div className="doc-review-head">
                  <div>
                    <span className="status-pill warn">Pending review</span>
                    <h2>{document.title}</h2>
                    <p>
                      {document.type_label}, {document.original_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary-btn doc-view-btn"
                    disabled={openingId === document.id}
                    onClick={() => void viewDocument(document)}>
                    {openingId === document.id ? 'Opening…' : 'View document'}
                  </button>
                </div>

                <div className="doc-review-decide">
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: document.id, status: 'approved' })}>
                    Approve document
                  </button>

                  <div className="reject-reason-card">
                    <div className="reject-reason-card-head">
                      <strong>Reject with reason</strong>
                      <span>Required when sending back to the student</span>
                    </div>
                    <label className="field reject-reason-field">
                      <span className="sr-only">Rejection reason</span>
                      <textarea
                        rows={3}
                        value={reason}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [document.id]: event.target.value,
                          }))
                        }
                        placeholder="e.g. Bio page is blurry, please upload a clearer scan"
                      />
                    </label>
                    <div className="reject-reason-card-footer">
                      <p className="muted">The student will see this message on their Documents page.</p>
                      <button
                        type="button"
                        className="ghost-btn danger"
                        disabled={updateStatus.isPending || reason.trim().length === 0}
                        onClick={() =>
                          updateStatus.mutate({
                            id: document.id,
                            status: 'rejected',
                            rejection_reason: reason.trim(),
                          })
                        }>
                        Reject document
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="panel">
            <h2>All documents for this student</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Pending, approved, and rejected files stay listed here so Student Info and Super Admin
              can open them later.
            </p>
            <div className="stack-list">
              {docs.map((document) => (
                <div key={`all-${document.id}`} className="stack-item">
                  <div>
                    <strong>
                      {document.title}, {document.type_label}
                    </strong>
                    <span>
                      {document.original_name}, {document.status_label}
                      {document.rejection_reason ? `, ${document.rejection_reason}` : ''}
                    </span>
                  </div>
                  <div className="doc-row-actions">
                    <span
                      className={`status-pill${document.status === 'rejected' ? ' danger' : document.status === 'pending' ? ' warn' : ''}`}>
                      {document.status_label}
                    </span>
                    <button
                      type="button"
                      className="primary-btn doc-view-btn"
                      disabled={openingId === document.id}
                      onClick={() => void viewDocument(document)}>
                      {openingId === document.id ? 'Opening…' : 'View document'}
                    </button>
                  </div>
                </div>
              ))}
              {!documentsQuery.isLoading && docs.length === 0 ? (
                <PageEmpty
                  title="No uploads yet"
                />
              ) : null}
            </div>
          </div>
        </div>
      </DepartmentStudentGate>
    </AppShell>
  );
}
