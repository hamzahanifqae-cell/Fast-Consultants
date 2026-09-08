import type { StudentDocument } from '@/types/auth';

/** Avoid "CNIC, CNIC" / "Matric certificate, Matric" when title and type overlap. */
export function studentDocumentHeading(document: Pick<StudentDocument, 'title' | 'type_label'>): string {
  const title = document.title.trim();
  const typeLabel = document.type_label.trim();

  if (!title) return typeLabel;
  if (!typeLabel) return title;

  const titleLower = title.toLowerCase();
  const typeLower = typeLabel.toLowerCase();

  if (titleLower === typeLower) return title;
  if (titleLower.includes(typeLower) || typeLower.includes(titleLower)) {
    return title.length >= typeLabel.length ? title : typeLabel;
  }

  return `${title} · ${typeLabel}`;
}
