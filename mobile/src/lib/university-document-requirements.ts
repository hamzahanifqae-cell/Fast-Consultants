import type { DocumentType, StudentDocument, University } from '@/types/auth';

export type UniversityDocRequirementStatus = 'missing' | 'pending' | 'rejected' | 'approved';

export type UniversityDocRequirement = {
  type: DocumentType;
  label: string;
  status: UniversityDocRequirementStatus;
};

export type UniversityDocCoverage = {
  items: UniversityDocRequirement[];
  requiredCount: number;
  coveredCount: number;
  pendingCount: number;
  actionCount: number;
  complete: boolean;
  missingLabels: string[];
};

export function documentRequirementStatus(
  documents: StudentDocument[],
  type: DocumentType,
): UniversityDocRequirementStatus {
  const matches = documents.filter((document) => document.type === type);
  if (matches.some((document) => document.status === 'approved')) return 'approved';
  if (matches.some((document) => document.status === 'pending')) return 'pending';
  if (matches.some((document) => document.status === 'rejected')) return 'rejected';
  return 'missing';
}

export function universityDocumentCoverage(
  universities: University[],
  documents: StudentDocument[],
): UniversityDocCoverage {
  const byType = new Map<DocumentType, string>();

  universities.forEach((university) => {
    (university.required_documents ?? []).forEach((requirement) => {
      if (!byType.has(requirement.type)) {
        byType.set(requirement.type, requirement.label);
      }
    });
  });

  const items: UniversityDocRequirement[] = Array.from(byType.entries()).map(([type, label]) => ({
    type,
    label,
    status: documentRequirementStatus(documents, type),
  }));

  const coveredCount = items.filter((item) => item.status === 'approved').length;
  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const actionCount = items.filter(
    (item) => item.status === 'missing' || item.status === 'rejected',
  ).length;
  const missingLabels = items
    .filter((item) => item.status === 'missing' || item.status === 'rejected')
    .map((item) => item.label);

  return {
    items,
    requiredCount: items.length,
    coveredCount,
    pendingCount,
    actionCount,
    complete: items.length === 0 || coveredCount >= items.length,
    missingLabels,
  };
}

export function universityDocumentStatusLabel(status: UniversityDocRequirementStatus): string {
  if (status === 'approved') return 'Approved';
  if (status === 'pending') return 'In review';
  if (status === 'rejected') return 'Rejected';
  return 'Not uploaded';
}
