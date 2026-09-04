import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { ApplicationHandoff, ApplicationStatusResponse } from '@/types/auth';

/**
 * Where the student sits in the department chain, so a page can explain why a
 * step is not open yet instead of letting staff submit and fail.
 */
export function useStudentHandoff(studentId: number | null) {
  return useQuery({
    queryKey: ['student-handoff', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        `/consultant/applications/${studentId}`,
      );
      return data.data.handoff;
    },
  });
}

export function handoffLockMessage(
  handoff: ApplicationHandoff | undefined,
  step: 'universities' | 'finance' | 'interview',
): string | null {
  if (!handoff) {
    return null;
  }

  if (step === 'universities') {
    return handoff.documents_approved
      ? null
      : 'Student Info is still reviewing this student\u2019s documents. You can share university options once every document is approved.';
  }

  if (step === 'finance') {
    return handoff.universities_shared
      ? null
      : 'Universities has not shared an option with this student yet. Charges can be raised after that.';
  }

  return handoff.fees_cleared
    ? null
    : 'A/C & Finance has not cleared this student\u2019s charges yet. The interview can be scheduled once every slip is approved.';
}
