import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { PageEmpty } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { api, getApiErrorMessage } from '@/lib/api';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import { studentDocumentHeading } from '@/lib/student-document-heading';
import type { DocumentType, StudentDocument, UrgentDocumentRequest } from '@/types/auth';
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

export function ConsultantDocumentsPage() {
  const queryClient = useQueryClient();
  const { studentId, selectStudent, clearStudent } = useDepartmentStudentParam();

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

  const urgentQuery = useQuery({
    queryKey: ['consultant-urgent-documents', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: UrgentDocumentRequest[] }>(
        '/consultant/urgent-documents',
        { params: { student_id: studentId, open_only: 1 } },
      );
      return data.data;
    },
  });

  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [urgentTypes, setUrgentTypes] = useState<DocumentType[]>([]);

  const docs = documentsQuery.data ?? [];
  const openUrgent = urgentQuery.data ?? [];
  const pending = useMemo(() => docs.filter((item) => item.status === 'pending'), [docs]);
  const approved = useMemo(() => docs.filter((item) => item.status === 'approved'), [docs]);
  const openUrgentTypes = useMemo(
    () => new Set(openUrgent.map((item) => item.document_type)),
    [openUrgent],
  );

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['consultant-documents', studentId] }),
        queryClient.invalidateQueries({ queryKey: ['consultant-urgent-documents', studentId] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update document.')),
  });

  const requestUrgent = useMutation({
    mutationFn: async () => {
      await api.post('/consultant/urgent-documents', {
        student_id: studentId,
        document_types: urgentTypes,
      });
    },
    onSuccess: async () => {
      setError(null);
      setUrgentTypes([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['consultant-documents', studentId] }),
        queryClient.invalidateQueries({ queryKey: ['consultant-urgent-documents', studentId] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not request urgent documents.')),
  });

  const resolveUrgent = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/consultant/urgent-documents/${id}/resolve`);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-urgent-documents', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not clear urgent request.')),
  });

  function toggleUrgentType(type: DocumentType) {
    setUrgentTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

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
          setUrgentTypes([]);
        }}>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="stack-list">
          <div className="panel urgent-request-card">
            <div className="urgent-request-head">
              <div>
                <span className="urgent-request-eyebrow">Priority request</span>
                <h2>Request urgent documents</h2>
                <p className="muted">
                  Choose the files you need now. The student returns to Documents with an Urgent
                  documents status until staff approve them.
                </p>
              </div>
              {urgentTypes.length > 0 ? (
                <span className="status-pill warn">
                  {urgentTypes.length} selected
                </span>
              ) : null}
            </div>

            {openUrgent.length > 0 ? (
              <div className="urgent-request-open">
                <div className="urgent-request-section-label">
                  <strong>Open requests</strong>
                  <span>{openUrgent.length} waiting on student</span>
                </div>
                <div className="urgent-request-open-list">
                  {openUrgent.map((item) => (
                    <div key={item.id} className="urgent-request-open-item">
                      <div>
                        <strong>{item.document_type_label}</strong>
                        <span>{item.note || 'Awaiting upload or review'}</span>
                      </div>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={resolveUrgent.isPending}
                        onClick={() => resolveUrgent.mutate(item.id)}>
                        Clear
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="urgent-request-section">
              <div className="urgent-request-section-label">
                <strong>Document types</strong>
                <span>Select one or more</span>
              </div>
              <div className="urgent-type-row" role="group" aria-label="Urgent document types">
                {DOCUMENT_TYPES.map((item) => {
                  const selected = urgentTypes.includes(item.value);
                  const alreadyOpen = openUrgentTypes.has(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={selected}
                      className={`urgent-type-option${selected ? ' is-selected' : ''}${alreadyOpen ? ' is-open' : ''}`}
                      onClick={() => toggleUrgentType(item.value)}>
                      <span className="urgent-type-check" aria-hidden="true">
                        {selected || alreadyOpen ? '✓' : ''}
                      </span>
                      <span className="urgent-type-copy">
                        <strong>{item.label}</strong>
                        <span>
                          {alreadyOpen ? 'Already requested' : selected ? 'Selected' : 'Available'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="urgent-request-footer">
              <p className="muted">
                {urgentTypes.length === 0
                  ? 'Select at least one document type to continue.'
                  : `Ready to send ${urgentTypes.length} urgent request${urgentTypes.length === 1 ? '' : 's'}.`}
              </p>
              <button
                type="button"
                className="primary-btn"
                disabled={requestUrgent.isPending || urgentTypes.length === 0}
                onClick={() => requestUrgent.mutate()}>
                {requestUrgent.isPending ? 'Sending…' : 'Send urgent request'}
              </button>
            </div>
          </div>

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
                        {studentDocumentHeading(document)}
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
                      <p className="muted">Rejection note</p>
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
            <div className="stack-list">
              {docs.map((document) => (
                <div key={`all-${document.id}`} className="stack-item">
                  <div>
                    <strong>
                      {studentDocumentHeading(document)}
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
