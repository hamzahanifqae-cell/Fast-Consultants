import type { AuthUser } from '@/types/auth';

const ORG_ROLES = new Set(['super_admin', 'admin', 'staff', 'consultant']);

export type LoginPortal = 'student' | 'staff' | 'super_admin';

export function isOrganizationUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_organization) return true;
  return user.roles.some((role) => ORG_ROLES.has(role));
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

/** Staff portal: Staff + Admin (not Super Admin, not Student). */
export function isStaffPortalUser(user: AuthUser | null | undefined): boolean {
  if (!user || isSuperAdminUser(user) || isStudentUser(user)) return false;
  return (
    Boolean(user.is_staff) ||
    Boolean(user.is_admin) ||
    user.roles.includes('staff') ||
    user.roles.includes('admin') ||
    user.roles.includes('consultant')
  );
}

export function portalMatchesUser(
  portal: LoginPortal,
  user: AuthUser | null | undefined,
): boolean {
  if (!user) return false;
  if (portal === 'student') return isStudentUser(user);
  if (portal === 'super_admin') return isSuperAdminUser(user);
  return isStaffPortalUser(user);
}

export function hasPermission(user: AuthUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  return user.permissions?.includes(permission) ?? false;
}
