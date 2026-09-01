import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { GuestOnly, PortalGuestOnly, RequirePortal } from '@/components/route-guards';
import { NavigationProgress } from '@/components/navigation-progress';
import { PortalAuthSync } from '@/components/portal-auth-sync';
import { SaveFeedbackBar } from '@/components/save-feedback-bar';
import { ScrollToTop } from '@/components/scroll-to-top';
import { AppProviders } from '@/providers/app-providers';
import { ConsultantDocumentsPage } from '@/pages/consultant-documents-page';
import { ConsultantFinancePage } from '@/pages/consultant-finance-page';
import { ConsultantStudentDetailPage } from '@/pages/consultant-student-detail-page';
import { ConsultantStudentsPage } from '@/pages/consultant-students-page';
import { ConsultantUniversitiesPage } from '@/pages/consultant-universities-page';
import { ConsultantVisaPage } from '@/pages/consultant-visa-page';
import { HomePage } from '@/pages/home-page';
import { LandingPage } from '@/pages/landing-page';
import { LoginPage } from '@/pages/login-page';
import { MessagesPage } from '@/pages/messages-page';
import { OrganizationTeamPage } from '@/pages/organization-team-page';
import { RegisterPage, TeamRegisterBlocked } from '@/pages/register-page';
import { StudentChargeReceiptsPage } from '@/pages/student-charge-receipts-page';
import { StudentDocumentsPage } from '@/pages/student-documents-page';
import { StudentInfoDepartmentPage } from '@/pages/student-info-department-page';
import { StudentInterviewPage } from '@/pages/student-interview-page';
import { StudentPreparationPage } from '@/pages/student-preparation-page';
import { StudentProfilePage } from '@/pages/student-profile-page';
import { StudentStatusPage } from '@/pages/student-status-page';
import { StudentUniversitiesPage } from '@/pages/student-universities-page';
import { StudentVisaAppointmentsPage } from '@/pages/student-visa-appointments-page';
import { departmentRoutes } from '@/lib/department-routes';
import {
  homeForPortal,
  loginForPortal,
  portalFromPath,
  portalMatchesUser,
  type Portal,
} from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';

function LegacyConsultantRedirect() {
  const path = window.location.pathname.replace(/^\/consultant/, '/superadmin');
  const search = window.location.search;
  return <Navigate to={`${path}${search}`} replace />;
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <ScrollToTop />
        <NavigationProgress />
        <PortalAuthSync />
        <SaveFeedbackBar />
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/student/register" replace />} />
          </Route>

          <Route path="/student">
            <Route index element={<PortalRootRedirect portal="student" />} />
            <Route element={<PortalGuestOnly portal="student" />}>
              <Route path="login" element={<LoginPage portal="student" />} />
              <Route path="register" element={<RegisterPage />} />
            </Route>
            <Route element={<RequirePortal portal="student" />}>
              <Route path="home" element={<HomePage />} />
              <Route path="profile" element={<StudentProfilePage />} />
              <Route path="documents" element={<StudentDocumentsPage />} />
              <Route path="universities" element={<StudentUniversitiesPage />} />
              <Route path="charge-receipts" element={<StudentChargeReceiptsPage />} />
              <Route path="preparation" element={<StudentPreparationPage />} />
              <Route path="interview" element={<StudentInterviewPage />} />
              <Route path="visa-appointments" element={<StudentVisaAppointmentsPage />} />
              <Route path="status" element={<StudentStatusPage />} />
              <Route path="messages" element={<MessagesPage isConsultant={false} />} />
            </Route>
          </Route>

          <Route path="/superadmin">
            <Route index element={<PortalRootRedirect portal="superadmin" />} />
            <Route element={<PortalGuestOnly portal="superadmin" />}>
              <Route path="login" element={<LoginPage portal="superadmin" />} />
              <Route path="register" element={<TeamRegisterBlocked />} />
            </Route>
            <Route element={<RequirePortal portal="superadmin" />}>
              <Route path="home" element={<HomePage />} />
              <Route path="departments/student-info" element={<StudentInfoDepartmentPage />} />
              <Route path="departments/student-info/students" element={<ConsultantStudentsPage />} />
              <Route
                path="departments/student-info/students/:id"
                element={<ConsultantStudentDetailPage />}
              />
              <Route
                path="departments/student-info/documents"
                element={<Navigate to="/superadmin/departments/documents" replace />}
              />
              <Route path="departments/documents" element={<ConsultantDocumentsPage />} />
              <Route path="departments/universities" element={<ConsultantUniversitiesPage />} />
              <Route path="departments/finance" element={<ConsultantFinancePage />} />
              <Route path="departments/interview" element={<ConsultantVisaPage focus="interview" />} />
              <Route path="departments/visa" element={<ConsultantVisaPage focus="visa" />} />
              <Route path="messages" element={<MessagesPage isConsultant />} />
              <Route path="team" element={<OrganizationTeamPage />} />
            </Route>
          </Route>

          <Route path="/staff">
            <Route index element={<PortalRootRedirect portal="staff" />} />
            <Route element={<PortalGuestOnly portal="staff" />}>
              <Route path="login" element={<LoginPage portal="staff" />} />
              <Route path="register" element={<TeamRegisterBlocked />} />
            </Route>
            <Route element={<RequirePortal portal="staff" />}>
              <Route path="home" element={<HomePage />} />
              <Route path="departments/student-info" element={<StudentInfoDepartmentPage />} />
              <Route path="departments/student-info/students" element={<ConsultantStudentsPage />} />
              <Route
                path="departments/student-info/students/:id"
                element={<ConsultantStudentDetailPage />}
              />
              <Route
                path="departments/student-info/documents"
                element={<Navigate to="/staff/departments/documents" replace />}
              />
              <Route path="departments/documents" element={<ConsultantDocumentsPage />} />
              <Route path="departments/universities" element={<ConsultantUniversitiesPage />} />
              <Route path="departments/finance" element={<ConsultantFinancePage />} />
              <Route path="departments/interview" element={<ConsultantVisaPage focus="interview" />} />
              <Route path="departments/visa" element={<ConsultantVisaPage focus="visa" />} />
              <Route path="messages" element={<MessagesPage isConsultant />} />
              <Route path="team" element={<OrganizationTeamPage />} />
            </Route>
          </Route>

          <Route path="/home" element={<SmartHomeRedirect />} />
          <Route path="/departments/*" element={<SmartHomeRedirect />} />
          <Route path="/consultant/login" element={<Navigate to="/superadmin/login" replace />} />
          <Route path="/consultant/*" element={<LegacyConsultantRedirect />} />
          <Route
            path="/organization/team"
            element={<Navigate to={departmentRoutes('superadmin').team.root} replace />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}

function PortalRootRedirect({ portal }: { portal: Portal }) {
  const peek = useAuthStore((state) => state.peekPortalSession);
  const session = peek(portal);

  if (session?.user && portalMatchesUser(portal, session.user)) {
    return <Navigate to={homeForPortal(portal)} replace />;
  }

  return <Navigate to={loginForPortal(portal)} replace />;
}

function SmartHomeRedirect() {
  const pathPortal = portalFromPath(window.location.pathname);
  const activePortal = useAuthStore((state) => state.activePortal);
  const token = useAuthStore((state) => state.token);
  const peek = useAuthStore((state) => state.peekPortalSession);

  if (pathPortal) {
    if (peek(pathPortal) || (token && activePortal === pathPortal)) {
      return <Navigate to={homeForPortal(pathPortal)} replace />;
    }
    return <Navigate to={loginForPortal(pathPortal)} replace />;
  }

  return <Navigate to="/" replace />;
}
