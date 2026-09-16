import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { DirectoryList } from '@/components/directory-list';
import { SearchableSelect } from '@/components/searchable-select';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { isSuperAdminPortalUser } from '@/lib/portals';
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
  phone: string;
  password: string;
  password_confirmation: string;
  role: 'admin' | 'staff';
  staff_department: string;
  permissions: PermissionName[];
};

const emptyDraft = (): Draft => ({
  name: '',
  email: '',
  phone: '',
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
          phone: draft.phone.trim() || null,
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
      phone: member.phone ?? '',
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
      title="Team & permissions">
      <div className="page-stack">
        <div className="org-layout">
          <DirectoryList
            title="Team members"
            description="Admin and Staff only. Super Admin is never listed for lower roles."
            countLabel={
              usersQuery.isLoading
                ? '…'
                : `${(usersQuery.data ?? []).length} member${
                    (usersQuery.data ?? []).length === 1 ? '' : 's'
                  }`
            }
            primaryColumn="Member"
            secondaryColumn="Email"
            items={(usersQuery.data ?? []).map((member) => ({
              id: member.id,
              title: member.name,
              subtitle: member.email,
              searchText: [
                member.phone,
                member.roles.join(' '),
                member.staff_department_label,
              ]
                .filter(Boolean)
                .join(' '),
              onClick:
                canManage && !member.is_super_admin
                  ? () => startEdit(member)
                  : undefined,
              actionLabel:
                canManage && !member.is_super_admin
                  ? 'Edit'
                  : member.staff_department_label || member.roles.join(', ') || '—',
            }))}
            loading={usersQuery.isLoading}
            emptyTitle="No organization users yet"
          />

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
                <span>WhatsApp / phone (optional)</span>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  placeholder="+92 300 1234567"
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
                  <>
                    <button
                      type="button"
                      className="ghost-btn danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        const member = (usersQuery.data ?? []).find((item) => item.id === editingId);
                        if (!member) return;
                        if (window.confirm(`Remove ${member.name}?`)) {
                          deleteMutation.mutate(member.id);
                          setEditingId(null);
                          setDraft(emptyDraft());
                        }
                      }}>
                      Remove
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        setEditingId(null);
                        setDraft(emptyDraft());
                      }}>
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </div>
      </div>
    </AppShell>
  );
}
