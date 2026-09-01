import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { PageBackButton } from '@/components/page-back-button';
import { PageEmpty, PageStats } from '@/components/page-fill';
import { api } from '@/lib/api';
import type { StudentSummary } from '@/types/auth';

type Props = {
  selectedId: number | null;
  onSelect: (student: StudentSummary) => void;
  onClear: () => void;
  children: ReactNode;
};

export function DepartmentStudentGate({
  selectedId,
  onSelect,
  onClear,
  children,
}: Props) {
  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const selected = (studentsQuery.data ?? []).find((item) => item.id === selectedId) ?? null;
  const students = studentsQuery.data ?? [];

  if (!selectedId || !selected) {
    return (
      <div className="dept-student-picker-layout">
        <div className="dept-student-picker-stat">
          <PageStats
            items={[
              {
                label: 'Students',
                value: studentsQuery.isLoading ? '…' : students.length,
                icon: '🎓',
                tone: 'purple',
              },
            ]}
          />
        </div>
        <div className="panel dept-student-select-card">
          <h2>Select a student</h2>
          <div className="stack-list dept-student-select-list">
            {studentsQuery.isLoading ? <p className="muted">Loading students…</p> : null}
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                className="stack-item dept-student-select-item"
                onClick={() => onSelect(student)}>
                <div>
                  <strong>{student.name}</strong>
                  <span>{student.email}</span>
                </div>
                <span>›</span>
              </button>
            ))}
            {!studentsQuery.isLoading && students.length === 0 ? (
              <PageEmpty title="No students yet" />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dept-student-workspace page-stack">
      <div className="panel dept-student-banner dept-student-banner-sticky">
        <PageBackButton label="Back to students" onClick={onClear} />
        <div className="dept-student-banner-copy">
          <strong>{selected.name}</strong>
          <span className="muted">{selected.email}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
