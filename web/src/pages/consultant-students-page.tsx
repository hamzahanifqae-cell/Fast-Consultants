import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

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

  return (
    <AppShell
      badge="Student Info"
      title="Students"
      backTo={routes.studentInfo.root}
      backLabel="Student Info">
      <div className="page-stack">
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
      </div>
    </AppShell>
  );
}
