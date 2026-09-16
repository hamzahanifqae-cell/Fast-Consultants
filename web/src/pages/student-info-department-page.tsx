import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { DirectoryList } from '@/components/directory-list';
import { PageSection, PageSplit } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { hasPermission } from '@/lib/roles';
import type { StudentProgressRow } from '@/lib/student-progress';
import { useAuthStore } from '@/stores/auth-store';
import './dashboard.css';

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
    <AppShell badge="Student Info" title="Student Info">
      <div className="page-stack">
        <PageSplit
          main={
            showStudents ? (
              <DirectoryList
                title="Students"
                countLabel={
                  studentsQuery.isLoading
                    ? '…'
                    : `${count} student${count === 1 ? '' : 's'}`
                }
                headerAction={
                  <Link className="text-link-btn" to={routes.studentInfo.students}>
                    View all
                  </Link>
                }
                items={students.map((student) => ({
                  id: student.id,
                  title: student.name,
                  subtitle: student.email,
                  searchText: student.current_status,
                  href: routes.studentInfo.student(student.id),
                  actionLabel:
                    student.overall_percent != null ? `${student.overall_percent}%` : 'Open',
                }))}
                loading={studentsQuery.isLoading}
                emptyTitle="No students found yet"
              />
            ) : (
              <PageSection title="Students">
                <p className="muted">You do not have access to the student directory.</p>
              </PageSection>
            )
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
                {showStudents ? (
                  <Link className="workspace-link" to={routes.formTemplates.root}>
                    <div>
                      <strong>Form templates</strong>
                      <span>Send the fixed Sponsorship letter</span>
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
