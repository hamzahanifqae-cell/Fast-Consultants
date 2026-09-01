import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageEmpty, PageSection, PageSplit } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { StudentProgressReport } from '@/components/student-progress-report';
import { api } from '@/lib/api';
import { departmentRoutes, StudentRoutes } from '@/lib/department-routes';
import { isInterviewMeetingCancelled } from '@/lib/interview';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import { orgPortalForUser } from '@/lib/portals';
import {
  hasPermission,
  isOrganizationUser,
  isSuperAdminUser,
  organizationRoleLabel,
} from '@/lib/roles';
import type { StudentProgressRow } from '@/lib/student-progress';
import { useAuthStore } from '@/stores/auth-store';
import type {
  ApplicationStatusResponse,
  ChargeReceipt,
  ChatConversation,
  OrganizationUser,
  StudentDocument,
  StudentProfile,
  StudentSummary,
  University,
  UserNotification,
  VisaAppointment,
} from '@/types/auth';
import './dashboard.css';

type StudentStep = {
  title: string;
  body: string;
  to: string;
  label: string;
  done?: boolean;
};

function isCategoryComplete(profile: StudentProfile) {
  return Boolean(
    profile.education_level &&
      profile.institution_name &&
      profile.field_of_study &&
      profile.graduation_year &&
      profile.job_title &&
      profile.employer_name &&
      profile.years_of_experience &&
      profile.other_information,
  );
}

function isProfileComplete(profile: StudentProfile | undefined) {
  if (!profile) return false;
  return Boolean(
    profile.phone &&
      profile.date_of_birth &&
      profile.gender &&
      profile.nationality &&
      profile.country_of_residence &&
      profile.city &&
      profile.address &&
      profile.passport_number &&
      profile.cnic_number &&
      profile.information_category &&
      isCategoryComplete(profile),
  );
}

/**
 * The step the student is on now. Only advances after that step is finished.
 */
function isInterviewJourneyComplete(
  interview: ApplicationStatusResponse['application']['interview'] | undefined,
): boolean {
  if (!interview) return false;
  if (
    interview.status === 'completed' ||
    interview.status === 'passed' ||
    interview.status === 'failed'
  ) {
    return true;
  }
  return (
    Boolean(interview.meeting_ended_at) && interview.followup_preference === 'decline_another'
  );
}

function isVisaJourneyComplete(appointments: VisaAppointment[]): boolean {
  return appointments.some((appointment) => appointment.status === 'completed');
}

function currentStudentStep(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
): StudentStep {
  if (!isProfileComplete(profile)) {
    return {
      title: 'Complete your personal details',
      body: 'Add phone, nationality, residence, passport, and CNIC so staff can support your application.',
      to: StudentRoutes.profile,
      label: 'Open personal info',
    };
  }

  if (!status) {
    return {
      title: 'Upload your admission documents',
      body: 'Passport, academic records, and English test scores unlock the next stages.',
      to: StudentRoutes.documents,
      label: 'Go to documents',
    };
  }

  const docs = status.checklist?.documents;
  if (!docs?.accepted) {
    if ((docs?.total ?? 0) === 0) {
      return {
        title: 'Upload your admission documents',
        body: 'Passport, academic records, and English test scores unlock the next stages.',
        to: StudentRoutes.documents,
        label: 'Go to documents',
      };
    }
    if ((docs?.rejected ?? 0) > 0) {
      return {
        title: 'Fix rejected documents',
        body: 'One or more files need a clearer upload. Review the rejection notes and send again.',
        to: StudentRoutes.documents,
        label: 'Review documents',
      };
    }
    return {
      title: 'Documents under review',
      body: 'Staff are checking your uploads. This step stays active until every file is approved.',
      to: StudentRoutes.documents,
      label: 'View documents',
    };
  }

  const fees = status.checklist?.charge_receipts;
  if (!fees?.accepted) {
    if ((fees?.total ?? 0) === 0) {
      return {
        title: 'Waiting for fee slips',
        body: 'Finance will send charge slips here. This is your current step until fees are cleared.',
        to: StudentRoutes.chargeReceipts,
        label: 'View receipts',
      };
    }
    if ((fees?.rejected ?? 0) > 0) {
      return {
        title: 'Fix rejected payment proof',
        body: 'Upload a clearer payment screenshot so Finance can approve your slip.',
        to: StudentRoutes.chargeReceipts,
        label: 'Open receipts',
      };
    }
    return {
      title: 'Complete your fee payments',
      body: 'Pay any open slips and upload proof. This step finishes when Finance approves them.',
      to: StudentRoutes.chargeReceipts,
      label: 'View receipts',
    };
  }

  if (!status.preparation_available) {
    return {
      title: 'Waiting for preparation unlock',
      body: 'Documents and fees are done. Staff will unlock interview preparation next.',
      to: StudentRoutes.interview,
      label: 'Open interview',
    };
  }

  if (!status.application?.preparation?.completed_at) {
    return {
      title: 'Complete interview preparation',
      body: 'Preparation is unlocked. Open Interview to finish the checklist before your meeting.',
      to: StudentRoutes.interview,
      label: 'Open interview',
    };
  }

  if (!status.interview_available) {
    return {
      title: 'Waiting for interview scheduling',
      body: 'Preparation is complete. Interview details will appear when staff unlock them.',
      to: StudentRoutes.interview,
      label: 'Open interview',
    };
  }

  const interview = status.application?.interview;
  if (!interview) {
    return {
      title: 'Waiting for interview scheduling',
      body: 'Preparation is complete. Interview details will appear when staff unlock them.',
      to: StudentRoutes.interview,
      label: 'Open interview',
    };
  }

  if (!isInterviewJourneyComplete(interview)) {
    if (isInterviewMeetingCancelled(interview)) {
      return {
        title: 'Interview meeting cancelled',
        body: 'Preparation staff cancelled the session. You will be notified when a new time is scheduled.',
        to: StudentRoutes.interview,
        label: 'Open interview',
      };
    }

    if (interview.at) {
      return {
        title: 'Attend your interview',
        body: 'Your meeting is scheduled. Open Interview for timing, the timer, and join details.',
        to: StudentRoutes.interview,
        label: 'Open interview',
      };
    }

    if (interview.meeting_ended_at) {
      if (interview.followup_preference === 'want_another') {
        return {
          title: 'Waiting for next interview',
          body: 'You asked for another meeting. Staff will schedule the next session.',
          to: StudentRoutes.interview,
          label: 'Open interview',
        };
      }

      return {
        title: 'Confirm your interview follow-up',
        body: 'Your last session has ended. Tell staff whether you want another meeting.',
        to: StudentRoutes.interview,
        label: 'Open interview',
      };
    }

    return {
      title: 'Track your interview',
      body: 'Interview is available. Check timing and updates, and message your team if needed.',
      to: StudentRoutes.status,
      label: 'View status',
    };
  }

  if (!isVisaJourneyComplete(appointments)) {
    const scheduled = appointments.filter((item) => item.status === 'scheduled');
    if (scheduled.length > 0) {
      return {
        title: 'Attend your visa appointment',
        body: 'Visa staff shared your embassy appointment. Check the details and prepare for the visit.',
        to: StudentRoutes.visaAppointments,
        label: 'Open visa appointments',
      };
    }

    return {
      title: 'Waiting for visa appointment',
      body: 'Interview is finished. Visa staff will schedule your embassy appointment next.',
      to: StudentRoutes.visaAppointments,
      label: 'Open visa appointments',
    };
  }

  return {
    title: 'All current steps complete',
    body: 'Interview and visa appointment are done. Message your consultant anytime if you need support.',
    to: StudentRoutes.status,
    label: 'View status',
    done: true,
  };
}

/** Admission journey steps shown in the dashboard progress bar. */
function studentProgressSteps(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
) {
  return [
    {
      id: 'profile',
      label: 'Profile',
      done: isProfileComplete(profile),
      color: '#22d3ee',
    },
    {
      id: 'documents',
      label: 'Documents',
      done: Boolean(status?.checklist?.documents?.accepted),
      color: '#60a5fa',
    },
    {
      id: 'fees',
      label: 'Fees',
      done: Boolean(status?.checklist?.charge_receipts?.accepted),
      color: '#fbbf24',
    },
    {
      id: 'preparation',
      label: 'Prep',
      done: Boolean(status?.application?.preparation?.completed_at),
      color: '#ff6b84',
    },
    {
      id: 'interview',
      label: 'Interview',
      done: isInterviewJourneyComplete(status?.application?.interview),
      color: '#34d399',
    },
    {
      id: 'visa',
      label: 'Visa',
      done: isVisaJourneyComplete(appointments),
      color: '#f24e68',
    },
  ] as const;
}

/** Overall admission progress from checklist + unlocked stages (0–100). */
function studentProgressPercent(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[] = [],
): number {
  const steps = studentProgressSteps(status, profile, appointments);
  const done = steps.filter((step) => step.done).length;
  return Math.round((done / steps.length) * 100);
}

function initials(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatWhen(value: string | null | undefined) {
  if (!value) return 'None';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const isTeam = isOrganizationUser(user);
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const orgPortal = orgPortalForUser(user);
  const routes = departmentRoutes(orgPortal);

  if (isSuperAdminUser(user)) {
    return <SuperAdminHome firstName={firstName} routes={routes} />;
  }

  if (isTeam) {
    return <StaffHome firstName={firstName} routes={routes} />;
  }

  return <StudentHome firstName={firstName} />;
}

function StudentHome({ firstName }: { firstName: string }) {
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
  });

  const profileQuery = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const receiptsQuery = useQuery({
    queryKey: ['student-charge-receipts'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/student/charge-receipts');
      return data.data;
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  const status = statusQuery.data;
  const profile = profileQuery.data;
  const docs = documentsQuery.data ?? [];
  const receipts = receiptsQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const currentStep = currentStudentStep(status, profile, appointments);
  const progressSteps = studentProgressSteps(status, profile, appointments);
  const progressPercent = studentProgressPercent(status, profile, appointments);
  const activeStepIndex = progressSteps.findIndex((step) => !step.done);
  const currentProgressIndex =
    activeStepIndex === -1 ? progressSteps.length - 1 : activeStepIndex;
  const pendingDocs = docs.filter((d) => d.status === 'pending').length;
  const approvedDocs = docs.filter((d) => d.status === 'approved').length;
  const openReceipts = receipts.filter(
    (r) => r.status === 'awaiting_student' || r.status === 'rejected',
  ).length;
  const unreadMessages = messagesQuery.data?.unread_count ?? 0;

  type RecentActivityItem =
    | {
        kind: 'file';
        id: string;
        title: string;
        body: string;
        tone: 'ok' | 'warn' | 'danger' | 'info';
        badge: string;
        viewPath: string;
        viewTitle: string;
      }
    | {
        kind: 'step';
        id: string;
        title: string;
        body: string;
        tone: 'ok' | 'warn' | 'danger' | 'info';
        badge: string;
        to: string;
      };

  const recentActivity = (() => {
    const items: RecentActivityItem[] = [];

    // Same order as journey steps: Profile → Documents → Fees → Interview → Visa
    if (isProfileComplete(profile)) {
      items.push({
        kind: 'step',
        id: 'step-profile',
        title: 'Personal details',
        body: 'Profile information completed',
        tone: 'ok',
        badge: 'Completed',
        to: StudentRoutes.profile,
      });
    }

    for (const doc of docs) {
      items.push({
        kind: 'file',
        id: `doc-${doc.id}`,
        title: doc.title || doc.type_label,
        body: `Document, ${doc.status_label}`,
        tone: doc.status === 'approved' ? 'ok' : doc.status === 'rejected' ? 'danger' : 'warn',
        badge: doc.status_label,
        viewPath: `/student/documents/${doc.id}/download`,
        viewTitle: doc.original_name || doc.title || 'Document',
      });
    }

    for (const receipt of receipts) {
      const hasFile = Boolean(receipt.student_file || receipt.consultant_file);
      if (!hasFile) continue;
      items.push({
        kind: 'file',
        id: `fee-${receipt.id}`,
        title: receipt.title,
        body: `Fee slip, ${receipt.status_label}`,
        tone:
          receipt.status === 'approved'
            ? 'ok'
            : receipt.status === 'awaiting_student' || receipt.status === 'rejected'
              ? 'warn'
              : 'info',
        badge: receipt.status_label,
        viewPath: receipt.student_file
          ? `/student/charge-receipts/${receipt.id}/student-file`
          : `/student/charge-receipts/${receipt.id}/consultant-file`,
        viewTitle:
          receipt.student_file?.original_name ??
          receipt.consultant_file?.original_name ??
          receipt.title,
      });
    }

    if (isInterviewJourneyComplete(status?.application?.interview)) {
      items.push({
        kind: 'step',
        id: 'step-interview',
        title: 'Interview',
        body: status?.application?.interview?.meeting_ended_at
          ? `Finished ${formatWhen(status.application.interview.meeting_ended_at)}`
          : 'Interview stage completed',
        tone: 'ok',
        badge: 'Completed',
        to: StudentRoutes.interview,
      });
    } else if (status?.application?.preparation?.completed_at) {
      items.push({
        kind: 'step',
        id: 'step-interview',
        title: 'Interview preparation',
        body: `Completed ${formatWhen(status.application.preparation.completed_at)}`,
        tone: 'ok',
        badge: 'Completed',
        to: StudentRoutes.interview,
      });
    }

    if (isVisaJourneyComplete(appointments)) {
      const completedCount = appointments.filter((a) => a.status === 'completed').length;
      items.push({
        kind: 'step',
        id: 'step-visa',
        title: 'Visa appointment',
        body: `${completedCount} appointment${completedCount === 1 ? '' : 's'} completed`,
        tone: 'ok',
        badge: 'Completed',
        to: StudentRoutes.visaAppointments,
      });
    }

    return items.slice(0, 8);
  })();

  const upcomingStep = currentStep.done
    ? null
    : {
        title: currentStep.title,
        body: currentStep.body,
        to: currentStep.to,
        label: currentStep.label,
        badge: progressSteps[currentProgressIndex]?.label ?? 'Next',
        detail:
          progressSteps[currentProgressIndex]?.id === 'interview' && status?.application?.interview?.at
            ? formatWhen(status.application.interview.at)
            : progressSteps[currentProgressIndex]?.id === 'visa'
              ? appointments.find((a) => a.status === 'scheduled')
                ? formatWhen(appointments.find((a) => a.status === 'scheduled')?.scheduled_at)
                : 'Waiting for Visa staff'
              : null,
      };

  async function viewActivityFile(path: string, title: string, key: string) {
    setOpeningKey(key);
    setActivityError(null);
    try {
      await openAuthenticatedFile(path, title);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Could not open this file.');
    } finally {
      setOpeningKey(null);
    }
  }

  return (
    <AppShell
      badge="Student"
      title={`Welcome back, ${firstName}`}>
      <div className="page-stack">
        <div className="dash-hero-row">
          <div className="next-step-card dash-hero-main">
            <div
              className="step-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Overall application progress">
              <div className="step-progress-bar">
                <div
                  className="step-progress-fill"
                  style={{
                    width: statusQuery.isLoading ? '0%' : `${progressPercent}%`,
                    ['--progress' as string]: Math.max(progressPercent, 1),
                  }}>
                  <span className="step-progress-liquid" aria-hidden />
                </div>
                <span className="step-progress-label">
                  {statusQuery.isLoading
                    ? 'Updating progress…'
                    : `${progressPercent}%, ${progressSteps[currentProgressIndex]?.label ?? 'Progress'}`}
                </span>
              </div>
            </div>
            <span className="next-step-kicker">
              {currentStep.done ? 'Completed' : 'Current step'}
            </span>
            <strong>{currentStep.title}</strong>
            <Link className="primary-btn" to={currentStep.to}>
              {currentStep.label}
            </Link>
          </div>
          <div className="dash-quick-actions">
            <Link className="dash-quick-card" to={StudentRoutes.documents}>
              <span className="dash-quick-icon purple">📄</span>
              <strong>Upload document</strong>
              <span>
                {documentsQuery.isLoading
                  ? 'Checking uploads…'
                  : docs.length === 0
                    ? 'No documents uploaded yet'
                    : pendingDocs
                      ? `${approvedDocs}/${docs.length} approved, ${pendingDocs} pending`
                      : `${approvedDocs}/${docs.length} uploaded`}
              </span>
            </Link>
            <Link className="dash-quick-card" to={StudentRoutes.chargeReceipts}>
              <span className="dash-quick-icon blue">💳</span>
              <strong>Pay / upload slip</strong>
              <span>
                {receiptsQuery.isLoading
                  ? 'Checking fees…'
                  : openReceipts
                    ? `${openReceipts} open fee${openReceipts === 1 ? '' : 's'} waiting`
                    : 'Nothing waiting'}
              </span>
            </Link>
            <Link className="dash-quick-card" to={StudentRoutes.messages}>
              <span className="dash-quick-icon lilac">💬</span>
              <strong>Message team</strong>
              <span>{unreadMessages ? `${unreadMessages} unread` : 'Ask a question'}</span>
            </Link>
          </div>
        </div>

        <PageSplit
          main={
            <PageSection
              title="Recent activity"
              action={
                <Link className="text-link-btn" to={StudentRoutes.status}>
                  View status
                </Link>
              }>
              <div className="panel dash-activity">
                {activityError ? <p className="form-error">{activityError}</p> : null}
                {recentActivity.map((item) => (
                  <div key={item.id} className="dash-activity-row">
                    <span className={`dash-activity-avatar ${item.tone}`}>
                      {item.title.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="dash-activity-copy">
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                    </div>
                    <div className="dash-activity-actions">
                      {item.kind === 'file' ? (
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={openingKey === item.id}
                          onClick={() =>
                            void viewActivityFile(item.viewPath, item.viewTitle, item.id)
                          }>
                          {openingKey === item.id ? 'Opening…' : 'View'}
                        </button>
                      ) : (
                        <Link className="ghost-btn" to={item.to}>
                          Open
                        </Link>
                      )}
                      <span
                        className={`status-pill${item.tone === 'warn' ? ' warn' : item.tone === 'danger' ? ' danger' : ''}`}>
                        {item.badge}
                      </span>
                    </div>
                  </div>
                ))}
                {!statusQuery.isLoading &&
                !documentsQuery.isLoading &&
                !receiptsQuery.isLoading &&
                recentActivity.length === 0 ? (
                  <p className="muted" style={{ padding: 8 }}>
                    Uploaded documents and completed steps will show here.
                  </p>
                ) : null}
              </div>
            </PageSection>
          }
          side={
            <PageSection
              title="Upcoming"
              action={
                <Link className="text-link-btn" to={StudentRoutes.status}>
                  My status
                </Link>
              }>
              <div className="panel dash-upcoming">
                {upcomingStep ? (
                  <>
                    <div className="dash-upcoming-row">
                      <div>
                        <strong>{upcomingStep.badge}</strong>
                        <span>{upcomingStep.detail ?? upcomingStep.title}</span>
                      </div>
                      <span className="status-pill warn">Next</span>
                    </div>
                    <div className="workspace-list" style={{ marginTop: 14 }}>
                      <Link className="workspace-link" to={upcomingStep.to}>
                        <div>
                          <strong>{upcomingStep.title}</strong>
                          <span>{upcomingStep.body}</span>
                        </div>
                        <span className="workspace-link-meta">{upcomingStep.label}</span>
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="muted" style={{ margin: 0, padding: 8 }}>
                    {statusQuery.isLoading
                      ? 'Loading…'
                      : 'Nothing upcoming, all steps are complete.'}
                  </p>
                )}
              </div>
            </PageSection>
          }
        />
      </div>
    </AppShell>
  );
}

function SuperAdminHome({
  firstName,
  routes,
}: {
  firstName: string;
  routes: ReturnType<typeof departmentRoutes>;
}) {
  const [inboxStudentId, setInboxStudentId] = useState<number | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['consultant-students-progress'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProgressRow[] }>(
        '/consultant/students/progress',
      );
      return data.data;
    },
  });

  const teamQuery = useQuery({
    queryKey: ['organization-users'],
    queryFn: async () => {
      const { data } = await api.get<{ data: OrganizationUser[] }>('/organization/users');
      return data.data;
    },
  });

  const universitiesQuery = useQuery({
    queryKey: ['consultant-universities'],
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/consultant/universities');
      return data.data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['consultant-documents-overview'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/consultant/documents');
      return data.data;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get<{ data: UserNotification[]; unread_count: number }>(
        '/notifications',
      );
      return data;
    },
  });

  const students = studentsQuery.data ?? [];
  const team = teamQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const conversations = messagesQuery.data?.data ?? [];
  const documents = documentsQuery.data ?? [];
  const pendingDocs = documents.filter((d) => d.status === 'pending').length;
  const unreadMessages = messagesQuery.data?.unread_count ?? 0;
  const unreadNotices = notificationsQuery.data?.unread_count ?? 0;
  const avgProgress =
    students.length === 0
      ? 0
      : Math.round(
          students.reduce((sum, student) => sum + student.overall_percent, 0) / students.length,
        );
  const onTrack = students.filter((student) => student.overall_percent >= 50).length;
  const inboxStudent = students.find((student) => student.id === inboxStudentId) ?? null;
  const inboxConversations = useMemo(() => {
    if (!inboxStudentId) return conversations;
    return conversations.filter((conversation) => conversation.other_user.id === inboxStudentId);
  }, [conversations, inboxStudentId]);

  return (
    <AppShell
      badge="Super Admin"
      title={`Welcome back, ${firstName}`}>
      <div className="page-stack">
        <StudentProgressReport
          students={students}
          loading={studentsQuery.isLoading}
          studentHref={(id) => routes.studentInfo.student(id)}
          viewAllHref={routes.studentInfo.students}
          onSelectedStudentChange={setInboxStudentId}
        />

        <div className="dash-metric-grid">
          <div className="dash-metric panel">
            <span className="dash-metric-icon purple">🎓</span>
            <span className="dash-metric-label">Students</span>
            <strong className="dash-metric-value">
              {studentsQuery.isLoading ? '…' : students.length}
            </strong>
            <span className="dash-metric-hint">Registered accounts</span>
          </div>
          <div className="dash-metric panel">
            <span className="dash-metric-icon coral">📈</span>
            <span className="dash-metric-label">Avg progress</span>
            <strong className="dash-metric-value">
              {studentsQuery.isLoading ? '…' : `${avgProgress}%`}
            </strong>
            <span className="dash-metric-hint">
              {onTrack} of {students.length || 0} at 50%+
            </span>
          </div>
          <div className="dash-metric panel">
            <span className="dash-metric-icon blue">👥</span>
            <span className="dash-metric-label">Team</span>
            <strong className="dash-metric-value">
              {teamQuery.isLoading ? '…' : team.length}
            </strong>
            <span className="dash-metric-hint">Admin & staff</span>
          </div>
          <div className="dash-metric panel">
            <span className="dash-metric-icon gold">🏫</span>
            <span className="dash-metric-label">Universities</span>
            <strong className="dash-metric-value">
              {universitiesQuery.isLoading ? '…' : universities.length}
            </strong>
            <span className="dash-metric-hint">Catalog options</span>
          </div>
        </div>

        <div className="dash-quick-actions dash-quick-actions-row">
          <Link className="dash-quick-card" to={routes.studentInfo.students}>
            <span className="dash-quick-icon purple">🎓</span>
            <strong>All students</strong>
            <span>Full progress directory</span>
          </Link>
          <Link className="dash-quick-card" to={routes.documents.root}>
            <span className="dash-quick-icon blue">📄</span>
            <strong>Documents</strong>
            <span>{pendingDocs ? `${pendingDocs} pending` : 'Review uploads'}</span>
          </Link>
          <Link className="dash-quick-card" to={routes.messages.root}>
            <span className="dash-quick-icon lilac">💬</span>
            <strong>Messages</strong>
            <span>{unreadMessages ? `${unreadMessages} unread` : 'All clear'}</span>
          </Link>
          <Link className="dash-quick-card" to={routes.team.root}>
            <span className="dash-quick-icon coral">👥</span>
            <strong>Team</strong>
            <span>{unreadNotices ? `${unreadNotices} notices` : 'Manage access'}</span>
          </Link>
        </div>

        <PageSplit
          main={
            <PageSection
              title="Inbox"
              action={
                <Link className="text-link-btn" to={routes.messages.root}>
                  Open
                </Link>
              }>
              <div className="panel dash-activity">
                {inboxConversations.slice(0, 5).map((conversation) => (
                  <Link
                    key={conversation.id}
                    className="dash-activity-row"
                    to={routes.messages.root}>
                    <span className="dash-activity-avatar purple">
                      {initials(conversation.other_user.name)}
                    </span>
                    <div className="dash-activity-copy">
                      <strong>{conversation.other_user.name}</strong>
                      <span>
                        {conversation.department_label
                          ? `${conversation.department_label}, `
                          : ''}
                        {conversation.last_message?.body ?? 'No messages yet'}
                      </span>
                    </div>
                    {(conversation.unread_count ?? 0) > 0 ? (
                      <span className="status-pill warn">{conversation.unread_count}</span>
                    ) : null}
                  </Link>
                ))}
                {!messagesQuery.isLoading && inboxConversations.length === 0 ? (
                  <p className="muted">
                    {inboxStudent
                      ? `No messages from ${inboxStudent.name} yet.`
                      : 'No student messages yet.'}
                  </p>
                ) : null}
              </div>
            </PageSection>
          }
          side={
            <PageSection title="Departments">
              <div className="workspace-list">
                <Link className="workspace-link" to={routes.finance.root}>
                  <div>
                    <strong>Finance</strong>
                    <span>Charge slips & reviews</span>
                  </div>
                  <span className="workspace-link-meta">Open</span>
                </Link>
                <Link className="workspace-link" to={routes.universities.root}>
                  <div>
                    <strong>Universities</strong>
                    <span>Catalog & assignments</span>
                  </div>
                  <span className="workspace-link-meta">Open</span>
                </Link>
                <Link className="workspace-link" to={routes.interview.root}>
                  <div>
                    <strong>Interview</strong>
                    <span>Preparation & scheduling</span>
                  </div>
                  <span className="workspace-link-meta">Open</span>
                </Link>
                <Link className="workspace-link" to={routes.visa.root}>
                  <div>
                    <strong>Visa</strong>
                    <span>Embassy appointments</span>
                  </div>
                  <span className="workspace-link-meta">Open</span>
                </Link>
                <Link className="workspace-link" to={routes.team.root}>
                  <div>
                    <strong>Team & access</strong>
                    <span>
                      {unreadNotices ? `${unreadNotices} notices` : 'People & permissions'}
                    </span>
                  </div>
                  <span className="workspace-link-meta">Manage</span>
                </Link>
              </div>
            </PageSection>
          }
        />
      </div>
    </AppShell>
  );
}

function StaffHome({
  firstName,
  routes,
}: {
  firstName: string;
  routes: ReturnType<typeof departmentRoutes>;
}) {
  const user = useAuthStore((state) => state.user);
  const showStudents =
    hasPermission(user, 'student_info.view') || hasPermission(user, 'student_info.manage');
  const showUniversities =
    hasPermission(user, 'universities.view') || hasPermission(user, 'universities.manage');
  const showFinance =
    hasPermission(user, 'finance.view') || hasPermission(user, 'finance.manage');
  const showVisa = hasPermission(user, 'visa.view') || hasPermission(user, 'visa.manage');
  const showInterview =
    hasPermission(user, 'interview.view') || hasPermission(user, 'interview.manage');
  const worksWithStudents = showStudents || showFinance || showVisa || showInterview;

  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    enabled: worksWithStudents,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const receiptsQuery = useQuery({
    queryKey: ['consultant-charge-receipts-overview'],
    enabled: showFinance,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/consultant/charge-receipts');
      return data.data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  const conversations = messagesQuery.data?.data ?? [];
  const studentCount = studentsQuery.data?.length ?? 0;
  const students = studentsQuery.data ?? [];
  const totalUnread = messagesQuery.data?.unread_count ?? 0;
  const awaitingReview = (receiptsQuery.data ?? []).filter(
    (receipt) => receipt.status === 'awaiting_review',
  ).length;
  const departmentCount = [
    showStudents,
    showUniversities,
    showFinance,
    showInterview,
    showVisa,
  ].filter(Boolean).length;
  const roleLabel = organizationRoleLabel(user);

  return (
    <AppShell
      badge={roleLabel}
      title={`Hello, ${firstName}`}>
      <div className="page-stack">
        <div className="dash-metric-grid">
          <div className="dash-metric panel">
            <span className="dash-metric-icon purple">🎓</span>
            <span className="dash-metric-label">Students</span>
            <strong className="dash-metric-value">
              {worksWithStudents
                ? studentsQuery.isLoading
                  ? '…'
                  : studentCount
                : 'None'}
            </strong>
            <span className="dash-metric-hint">
              {worksWithStudents ? 'In the shared directory' : 'Not assigned to student work'}
            </span>
          </div>

          <div className="dash-metric panel">
            <span className="dash-metric-icon lilac">💬</span>
            <span className="dash-metric-label">Messages</span>
            <strong className="dash-metric-value">
              {messagesQuery.isLoading ? '…' : conversations.length}
            </strong>
            <span className="dash-metric-hint">
              {totalUnread ? `${totalUnread} unread` : 'Department threads'}
            </span>
          </div>

          {showFinance ? (
            <div className="dash-metric panel">
              <span className="dash-metric-icon gold">💳</span>
              <span className="dash-metric-label">Awaiting review</span>
              <strong className="dash-metric-value">
                {receiptsQuery.isLoading ? '…' : awaitingReview}
              </strong>
              <span className="dash-metric-hint">Payment screenshots to check</span>
            </div>
          ) : (
            <div className="dash-metric panel">
              <span className="dash-metric-icon blue">📁</span>
              <span className="dash-metric-label">Departments</span>
              <strong className="dash-metric-value">{departmentCount || 1}</strong>
              <span className="dash-metric-hint">Assigned to your account</span>
            </div>
          )}

          <div className="dash-metric panel">
            <span className="dash-metric-icon coral">👤</span>
            <span className="dash-metric-label">Your desk</span>
            <strong className="dash-metric-value" style={{ fontSize: '1.25rem' }}>
              {roleLabel}
            </strong>
            <span className="dash-metric-hint">Open tools from the sidebar</span>
          </div>
        </div>

        <PageSplit
          main={
            <PageSection
              title={showStudents ? 'Students' : 'Messages'}
              action={
                showStudents ? (
                  <Link className="text-link-btn" to={routes.studentInfo.students}>
                    View all
                  </Link>
                ) : (
                  <Link className="text-link-btn" to={routes.messages.root}>
                    Open inbox
                  </Link>
                )
              }>
              <div className="panel dash-activity">
                {showStudents ? (
                  <>
                    {studentsQuery.isLoading ? <p className="muted">Loading students…</p> : null}
                    {students.slice(0, 10).map((student) => (
                      <Link
                        key={student.id}
                        className="dash-activity-row"
                        to={routes.studentInfo.student(student.id)}>
                        <span className="dash-activity-avatar info">{initials(student.name)}</span>
                        <div className="dash-activity-copy">
                          <strong>{student.name}</strong>
                          <span>{student.email}</span>
                        </div>
                        <span className="workspace-link-meta">Open</span>
                      </Link>
                    ))}
                    {!studentsQuery.isLoading && students.length === 0 ? (
                      <PageEmpty
                        title="No students yet"
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    {messagesQuery.isLoading ? <p className="muted">Loading messages…</p> : null}
                    {conversations.slice(0, 10).map((conversation) => (
                      <Link
                        key={conversation.id}
                        className="dash-activity-row"
                        to={routes.messages.root}>
                        <span className="dash-activity-avatar purple">
                          {initials(conversation.other_user.name)}
                        </span>
                        <div className="dash-activity-copy">
                          <strong>{conversation.other_user.name}</strong>
                          <span>
                            {conversation.department_label
                              ? `${conversation.department_label}, `
                              : ''}
                            {conversation.last_message?.body ?? 'No messages yet'}
                          </span>
                        </div>
                        {(conversation.unread_count ?? 0) > 0 ? (
                          <span className="status-pill warn">{conversation.unread_count}</span>
                        ) : null}
                      </Link>
                    ))}
                    {!messagesQuery.isLoading && conversations.length === 0 ? (
                      <PageEmpty
                        title="No messages yet"
                      />
                    ) : null}
                  </>
                )}
              </div>
            </PageSection>
          }
          side={
            showStudents ? (
              <PageSection title="Inbox">
                <div className="panel dash-activity">
                  {messagesQuery.isLoading ? <p className="muted">Loading…</p> : null}
                  {conversations.slice(0, 6).map((conversation) => (
                    <Link
                      key={conversation.id}
                      className="dash-activity-row"
                      to={routes.messages.root}>
                      <span className="dash-activity-avatar purple">
                        {initials(conversation.other_user.name)}
                      </span>
                      <div className="dash-activity-copy">
                        <strong>{conversation.other_user.name}</strong>
                        <span>{conversation.last_message?.body ?? 'No messages yet'}</span>
                      </div>
                    </Link>
                  ))}
                  {!messagesQuery.isLoading && conversations.length === 0 ? (
                    <p className="muted">No student messages yet.</p>
                  ) : null}
                </div>
              </PageSection>
            ) : (
              <PageSection title="Getting started">
                <div className="workspace-list">
                  {showFinance ? (
                    <Link className="workspace-link" to={routes.finance.root}>
                      <div>
                        <strong>Finance</strong>
                        <span>Send slips and review payments</span>
                      </div>
                      <span className="workspace-link-meta">Open</span>
                    </Link>
                  ) : null}
                  {showUniversities ? (
                    <Link className="workspace-link" to={routes.universities.root}>
                      <div>
                        <strong>Universities</strong>
                        <span>Catalog and assignments</span>
                      </div>
                      <span className="workspace-link-meta">Open</span>
                    </Link>
                  ) : null}
                  {showInterview ? (
                    <Link className="workspace-link" to={routes.interview.root}>
                      <div>
                        <strong>Interview</strong>
                        <span>Preparation and scheduling</span>
                      </div>
                      <span className="workspace-link-meta">Open</span>
                    </Link>
                  ) : null}
                  {showVisa ? (
                    <Link className="workspace-link" to={routes.visa.root}>
                      <div>
                        <strong>Visa</strong>
                        <span>Embassy appointments</span>
                      </div>
                      <span className="workspace-link-meta">Open</span>
                    </Link>
                  ) : null}
                  <Link className="workspace-link" to={routes.messages.root}>
                    <div>
                      <strong>Messages</strong>
                      <span>Department inbox</span>
                    </div>
                    <span className="workspace-link-meta">Chat</span>
                  </Link>
                </div>
              </PageSection>
            )
          }
        />
      </div>
    </AppShell>
  );
}
