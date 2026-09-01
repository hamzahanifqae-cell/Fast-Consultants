/**
 * Resolve backend notification `action` paths to Expo Router routes.
 * Org users share one mobile app shell — paths must not include `/staff` or `/superadmin`.
 */
const ORG_LEGACY: Record<string, string> = {
  '/organization/team': '/departments/team',
  '/departments/student-info': '/departments/student-info',
  '/departments/student-info/students': '/consultant-students',
  '/departments/student-info/documents': '/departments/documents',
  '/departments/documents': '/departments/documents',
  '/departments/universities': '/departments/universities',
  '/departments/finance': '/departments/finance',
  '/departments/interview': '/departments/interview',
  '/departments/visa': '/departments/visa',
  '/departments/team': '/departments/team',
  '/consultant/students': '/consultant-students',
  '/consultant/documents': '/departments/documents',
  '/consultant/universities': '/departments/universities',
  '/consultant/finance': '/departments/finance',
  '/consultant/visa': '/departments/visa',
};

const WEB_STUDENT: Record<string, string> = {
  '/student/documents': '/student-documents',
  '/student/universities': '/student-universities',
  '/student/charge-receipts': '/student-charge-receipts',
  '/student/preparation': '/student-preparation',
  '/student/interview': '/student-interview',
  '/student/visa-appointments': '/student-visa-appointments',
  '/student/status': '/student-status',
  '/student/messages': '/home',
};

function stripPortalPrefix(action: string): string {
  return action.replace(/^\/(?:staff|superadmin|consultant)/, '') || action;
}

export function resolveNotificationRoute(action: string | null | undefined): string | null {
  if (!action || action === 'chat') return null;

  if (action.startsWith('/student-')) return action;

  if (WEB_STUDENT[action]) return WEB_STUDENT[action];

  const studentDetailMatch = action.match(
    /\/(?:departments\/student-info\/students|consultant\/students)\/(\d+)$/,
  );
  if (studentDetailMatch) {
    return `/consultant-students/${studentDetailMatch[1]}`;
  }

  if (ORG_LEGACY[action]) return ORG_LEGACY[action];

  const normalized = stripPortalPrefix(action);
  if (normalized !== action && ORG_LEGACY[normalized]) {
    return ORG_LEGACY[normalized];
  }

  if (normalized.startsWith('/departments/')) {
    return normalized;
  }

  return null;
}
