import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '@/lib/api';
import type { StudentSummary } from '@/types/auth';

export function useDepartmentStudentParam() {
  const [searchParams, setSearchParams] = useSearchParams();

  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const students = studentsQuery.data ?? [];
  const studentId = Number(searchParams.get('student')) || null;

  const selected = useMemo(
    () => students.find((student) => student.id === studentId) ?? null,
    [students, studentId],
  );

  const selectStudent = useCallback(
    (student: StudentSummary) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('student', String(student.id));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearStudent = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('student');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return {
    students,
    studentsQuery,
    studentId: selected?.id ?? null,
    selected,
    selectStudent,
    clearStudent,
  };
}
