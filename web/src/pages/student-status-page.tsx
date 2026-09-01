import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageEmpty, PageSplit, PageTips, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import { isInterviewMeetingCancelled } from '@/lib/interview';
import type { ApplicationStatusResponse, VisaAppointment } from '@/types/auth';
import './dashboard.css';

function formatWhen(value: string | null) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function overallStatusProgress(
  status: ApplicationStatusResponse | undefined,
  appointments: VisaAppointment[],
) {
  if (!status) {
    return {
      percent: 0,
      title: 'Status loading',
      description: 'Fetching your application checklist.',
    };
  }

  const steps = [
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

  if (percent >= 100) {
    return {
      percent: 100,
      title: 'Application complete',
      description: 'Documents, fees, interview, and visa appointment are finished.',
    };
  }

  if (
    steps[3] &&
    !steps[4]
  ) {
    return {
      percent,
      title: 'Visa in progress',
      description:
        appointments.some((a) => a.status === 'scheduled')
          ? 'Interview done, attend your scheduled visa appointment.'
          : 'Interview done, waiting for Visa staff to schedule your appointment.',
    };
  }

  return {
    percent,
    title: 'Application in progress',
    description: `${done} of ${steps.length} stages ready, current: ${status.current_status}.`,
  };
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

  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  const status = statusQuery.data;
  const appointments = appointmentsQuery.data ?? [];
  const progress = overallStatusProgress(status, appointments);
  const loading = statusQuery.isLoading || appointmentsQuery.isLoading;

  return (
    <AppShell
      badge="Student"
      title="My status">
      <div className="page-stack">
        <SectionProgress
          loading={loading}
          title={progress.title}
          percent={progress.percent}
        />

        <PageSplit
          main={
            <>
              <section className="panel">
                <h2>Current stage</h2>
                {statusQuery.isLoading ? <p className="muted">Loading…</p> : null}
                {status ? (
                  <>
                    <p>
                      <strong>{status.current_status}</strong>
                    </p>
                    <div className="stack-list" style={{ marginTop: 14 }}>
                      <div className="stack-item">
                        <div>
                          <strong>Documents</strong>
                          <span>
                            {status.checklist?.documents?.accepted
                              ? 'All accepted'
                              : `Approved ${status.checklist?.documents?.approved ?? 0}, Pending ${status.checklist?.documents?.pending ?? 0}`}
                          </span>
                        </div>
                        <span
                          className={`status-pill${status.checklist?.documents?.accepted ? '' : ' warn'}`}>
                          {status.checklist?.documents?.accepted ? 'Ready' : 'Open'}
                        </span>
                      </div>
                      <div className="stack-item">
                        <div>
                          <strong>Charge receipts</strong>
                          <span>
                            {status.checklist?.charge_receipts?.accepted
                              ? 'All accepted'
                              : `Approved ${status.checklist?.charge_receipts?.approved ?? 0}, Pending ${status.checklist?.charge_receipts?.pending ?? 0}`}
                          </span>
                        </div>
                        <span
                          className={`status-pill${status.checklist?.charge_receipts?.accepted ? '' : ' warn'}`}>
                          {status.checklist?.charge_receipts?.accepted ? 'Ready' : 'Open'}
                        </span>
                      </div>
                    </div>
                    <p style={{ marginTop: 14 }}>
                      <Link to={StudentRoutes.documents}>Documents</Link>
                      {', '}
                      <Link to={StudentRoutes.chargeReceipts}>Charge receipts</Link>
                    </p>
                  </>
                ) : null}
              </section>

              <section className="panel">
                <h2>Preparation & interview</h2>
                {status ? (
                  <div className="stack-list">
                    <div className="stack-item">
                      <div>
                        <strong>Interview</strong>
                        <span>
                          {!status.preparation_available
                            ? 'Locked until documents and charges are approved'
                            : !status.application?.preparation?.completed_at
                              ? 'Preparation notes available'
                              : status.interview_available
                                ? status.application?.interview?.status_label
                                : 'Preparation complete, waiting for meeting'}
                        </span>
                      </div>
                      <Link className="ghost-btn" to={StudentRoutes.interview}>
                        Open
                      </Link>
                    </div>
                    {status.interview_available && isInterviewMeetingCancelled(status.application?.interview) ? (
                      <div className="stack-item">
                        <div>
                          <strong>Meeting</strong>
                          <span className="status-pill danger">Cancelled</span>
                        </div>
                      </div>
                    ) : null}
                    {status.interview_available && status.application?.interview?.at ? (
                      <div className="stack-item">
                        <div>
                          <strong>Scheduled</strong>
                          <span>{formatWhen(status.application.interview.at)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          }
          side={
            <PageTips
              title="Reading your status"
              items={[
                'Green “Ready” means that checklist item is cleared.',
                'Open Interview for preparation notes and the live meeting.',
                'Ask questions in Messages if a stage looks stuck.',
              ]}
            />
          }
        />

        <section className="panel">
          <h2>Visa appointments</h2>
          <div className="stack-list">
            {appointments.map((item) => (
              <div key={item.id} className="stack-item">
                <div>
                  <strong>{formatWhen(item.scheduled_at)}</strong>
                  <span>
                    {[item.embassy, item.location, item.mode].filter(Boolean).join(', ') ||
                      'Details pending'}
                  </span>
                </div>
                <span className="status-pill">{item.status_label}</span>
              </div>
            ))}
          </div>
          {!appointmentsQuery.isLoading && appointments.length === 0 ? (
            <PageEmpty
              title="No appointments yet"
            />
          ) : null}
          <p style={{ marginTop: 14 }}>
            <Link to={StudentRoutes.visaAppointments}>Open visa appointments</Link>
            {', '}
            <Link to={StudentRoutes.interview}>Open interview</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
