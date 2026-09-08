import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageSection } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { hasPermission } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { University } from '@/types/auth';
import './dashboard.css';

export function UniversitiesDepartmentPage() {
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);
  const canManage =
    hasPermission(user, 'universities.view') || hasPermission(user, 'universities.manage');

  const catalogQuery = useQuery({
    queryKey: ['consultant-universities'],
    enabled: canManage,
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/consultant/universities');
      return data.data;
    },
  });

  const count = catalogQuery.data?.length ?? 0;

  return (
    <AppShell badge="Universities" title="Universities">
      <div className="page-stack">
        <PageSection title="Department" subtitle="Catalog and student sharing">
          <div className="workspace-list">
            <Link className="workspace-link" to={routes.universities.catalog}>
              <div>
                <strong>Catalog</strong>
                <span>Add and manage university options</span>
              </div>
              <span className="workspace-link-meta">
                {catalogQuery.isLoading ? '…' : count || 'Empty'}
              </span>
            </Link>
            <Link className="workspace-link" to={routes.universities.suggestions}>
              <div>
                <strong>Student suggestions</strong>
                <span>Review universities students suggested by country</span>
              </div>
              <span className="workspace-link-meta">Review</span>
            </Link>
            <Link className="workspace-link" to={routes.universities.share}>
              <div>
                <strong>Share with students</strong>
                <span>Assign catalog options to a student</span>
              </div>
              <span className="workspace-link-meta">Assign</span>
            </Link>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
