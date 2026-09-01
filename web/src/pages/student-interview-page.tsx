import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { PageEmpty, PageSplit, PageTips, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import { isInterviewMeetingCancelled, isOnlineInterviewMode, meetingScheduleSummary } from '@/lib/interview';
import type { ApplicationStatusResponse } from '@/types/auth';
import './dashboard.css';

function formatWhen(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
      description: 'Preparation complete, meeting is scheduled.',
    };
  }

  if (status.interview_available) {
    return {
      percent: 50,
      title: 'Interview in progress',
      description: 'Preparation complete, waiting for a meeting time.',
    };
  }

  return {
    percent: 50,
    title: 'Interview in progress',
    description: 'Preparation complete, waiting for interview unlock.',
  };
}

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

  return (
    <AppShell
      badge="Student"
      title="Interview">
      <div className="page-stack">
        <SectionProgress
          loading={statusQuery.isLoading}
          title={progress.title}
          percent={progress.percent}
        />

        <PageSplit
          main={
            <>
              <section className="panel">
                <h2>{preparation?.title ?? 'Preparation notes'}</h2>
                {statusQuery.isLoading ? <p className="muted">Loading…</p> : null}

                {prepLocked ? (
                  <PageEmpty
                    title="Preparation is locked"
                    actionLabel="View my status"
                    actionTo={StudentRoutes.status}
                  />
                ) : null}

                {!prepLocked && status ? (
                  <>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                      {preparation?.body?.trim()
                        ? preparation.body
                        : 'Staff have unlocked preparation. Review any notes here, then mark complete when you are ready for interview scheduling.'}
                    </p>

                    {preparation?.completed_at ? (
                      <p className="form-success">
                        Preparation marked complete
                        {formatWhen(preparation.completed_at)
                          ? `, ${formatWhen(preparation.completed_at)}`
                          : ''}
                        .
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={completePrep.isPending}
                        onClick={() => completePrep.mutate()}>
                        {completePrep.isPending ? 'Saving…' : 'Mark preparation complete'}
                      </button>
                    )}

                    {error ? <p className="form-error">{error}</p> : null}
                  </>
                ) : null}
              </section>

              <section className="panel">
                <h2>Interview meeting</h2>
                {!interviewLocked && interview?.meeting_ended_at && !interview.at ? (
                  <p className="muted" style={{ marginTop: 0 }}>
                    Previous session finished
                    {interview.meeting_ended_at
                      ? ` on ${formatWhen(interview.meeting_ended_at)}`
                      : ''}
                    . {meetingSummary.hint}.
                  </p>
                ) : null}

                {interviewLocked ? (
                  <p className="muted">
                    The meeting timer and video unlock after staff schedule your interview.
                  </p>
                ) : null}

                {!interviewLocked && interview ? (
                  <div className="stack-list">
                    <div className="stack-item">
                      <div>
                        <strong>Status</strong>
                        <span>{meetingSummary.value}</span>
                      </div>
                    </div>

                    {meetingCancelled ? (
                      <div className="panel" style={{ background: 'var(--panel-muted)' }}>
                        <span className="status-pill danger">Meeting cancelled</span>
                        <p className="muted" style={{ margin: '12px 0 0' }}>
                          Staff cancelled this meeting. You will be notified when a new session is
                          scheduled.
                        </p>
                      </div>
                    ) : null}

                    {interview.notes ? (
                      <div className="panel" style={{ background: 'var(--panel-muted)' }}>
                        <h3 style={{ marginTop: 0 }}>Notes from staff</h3>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{interview.notes}</p>
                      </div>
                    ) : null}

                    {showFollowupChoice ? (
                      <div className="panel interview-followup-card">
                        <h3 style={{ marginTop: 0 }}>Would you like another meeting?</h3>
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
                      <div className="panel" style={{ background: 'var(--panel-muted)' }}>
                        <span className="status-pill">Requested another meeting</span>
                        <p className="muted" style={{ margin: '12px 0 0' }}>
                          Staff can see your request and will schedule the next session.
                        </p>
                      </div>
                    ) : null}

                    {!interview.at &&
                    !meetingCancelled &&
                    interview.followup_preference === 'decline_another' ? (
                      <div className="panel" style={{ background: 'var(--panel-muted)' }}>
                        <span className="status-pill">No further meeting requested</span>
                        <p className="muted" style={{ margin: '12px 0 0' }}>
                          You told staff you don’t need another meeting right now.
                        </p>
                      </div>
                    ) : null}

                    {!interview.at &&
                    !meetingCancelled &&
                    !showFollowupChoice &&
                    !interview.followup_preference ? (
                      <p className="muted">
                        No meeting is scheduled right now. Staff will set the next session time.
                      </p>
                    ) : null}

                    <InterviewMeetingSection
                      enabled={Boolean(interview.at)}
                      interviewMode={interview.mode}
                      role="student"
                    />

                    {!online && interview.location ? (
                      <div className="stack-item">
                        <div>
                          <strong>In-person location</strong>
                          <span>{interview.location}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <p className="muted">
                <Link to={StudentRoutes.status}>← Back to my status</Link>
              </p>
            </>
          }
          side={
            <PageTips
              title="How this works"
              items={[
                'Read preparation notes and mark complete when you are ready.',
                'When staff schedule a meeting, the timer and video appear below.',
                'After a meeting ends, choose whether you want another session.',
              ]}
            />
          }
        />
      </div>
    </AppShell>
  );
}
