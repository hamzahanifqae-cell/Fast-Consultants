import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useRef, useState } from 'react';

import { InlinePageLoader } from '@/components/app-loader';
import { PageEmpty, PageSplit, PageTips, SectionProgress } from '@/components/page-fill';
import { RejectionFeedback } from '@/components/rejection-feedback';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { prepareUploadFile } from '@/lib/prepare-upload-file';
import type { DocumentType, StudentDocument } from '@/types/auth';
import './dashboard.css';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'metric', label: 'Metric (Matric)' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree_certificate', label: 'Degree certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'english_test', label: 'IELTS score' },
  { value: 'recommendation_letter', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];

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

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const docs = documentsQuery.data ?? [];
  const editingDoc = docs.find((doc) => doc.id === editingId) ?? null;
  const counts = useMemo(() => {
    return {
      total: docs.length,
      pending: docs.filter((d) => d.status === 'pending').length,
      approved: docs.filter((d) => d.status === 'approved').length,
      rejected: docs.filter((d) => d.status === 'rejected').length,
    };
  }, [docs]);

  const documentsProgress = useMemo(() => {
    if (counts.total === 0) {
      return {
        percent: 0,
        title: 'Documents incomplete',
        description: 'Upload your admission files to get started.',
      };
    }
    if (counts.rejected > 0) {
      return {
        percent: Math.round((counts.approved / counts.total) * 100),
        title: 'Documents need attention',
        description: `${counts.rejected} file${counts.rejected === 1 ? '' : 's'} rejected, fix and re-upload.`,
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
  }, [counts]);

  function resetForm() {
    setEditingId(null);
    setType('passport');
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
          loading={documentsQuery.isLoading}
          title={documentsProgress.title}
          percent={documentsProgress.percent}
        />

        <PageSplit
          main={
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
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as DocumentType)}>
                    {DOCUMENT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
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
          }
          side={
            <PageTips
              title="Upload tips"
              items={[
                'Pending and rejected documents can be edited or deleted.',
                'Approved files stay locked after staff review.',
                'Large photos are compressed automatically before upload.',
              ]}
            />
          }
        />

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
                    {document.title}, {document.type_label}
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
