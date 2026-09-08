import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { InlinePageLoader } from '@/components/app-loader';
import { PageEmpty, SectionProgress } from '@/components/page-fill';
import { RejectionFeedback } from '@/components/rejection-feedback';
import { SearchableSelect } from '@/components/searchable-select';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import { prepareUploadFile } from '@/lib/prepare-upload-file';
import { studentDocumentHeading } from '@/lib/student-document-heading';
import {
  universityDocumentCoverage,
  universityDocumentStatusLabel,
} from '@/lib/university-document-requirements';
import type {
  ApplicationStatusResponse,
  DocumentType,
  StudentDocument,
  University,
} from '@/types/auth';
import './dashboard.css';

const DOCUMENT_TYPES: { value: DocumentType; label: string; required?: boolean }[] = [
  { value: 'passport', label: 'Passport', required: true },
  { value: 'cnic', label: 'CNIC', required: true },
  { value: 'metric', label: 'Matric', required: true },
  { value: 'intermediate', label: 'Intermediate', required: true },
  { value: 'transcript', label: 'Transcript', required: true },
  { value: 'degree_certificate', label: 'Degree certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'english_test', label: 'IELTS score' },
  { value: 'recommendation_letter', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];

/** Catch-all types may be uploaded more than once; everything else is one file per type. */
const REPEATABLE_TYPES: DocumentType[] = ['other'];

function canModifyDocument(document: StudentDocument) {
  return document.status === 'pending' || document.status === 'rejected';
}

export function StudentDocumentsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [type, setType] = useState<DocumentType>('passport');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const universitiesQuery = useQuery({
    queryKey: ['student-universities'],
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/student/universities');
      return data.data;
    },
  });

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
  });

  const docs = documentsQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const urgentDocuments = statusQuery.data?.checklist.urgent_documents;
  const universityCoverage = useMemo(
    () => universityDocumentCoverage(universities, docs),
    [universities, docs],
  );
  const universityRequiredTypes = useMemo(
    () => new Set(universityCoverage.items.map((item) => item.type)),
    [universityCoverage],
  );
  const urgentRequiredTypes = useMemo(
    () => new Set((urgentDocuments?.missing ?? []).map((item) => item.type)),
    [urgentDocuments],
  );
  const editingDoc = docs.find((doc) => doc.id === editingId) ?? null;
  const counts = useMemo(() => {
    return {
      total: docs.length,
      pending: docs.filter((d) => d.status === 'pending').length,
      approved: docs.filter((d) => d.status === 'approved').length,
      rejected: docs.filter((d) => d.status === 'rejected').length,
    };
  }, [docs]);

  const uploadedByType = useMemo(() => {
    const map = new Map<DocumentType, StudentDocument>();
    docs.forEach((doc) => {
      if (!map.has(doc.type)) map.set(doc.type, doc);
    });
    return map;
  }, [docs]);

  /** An uploaded type drops out of the list, so students edit that file instead of re-uploading. */
  const typeOptions = useMemo(
    () =>
      DOCUMENT_TYPES.filter(
        (item) =>
          item.value === editingDoc?.type ||
          REPEATABLE_TYPES.includes(item.value) ||
          !uploadedByType.has(item.value),
      ).map((item) => {
        const required =
          item.required ||
          universityRequiredTypes.has(item.value) ||
          urgentRequiredTypes.has(item.value);
        const urgent = urgentRequiredTypes.has(item.value);
        return {
          value: item.value,
          label: urgent
            ? `${item.label} (urgent)`
            : required
              ? `${item.label} *`
              : item.label,
        };
      }),
    [uploadedByType, editingDoc, universityRequiredTypes, urgentRequiredTypes],
  );

  const uploadedTypeLabels = useMemo(
    () =>
      DOCUMENT_TYPES.filter(
        (item) => !REPEATABLE_TYPES.includes(item.value) && uploadedByType.has(item.value),
      ).map((item) => item.label),
    [uploadedByType],
  );

  useEffect(() => {
    if (editingId) return;
    if (typeOptions.some((option) => option.value === type)) return;
    setType((typeOptions[0]?.value as DocumentType) ?? 'other');
  }, [typeOptions, type, editingId]);

  const documentsProgress = useMemo(() => {
    if (urgentDocuments && urgentDocuments.required > 0 && !urgentDocuments.complete) {
      return {
        percent: Math.round(
          ((urgentDocuments.covered + urgentDocuments.pending * 0.5) /
            Math.max(urgentDocuments.required, 1)) *
            100,
        ),
        title: 'Urgent documents',
        description:
          urgentDocuments.action_needed > 0
            ? `${urgentDocuments.action_needed} urgent file${urgentDocuments.action_needed === 1 ? '' : 's'} still needed.`
            : `${urgentDocuments.pending} urgent file${urgentDocuments.pending === 1 ? '' : 's'} waiting for staff review.`,
      };
    }
    if (counts.total === 0 && universityCoverage.requiredCount === 0) {
      return {
        percent: 0,
        title: 'Documents incomplete',
        description: 'No files yet.',
      };
    }
    if (counts.rejected > 0) {
      return {
        percent: Math.round((counts.approved / Math.max(counts.total, 1)) * 100),
        title: 'Documents need attention',
        description: `${counts.rejected} file${counts.rejected === 1 ? '' : 's'} rejected, fix and re-upload.`,
      };
    }
    if (universityCoverage.requiredCount > 0 && !universityCoverage.complete) {
      const uploadPercent =
        counts.total === 0
          ? 0
          : counts.pending > 0
            ? Math.round(((counts.approved + counts.pending * 0.5) / counts.total) * 100)
            : Math.round((counts.approved / counts.total) * 100);
      const uniPercent = Math.round(
        (universityCoverage.coveredCount / universityCoverage.requiredCount) * 100,
      );
      return {
        percent: Math.round((uploadPercent + uniPercent) / 2),
        title: 'University documents needed',
        description:
          universityCoverage.actionCount > 0
            ? `${universityCoverage.actionCount} required file${universityCoverage.actionCount === 1 ? '' : 's'} still missing for your universities.`
            : `${universityCoverage.pendingCount} university document${universityCoverage.pendingCount === 1 ? '' : 's'} waiting for staff review.`,
      };
    }
    if (counts.pending > 0) {
      return {
        percent: Math.round(((counts.approved + counts.pending * 0.5) / counts.total) * 100),
        title: 'Documents in review',
        description: `${counts.approved} approved, ${counts.pending} pending review.`,
      };
    }
    return {
      percent: 100,
      title: 'Documents complete',
      description: `All ${counts.approved} uploaded file${counts.approved === 1 ? '' : 's'} are approved.`,
    };
  }, [counts, universityCoverage, urgentDocuments]);

  function resetForm() {
    setEditingId(null);
    setType((typeOptions[0]?.value as DocumentType) ?? 'other');
    setTitle('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function startEdit(document: StudentDocument) {
    setEditingId(document.id);
    setType(document.type);
    setTitle(document.title);
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    window.scrollTo(0, 0);
  }

  async function viewDocument(document: StudentDocument) {
    setOpeningId(document.id);
    setError(null);
    try {
      await openAuthenticatedFile(
        `/student/documents/${document.id}/download`,
        document.original_name || document.title,
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open this document.'));
    } finally {
      setOpeningId(null);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!editingId && !file) {
        throw new Error('Choose a file to upload.');
      }

      const formData = new FormData();
      formData.append('type', type);
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      if (file) {
        const ready = await prepareUploadFile(file);
        formData.append('file', ready, ready.name);
      }

      if (editingId) {
        await api.post(`/student/documents/${editingId}`, formData);
      } else {
        await api.post('/student/documents', formData);
      }
    },
    onSuccess: async () => {
      resetForm();
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        setError(err.message);
        return;
      }
      setError(getApiErrorMessage(err, editingId ? 'Could not update document.' : 'Could not upload document.'));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/student/documents/${id}`);
    },
    onSuccess: async (_data, id) => {
      if (editingId === id) {
        resetForm();
      }
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not delete document.')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const alreadyUploaded = uploadedByType.get(type);
    if (!editingId && alreadyUploaded && !REPEATABLE_TYPES.includes(type)) {
      setError(
        `${alreadyUploaded.type_label} is already uploaded. Edit that file below if it was rejected.`,
      );
      return;
    }
    if (!editingId && !file) {
      setError('Choose a file to upload.');
      return;
    }
    setError(null);
    save.mutate();
  }

  function onDelete(document: StudentDocument) {
    if (!window.confirm(`Delete “${document.title}”? This cannot be undone.`)) {
      return;
    }
    remove.mutate(document.id);
  }

  return (
    <AppShell
      badge="Student"
      title="Documents">
      <div className="page-stack">
        <SectionProgress
          loading={documentsQuery.isLoading || statusQuery.isLoading}
          title={documentsProgress.title}
          percent={documentsProgress.percent}
        />

        {urgentDocuments && urgentDocuments.required > 0 ? (
          <section className="panel university-docs-banner urgent-docs-banner needs-action">
            <div className="university-docs-banner-head">
              <div>
                <h2>Urgent documents</h2>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  Staff asked for these files now. Your application stays on Documents until they
                  are approved.
                </p>
              </div>
              <span className="status-pill warn">
                {urgentDocuments.action_needed > 0
                  ? `${urgentDocuments.action_needed} needed`
                  : `${urgentDocuments.pending} in review`}
              </span>
            </div>
            <div className="university-doc-chip-row">
              {urgentDocuments.missing.map((item) => {
                const existing = uploadedByType.get(item.type);
                return (
                  <button
                    key={`urgent-${item.id}`}
                    type="button"
                    className={`university-doc-chip status-${item.status}`}
                    onClick={() => {
                      if (existing && canModifyDocument(existing)) {
                        startEdit(existing);
                        return;
                      }
                      if (existing && !REPEATABLE_TYPES.includes(item.type)) {
                        return;
                      }
                      setEditingId(null);
                      setType(item.type);
                      setError(null);
                      window.scrollTo(0, 0);
                    }}>
                    <strong>{item.label}</strong>
                    <span>{universityDocumentStatusLabel(item.status)}</span>
                    {item.note ? <span className="muted">{item.note}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {universityCoverage.requiredCount > 0 ? (
          <section
            className={`panel university-docs-banner${universityCoverage.complete ? '' : ' needs-action'}`}>
            <div className="university-docs-banner-head">
              <div>
                <h2>Required for your universities</h2>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  {universityCoverage.complete
                    ? 'All university-required documents are approved.'
                    : `${universityCoverage.coveredCount} of ${universityCoverage.requiredCount} approved.`}
                </p>
              </div>
              <Link className="text-link-btn" to={StudentRoutes.universities}>
                View universities
              </Link>
            </div>
            <div className="university-doc-chip-row">
              {universityCoverage.items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className={`university-doc-chip status-${item.status}`}
                  disabled={uploadedByType.has(item.type) && !REPEATABLE_TYPES.includes(item.type)}
                  onClick={() => {
                    if (uploadedByType.has(item.type) && !REPEATABLE_TYPES.includes(item.type)) {
                      return;
                    }
                    setType(item.type);
                    setError(null);
                    window.scrollTo(0, 0);
                  }}>
                  <strong>{item.label}</strong>
                  <span>{universityDocumentStatusLabel(item.status)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel">
              <h2>{editingId ? 'Edit document' : 'Upload a document'}</h2>
              {editingDoc ? (
                <p className="muted" style={{ marginTop: 0 }}>
                  Updating “{editingDoc.title}”. Leave the file empty to keep the current file.
                </p>
              ) : null}
              <form className="org-form" onSubmit={onSubmit}>
                <label className="field">
                  <span>Type</span>
                  <SearchableSelect
                    value={type}
                    options={typeOptions}
                    searchable={false}
                    ariaLabel="Document type"
                    onChange={(value) => setType(value as DocumentType)}
                  />
                  {!editingId && uploadedTypeLabels.length ? (
                    <span
                      className="muted"
                      style={{ marginTop: 6, display: 'block', fontSize: '0.85rem' }}>
                      Already uploaded: {uploadedTypeLabels.join(', ')}. Use Edit below to replace a
                      rejected file.
                    </span>
                  ) : null}
                </label>
                <label className="field">
                  <span>Title (optional)</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Passport bio page"
                  />
                </label>
                <label className="field">
                  <span>{editingId ? 'Replace file (optional)' : 'File'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(event) => {
                      const next = event.target.files?.[0] ?? null;
                      setFile(next);
                      setError(null);
                    }}
                  />
                  <span className="muted" style={{ marginTop: 6, display: 'block', fontSize: '0.85rem' }}>
                    PDF, JPG, PNG, DOC, or DOCX. Large images are compressed automatically.
                    {editingDoc ? ` Current file: ${editingDoc.original_name}` : ''}
                  </span>
                </label>
                {error ? <p className="form-error">{error}</p> : null}
                <div className="doc-form-actions">
                  <button type="submit" className="primary-btn" disabled={save.isPending}>
                    {save.isPending
                      ? editingId
                        ? 'Saving…'
                        : 'Uploading…'
                      : editingId
                        ? 'Save changes'
                        : 'Upload'}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={save.isPending}
                      onClick={() => {
                        resetForm();
                        setError(null);
                      }}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

        <section className="panel">
          <h2>Your uploads</h2>
          <div className="stack-list">
            {documentsQuery.isLoading ? (
              <InlinePageLoader message="Loading your documents…" />
            ) : null}
            {docs.map((document) => (
              <div key={document.id} className="stack-item">
                <div>
                  <strong>
                    {studentDocumentHeading(document)}
                  </strong>
                  <span>{document.original_name}</span>
                  {document.status === 'rejected' && document.rejection_reason ? (
                    <RejectionFeedback reason={document.rejection_reason} />
                  ) : null}
                </div>
                <div className="doc-row-actions">
                  <span
                    className={`status-pill${document.status === 'rejected' ? ' danger' : document.status === 'pending' ? ' warn' : ''}`}>
                    {document.status_label}
                  </span>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={openingId === document.id}
                    onClick={() => void viewDocument(document)}>
                    {openingId === document.id ? 'Opening…' : 'View'}
                  </button>
                  {canModifyDocument(document) ? (
                    <>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={save.isPending || remove.isPending}
                        onClick={() => startEdit(document)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-btn danger"
                        disabled={save.isPending || remove.isPending}
                        onClick={() => onDelete(document)}>
                        {remove.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!documentsQuery.isLoading && docs.length === 0 ? (
              <PageEmpty
                title="No documents yet"
              />
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
