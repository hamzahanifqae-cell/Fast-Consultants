import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { formatTimerSeconds, timerHeadline, type InterviewCallStatus } from '@/lib/interview-call';

type InterviewMeetingTimerProps = {
  status: InterviewCallStatus | null | undefined;
  role: 'student' | 'staff';
};

export function InterviewMeetingTimer({ status, role }: InterviewMeetingTimerProps) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsUntilStart = useMemo(() => {
    if (!status?.interview_at) return null;
    const target = new Date(status.interview_at).getTime();
    if (Number.isNaN(target)) return null;
    return Math.round((target - nowMs) / 1000);
  }, [nowMs, status?.interview_at]);

  if (!status?.interview_at || secondsUntilStart === null) {
    return (
      <View style={styles.container}>
        <ThemedText type="smallBold">Meeting timer</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Waiting for staff to set the interview time
        </ThemedText>
      </View>
    );
  }

  const overdue = secondsUntilStart <= 0;
  const alarmActive = overdue && !status.both_joined;

  return (
    <View style={[styles.container, alarmActive && styles.alarm, overdue && !alarmActive && styles.overdue]}>
      <ThemedText type="smallBold">{timerHeadline(secondsUntilStart)}</ThemedText>
      <ThemedText style={styles.digits} type="title">
        {formatTimerSeconds(secondsUntilStart)}
      </ThemedText>

      <View style={styles.parties}>
        <View style={[styles.pill, status.student_joined && styles.pillJoined]}>
          <ThemedText type="caption">
            Student {status.student_joined ? 'in call' : 'waiting'}
          </ThemedText>
        </View>
        <View style={[styles.pill, status.staff_joined && styles.pillJoined]}>
          <ThemedText type="caption">Staff {status.staff_joined ? 'in call' : 'waiting'}</ThemedText>
        </View>
      </View>

      {alarmActive ? (
        <ThemedText style={styles.alarmCopy} type="small">
          Alarm is ringing until both {role === 'student' ? 'you and staff' : 'you and the student'} join
          the in-app video call.
        </ThemedText>
      ) : status.both_joined ? (
        <ThemedText style={styles.okCopy} type="small">
          Both parties joined, alarm stopped.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  alarm: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  overdue: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  digits: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  parties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  pill: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  pillJoined: {
    backgroundColor: '#DCFCE7',
  },
  alarmCopy: {
    color: Brand.danger,
  },
  okCopy: {
    color: Brand.success,
  },
});
