import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';

import { PageBackButton } from '@/components/page-back-button';
import { PageEmpty } from '@/components/page-fill';
import { api } from '@/lib/api';
import type { StudentSummary } from '@/types/auth';

type Props = {
  selectedId: number | null;
  onSelect: (student: StudentSummary) => void;
  onClear: () => void;
  children: ReactNode;
};

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function DepartmentStudentGate({
  selectedId,
  onSelect,
  onClear,
  children,
}: Props) {
  const [query, setQuery] = useState('');
  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const selected = (studentsQuery.data ?? []).find((item) => item.id === selectedId) ?? null;
  const students = studentsQuery.data ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(needle) ||
        student.email.toLowerCase().includes(needle),
    );
  }, [students, query]);

  if (!selectedId || !selected) {
    return (
      <section className="panel dept-directory">
        <header className="dept-directory-header">
          <div className="dept-directory-heading">
            <h2>Student directory</h2>
            <p className="muted">
              Choose a student to review their file for this department.
            </p>
          </div>
          <div className="dept-directory-meta">
            <span className="dept-directory-count">
              {studentsQuery.isLoading ? '…' : `${students.length} student${students.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </header>

        <label className="dept-directory-search field">
          <span className="sr-only">Search students</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            autoComplete="off"
          />
        </label>

        <div className="dept-directory-table" role="list">
          <div className="dept-directory-table-head" aria-hidden>
            <span>Student</span>
            <span>Email</span>
            <span />
          </div>

          {studentsQuery.isLoading ? (
            <p className="muted dept-directory-status">Loading students…</p>
          ) : null}

          {filtered.map((student) => (
            <button
              key={student.id}
              type="button"
              role="listitem"
              className="dept-directory-row"
              onClick={() => onSelect(student)}>
              <span className="dept-directory-identity">
                <span className="dept-directory-avatar" aria-hidden>
                  {studentInitials(student.name)}
                </span>
                <span className="dept-directory-name">{student.name}</span>
              </span>
              <span className="dept-directory-email">{student.email}</span>
              <span className="dept-directory-action">Open</span>
            </button>
          ))}

          {!studentsQuery.isLoading && students.length === 0 ? (
            <PageEmpty
              title="No students yet"
              body="Students appear here once they register with your organization."
            />
          ) : null}

          {!studentsQuery.isLoading && students.length > 0 && filtered.length === 0 ? (
            <p className="muted dept-directory-status">No students match “{query.trim()}”.</p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="dept-student-workspace page-stack">
      <div className="panel dept-student-banner dept-student-banner-sticky">
        <PageBackButton label="Back to directory" onClick={onClear} />
        <div className="dept-student-banner-copy">
          <span className="dept-directory-avatar" aria-hidden>
            {studentInitials(selected.name)}
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
