import { Navigate } from 'react-router-dom';

import { StudentRoutes } from '@/lib/department-routes';

/** Preparation is now part of the Interview page, keep this route for old links. */
export function StudentPreparationPage() {
  return <Navigate to={StudentRoutes.interview} replace />;
}
