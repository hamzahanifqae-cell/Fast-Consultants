import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageSection, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import { isInterviewMeetingCancelled } from '@/lib/interview';
import { isProfileComplete } from '@/lib/student-profile';
import type { ApplicationStatusResponse, StudentProfile, VisaAppointment } from '@/types/auth';
import './dashboard.css';

function formatWhen(value: string | null) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type JourneyState = 'complete' | 'current' | 'upcoming' | 'locked';

type JourneyStep = {
  id: string;
  label: string;
  detail: string;
  state: JourneyState;
  href?: string;
  actionLabel?: string;
};

function overallStatusProgress(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[],
) {
  if (!status) {
    return {
      percent: 0,
      title: 'Loading your application',
      description: 'Fetching your latest checklist and stage details.',
    };
  }

  const profileDone = isProfileComplete(profile);
  const steps = [
    profileDone,
    Boolean(status.checklist?.documents?.accepted),
    Boolean(status.checklist?.charge_receipts?.accepted),
    Boolean(status.application?.preparation?.completed_at),
    status.application?.interview?.status === 'completed' ||
      status.application?.interview?.status === 'passed' ||
      status.application?.interview?.status === 'failed' ||
      (Boolean(status.application?.interview?.meeting_ended_at) &&
        status.application?.interview?.followup_preference === 'decline_another'),
    appointments.some((a) => a.status === 'completed'),
  ];
  const done = steps.filter(Boolean).length;
  const percent = Math.round((done / steps.length) * 100);
  const currentFocus = profileDone ? status.current_status : 'Student info';

  if (percent >= 100) {
    return {
      percent: 100,
      title: 'Application complete',
      description: 'Personal info, documents, fees, interview, and visa are all finished.',
    };
  }

  if (steps[4] && !steps[5]) {
    return {
      percent,
      title: 'Visa stage in progress',
      description: appointments.some((a) => a.status === 'scheduled')
        ? 'Your interview is done. Attend your scheduled visa appointment next.'
        : 'Interview complete. Visa staff will schedule your embassy appointment.',
    };
  }

  return {
    percent,
    title: 'Application in progress',
    description: `${done} of ${steps.length} stages complete · Current focus: ${currentFocus}`,
  };
}

function buildJourneySteps(
  status: ApplicationStatusResponse | undefined,
  profile: StudentProfile | undefined,
  appointments: VisaAppointment[],
): JourneyStep[] {
  if (!status) return [];

  const profileDone = isProfileComplete(profile);
  const docsDone = Boolean(status.checklist?.documents?.accepted);
  const feesDone = Boolean(status.checklist?.charge_receipts?.accepted);
  const prepDone = Boolean(status.application?.preparation?.completed_at);
  const interviewDone =
    status.application?.interview?.status === 'completed' ||
    status.application?.interview?.status === 'passed' ||
    status.application?.interview?.status === 'failed' ||
    (Boolean(status.application?.interview?.meeting_ended_at) &&
      status.application?.interview?.followup_preference === 'decline_another');
  const visaDone = appointments.some((a) => a.status === 'completed');

  const flags = [profileDone, docsDone, feesDone, prepDone, interviewDone, visaDone];
  const firstOpen = flags.findIndex((done) => !done);

  function stateFor(index: number): JourneyState {
    if (flags[index]) return 'complete';
    if (firstOpen === -1) return 'complete';
    if (index === firstOpen) return 'current';
    return 'locked';
  }

  const docs = status.checklist?.documents;
  const fees = status.checklist?.charge_receipts;
  const interview = status.application?.interview;

  return [
    {
      id: 'profile',
      label: 'Student info',
      detail: profileDone
        ? 'Personal details submitted'
        : 'Add phone, nationality, passport, CNIC, and other details',
      state: stateFor(0),
      href: StudentRoutes.profile,
      actionLabel: profileDone ? 'View' : 'Open',
    },
    {
      id: 'documents',
      label: 'Documents',
      detail: !profileDone
        ? 'Complete student info first'
        : docsDone
          ? 'All required files approved'
          : `${docs?.approved ?? 0} approved · ${docs?.pending ?? 0} pending review`,
      state: !profileDone ? 'locked' : stateFor(1),
      href: StudentRoutes.documents,
      actionLabel: docsDone ? 'View' : 'Open',
    },
    {
      id: 'fees',
      label: 'Charge receipts',
      detail: !profileDone
        ? 'Complete student info first'
        : feesDone
          ? 'All fee slips cleared'
          : `${fees?.approved ?? 0} approved · ${fees?.pending ?? 0} awaiting action`,
      state: !profileDone ? 'locked' : stateFor(2),
      href: StudentRoutes.chargeReceipts,
      actionLabel: feesDone ? 'View' : 'Open',
    },
    {
      id: 'preparation',
      label: 'Interview preparation',
      detail: !profileDone
        ? 'Complete student info first'
        : !status.preparation_available
          ? 'Unlocks after documents and fees are approved'
          : prepDone
            ? 'Preparation checklist completed'
            : 'Preparation notes are ready for you',
      state: !profileDone || !status.preparation_available
        ? 'locked'
        : prepDone
          ? 'complete'
          : stateFor(3),
      href: status.preparation_available ? StudentRoutes.interview : undefined,
      actionLabel: prepDone ? 'View' : 'Open',
    },
    {
      id: 'interview',
      label: 'Interview meeting',
      detail: !profileDone
        ? 'Complete student info first'
        : !status.interview_available
          ? 'Scheduled after preparation is complete'
          : isInterviewMeetingCancelled(interview)
            ? 'Meeting cancelled — staff will reschedule'
            : interview?.at
              ? `Scheduled ${formatWhen(interview.at)}`
              : interview?.status_label ?? 'Interview stage active',
      state: !profileDone || !status.interview_available
        ? 'locked'
        : interviewDone
          ? 'complete'
          : stateFor(4),
      href: status.interview_available ? StudentRoutes.interview : undefined,
      actionLabel: 'Open',
    },
    {
      id: 'visa',
      label: 'Visa appointment',
      detail: !profileDone
        ? 'Complete student info first'
        : visaDone
          ? 'Embassy appointment completed'
          : appointments.some((a) => a.status === 'scheduled')
            ? 'Appointment scheduled — see details below'
            : 'Visa staff will book after interview',
      state: !profileDone ? 'locked' : stateFor(5),
      href: StudentRoutes.visaAppointments,
      actionLabel: appointments.length ? 'View' : undefined,
    },
  ];
}

function stateLabel(state: JourneyState) {
  if (state === 'complete') return 'Complete';
  if (state === 'current') return 'In progress';
  if (state === 'locked') return 'Locked';
  return 'Up next';
}

function stateClass(state: JourneyState) {
  if (state === 'complete') return 'is-complete';
  if (state === 'current') return 'is-current';
  if (state === 'locked') return 'is-locked';
  return 'is-upcoming';
}

export function StudentStatusPage() {
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

  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  const status = statusQuery.data;
  const profile = profileQuery.data;
  const appointments = appointmentsQuery.data ?? [];
  const loading =
    statusQuery.isLoading || profileQuery.isLoading || appointmentsQuery.isLoading;
  const progress = overallStatusProgress(status, profile, appointments);
  const journeySteps = useMemo(
    () => buildJourneySteps(status, profile, appointments),
    [status, profile, appointments],
  );
  const currentStage =
    status && !isProfileComplete(profile) ? 'Student info' : status?.current_status;

  return (
    <AppShell badge="Student" title="My status">
      <div className="page-stack status-page">
        <SectionProgress
          description={progress.description}
          loading={loading}
          percent={progress.percent}
          title={progress.title}
        />

        {currentStage ? (
          <div className="status-current panel">
            <span className="status-current-label">Current stage</span>
            <strong className="status-current-value">{currentStage}</strong>
          </div>
        ) : null}

        <PageSection subtitle="Track each milestone from student info through visa." title="Application journey">
          <div className="status-journey">
            {journeySteps.map((step, index) => (
              <article
                key={step.id}
                className={`status-step ${stateClass(step.state)}${index === journeySteps.length - 1 ? ' is-last' : ''}`}>
                <div className="status-step-rail" aria-hidden>
                  <span className="status-step-dot" />
                  {index < journeySteps.length - 1 ? <span className="status-step-line" /> : null}
                </div>
                <div className="status-step-body">
                  <div className="status-step-head">
                    <div>
                      <h3>{step.label}</h3>
                      <p>{step.detail}</p>
                    </div>
                    <span className={`status-step-badge ${stateClass(step.state)}`}>
                      {stateLabel(step.state)}
                    </span>
                  </div>
                  {step.href && step.actionLabel && step.state !== 'locked' ? (
                    <Link className="ghost-btn status-step-action" to={step.href}>
                      {step.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </PageSection>

        <PageSection
          action={
            <Link className="ghost-btn" to={StudentRoutes.visaAppointments}>
              View all
            </Link>
          }
          subtitle="Embassy visits scheduled by the visa team."
          title="Visa appointments">
          {appointmentsQuery.isLoading ? (
            <p className="muted">Loading appointments…</p>
          ) : appointments.length ? (
            <div className="status-appointments">
              {appointments.map((item) => (
                <div key={item.id} className="status-appointment-row">
                  <div>
                    <strong>{formatWhen(item.scheduled_at)}</strong>
                    <span>
                      {[item.embassy, item.location, item.mode].filter(Boolean).join(' · ') ||
                        'Details to be confirmed'}
                    </span>
                  </div>
                  <span className="status-pill">{item.status_label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="status-appointments-empty">
              <span className="status-appointments-icon" aria-hidden>
                🛂
              </span>
              <div>
                <strong>No appointments yet</strong>
                <p>Visa staff will add your embassy slot here after the interview stage.</p>
              </div>
            </div>
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}
