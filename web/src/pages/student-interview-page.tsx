import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { PageEmpty, PageSection, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import {
  formatInterviewWhen,
  interviewSectionProgress as buildInterviewProgress,
  interviewStatusPillLabel,
  isInterviewJourneyComplete,
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

export function StudentInterviewPage() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
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
  const interview = status?.application?.interview;
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
  const progress = status
    ? buildInterviewProgress(status.interview_available, interview)
    : {
        percent: 0,
        title: 'Interview',
        description: 'Loading your interview progress.',
        complete: false,
      };

  return (
    <AppShell badge="Student" title="Interview">
      <div className="page-stack interview-page">
        <SectionProgress
          loading={statusQuery.isLoading}
          title={progress.title}
          description={progress.description}
          percent={progress.percent}
        />

        <PageSection
          title="Your interview"
          subtitle="After fees are cleared, staff schedule your session here. Join online when the timer opens.">
          <section className="panel interview-panel interview-panel-single">
            {statusQuery.isLoading ? <p className="muted">Loading…</p> : null}

            {interviewLocked ? (
              <PageEmpty
                title="Interview is locked"
                body="Your documents and charge slips need to be accepted before the interview stage opens."
                actionLabel="View my status"
                actionTo={StudentRoutes.status}
              />
            ) : null}

            {!interviewLocked && interview ? (
              <div className="interview-meeting-body">
                <div className="interview-status-row">
                  <span
                    className={`status-pill${
                      meetingCancelled
                        ? ' danger'
                        : interview.at
                          ? ' warn'
                          : isInterviewJourneyComplete(interview)
                            ? ' success'
                            : ''
                    }`}>
                    {interviewStatusPillLabel(interview)}
                  </span>
                  {interview.at ? (
                    <strong className="interview-status-when">{formatInterviewWhen(interview.at)}</strong>
                  ) : null}
                </div>

                {interview.meeting_ended_at && !interview.at ? (
                  <p className="interview-lead">
                    Previous session finished
                    {interview.meeting_ended_at
                      ? ` on ${formatWhen(interview.meeting_ended_at)}`
                      : ''}
                    . {meetingSummary.hint}.
                  </p>
                ) : null}

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
                      <em>
                        {online ? 'Join from this page when the timer opens' : 'Attend in person'}
                      </em>
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
                    <strong>Meeting cancelled</strong>
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
                      <p>Staff will set your session time. The timer and join button appear here when it is booked.</p>
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
