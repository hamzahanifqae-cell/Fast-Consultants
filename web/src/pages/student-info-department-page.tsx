import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { PageSection, PageSplit } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { hasPermission } from '@/lib/roles';
import type { StudentProgressRow } from '@/lib/student-progress';
import { useAuthStore } from '@/stores/auth-store';
import './dashboard.css';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function StudentInfoDepartmentPage() {
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);
  const showStudents =
    hasPermission(user, 'student_info.view') || hasPermission(user, 'student_info.manage');

  const studentsQuery = useQuery({
    queryKey: ['consultant-students-progress'],
    enabled: showStudents,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProgressRow[] }>(
        '/consultant/students/progress',
      );
      return data.data;
    },
  });

  const students = studentsQuery.data ?? [];
  const count = students.length;

  return (
    <AppShell
      badge="Student Info"
      title="Student Info"
      backTo={routes.home}
      backLabel="Dashboard">
      <div className="page-stack">
        <PageSplit
          main={
            <PageSection
              title="Recent students"
              action={
                showStudents ? (
                  <Link className="text-link-btn" to={routes.studentInfo.students}>
                    View all
                  </Link>
                ) : null
              }>
              <div className="panel dash-activity">
                {studentsQuery.isLoading ? <p className="muted">Loading…</p> : null}
                {students.slice(0, 8).map((student) => (
                  <Link
                    key={student.id}
                    className="dash-activity-row"
                    to={routes.studentInfo.student(student.id)}>
                    <span className="dash-activity-avatar info">{initials(student.name)}</span>
                    <div className="dash-activity-copy">
                      <strong>{student.name}</strong>
                      <span>{student.email}</span>
                    </div>
                    <div className="student-info-progress-chip">
                      <strong>{student.overall_percent}%</strong>
                      <span>{student.current_status}</span>
                    </div>
                  </Link>
                ))}
                {!studentsQuery.isLoading && students.length === 0 ? (
                  <p className="muted">No students found yet.</p>
                ) : null}
              </div>
            </PageSection>
          }
          side={
            <PageSection title="Quick links">
              <div className="workspace-list">
                {showStudents ? (
                  <Link className="workspace-link" to={routes.studentInfo.students}>
                    <div>
                      <strong>All students</strong>
                      <span>Full progress directory</span>
                    </div>
                    <span className="workspace-link-meta">{count || 'None'}</span>
                  </Link>
                ) : null}
                <Link className="workspace-link" to={routes.messages.root}>
                  <div>
                    <strong>Messages</strong>
                    <span>Student Info inbox</span>
                  </div>
                  <span className="workspace-link-meta">Chat</span>
                </Link>
                {showStudents ? (
                  <Link className="workspace-link" to={routes.documents.root}>
                    <div>
                      <strong>Documents</strong>
                      <span>Review uploads separately</span>
                    </div>
                    <span className="workspace-link-meta">Open</span>
                  </Link>
                ) : null}
              </div>
            </PageSection>
          }
        />
      </div>
    </AppShell>
  );
}
