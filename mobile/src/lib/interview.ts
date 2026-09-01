export type InterviewVideoRoom = {
  room_name: string;
  join_url: string;
  display_name: string;
  provider: 'jitsi';
  student_name: string | null;
};

export function formatInterviewWhen(value: string | null): string {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isOnlineInterviewMode(mode: string | null | undefined): boolean {
  if (!mode) return true;
  if (/in[- ]?person|on[- ]?site|office|embassy/i.test(mode)) return false;
  return /online|video|virtual|remote|prep|call/i.test(mode) || mode.trim().length === 0;
}

export function isInterviewMeetingCancelled(
  interview: { status?: string | null; at?: string | null } | null | undefined,
): boolean {
  return interview?.status === 'cancelled' && !interview.at;
}

type MeetingScheduleInterview = {
  status?: string | null;
  at?: string | null;
  mode?: string | null;
  unlocked_at?: string | null;
  meeting_ended_at?: string | null;
  followup_preference?: 'want_another' | 'decline_another' | null;
};

export function meetingScheduleSummary(
  interview: MeetingScheduleInterview | null | undefined,
  options?: { interviewAvailable?: boolean },
): { value: string; hint: string } {
  const available = Boolean(options?.interviewAvailable ?? interview?.unlocked_at);

  if (!available) {
    return { value: 'Locked', hint: 'Opens after staff unlock interview' };
  }

  if (isInterviewMeetingCancelled(interview)) {
    return { value: 'Cancelled', hint: 'Waiting for a new schedule from staff' };
  }

  if (interview?.at) {
    const at = new Date(interview.at);
    const started = !Number.isNaN(at.getTime()) && at.getTime() <= Date.now();
    return {
      value: formatInterviewWhen(interview.at),
      hint: started ? 'Meeting time reached, join below' : 'Scheduled session',
    };
  }

  if (interview?.meeting_ended_at) {
    if (interview.followup_preference === 'want_another') {
      return {
        value: 'Awaiting next schedule',
        hint: 'You requested another meeting, staff will set a time',
      };
    }
    if (interview.followup_preference === 'decline_another') {
      return {
        value: 'Completed',
        hint: 'No further meeting requested',
      };
    }
    return {
      value: 'Session completed',
      hint: 'Choose whether you want another meeting',
    };
  }

  if (
    interview?.status === 'completed' ||
    interview?.status === 'passed' ||
    interview?.status === 'failed'
  ) {
    const label =
      interview.status === 'passed'
        ? 'Passed'
        : interview.status === 'failed'
          ? 'Failed'
          : 'Completed';
    return {
      value: label,
      hint: 'Interview stage finished',
    };
  }

  return {
    value: 'Awaiting schedule',
    hint: 'Staff will confirm your meeting time',
  };
}

export function interviewCountdownLabel(at: string | null): string | null {
  if (!at) return null;
  const target = new Date(at);
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return 'Starting now';

  const totalMinutes = Math.round(diffMs / 60_000);
  if (totalMinutes < 60) return `Starts in ${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }

  return minutes > 0 ? `Starts in ${hours}h ${minutes}m` : `Starts in ${hours}h`;
}

export const INTERVIEW_ALARM_TYPES = new Set([
  'interview_scheduled',
  'interview_reminder',
  'interview_reminder_urgent',
  'interview_starting',
]);
