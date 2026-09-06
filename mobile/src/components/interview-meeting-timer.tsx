import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatTimerSeconds, timerHeadline, type InterviewCallStatus } from '@/lib/interview-call';

type InterviewMeetingTimerProps = {
  status: InterviewCallStatus | null | undefined;
  role: 'student' | 'staff';
};

export function InterviewMeetingTimer({ status, role }: InterviewMeetingTimerProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
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

  const palette = isDark
    ? {
        idleBg: theme.backgroundSelected,
        idleBorder: theme.border,
        alarmBg: theme.cardCoral,
        alarmBorder: '#7F1D1D',
        overdueBg: theme.cardGold,
        overdueBorder: '#854D0E',
        pillBg: theme.backgroundElement,
        pillJoinedBg: '#14532D',
        alarmCopy: '#FCA5A5',
        okCopy: '#86EFAC',
      }
    : {
        idleBg: '#F8FAFC',
        idleBorder: '#E2E8F0',
        alarmBg: '#FEF2F2',
        alarmBorder: '#FECACA',
        overdueBg: '#FFFBEB',
        overdueBorder: '#FDE68A',
        pillBg: '#E2E8F0',
        pillJoinedBg: '#DCFCE7',
        alarmCopy: theme.danger,
        okCopy: theme.success,
      };

  if (!status?.interview_at || secondsUntilStart === null) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: palette.idleBg, borderColor: palette.idleBorder },
        ]}>
        <ThemedText type="smallBold">Meeting timer</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Waiting for staff to set the interview time
        </ThemedText>
      </View>
    );
  }

  const overdue = secondsUntilStart <= 0;
  const alarmActive = overdue && !status.both_joined;
  const surfaceBg = alarmActive
    ? palette.alarmBg
    : overdue
      ? palette.overdueBg
      : palette.idleBg;
  const surfaceBorder = alarmActive
    ? palette.alarmBorder
    : overdue
      ? palette.overdueBorder
      : palette.idleBorder;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: surfaceBg, borderColor: surfaceBorder },
      ]}>
      <ThemedText type="smallBold">{timerHeadline(secondsUntilStart)}</ThemedText>
      <ThemedText style={styles.digits} type="title">
        {formatTimerSeconds(secondsUntilStart)}
      </ThemedText>

      <View style={styles.parties}>
        <View
          style={[
            styles.pill,
            { backgroundColor: palette.pillBg },
            status.student_joined && { backgroundColor: palette.pillJoinedBg },
          ]}>
          <ThemedText type="caption">
            Student {status.student_joined ? 'in call' : 'waiting'}
          </ThemedText>
        </View>
        <View
          style={[
            styles.pill,
            { backgroundColor: palette.pillBg },
            status.staff_joined && { backgroundColor: palette.pillJoinedBg },
          ]}>
          <ThemedText type="caption">Staff {status.staff_joined ? 'in call' : 'waiting'}</ThemedText>
        </View>
      </View>

      {alarmActive ? (
        <ThemedText style={[styles.alarmCopy, { color: palette.alarmCopy }]} type="small">
          Alarm is ringing until both {role === 'student' ? 'you and staff' : 'you and the student'} join
          the in-app video call.
        </ThemedText>
      ) : status.both_joined ? (
        <ThemedText style={[styles.okCopy, { color: palette.okCopy }]} type="small">
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
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  alarmCopy: {
    fontWeight: '600',
  },
  okCopy: {
    fontWeight: '600',
  },
});
