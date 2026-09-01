import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Redirect, router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BrandProgressBar } from '@/components/student/brand-progress-bar';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import {
  buildStatusJourneySteps,
  isProfileComplete,
  overallStatusSummary,
  statusJourneyStateLabel,
  type StatusJourneyState,
  type StatusJourneyStep,
} from '@/lib/student-journey-progress';
import { useAuthStore } from '@/stores/auth-store';
import type { ApplicationStatusResponse, StudentProfile, VisaAppointment } from '@/types/auth';

function formatWhen(value: string | null) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function badgeColors(state: StatusJourneyState) {
  if (state === 'complete') {
    return { background: Brand.successMuted, text: Brand.success };
  }
  if (state === 'current') {
    return { background: Brand.primarySoft, text: Brand.primary };
  }
  return { background: '#EEEFF4', text: '#5F5F5F' };
}

function dotColor(state: StatusJourneyState) {
  if (state === 'complete') return Brand.success;
  if (state === 'current') return Brand.primary;
  return '#D1D5DB';
}

function JourneyStepRow({
  step,
  isLast,
}: {
  step: StatusJourneyStep;
  isLast: boolean;
}) {
  const theme = useTheme();
  const badge = badgeColors(step.state);

  return (
    <View style={styles.journeyRow}>
      <View style={styles.journeyRail}>
        <View
          style={[
            styles.journeyDot,
            {
              backgroundColor: step.state === 'locked' ? theme.background : dotColor(step.state),
              borderColor: step.state === 'locked' ? '#D1D5DB' : dotColor(step.state),
              borderWidth: step.state === 'locked' ? 2 : 0,
            },
          ]}
        />
        {!isLast ? <View style={styles.journeyLine} /> : null}
      </View>

      <View style={[styles.journeyBody, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.journeyHead}>
          <View style={styles.journeyCopy}>
            <ThemedText type="smallBold">{step.label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {step.detail}
            </ThemedText>
          </View>
          <View style={[styles.journeyBadge, { backgroundColor: badge.background }]}>
            <ThemedText type="caption" style={[styles.journeyBadgeText, { color: badge.text }]}>
              {statusJourneyStateLabel(step.state)}
            </ThemedText>
          </View>
        </View>

        {step.href && step.actionLabel && step.state !== 'locked' ? (
          <Pressable
            onPress={() => router.push(step.href as Href)}
            style={[styles.stepAction, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="caption" style={styles.stepActionText}>
              {step.actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function StatusProgressCard({
  title,
  description,
  percent,
  loading,
}: {
  title: string;
  description: string;
  percent: number;
  loading: boolean;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const complete = !loading && clamped >= 100;

  return (
    <View style={[styles.progressCard, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.progressTop}>
        <View style={styles.progressCopy}>
          <ThemedText type="smallBold">{loading ? 'Loading your application' : title}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {loading ? 'Fetching your latest checklist and stage details.' : description}
          </ThemedText>
        </View>
        <ThemedText
          type="smallBold"
          style={{ color: complete ? Brand.success : theme.text, fontVariant: ['tabular-nums'] }}>
          {loading ? '…' : `${clamped}%`}
        </ThemedText>
      </View>
      <BrandProgressBar
        complete={complete}
        height={8}
        percent={loading ? 0 : clamped}
        trackColor={theme.backgroundSelected}
      />
    </View>
  );
}

export default function StudentStatusScreen() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;
  const theme = useTheme();

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
  });

  const profileQuery = useQuery({
    queryKey: ['student-profile'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      return data.data;
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  const status = statusQuery.data;
  const profile = profileQuery.data;
  const appointments = appointmentsQuery.data ?? [];
  const loading =
    statusQuery.isLoading || profileQuery.isLoading || appointmentsQuery.isLoading;
  const progress = overallStatusSummary(status, profile, appointments);
  const journeySteps = useMemo(
    () => buildStatusJourneySteps(status, profile, appointments),
    [status, profile, appointments],
  );
  const currentStage =
    status && !isProfileComplete(profile) ? 'Student info' : status?.current_status;

  return (
    <StudentScreen showBack title="My status">
      {loading && !status ? <ActivityIndicator color={Brand.primary} /> : null}

      <StatusProgressCard
        description={progress.description}
        loading={loading}
        percent={progress.percent}
        title={progress.title}
      />

      {currentStage ? (
        <View style={[styles.currentStage, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.currentStageLabel}>
            CURRENT STAGE
          </ThemedText>
          <ThemedText type="subtitle">{currentStage}</ThemedText>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">Application journey</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Track each milestone from student info through visa.
        </ThemedText>
      </View>

      {journeySteps.length ? (
        <View style={styles.journeyList}>
          {journeySteps.map((step, index) => (
            <JourneyStepRow
              key={step.id}
              isLast={index === journeySteps.length - 1}
              step={step}
            />
          ))}
        </View>
      ) : loading ? (
        <ActivityIndicator color={Brand.primary} />
      ) : null}

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <ThemedText type="smallBold">Visa appointments</ThemedText>
          <Pressable onPress={() => router.push('/student-visa-appointments')}>
            <ThemedText type="caption" style={{ color: Brand.primary }}>
              View all
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Embassy visits scheduled by the visa team.
        </ThemedText>
      </View>

      {appointmentsQuery.isLoading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Loading appointments…
        </ThemedText>
      ) : appointments.length ? (
        <View style={styles.appointmentsList}>
          {appointments.map((item) => (
            <View
              key={item.id}
              style={[styles.appointmentRow, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.appointmentCopy}>
                <ThemedText type="smallBold">{formatWhen(item.scheduled_at)}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {[item.embassy, item.location, item.mode].filter(Boolean).join(' · ') ||
                    'Details to be confirmed'}
                </ThemedText>
              </View>
              <View style={[styles.appointmentPill, { backgroundColor: Brand.primarySoft }]}>
                <ThemedText type="caption" style={{ color: Brand.primary }}>
                  {item.status_label}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <StudentSurface>
          <View style={styles.emptyAppointments}>
            <ThemedText style={styles.emptyIcon}>🛂</ThemedText>
            <View style={styles.emptyCopy}>
              <ThemedText type="smallBold">No appointments yet</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Visa staff will add your embassy slot here after the interview stage.
              </ThemedText>
            </View>
          </View>
        </StudentSurface>
      )}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  progressCopy: {
    flex: 1,
    gap: 4,
  },
  currentStage: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  currentStageLabel: {
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  sectionHeader: {
    gap: 4,
    marginTop: Spacing.one,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  journeyList: {
    gap: Spacing.two,
  },
  journeyRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  journeyRail: {
    width: 16,
    alignItems: 'center',
  },
  journeyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 18,
  },
  journeyLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E8E8EA',
    marginTop: 4,
    minHeight: 24,
  },
  journeyBody: {
    flex: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  journeyHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  journeyCopy: {
    flex: 1,
    gap: 4,
  },
  journeyBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  journeyBadgeText: {
    fontWeight: '700',
  },
  stepAction: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stepActionText: {
    fontWeight: '700',
    color: Brand.primary,
  },
  appointmentsList: {
    gap: Spacing.two,
  },
  appointmentRow: {
    borderRadius: 20,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  appointmentCopy: {
    flex: 1,
    gap: 4,
  },
  appointmentPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emptyAppointments: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  emptyIcon: {
    fontSize: 28,
    lineHeight: 32,
  },
  emptyCopy: {
    flex: 1,
    gap: 4,
  },
});
