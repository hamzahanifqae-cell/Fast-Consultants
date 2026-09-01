import type { Portal } from '@/lib/portals';

/**
 * Department / workspace paths scoped to Staff or Super Admin portals.
 */
export function departmentRoutes(portal: Exclude<Portal, 'student'>) {
  const base = `/${portal}`;
  return {
    home: `${base}/home`,
    studentInfo: {
      root: `${base}/departments/student-info`,
      students: `${base}/departments/student-info/students`,
      student: (id: number | string) => `${base}/departments/student-info/students/${id}`,
      /** @deprecated Use `documents.root`, kept for older links. */
      documents: `${base}/departments/documents`,
    },
    documents: {
      root: `${base}/departments/documents`,
    },
    universities: {
      root: `${base}/departments/universities`,
    },
    finance: {
      root: `${base}/departments/finance`,
    },
    interview: {
      root: `${base}/departments/interview`,
    },
    visa: {
      root: `${base}/departments/visa`,
    },
    messages: {
      root: `${base}/messages`,
    },
    team: {
      root: `${base}/team`,
    },
  };
}

export const StudentRoutes = {
  home: '/student/home',
  login: '/student/login',
  register: '/student/register',
  profile: '/student/profile',
  documents: '/student/documents',
  universities: '/student/universities',
  chargeReceipts: '/student/charge-receipts',
  preparation: '/student/preparation',
  interview: '/student/interview',
  visaAppointments: '/student/visa-appointments',
  status: '/student/status',
  messages: '/student/messages',
} as const;

/** Default paths used when portal is unknown (notifications / legacy). Prefer staff. */
export const DepartmentRoutes = departmentRoutes('staff');

/** Strip `/staff`, `/superadmin`, or `/consultant` prefix from notification actions. */
function stripPortalPrefix(action: string): string {
  return action.replace(/^\/(?:staff|superadmin|consultant)/, '') || action;
}

export function mapNotificationAction(
  action: string | null | undefined,
  portal: Exclude<Portal, 'student'> = 'staff',
): string | null {
  if (!action) return null;

  const routes = departmentRoutes(portal);

  const studentMatch = action.match(
    /\/(?:departments\/student-info\/students|consultant\/students)\/(\d+)$/,
  );
  if (studentMatch) {
    return routes.studentInfo.student(studentMatch[1]);
  }

  const legacy: Record<string, string> = {
    '/consultant/students': routes.studentInfo.students,
    '/consultant/documents': routes.documents.root,
    '/consultant/universities': routes.universities.root,
    '/consultant/finance': routes.finance.root,
    '/consultant/visa': routes.visa.root,
    '/consultant/messages': routes.messages.root,
    '/organization/team': routes.team.root,
    '/departments/student-info': routes.studentInfo.root,
    '/departments/student-info/students': routes.studentInfo.students,
    '/departments/student-info/documents': routes.documents.root,
    '/departments/documents': routes.documents.root,
    '/departments/universities': routes.universities.root,
    '/departments/finance': routes.finance.root,
    '/departments/interview': routes.interview.root,
    '/departments/visa': routes.visa.root,
    '/departments/messages': routes.messages.root,
    '/departments/team': routes.team.root,
  };

  if (legacy[action]) return legacy[action];

  const normalized = stripPortalPrefix(action);
  if (normalized !== action && legacy[normalized]) {
    return legacy[normalized];
  }

  if (action.startsWith('/student/')) return action;

  const portalMatch = action.match(/^\/(?:staff|superadmin|consultant)(\/.*)$/);
  if (portalMatch) {
    return `/${portal}${portalMatch[1]}`;
  }

  if (action.startsWith('/consultant/')) {
    return `/${portal}${action.slice('/consultant'.length)}`;
  }

  return null;
}
