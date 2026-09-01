import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageSplit, PageStats, PageTips } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { StudentProgressBoard } from '@/components/student-progress-board';
import { api } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import type { StudentProgressRow } from '@/lib/student-progress';
import { useAuthStore } from '@/stores/auth-store';
import './dashboard.css';

export function ConsultantStudentsPage() {
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);
  const [query, setQuery] = useState('');

  const studentsQuery = useQuery({
    queryKey: ['consultant-students-progress'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProgressRow[] }>(
        '/consultant/students/progress',
      );
      return data.data;
    },
  });

  const students = studentsQuery.data ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (student) =>
        (student.name ?? '').toLowerCase().includes(needle) ||
        (student.email ?? '').toLowerCase().includes(needle) ||
        (student.current_status ?? '').toLowerCase().includes(needle),
    );
  }, [students, query]);

  const avgProgress =
    students.length === 0
      ? 0
      : Math.round(
          students.reduce((sum, student) => sum + student.overall_percent, 0) / students.length,
        );
  const completeCount = students.filter((student) => student.overall_percent >= 100).length;

  return (
    <AppShell
      badge="Student Info"
      title="Students"
      backTo={routes.studentInfo.root}
      backLabel="Student Info">
      <div className="page-stack">
        <PageStats
          items={[
            {
              label: 'Directory',
              value: studentsQuery.isLoading ? '…' : students.length,
              hint: 'Registered students',
              icon: '🎓',
              tone: 'purple',
            },
            {
              label: 'Avg progress',
              value: studentsQuery.isLoading ? '…' : `${avgProgress}%`,
              hint: 'Across all journey sections',
              icon: '📈',
              tone: 'coral',
            },
            {
              label: 'Complete',
              value: studentsQuery.isLoading ? '…' : completeCount,
              hint: 'Students at 100%',
              icon: '✓',
              tone: 'teal',
            },
            {
              label: 'Needs attention',
              value: studentsQuery.isLoading
                ? '…'
                : students.filter((student) => student.overall_percent < 50).length,
              hint: 'Below 50% overall',
              icon: '⚠',
              tone: 'gold',
            },
          ]}
        />

        <PageSplit
          main={
            <div className="panel">
              <div className="page-section-head" style={{ marginBottom: 14 }}>
                <div>
                  <h2>All students</h2>
                </div>
                <label className="field" style={{ margin: 0, maxWidth: 260 }}>
                  <span className="sr-only">Search students</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, email, status"
                  />
                </label>
              </div>

              <StudentProgressBoard
                students={filtered}
                loading={studentsQuery.isLoading}
                studentHref={(id) => routes.studentInfo.student(id)}
                emptyTitle={query ? 'No matches' : 'No students yet'}
              />
            </div>
          }
          side={
            <PageTips
              title="Tips"
              items={[
                'Each colored bar is a journey section from the student account.',
                'Overall % averages Personal, Documents, Universities, Fees, Interview, Visa, and Status.',
                'Open a student to review personal information in detail.',
                'Document approve/reject still lives in the Documents department.',
              ]}
            />
          }
        />

      </div>
    </AppShell>
  );
}
