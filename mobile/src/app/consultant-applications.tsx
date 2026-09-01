import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useMemo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { InterviewMeetingSection } from '@/components/interview-meeting-section';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ApplicationStatusResponse, StudentApplication } from '@/types/auth';
import { isOrganizationUser } from '@/lib/roles';

export default function ConsultantApplicationsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [prepTitle, setPrepTitle] = useState('');
  const [prepBody, setPrepBody] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewMode, setInterviewMode] = useState('Online');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ['consultant-applications'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentApplication[] }>('/consultant/applications');
      return data.data;
    },
  });

  const selected = useMemo(
    () => applicationsQuery.data?.find((item) => item.student?.id === selectedId) ?? null,
    [applicationsQuery.data, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setInterviewAt(
      selected.interview.at
        ? new Date(selected.interview.at).toISOString().slice(0, 16).replace('T', ' ')
        : '',
    );
  }, [selected?.id, selected?.interview.at]);

  const updateApplication = useMutation({
    mutationFn: async () => {
      if (!selectedId) {
        throw new Error('Select a student first.');
      }

      const payload: Record<string, unknown> = {
        preparation_title: prepTitle.trim() || undefined,
        preparation_body: prepBody.trim() || undefined,
        unlock_interview: true,
        interview_mode: interviewMode.trim() || null,
        interview_location: interviewLocation.trim() || null,
        interview_notes: interviewNotes.trim() || null,
      };

      if (interviewAt.trim()) {
        payload.interview_at = new Date(interviewAt.trim()).toISOString();
      }

      const { data } = await api.put<{ data: ApplicationStatusResponse }>(
        `/consultant/applications/${selectedId}`,
        payload,
      );
      return data.data;
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-applications'] });
      if (selectedId) {
        await queryClient.invalidateQueries({
          queryKey: ['consultant-interview-video-room', selectedId],
        });
      }
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not update student application.'));
    },
  });

  const cancelMeeting = useMutation({
    mutationFn: async () => {
      if (!selectedId) {
        throw new Error('Select a student first.');
      }
      await api.post(`/consultant/applications/${selectedId}/cancel-meeting`);
    },
    onSuccess: async () => {
      setError(null);
      setInterviewAt('');
      await queryClient.invalidateQueries({ queryKey: ['consultant-applications'] });
      if (selectedId) {
        await queryClient.invalidateQueries({
          queryKey: ['consultant-interview-video-room', selectedId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['interview-call-status', 'staff', selectedId],
        });
      }
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not cancel the meeting.'));
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  function selectStudent(application: StudentApplication) {
    const studentId = application.student?.id;
    if (!studentId) {
      return;
    }

    setSelectedId(studentId);
    setPrepTitle(application.preparation?.title ?? 'Interview preparation');
    setPrepBody(application.preparation?.body ?? '');
    setInterviewAt(
      application.interview?.at
        ? new Date(application.interview.at).toISOString().slice(0, 16).replace('T', ' ')
        : '',
    );
    setInterviewMode(application.interview?.mode ?? 'Online');
    setInterviewLocation(application.interview?.location ?? '');
    setInterviewNotes(application.interview?.notes ?? '');
    setError(null);
  }

  return (
    <StudentScreen
      showBack
      title="Student progress">
          {applicationsQuery.isLoading ? <ActivityIndicator /> : null}

          {applicationsQuery.data?.map((application) => (
            <Pressable key={application.id} onPress={() => selectStudent(application)}>
              <ThemedView
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      selectedId === application.student?.id
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                  },
                ]}>
                <ThemedText type="smallBold">{application.student?.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Status: {application.stage_label}
                  {application.everything_accepted ? ', Ready for preparation' : ''}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}

          {selected ? (
            <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="subtitle">Update {selected.student?.name}</ThemedText>

              {!selected.everything_accepted ? (
                <ThemedText type="small" style={styles.warn}>
                  Documents and charge slips are not all accepted yet.
                </ThemedText>
              ) : null}

              <TextInput
                onChangeText={setPrepTitle}
                placeholder="Preparation title"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={prepTitle}
              />
              <TextInput
                multiline
                onChangeText={setPrepBody}
                placeholder="Preparation guidance for the student"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
                value={prepBody}
              />

              <ThemedText type="smallBold">Interview</ThemedText>
              <TextInput
                onChangeText={setInterviewAt}
                placeholder="Interview time e.g. 2026-08-25 15:00"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={interviewAt}
              />
              <TextInput
                onChangeText={setInterviewMode}
                placeholder="Mode e.g. Online / In person"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={interviewMode}
              />
              <TextInput
                onChangeText={setInterviewLocation}
                placeholder="In-person address (optional)"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                value={interviewLocation}
              />
              <TextInput
                multiline
                onChangeText={setInterviewNotes}
                placeholder="Interview notes"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
                value={interviewNotes}
              />

              {error ? (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                disabled={!selected.everything_accepted || updateApplication.isPending}
                onPress={() => updateApplication.mutate()}
                style={[
                  styles.button,
                  {
                    opacity:
                      !selected.everything_accepted || updateApplication.isPending ? 0.6 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {updateApplication.isPending
                    ? 'Saving…'
                    : 'Save preparation & unlock interview'}
                </ThemedText>
              </Pressable>

              {selected.interview.unlocked_at && selected.interview.at ? (
                <>
                  <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
                    Live meeting timer & video
                  </ThemedText>
                  <InterviewMeetingSection
                    enabled
                    interviewMode={selected.interview.mode ?? interviewMode}
                    role="staff"
                    studentId={selectedId}
                    studentName={selected.student?.name}
                  />
                  <Pressable
                    disabled={cancelMeeting.isPending}
                    onPress={() => cancelMeeting.mutate()}
                    style={[styles.cancelButton, { opacity: cancelMeeting.isPending ? 0.6 : 1 }]}>
                    <ThemedText type="smallBold" style={styles.cancelButtonText}>
                      {cancelMeeting.isPending ? 'Cancelling…' : 'Cancel meeting'}
                    </ThemedText>
                  </Pressable>
                </>
              ) : selected.interview.unlocked_at ? (
                <View style={{ marginTop: Spacing.two, gap: Spacing.two }}>
                  {selected.interview.followup_preference === 'want_another' ? (
                    <View style={styles.followupBanner}>
                      <ThemedText type="smallBold">Student wants another meeting</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {selected.student?.name ?? 'This student'} asked for another interview
                        session. Schedule a new time above.
                      </ThemedText>
                    </View>
                  ) : null}
                  {selected.interview.followup_preference === 'decline_another' ? (
                    <View style={styles.followupBanner}>
                      <ThemedText type="smallBold">Student declined another meeting</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {selected.student?.name ?? 'This student'} said they do not need another
                        meeting right now.
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    No active meeting. Schedule a new interview time above for the next session.
                  </ThemedText>
                </View>
              ) : null}
            </ThemedView>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Select a student to manage preparation and interview.
            </ThemedText>
          )}
        </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderRadius: 24,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonText: { color: '#ffffff' },
  cancelButton: {
    borderColor: '#D92D20',
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: { color: '#D92D20' },
  followupBanner: {
    borderRadius: 18,
    padding: Spacing.three,
    backgroundColor: '#F2F4F7',
    gap: Spacing.one,
  },
  error: { color: '#D92D20' },
  warn: { color: '#B54708' },
});
