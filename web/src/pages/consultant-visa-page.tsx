import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { DepartmentStudentGate } from '@/components/department-student-gate';
import { PageStats, PageTips } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { handoffLockMessage, useStudentHandoff } from '@/hooks/use-student-handoff';
import { api, getApiErrorMessage } from '@/lib/api';
import type { StudentApplication, VisaAppointment } from '@/types/auth';
import './dashboard.css';

type ConsultantVisaPageProps = {
  focus?: 'interview' | 'visa' | 'all';
};

export function ConsultantVisaPage({ focus = 'all' }: ConsultantVisaPageProps) {
  const queryClient = useQueryClient();
  const showInterview = focus === 'all' || focus === 'interview';
  const showVisa = focus === 'all' || focus === 'visa';
  const shellTitle =
    focus === 'interview' ? 'Interview' : focus === 'visa' ? 'Visa' : 'Visa & Interview';
  const shellBadge =
    focus === 'interview' ? 'Interview' : focus === 'visa' ? 'VISA' : 'Visa & Interview';

  const { studentId, selected, selectStudent, clearStudent, studentsQuery } =
    useDepartmentStudentParam();
  const [prepTitle, setPrepTitle] = useState('');
  const [prepBody, setPrepBody] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewMode, setInterviewMode] = useState('Online');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [visaAt, setVisaAt] = useState('');
  const [visaMode, setVisaMode] = useState('In person');
  const [visaLocation, setVisaLocation] = useState('');
  const [visaEmbassy, setVisaEmbassy] = useState('');
  const [visaNotes, setVisaNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applicationQuery = useQuery({
    queryKey: ['consultant-application', studentId],
    enabled: Boolean(studentId) && showInterview,
    queryFn: async () => {
      const { data } = await api.get<{ data: { application: StudentApplication } }>(
        `/consultant/applications/${studentId}`,
      );
      return data.data.application;
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ['consultant-visa-appointments', studentId],
    enabled: Boolean(studentId) && showVisa,
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/consultant/visa-appointments', {
        params: { student_id: studentId },
      });
      return data.data;
    },
  });

  const handoffQuery = useStudentHandoff(showInterview ? studentId : null);
  const interviewLock = handoffLockMessage(handoffQuery.data, 'interview');

  const directoryCount = studentsQuery.data?.length ?? 0;
  const appointmentCount = appointmentsQuery.data?.length ?? 0;
  const application = applicationQuery.data;

  useEffect(() => {
    const application = applicationQuery.data;
    if (!application?.preparation || !application.interview) return;
    setPrepTitle(application.preparation.title ?? 'Interview preparation');
    setPrepBody(application.preparation.body ?? '');
    setInterviewAt(
      application.interview.at
        ? new Date(application.interview.at).toISOString().slice(0, 16)
        : '',
    );
    setInterviewMode(application.interview.mode ?? 'Online');
    setInterviewLocation(application.interview.location ?? '');
    setInterviewNotes(application.interview.notes ?? '');
  }, [applicationQuery.data]);

  const updateApplication = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error('Select a student.');
      const payload: Record<string, unknown> = {
        preparation_title: prepTitle.trim() || undefined,
        preparation_body: prepBody.trim() || undefined,
        unlock_interview: true,
        interview_mode: interviewMode.trim() || null,
        interview_location: interviewLocation.trim() || null,
        interview_notes: interviewNotes.trim() || null,
      };
      if (interviewAt.trim()) {
        payload.interview_at = new Date(interviewAt.trim()).toISOString();
      }
      await api.put(`/consultant/applications/${studentId}`, payload);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-application', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['consultant-interview-video-room', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update application.')),
  });

  const cancelMeeting = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error('Select a student.');
      await api.post(`/consultant/applications/${studentId}/cancel-meeting`);
    },
    onSuccess: async () => {
      setError(null);
      setInterviewAt('');
      await queryClient.invalidateQueries({ queryKey: ['consultant-application', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['consultant-interview-video-room', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['interview-call-status', 'staff', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['consultant-applications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not cancel the meeting.')),
  });

  const createAppointment = useMutation({
    mutationFn: async () => {
      await api.post('/consultant/visa-appointments', {
        student_id: studentId,
        scheduled_at: new Date(visaAt).toISOString(),
        mode: visaMode.trim() || null,
        location: visaLocation.trim() || null,
        embassy: visaEmbassy.trim() || null,
        notes: visaNotes.trim() || null,
      });
    },
    onSuccess: async () => {
      setVisaAt('');
      setVisaLocation('');
      setVisaEmbassy('');
      setVisaNotes('');
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['consultant-visa-appointments', studentId],
      });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not schedule appointment.')),
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await api.put(`/consultant/visa-appointments/${id}`, { status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['consultant-visa-appointments', studentId],
      });
    },
  });

  function onCreateAppointment(event: FormEvent) {
    event.preventDefault();
    if (!studentId || !visaAt) {
      setError('Appointment time is required.');
      return;
    }
    createAppointment.mutate();
  }

  return (
    <AppShell badge={shellBadge} title={shellTitle}>
      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={(student) => {
          selectStudent(student);
          setError(null);
        }}
        onClear={() => {
          clearStudent();
          setError(null);
        }}>
        {error ? <p className="form-error">{error}</p> : null}

        <PageStats
          items={[
            {
              label: 'Students',
              value: studentsQuery.isLoading ? '…' : directoryCount,
              hint: 'In the shared directory',
              icon: '🎓',
              tone: 'purple',
            },
            ...(showInterview
              ? [
                  {
                    label: 'Interview stage',
                    value: applicationQuery.isLoading
                      ? '…'
                      : (application?.stage_label ?? 'Not started'),
                    hint: application?.everything_accepted
                      ? 'Docs & fees ready'
                      : 'Waiting on checklist',
                    icon: '🗓️',
                    tone: 'coral' as const,
                  },
                ]
              : []),
            ...(showVisa
              ? [
                  {
                    label: 'Visa appointments',
                    value: appointmentsQuery.isLoading ? '…' : appointmentCount,
                    hint: 'For this student',
                    icon: '🛂',
                    tone: 'gold' as const,
                  },
                ]
              : []),
            {
              label: 'Selected student',
              value: selected?.name?.split(' ')[0] ?? 'None',
              hint: selected?.email ?? 'Pick a student to continue',
              icon: '👤',
              tone: 'blue' as const,
            },
          ]}
        />
        <PageTips
          title={showInterview && !showVisa ? 'Interview tips' : showVisa && !showInterview ? 'Visa tips' : 'Tips'}
          items={
            showInterview && !showVisa
              ? [
                  'Unlock preparation only after documents and fees are accepted.',
                  'Add clear prep notes so the student knows what to practice.',
                  'Schedule interview time with mode and location or link.',
                ]
              : showVisa && !showInterview
                ? [
                    'Schedule embassy time with mode and location.',
                    'Mark appointments completed or cancelled when status changes.',
                    'Students see these appointments on My status.',
                  ]
                : [
                    'Interview unlocks after documents and fees are accepted.',
                    'Visa appointments appear on the student My status page.',
                    'Keep notes short and actionable for the student.',
                  ]
          }
        />

        <div className="org-layout">
          {showInterview ? (
            <section className="panel">
              <h2>Interview for this student</h2>
              {applicationQuery.isLoading ? <p className="muted">Loading…</p> : null}
              {application ? (
                <form
                  className="org-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateApplication.mutate();
                  }}>
                  <p>
                    Stage: <strong>{application.stage_label}</strong>
                  </p>
                  {interviewLock ? <p className="handoff-lock">{interviewLock}</p> : null}
                  <label className="field">
                    <span>Preparation title</span>
                    <input value={prepTitle} onChange={(event) => setPrepTitle(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Preparation notes</span>
                    <input value={prepBody} onChange={(event) => setPrepBody(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Interview time</span>
                    <input
                      type="datetime-local"
                      value={interviewAt}
                      onChange={(event) => setInterviewAt(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Mode</span>
                    <input
                      value={interviewMode}
                      onChange={(event) => setInterviewMode(event.target.value)}
                      placeholder="Online"
                    />
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      Use Online for in-app video prep. Students and staff join the same built-in room.
                    </span>
                  </label>
                  <label className="field">
                    <span>In-person location (optional)</span>
                    <input
                      value={interviewLocation}
                      onChange={(event) => setInterviewLocation(event.target.value)}
                      placeholder="Office address, only if not online"
                    />
                  </label>
                  <label className="field">
                    <span>Interview notes</span>
                    <input
                      value={interviewNotes}
                      onChange={(event) => setInterviewNotes(event.target.value)}
                    />
                  </label>
                  <button
                    className="primary-btn"
                    type="submit"
                    disabled={updateApplication.isPending || Boolean(interviewLock)}>
                    Unlock / update interview
                  </button>
                </form>
              ) : null}

              {application?.interview?.unlocked_at && application?.interview?.at ? (
                <div className="panel interview-video-card" style={{ marginTop: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}>
                    <h3 style={{ marginTop: 0, marginBottom: 0 }}>Live meeting timer & video</h3>
                    <button
                      type="button"
                      className="ghost-btn danger"
                      disabled={cancelMeeting.isPending}
                      onClick={() => cancelMeeting.mutate()}>
                      {cancelMeeting.isPending ? 'Cancelling…' : 'Cancel meeting'}
                    </button>
                  </div>
                  <InterviewMeetingSection
                    enabled
                    interviewMode={application.interview.mode ?? interviewMode}
                    role="staff"
                    studentId={studentId}
                    studentName={selected?.name ?? application.student?.name}
                  />
                </div>
              ) : application?.interview?.unlocked_at ? (
                <div style={{ marginTop: 18 }}>
                  {application.interview?.followup_preference === 'want_another' ? (
                    <div className="panel" style={{ background: 'var(--panel-muted)', marginBottom: 12 }}>
                      <span className="status-pill">Student wants another meeting</span>
                      <p className="muted" style={{ margin: '12px 0 0' }}>
                        {selected?.name ?? application.student?.name ?? 'This student'} asked for
                        another interview session. Schedule a new time above.
                      </p>
                    </div>
                  ) : null}
                  {application.interview?.followup_preference === 'decline_another' ? (
                    <div className="panel" style={{ background: 'var(--panel-muted)', marginBottom: 12 }}>
                      <span className="status-pill">Student declined another meeting</span>
                      <p className="muted" style={{ margin: '12px 0 0' }}>
                        {selected?.name ?? application.student?.name ?? 'This student'} said they do
                        not need another meeting right now.
                      </p>
                    </div>
                  ) : null}
                  <p className="muted">
                    No active meeting. Schedule a new interview time above when you are ready for the
                    next session.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {showVisa ? (
            <section className="panel">
              <h2>Visa appointments</h2>
              <div className="stack-list">
                {(appointmentsQuery.data ?? []).map((appointment) => (
                  <div key={appointment.id} className="stack-item org-member">
                    <div>
                      <strong>{appointment.status_label}</strong>
                      <span>
                        {appointment.scheduled_at
                          ? new Date(appointment.scheduled_at).toLocaleString()
                          : 'No time'}
                        {appointment.embassy ? `, ${appointment.embassy}` : ''}
                      </span>
                    </div>
                    <div className="org-actions">
                      {appointment.status === 'scheduled' ? (
                        <>
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() =>
                              updateAppointment.mutate({
                                id: appointment.id,
                                status: 'completed',
                              })
                            }>
                            Complete
                          </button>
                          <button
                            type="button"
                            className="ghost-btn danger"
                            onClick={() =>
                              updateAppointment.mutate({
                                id: appointment.id,
                                status: 'cancelled',
                              })
                            }>
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(appointmentsQuery.data?.length ?? 0) === 0 ? (
                  <p className="muted">No visa appointments for this student yet.</p>
                ) : null}
              </div>

              <form className="org-form" style={{ marginTop: 18 }} onSubmit={onCreateAppointment}>
                <h2>Schedule appointment</h2>
                <label className="field">
                  <span>Date & time</span>
                  <input
                    type="datetime-local"
                    value={visaAt}
                    onChange={(event) => setVisaAt(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Embassy</span>
                  <input
                    value={visaEmbassy}
                    onChange={(event) => setVisaEmbassy(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Mode</span>
                  <input value={visaMode} onChange={(event) => setVisaMode(event.target.value)} />
                </label>
                <label className="field">
                  <span>Location</span>
                  <input
                    value={visaLocation}
                    onChange={(event) => setVisaLocation(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Notes</span>
                  <input value={visaNotes} onChange={(event) => setVisaNotes(event.target.value)} />
                </label>
                <button
                  className="primary-btn"
                  type="submit"
                  disabled={createAppointment.isPending}>
                  Schedule visa appointment
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </DepartmentStudentGate>
    </AppShell>
  );
}
