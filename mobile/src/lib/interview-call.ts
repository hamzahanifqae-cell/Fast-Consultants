export type InterviewCallStatus = {
  interview_at: string | null;
  student_joined: boolean;
  staff_joined: boolean;
  both_joined: boolean;
  alarm_active: boolean;
  seconds_until_start: number | null;
};

export function formatTimerSeconds(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  const parts = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0'));
  return parts.join(':');
}

export function timerHeadline(secondsUntilStart: number | null): string {
  if (secondsUntilStart === null) return 'Meeting time not set';
  if (secondsUntilStart > 0) return 'Meeting starts in';
  if (secondsUntilStart === 0) return 'Meeting starts now';
  return 'Meeting overdue, join call to stop alarm';
}
