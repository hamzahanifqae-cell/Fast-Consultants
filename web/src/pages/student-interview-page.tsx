import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { PageEmpty, PageSection, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import {
  formatInterviewWhen,
  isInterviewMeetingCancelled,
  isOnlineInterviewMode,
  meetingScheduleSummary,
} from '@/lib/interview';
import type { ApplicationStatusResponse } from '@/types/auth';
import './dashboard.css';

function formatWhen(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function interviewSectionProgress(status: ApplicationStatusResponse | undefined) {
  if (!status) {
    return {
      percent: 0,
      title: 'Interview incomplete',
      description: 'Loading your interview progress.',
    };
  }

  const prepDone = Boolean(status.application.preparation.completed_at);
  const interview = status.application.interview;
  const meetingDone = Boolean(interview.meeting_ended_at);
  const scheduled = Boolean(interview.at);

  if (!status.preparation_available) {
    return {
      percent: 0,
      title: 'Interview locked',
      description: 'Opens after documents and charge slips are approved.',
    };
  }

  if (!prepDone) {
    return {
      percent: 25,
      title: 'Interview incomplete',
      description: 'Review preparation notes and mark them complete.',
    };
  }

  if (meetingDone && !scheduled) {
    return {
      percent: 100,
      title: 'Interview complete',
      description: 'Preparation done and your session has finished.',
    };
  }

  if (scheduled) {
    return {
      percent: 75,
      title: 'Interview in progress',
      description: 'Preparation complete — meeting is scheduled.',
    };
  }

  if (status.interview_available) {
    return {
      percent: 50,
      title: 'Interview in progress',
      description: 'Preparation complete — waiting for a meeting time.',
    };
  }

  return {
    percent: 50,
    title: 'Interview in progress',
    description: 'Preparation complete — waiting for interview unlock.',
  };
}

const DEFAULT_PREP_TIPS = [
  'Review your personal details and uploaded documents.',
  'Check university requirements for your shortlisted programmes.',
  'Practice common admission questions out loud.',
  'Keep your passport and key documents ready for the session.',
];

export function StudentInterviewPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
  });

  const completePrep = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: ApplicationStatusResponse }>(
        '/student/application/complete-preparation',
      );
      return data.data;
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not mark preparation complete.')),
  });

  const followupPreference = useMutation({
    mutationFn: async (preference: 'want_another' | 'decline_another') => {
      const { data } = await api.post<{ data: ApplicationStatusResponse; message?: string }>(
        '/student/interview/followup-preference',
        { preference },
      );
      return data.data;
    },
    onSuccess: async (payload) => {
      queryClient.setQueryData(['student-application-status'], payload);
      await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    },
  });

  const status = statusQuery.data;
  const preparation = status?.application?.preparation;
  const interview = status?.application?.interview;
  const prepLocked = Boolean(status && !status.preparation_available);
  const interviewLocked = Boolean(status && !status.interview_available);
  const online = isOnlineInterviewMode(interview?.mode);
  const meetingCancelled = isInterviewMeetingCancelled(interview);
  const prepDone = Boolean(preparation?.completed_at);
  const customPrepBody = preparation?.body?.trim() ?? '';
  const showFollowupChoice =
    Boolean(interview?.unlocked_at) &&
    Boolean(interview?.meeting_ended_at) &&
    !interview?.at &&
    !meetingCancelled &&
    !interview?.followup_preference;
  const meetingSummary = meetingScheduleSummary(interview, {
    interviewAvailable: status?.interview_available,
  });
  const progress = interviewSectionProgress(status);

  const prepStageState = prepLocked ? 'locked' : prepDone ? 'done' : 'active';
  const meetingStageState = interviewLocked
    ? 'locked'
    : interview?.meeting_ended_at && !interview.at
      ? 'done'
      : interview?.at
        ? 'active'
        : prepDone
          ? 'waiting'
          : 'locked';

  return (
    <AppShell badge="Student" title="Interview">
      <div className="page-stack interview-page">
        <SectionProgress
          loading={statusQuery.isLoading}
          title={progress.title}
          description={progress.description}
          percent={progress.percent}
        />

        <div className="interview-stage-rail" aria-label="Interview stages">
          <article className={`interview-stage ${prepStageState}`}>
            <span className="interview-stage-index" aria-hidden>
              1
            </span>
            <div>
              <strong>Preparation</strong>
              <span>
                {prepLocked
                  ? 'Locked until documents and fees clear'
                  : prepDone
                    ? `Completed ${formatWhen(preparation?.completed_at ?? null) ?? ''}`
                    : 'Review notes, then mark complete'}
              </span>
            </div>
            <span className={`status-pill${prepDone ? ' success' : prepLocked ? '' : ' warn'}`}>
              {prepLocked ? 'Locked' : prepDone ? 'Done' : 'To do'}
            </span>
          </article>
          <article className={`interview-stage ${meetingStageState}`}>
            <span className="interview-stage-index" aria-hidden>
              2
            </span>
            <div>
              <strong>Meeting</strong>
              <span>
                {interviewLocked
                  ? 'Scheduled after preparation'
                  : meetingCancelled
                    ? 'Cancelled — waiting for reschedule'
                    : interview?.at
                      ? formatInterviewWhen(interview.at)
                      : interview?.meeting_ended_at
                        ? 'Session finished'
                        : 'Waiting for staff to schedule'}
              </span>
            </div>
            <span
              className={`status-pill${
                meetingStageState === 'done'
                  ? ' success'
                  : meetingStageState === 'active'
                    ? ' warn'
                    : meetingCancelled
                      ? ' danger'
                      : ''
              }`}>
              {meetingCancelled
                ? 'Cancelled'
                : meetingStageState === 'done'
                  ? 'Done'
                  : meetingStageState === 'active'
                    ? 'Scheduled'
                    : meetingStageState === 'waiting'
                      ? 'Pending'
                      : 'Locked'}
            </span>
          </article>
        </div>

        <PageSection
          title={preparation?.title ?? 'Interview preparation'}
          subtitle="Get ready before staff schedule your session."
          action={
            prepDone ? <span className="status-pill success">Complete</span> : undefined
          }>
          <section className="panel interview-panel">
            {statusQuery.isLoading ? <p className="muted">Loading…</p> : null}

            {prepLocked ? (
              <PageEmpty
                title="Preparation is locked"
                body="Your documents and charge slips need to be accepted before preparation unlocks."
                actionLabel="View my status"
                actionTo={StudentRoutes.status}
              />
            ) : null}

            {!prepLocked && status ? (
              <div className="interview-prep-body">
                {customPrepBody ? (
                  <p className="interview-prep-notes">{customPrepBody}</p>
                ) : (
                  <>
                    <p className="interview-lead">
                      Staff have unlocked preparation. Work through these points, then mark complete
                      when you are ready for scheduling.
                    </p>
                    <ul className="interview-checklist">
                      {DEFAULT_PREP_TIPS.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </>
                )}

                {prepDone ? (
                  <div className="interview-complete-banner">
                    <span className="status-pill success">Preparation marked complete</span>
                    <p>
                      {formatWhen(preparation?.completed_at ?? null)
                        ? `Saved ${formatWhen(preparation?.completed_at ?? null)}.`
                        : 'Saved.'}{' '}
                      Staff can now schedule your interview meeting.
                    </p>
                  </div>
                ) : (
                  <div className="interview-prep-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={completePrep.isPending}
                      onClick={() => completePrep.mutate()}>
                      {completePrep.isPending ? 'Saving…' : 'Mark preparation complete'}
                    </button>
                    <p className="field-hint">You can still review notes after marking complete.</p>
                  </div>
                )}

                {error ? <p className="form-error">{error}</p> : null}
              </div>
            ) : null}
          </section>
        </PageSection>

        <PageSection
          title="Interview meeting"
          subtitle="Timer and video unlock when staff set your session time."
          action={
            !interviewLocked && interview?.at ? (
              <span className="status-pill warn">Scheduled</span>
            ) : undefined
          }>
          <section className="panel interview-panel">
            {interviewLocked ? (
              <div className="interview-waiting">
                <div className="interview-waiting-icon" aria-hidden>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                    <path
                      d="M12 7v5l3 2"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <strong>Waiting for schedule</strong>
                  <p>
                    The meeting timer and video unlock after staff schedule your interview. Finish
                    preparation first if you have not already.
                  </p>
                </div>
              </div>
            ) : null}

            {!interviewLocked && interview?.meeting_ended_at && !interview.at ? (
              <p className="interview-lead" style={{ marginTop: 0 }}>
                Previous session finished
                {interview.meeting_ended_at
                  ? ` on ${formatWhen(interview.meeting_ended_at)}`
                  : ''}
                . {meetingSummary.hint}.
              </p>
            ) : null}

            {!interviewLocked && interview ? (
              <div className="interview-meeting-body">
                <div className="interview-meta-grid">
                  <div className="interview-meta">
                    <span>Status</span>
                    <strong>{meetingSummary.value}</strong>
                    <em>{meetingSummary.hint}</em>
                  </div>
                  {interview.mode ? (
                    <div className="interview-meta">
                      <span>Mode</span>
                      <strong>{interview.mode}</strong>
                      <em>{online ? 'Join from this page when the timer opens' : 'Attend in person'}</em>
                    </div>
                  ) : null}
                  {interview.at ? (
                    <div className="interview-meta">
                      <span>When</span>
                      <strong>{formatInterviewWhen(interview.at)}</strong>
                      <em>Local time on your device</em>
                    </div>
                  ) : null}
                  {!online && interview.location ? (
                    <div className="interview-meta">
                      <span>Location</span>
                      <strong>{interview.location}</strong>
                      <em>In-person meeting point</em>
                    </div>
                  ) : null}
                </div>

                {meetingCancelled ? (
                  <div className="interview-alert danger">
                    <span className="status-pill danger">Meeting cancelled</span>
                    <p>
                      Staff cancelled this meeting. You will be notified when a new session is
                      scheduled.
                    </p>
                  </div>
                ) : null}

                {interview.notes ? (
                  <div className="interview-alert">
                    <h3>Notes from staff</h3>
                    <p className="interview-prep-notes">{interview.notes}</p>
                  </div>
                ) : null}

                {showFollowupChoice ? (
                  <div className="interview-alert interview-followup-card">
                    <h3>Would you like another meeting?</h3>
                    <p className="muted" style={{ marginTop: 0 }}>
                      Your last meeting has ended. Tell staff if you want another session.
                    </p>
                    {followupPreference.isError ? (
                      <p className="form-error">
                        {getApiErrorMessage(
                          followupPreference.error,
                          'Could not save your choice.',
                        )}
                      </p>
                    ) : null}
                    <div className="interview-followup-actions">
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={followupPreference.isPending}
                        onClick={() => followupPreference.mutate('want_another')}>
                        {followupPreference.isPending
                          ? 'Saving…'
                          : 'Yes, schedule another meeting'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={followupPreference.isPending}
                        onClick={() => followupPreference.mutate('decline_another')}>
                        No, I don’t need another meeting
                      </button>
                    </div>
                  </div>
                ) : null}

                {!interview.at &&
                !meetingCancelled &&
                interview.followup_preference === 'want_another' ? (
                  <div className="interview-alert">
                    <span className="status-pill">Requested another meeting</span>
                    <p>Staff can see your request and will schedule the next session.</p>
                  </div>
                ) : null}

                {!interview.at &&
                !meetingCancelled &&
                interview.followup_preference === 'decline_another' ? (
                  <div className="interview-alert">
                    <span className="status-pill">No further meeting requested</span>
                    <p>You told staff you don’t need another meeting right now.</p>
                  </div>
                ) : null}

                {!interview.at &&
                !meetingCancelled &&
                !showFollowupChoice &&
                !interview.followup_preference ? (
                  <div className="interview-waiting compact">
                    <div className="interview-waiting-icon" aria-hidden>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect
                          x="3.5"
                          y="5"
                          width="17"
                          height="15"
                          rx="2.5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        />
                        <path
                          d="M8 3.5v3M16 3.5v3M3.5 9.5h17"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div>
                      <strong>No meeting scheduled yet</strong>
                      <p>Staff will set the next session time. You will see the timer here when it is booked.</p>
                    </div>
                  </div>
                ) : null}

                <InterviewMeetingSection
                  enabled={Boolean(interview.at)}
                  interviewMode={interview.mode}
                  role="student"
                />
              </div>
            ) : null}
          </section>
        </PageSection>

        <p className="muted interview-back">
          <Link to={StudentRoutes.status}>← Back to my status</Link>
        </p>
      </div>
    </AppShell>
  );
}
