import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { PageEmpty, PageStats, PageTips } from '@/components/page-fill';
import { SearchableSelect } from '@/components/searchable-select';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { isSuperAdminPortalUser, orgPortalForUser } from '@/lib/portals';
import { hasPermission, isSuperAdminUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type {
  OrganizationCatalog,
  OrganizationUser,
  PermissionName,
} from '@/types/auth';
import './dashboard.css';

type Draft = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'admin' | 'staff';
  staff_department: string;
  permissions: PermissionName[];
};

const emptyDraft = (): Draft => ({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'staff',
  staff_department: 'universities',
  permissions: [],
});

export function OrganizationTeamPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canView =
    isSuperAdminUser(user) ||
    hasPermission(user, 'users.view') ||
    hasPermission(user, 'users.manage');
  const canManage = isSuperAdminUser(user);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['organization-catalog'],
    enabled: canView,
    queryFn: async () => {
      const { data } = await api.get<{ data: OrganizationCatalog }>('/organization/catalog');
      return data.data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ['organization-users'],
    enabled: canView,
    queryFn: async () => {
      const { data } = await api.get<{ data: OrganizationUser[] }>('/organization/users');
      return data.data;
    },
  });

  const permissionOptions = catalogQuery.data?.permissions ?? [];
  const departmentOptions = catalogQuery.data?.staff_departments ?? [];

  const selectedPermissions = useMemo(() => new Set(draft.permissions), [draft.permissions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const payload: Record<string, unknown> = {
          name: draft.name,
          email: draft.email,
          role: draft.role,
          staff_department: draft.role === 'staff' ? draft.staff_department : null,
          permissions: draft.permissions,
        };
        if (draft.password) {
          payload.password = draft.password;
          payload.password_confirmation = draft.password_confirmation;
        }
        const { data } = await api.put(`/organization/users/${editingId}`, payload);
        return data;
      }

      const { data } = await api.post('/organization/users', {
        ...draft,
        staff_department: draft.role === 'staff' ? draft.staff_department : null,
      });
      return data;
    },
    onSuccess: () => {
      setError(null);
      setDraft(emptyDraft());
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not save user.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/organization/users/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization-users'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not remove user.'));
    },
  });

  if (!canView) {
    return (
      <Navigate
        to={isSuperAdminPortalUser(user) ? '/superadmin/home' : '/staff/home'}
        replace
      />
    );
  }

  function startEdit(member: OrganizationUser) {
    setEditingId(member.id);
    setDraft({
      name: member.name,
      email: member.email,
      password: '',
      password_confirmation: '',
      role: (member.roles ?? []).includes('admin') || (member.roles ?? []).includes('consultant') ? 'admin' : 'staff',
      staff_department: member.staff_department ?? 'universities',
      permissions: (member.permissions ?? []).filter((permission) =>
        permissionOptions.some((option) => option.value === permission),
      ) as PermissionName[],
    });
    setError(null);
  }

  function togglePermission(permission: PermissionName) {
    setDraft((current) => {
      const next = new Set(current.permissions);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return { ...current, permissions: [...next] };
    });
  }

  function onDepartmentChange(value: string) {
    const defaults =
      departmentOptions.find((department) => department.value === value) &&
      catalogQuery.data
        ? // Apply department defaults from backend labels mapping via known prefixes
          permissionOptions
            .filter((permission) => permission.value.startsWith(`${value}.`))
            .map((permission) => permission.value)
        : [];

    setDraft((current) => ({
      ...current,
      staff_department: value,
      permissions: defaults.length ? defaults : current.permissions,
    }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  return (
    <AppShell
      badge={canManage ? 'Super Admin' : 'Team'}
      title="Team & permissions"
      backTo={departmentRoutes(orgPortalForUser(user)).home}
      backLabel="Dashboard">
      <div className="page-stack">
        <PageStats
          items={[
            {
              label: 'Teammates',
              value: usersQuery.isLoading ? '…' : (usersQuery.data ?? []).length,
              hint: 'Admin & Staff listed',
              icon: '👥',
              tone: 'blue',
            },
            {
              label: 'Your access',
              value: canManage ? 'Manage' : 'View',
              hint: canManage ? 'Create and edit accounts' : 'Read-only directory',
              icon: '🔑',
              tone: 'coral',
            },
            {
              label: 'Departments',
              value: catalogQuery.isLoading ? '…' : departmentOptions.length,
              hint: 'Staff home departments',
              icon: '📁',
              tone: 'gold',
            },
          ]}
        />

        <div className="org-layout">
          <section className="panel">
            <h2>Team members</h2>
            <p>Admin and Staff only, Super Admin is never listed for lower roles.</p>
            <div className="stack-list">
              {(usersQuery.data ?? []).map((member) => (
                <div key={member.id} className="stack-item org-member">
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                    <span className="org-meta">
                      {member.roles.join(', ')}
                      {member.staff_department_label
                        ? `, ${member.staff_department_label}`
                        : ''}
                    </span>
                  </div>
                  {canManage && !member.is_super_admin ? (
                    <div className="org-actions">
                      <button type="button" className="ghost-btn" onClick={() => startEdit(member)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost-btn danger"
                        onClick={() => {
                          if (window.confirm(`Remove ${member.name}?`)) {
                            deleteMutation.mutate(member.id);
                          }
                        }}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {usersQuery.isLoading ? <p>Loading team…</p> : null}
              {!usersQuery.isLoading && (usersQuery.data?.length ?? 0) === 0 ? (
                <PageEmpty
                  title="No organization users yet"
                />
              ) : null}
            </div>
          </section>

          {canManage ? (
            <section className="panel">
              <h2>{editingId ? 'Edit user' : 'Add Admin or Staff'}</h2>
              <p>Assign permissions so they only see the modules you allow.</p>
            <form className="org-form" onSubmit={onSubmit}>
              <label className="field">
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>{editingId ? 'New password (optional)' : 'Password'}</span>
                <input
                  type="password"
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  required={!editingId}
                  minLength={8}
                />
              </label>
              <label className="field">
                <span>Confirm password</span>
                <input
                  type="password"
                  value={draft.password_confirmation}
                  onChange={(event) =>
                    setDraft({ ...draft, password_confirmation: event.target.value })
                  }
                  required={!editingId || Boolean(draft.password)}
                />
              </label>
              <label className="field">
                <span>Role</span>
                <SearchableSelect
                  searchable={false}
                  value={draft.role}
                  placeholder="Select role"
                  options={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'staff', label: 'Staff' },
                  ]}
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      role: value as 'admin' | 'staff',
                    })
                  }
                />
              </label>
              {draft.role === 'staff' ? (
                <label className="field">
                  <span>Staff department</span>
                  <SearchableSelect
                    searchable={false}
                    value={draft.staff_department}
                    placeholder="Select department"
                    options={departmentOptions.map((department) => ({
                      value: department.value,
                      label: department.label,
                    }))}
                    onChange={(value) => onDepartmentChange(value)}
                  />
                </label>
              ) : null}

              <fieldset className="org-permissions">
                <legend>Permissions</legend>
                {permissionOptions.map((permission) => (
                  <label key={permission.value} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.has(permission.value)}
                      onChange={() => togglePermission(permission.value)}
                    />
                    <span>{permission.label}</span>
                  </label>
                ))}
              </fieldset>

              {error ? <p className="form-error">{error}</p> : null}

              <div className="org-actions">
                <button className="primary-btn" disabled={saveMutation.isPending} type="submit">
                  {saveMutation.isPending ? 'Saving…' : editingId ? 'Update user' : 'Create user'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setEditingId(null);
                      setDraft(emptyDraft());
                    }}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </div>

        {!canManage ? (
          <PageTips
            title="Viewing the team"
            items={[
              'You can see Admin and Staff teammates.',
              'Super Admin accounts stay hidden from this list.',
              'Ask Super Admin if you need extra department access.',
            ]}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
