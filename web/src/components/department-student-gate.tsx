import { useQuery } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { DirectoryList, directoryInitials } from '@/components/directory-list';
import { PageBackButton } from '@/components/page-back-button';
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
      <DirectoryList
        title="Student directory"
        countLabel={
          studentsQuery.isLoading
            ? '…'
            : `${students.length} student${students.length === 1 ? '' : 's'}`
        }
        items={students.map((student) => ({
          id: student.id,
          title: student.name,
          subtitle: student.email,
          onClick: () => onSelect(student),
        }))}
        loading={studentsQuery.isLoading}
        emptyTitle="No students yet"
        emptyBody="Students appear here once they register with your organization."
      />
    );
  }

  return (
    <div className="dept-student-workspace page-stack">
      <div className="panel dept-student-banner dept-student-banner-sticky">
        <PageBackButton label="Back to directory" onClick={onClear} />
        <div className="dept-student-banner-copy">
          <span className="dept-directory-avatar" aria-hidden>
            {directoryInitials(selected.name)}
          </span>
          <div className="dept-student-banner-text">
            <strong>{selected.name}</strong>
            <span className="muted">{selected.email}</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
