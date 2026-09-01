import { useEffect, useMemo, useState } from 'react';

import { formatTimerSeconds, timerHeadline, type InterviewCallStatus } from '@/lib/interview-call';
import './interview-meeting-timer.css';

type InterviewMeetingTimerProps = {
  status: InterviewCallStatus | null | undefined;
  role: 'student' | 'staff';
};

export function InterviewMeetingTimer({ status, role }: InterviewMeetingTimerProps) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsUntilStart = useMemo(() => {
    if (!status?.interview_at) return null;
    const target = new Date(status.interview_at).getTime();
    if (Number.isNaN(target)) return null;
    return Math.round((target - nowMs) / 1000);
  }, [nowMs, status?.interview_at]);

  if (!status?.interview_at || secondsUntilStart === null) {
    return (
      <div className="interview-meeting-timer muted">
        <span>Meeting timer</span>
        <strong>Waiting for staff to set the interview time</strong>
      </div>
    );
  }

  const overdue = secondsUntilStart <= 0;
  const alarmActive = overdue && !status.both_joined;

  return (
    <div className={`interview-meeting-timer${alarmActive ? ' alarm' : overdue ? ' overdue' : ''}`}>
      <div className="interview-meeting-timer-head">
        <span>{timerHeadline(secondsUntilStart)}</span>
        <strong className="interview-meeting-timer-digits">{formatTimerSeconds(secondsUntilStart)}</strong>
      </div>
      <div className="interview-meeting-timer-parties">
        <span className={`party-pill${status.student_joined ? ' joined' : ''}`}>
          Student {status.student_joined ? 'in call' : 'waiting'}
        </span>
        <span className={`party-pill${status.staff_joined ? ' joined' : ''}`}>
          Staff {status.staff_joined ? 'in call' : 'waiting'}
        </span>
      </div>
      {alarmActive ? (
        <p className="interview-meeting-alarm-copy">
          Alarm is ringing until both {role === 'student' ? 'you and staff' : 'you and the student'} join the
          in-app video call.
        </p>
      ) : status.both_joined ? (
        <p className="interview-meeting-alarm-copy ok">Both parties joined, alarm stopped.</p>
      ) : null}
    </div>
  );
}
