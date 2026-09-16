import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { AppButton } from '@/components/ui/app-button';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  interviewStatusPillLabel,
  isInterviewMeetingCancelled,
  isOnlineInterviewMode,
  meetingScheduleSummary,
} from '@/lib/interview';
import { syncInterviewLocalReminders } from '@/lib/interview-reminders';
import { useAuthStore } from '@/stores/auth-store';
import type { ApplicationStatusResponse } from '@/types/auth';

export default function StudentInterviewScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;

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
  const interview = status?.application.interview;
  const online = isOnlineInterviewMode(interview?.mode);
  const meetingCancelled = isInterviewMeetingCancelled(interview);
  const interviewLocked = Boolean(status && !status.interview_available);
  const showFollowupChoice =
    Boolean(interview?.unlocked_at) &&
    Boolean(interview?.meeting_ended_at) &&
    !interview?.at &&
    !meetingCancelled &&
    !interview?.followup_preference;
  const meetingSummary = meetingScheduleSummary(interview, {
    interviewAvailable: status?.interview_available,
  });

  useEffect(() => {
    if (!isStudent || !interview?.at) return;
    void syncInterviewLocalReminders(interview.at);
  }, [interview?.at, isStudent]);

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  return (
    <StudentScreen showBack title="Interview">
      {statusQuery.isLoading ? <ActivityIndicator color={Brand.primary} /> : null}

      {status ? (
        <StudentSurface style={styles.stack}>
          {interviewLocked ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Interview unlocks after your documents and charge slips are accepted.
              </ThemedText>
              <AppButton label="View my status" onPress={() => router.push('/student-status')} />
            </>
          ) : interview ? (
            <>
              <View style={styles.statusRow}>
                <ThemedText type="smallBold">{interviewStatusPillLabel(interview)}</ThemedText>
              </View>

              <ThemedText type="smallBold">Status</ThemedText>
              <ThemedText type="small">{meetingSummary.value}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {meetingSummary.hint}
              </ThemedText>

              {meetingCancelled ? (
                <View style={styles.cancelledBanner}>
                  <ThemedText type="smallBold" style={styles.cancelledTitle}>
                    Meeting cancelled
                  </ThemedText>
                  <ThemedText type="small" style={styles.cancelledCopy}>
                    Staff cancelled this meeting. You will be notified when a new session is
                    scheduled.
                  </ThemedText>
                </View>
              ) : null}

              {interview.mode ? (
                <>
                  <ThemedText type="smallBold">Mode</ThemedText>
                  <ThemedText type="small">{interview.mode}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {online ? 'Join from this page when the timer opens' : 'Attend in person'}
                  </ThemedText>
                </>
              ) : null}

              {interview.notes ? (
                <>
                  <ThemedText type="smallBold">Notes from staff</ThemedText>
                  <ThemedText type="small">{interview.notes}</ThemedText>
                </>
              ) : null}

              {showFollowupChoice ? (
                <View style={styles.followupCard}>
                  <ThemedText type="smallBold">Would you like another meeting?</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Your last meeting has ended. Tell staff if you want another session.
                  </ThemedText>
                  {followupPreference.isError ? (
                    <ThemedText type="small" style={styles.error}>
                      {getApiErrorMessage(followupPreference.error, 'Could not save your choice.')}
                    </ThemedText>
                  ) : null}
                  <AppButton
                    disabled={followupPreference.isPending}
                    label={
                      followupPreference.isPending
                        ? 'Saving…'
                        : 'Yes, schedule another meeting'
                    }
                    onPress={() => followupPreference.mutate('want_another')}
                  />
                  <AppButton
                    disabled={followupPreference.isPending}
                    label="No, I don’t need another meeting"
                    onPress={() => followupPreference.mutate('decline_another')}
                    variant="ghost"
                  />
                </View>
              ) : null}

              {!interview.at &&
              !meetingCancelled &&
              !showFollowupChoice &&
              !interview.followup_preference ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No meeting is scheduled yet. Staff will set your session time.
                </ThemedText>
              ) : null}

              {interview.at ? (
                <InterviewMeetingSection enabled interviewMode={interview.mode} role="student" />
              ) : null}

              {!online && interview.location ? (
                <>
                  <ThemedText type="smallBold">Location</ThemedText>
                  <ThemedText type="small">{interview.location}</ThemedText>
                </>
              ) : null}
            </>
          ) : null}

          <Pressable onPress={() => router.push('/student-status')} style={styles.linkWrap}>
            <ThemedText type="smallBold" style={styles.link}>
              ← Back to my status
            </ThemedText>
          </Pressable>
        </StudentSurface>
      ) : null}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.two },
  statusRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.primarySoft,
  },
  cancelledBanner: {
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: '#FEE4E2',
    gap: Spacing.one,
  },
  cancelledTitle: { color: '#B42318' },
  cancelledCopy: { color: '#912018' },
  followupCard: {
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: '#F2F4F7',
    gap: Spacing.two,
  },
  error: { color: '#D92D20' },
  linkWrap: { marginTop: Spacing.two },
  link: { color: Brand.primary },
});
