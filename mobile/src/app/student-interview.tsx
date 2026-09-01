import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isInterviewMeetingCancelled, isOnlineInterviewMode, meetingScheduleSummary } from '@/lib/interview';
import { syncInterviewLocalReminders } from '@/lib/interview-reminders';
import { useAuthStore } from '@/stores/auth-store';
import type { ApplicationStatusResponse } from '@/types/auth';

export default function StudentInterviewScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;
  const [error, setError] = useState<string | null>(null);

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
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not mark preparation complete.'));
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
  const preparation = status?.application.preparation;
  const interview = status?.application.interview;
  const online = isOnlineInterviewMode(interview?.mode);
  const meetingCancelled = isInterviewMeetingCancelled(interview);
  const prepLocked = Boolean(status && !status.preparation_available);
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
    <StudentScreen
      showBack
      title="Interview">
      {statusQuery.isLoading ? <ActivityIndicator color={Brand.primary} /> : null}

      {status ? (
        <StudentSurface style={styles.stack}>
          <ThemedText type="section" themeColor="textSecondary">
            Preparation notes
          </ThemedText>

          {prepLocked ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Preparation unlocks after your documents and charge slips are accepted.
              </ThemedText>
              <Pressable onPress={() => router.push('/student-status')} style={styles.button}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  View my status
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle">
                {preparation?.title ?? 'Interview preparation'}
              </ThemedText>
              <ThemedText type="small">
                {preparation?.body?.trim()
                  ? preparation.body
                  : 'Staff have unlocked preparation. Review any notes here, then mark complete when you are ready.'}
              </ThemedText>

              {preparation?.completed_at ? (
                <ThemedText type="small" style={styles.success}>
                  Preparation marked complete.
                </ThemedText>
              ) : (
                <Pressable
                  disabled={completePrep.isPending}
                  onPress={() => completePrep.mutate()}
                  style={[styles.button, { opacity: completePrep.isPending ? 0.6 : 1 }]}>
                  <ThemedText type="smallBold" style={styles.buttonText}>
                    {completePrep.isPending ? 'Saving…' : 'Mark preparation complete'}
                  </ThemedText>
                </Pressable>
              )}

              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
            </>
          )}

          <ThemedText type="section" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
            Interview meeting
          </ThemedText>

          {interviewLocked ? (
            <ThemedText type="small" themeColor="textSecondary">
              The meeting timer and video unlock after staff schedule your interview.
            </ThemedText>
          ) : interview ? (
            <>
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
                </>
              ) : null}

              {interview.notes ? (
                <>
                  <ThemedText type="smallBold">Notes</ThemedText>
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
                  <Pressable
                    disabled={followupPreference.isPending}
                    onPress={() => followupPreference.mutate('want_another')}
                    style={[styles.button, { opacity: followupPreference.isPending ? 0.6 : 1 }]}>
                    <ThemedText type="smallBold" style={styles.buttonText}>
                      {followupPreference.isPending ? 'Saving…' : 'Yes, schedule another meeting'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={followupPreference.isPending}
                    onPress={() => followupPreference.mutate('decline_another')}
                    style={[
                      styles.secondaryButton,
                      { opacity: followupPreference.isPending ? 0.6 : 1 },
                    ]}>
                    <ThemedText type="smallBold">No, I don’t need another meeting</ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {!interview.at &&
              !meetingCancelled &&
              interview.followup_preference === 'want_another' ? (
                <View style={styles.followupCard}>
                  <ThemedText type="smallBold">Requested another meeting</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Staff can see your request and will schedule the next session.
                  </ThemedText>
                </View>
              ) : null}

              {!interview.at &&
              !meetingCancelled &&
              interview.followup_preference === 'decline_another' ? (
                <View style={styles.followupCard}>
                  <ThemedText type="smallBold">No further meeting requested</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    You told staff you don’t need another meeting right now.
                  </ThemedText>
                </View>
              ) : null}

              {interview.at ? (
                <InterviewMeetingSection
                  enabled
                  interviewMode={interview.mode}
                  role="student"
                />
              ) : !meetingCancelled && !showFollowupChoice && !interview.followup_preference ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No meeting is scheduled right now. Staff will set the next session time.
                </ThemedText>
              ) : null}

              {!online && interview.location ? (
                <>
                  <ThemedText type="smallBold">In-person location</ThemedText>
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
  button: {
    backgroundColor: Brand.primary,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: { color: '#fff' },
  secondaryButton: {
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#fff',
  },
  success: { color: Brand.success },
  error: { color: '#D92D20' },
  linkWrap: { marginTop: Spacing.two },
  link: { color: Brand.primary },
});
