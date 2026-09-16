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

export type MeetingScheduleInterview = {
  status?: string | null;
  at?: string | null;
  mode?: string | null;
  unlocked_at?: string | null;
  meeting_ended_at?: string | null;
  followup_preference?: 'want_another' | 'decline_another' | null;
};

/** Interview stage is finished — not when cancelled or another meeting is pending. */
export function interviewStatusPillLabel(
  interview: MeetingScheduleInterview | null | undefined,
): string {
  if (isInterviewMeetingCancelled(interview)) return 'Cancelled';
  if (interview?.at) return 'Scheduled';
  if (isInterviewJourneyComplete(interview)) return 'Complete';
  if (interview?.followup_preference === 'want_another') return 'Another requested';
  if (interview?.meeting_ended_at) return 'Follow-up needed';
  return 'Waiting';
}

export function isInterviewJourneyComplete(
  interview: MeetingScheduleInterview | null | undefined,
): boolean {
  if (!interview) return false;
  if (isInterviewMeetingCancelled(interview)) return false;
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

export type InterviewSectionProgress = {
  percent: number;
  title: string;
  description: string;
  complete: boolean;
};

export function interviewSectionProgress(
  interviewAvailable: boolean,
  interview: MeetingScheduleInterview | null | undefined,
): InterviewSectionProgress {
  if (!interviewAvailable) {
    return {
      percent: 0,
      title: 'Interview locked',
      description: 'Opens after documents and charge slips are approved.',
      complete: false,
    };
  }

  if (isInterviewJourneyComplete(interview)) {
    return {
      percent: 100,
      title: 'Interview complete',
      description: 'Your interview stage is finished.',
      complete: true,
    };
  }

  if (isInterviewMeetingCancelled(interview)) {
    return {
      percent: 55,
      title: 'Meeting cancelled',
      description: 'Staff will schedule a new session.',
      complete: false,
    };
  }

  if (interview?.at) {
    return {
      percent: 85,
      title: 'Meeting scheduled',
      description: 'Join from this page when the timer opens.',
      complete: false,
    };
  }

  if (interview?.followup_preference === 'want_another') {
    return {
      percent: 68,
      title: 'Another meeting requested',
      description: 'Staff will schedule your next session.',
      complete: false,
    };
  }

  if (interview?.meeting_ended_at && !interview.followup_preference) {
    return {
      percent: 72,
      title: 'Session ended',
      description: 'Tell staff whether you want another meeting.',
      complete: false,
    };
  }

  return {
    percent: 40,
    title: 'Waiting for schedule',
    description: 'Interview staff will book your session time.',
    complete: false,
  };
}

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
