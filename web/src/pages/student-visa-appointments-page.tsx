import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageEmpty, PageSplit, PageTips, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import type { VisaAppointment } from '@/types/auth';
import './dashboard.css';

function formatWhen(value: string | null) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function StudentVisaAppointmentsPage() {
  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  const appointments = appointmentsQuery.data ?? [];
  const upcoming = appointments.filter((item) => item.status === 'scheduled').length;
  const completed = appointments.filter((item) => item.status === 'completed').length;
  const visaProgress = (() => {
    if (appointments.length === 0) {
      return {
        percent: 0,
        title: 'Visa incomplete',
        description: 'No appointments yet, Visa staff will add them here.',
      };
    }
    if (completed > 0 && upcoming === 0) {
      return {
        percent: 100,
        title: 'Visa complete',
        description: `${completed} appointment${completed === 1 ? '' : 's'} completed.`,
      };
    }
    if (upcoming > 0) {
      return {
        percent: Math.round(((completed + upcoming * 0.5) / appointments.length) * 100),
        title: 'Visa in progress',
        description: `${upcoming} scheduled, ${completed} completed.`,
      };
    }
    return {
      percent: Math.round((completed / appointments.length) * 100),
      title: 'Visa in progress',
      description: `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} on file.`,
    };
  })();

  return (
    <AppShell
      badge="Student"
      title="Visa appointments">
      <div className="page-stack">
        <SectionProgress
          loading={appointmentsQuery.isLoading}
          title={visaProgress.title}
          percent={visaProgress.percent}
        />

        <PageSplit
          main={
            <section className="panel">
              <h2>Your appointments</h2>
              {appointmentsQuery.isLoading ? <p className="muted">Loading…</p> : null}
              <div className="stack-list">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="stack-item">
                    <div>
                      <strong>{formatWhen(appointment.scheduled_at)}</strong>
                      <span>
                        {[
                          appointment.embassy ? `Embassy: ${appointment.embassy}` : null,
                          appointment.mode ? `Mode: ${appointment.mode}` : null,
                          appointment.location ? `Location: ${appointment.location}` : null,
                          appointment.notes ? `Notes: ${appointment.notes}` : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'Details will be confirmed by staff.'}
                      </span>
                    </div>
                    <span
                      className={`status-pill${appointment.status === 'cancelled' ? ' danger' : appointment.status === 'scheduled' ? ' warn' : ''}`}>
                      {appointment.status_label}
                    </span>
                  </div>
                ))}
              </div>
              {!appointmentsQuery.isLoading && appointments.length === 0 ? (
                <PageEmpty
                  title="No visa appointments yet"
                />
              ) : null}
              <p className="muted" style={{ marginTop: 16 }}>
                Complete <Link to={StudentRoutes.interview}>Interview</Link> preparation first if that
                section is still open.
              </p>
            </section>
          }
          side={
            <PageTips
              title="Visa tips"
              items={[
                'Arrive early and bring the documents staff listed for you.',
                'Check Messages if a time or embassy location looks wrong.',
                'Preparation notes stay available under Preparation.',
              ]}
            />
          }
        />
      </div>
    </AppShell>
  );
}
