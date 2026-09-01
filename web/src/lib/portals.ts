import type { AuthUser } from '@/types/auth';
import {
  isOrganizationUser,
  isStudentUser,
  isSuperAdminUser,
} from '@/lib/roles';

export type Portal = 'student' | 'superadmin' | 'staff';

/** Super Admin, Admin, and legacy Consultant accounts use the super admin portal. */
export function isSuperAdminPortalUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  return (
    Boolean(user.is_admin) ||
    user.roles.includes('admin') ||
    user.roles.includes('consultant')
  );
}

/** @deprecated Use {@link isSuperAdminPortalUser}. */
export const isConsultantPortalUser = isSuperAdminPortalUser;

/** Department staff only, not org admins. */
export function isStaffOnlyPortalUser(user: AuthUser | null | undefined): boolean {
  if (!user || isSuperAdminPortalUser(user) || isStudentUser(user)) return false;
  return Boolean(user.is_staff) || user.roles.includes('staff');
}

export function portalForUser(user: AuthUser | null | undefined): Portal | null {
  if (!user) return null;
  if (isStudentUser(user)) return 'student';
  if (isSuperAdminPortalUser(user)) return 'superadmin';
  if (isStaffOnlyPortalUser(user) || isOrganizationUser(user)) return 'staff';
  return null;
}

/** Path prefix for org workspace routes (super admin vs staff). */
export function orgPortalForUser(user: AuthUser | null | undefined): Exclude<Portal, 'student'> {
  return portalForUser(user) === 'superadmin' ? 'superadmin' : 'staff';
}

export function homeForPortal(portal: Portal): string {
  return `/${portal}/home`;
}

export function loginForPortal(portal: Portal): string {
  return `/${portal}/login`;
}

export function rootForPortal(portal: Portal): string {
  return `/${portal}`;
}

export function portalMatchesUser(portal: Portal, user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (portal === 'student') return isStudentUser(user);
  if (portal === 'superadmin') return isSuperAdminPortalUser(user);
  if (portal === 'staff') return isStaffOnlyPortalUser(user);
  return false;
}

export function portalLabel(portal: Portal): string {
  if (portal === 'student') return 'Student';
  if (portal === 'superadmin') return 'Super Admin';
  return 'Staff';
}

/** Resolve which portal session this URL belongs to. */
export function portalFromPath(pathname: string): Portal | null {
  if (pathname === '/student' || pathname.startsWith('/student/')) return 'student';
  if (pathname === '/superadmin' || pathname.startsWith('/superadmin/')) return 'superadmin';
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return 'staff';
  if (pathname === '/consultant' || pathname.startsWith('/consultant/')) return 'superadmin';
  return null;
}
