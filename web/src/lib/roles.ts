import type { AuthUser, OrgRole, PermissionName } from '@/types/auth';

const ORG_ROLES: OrgRole[] = ['super_admin', 'admin', 'staff', 'consultant'];

export function isOrganizationUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_organization) return true;
  return user.roles.some((role) => ORG_ROLES.includes(role as OrgRole));
}

export function isStudentUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_student) return true;
  return user.roles.includes('student');
}

export function isSuperAdminUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.roles.includes('super_admin');
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: PermissionName,
): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  return user.permissions?.includes(permission) ?? false;
}

export function organizationRoleLabel(user: AuthUser | null | undefined): string {
  if (!user) return 'Team';
  if (isSuperAdminUser(user)) return 'Super Admin';
  if (user.is_admin || user.roles.includes('admin') || user.roles.includes('consultant')) {
    return 'Admin';
  }
  if (user.is_staff || user.roles.includes('staff')) {
    return user.staff_department_label ?? 'Staff';
  }
  return 'Team';
}
