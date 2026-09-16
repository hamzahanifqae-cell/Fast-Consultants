import { useQuery } from '@tanstack/react-query';

import { DirectoryList } from '@/components/directory-list';
import { AppShell } from '@/components/shell';
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

  return (
    <AppShell
      badge="Student Info"
      title="Students"
      backTo={routes.studentInfo.root}
      backLabel="Student Info">
      <div className="page-stack">
        <DirectoryList
          title="All students"
          countLabel={
            studentsQuery.isLoading
              ? '…'
              : `${students.length} student${students.length === 1 ? '' : 's'}`
          }
          items={students.map((student) => ({
            id: student.id,
            title: student.name,
            subtitle: student.email,
            searchText: student.current_status,
            href: routes.studentInfo.student(student.id),
            actionLabel: student.overall_percent != null ? `${student.overall_percent}%` : 'Open',
          }))}
          loading={studentsQuery.isLoading}
          emptyTitle="No students yet"
          emptyBody="Students appear here once they register with your organization."
        />
      </div>
    </AppShell>
  );
}
