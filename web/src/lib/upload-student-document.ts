import { api } from '@/lib/api';
import { prepareUploadFile } from '@/lib/prepare-upload-file';
import type { DocumentType, StudentDocument } from '@/types/auth';

export function canReplaceDocument(document: StudentDocument | null) {
  return Boolean(
    document && (document.status === 'pending' || document.status === 'rejected'),
  );
}

export async function uploadStudentDocument(options: {
  type: DocumentType;
  title: string;
  file: File;
  existing: StudentDocument | null;
}) {
  const { type, title, file, existing } = options;
  const canReplace = canReplaceDocument(existing);

  if (existing && !canReplace) {
    throw new Error(
      `Your ${title} is already ${existing.status_label.toLowerCase()} and cannot be replaced here.`,
    );
  }

  const formData = new FormData();
  formData.append('type', type);
  formData.append('title', title);
  const ready = await prepareUploadFile(file);
  formData.append('file', ready, ready.name);

  if (canReplace && existing) {
    await api.post(`/student/documents/${existing.id}`, formData);
    return;
  }

  await api.post('/student/documents', formData);
}
