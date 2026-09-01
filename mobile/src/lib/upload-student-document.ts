import { api } from '@/lib/api';
import type { DocumentType, StudentDocument } from '@/types/auth';

export type PickedUploadFile = {
  uri: string;
  name: string;
  mimeType: string | null;
};

export function canReplaceDocument(document: StudentDocument | null) {
  return Boolean(
    document && (document.status === 'pending' || document.status === 'rejected'),
  );
}

export async function uploadStudentDocument(options: {
  type: DocumentType;
  title: string;
  file: PickedUploadFile;
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
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  } as unknown as Blob);

  const path =
    canReplace && existing ? `/student/documents/${existing.id}` : '/student/documents';

  await api.post(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
