import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { InterviewMeetingTimer } from '@/components/interview-meeting-timer';
import { InterviewVideoCallLauncher } from '@/components/interview-video-call';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useInterviewCallSession } from '@/hooks/use-interview-call-session';
import { api } from '@/lib/api';
import { isOnlineInterviewMode } from '@/lib/interview';
import type { InterviewVideoRoom } from '@/types/auth';

type InterviewMeetingSectionProps = {
  role: 'student' | 'staff';
  studentId?: number | null;
  interviewMode?: string | null;
  enabled?: boolean;
  studentName?: string | null;
};

export function InterviewMeetingSection({
  role,
  studentId,
  interviewMode,
  enabled = true,
  studentName,
}: InterviewMeetingSectionProps) {
  const online = isOnlineInterviewMode(interviewMode);
  const { callStatus, markJoined, endMeeting } = useInterviewCallSession({ role, studentId, enabled });

  const videoRoomQuery = useQuery({
    queryKey:
      role === 'student'
        ? ['student-interview-video-room']
        : ['consultant-interview-video-room', studentId],
    enabled: enabled && online && (role === 'student' || Boolean(studentId)),
    queryFn: async () => {
      if (role === 'student') {
        const { data } = await api.get<{ data: InterviewVideoRoom }>('/student/interview/video-room');
        return data.data;
      }
      const { data } = await api.get<{ data: InterviewVideoRoom }>(
        `/consultant/applications/${studentId}/video-room`,
      );
      return data.data;
    },
  });

  if (!enabled) return null;

  return (
    <View style={styles.stack}>
      <InterviewMeetingTimer role={role} status={callStatus} />

      {online ? (
        <>
          <ThemedText type="smallBold">In-app video call</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Join here for interview preparation. The alarm stops once both student and staff have started
            the call.
          </ThemedText>
          {videoRoomQuery.isLoading ? (
            <ActivityIndicator color={Brand.primary} style={{ marginTop: Spacing.one }} />
          ) : null}
          {videoRoomQuery.data ? (
            <InterviewVideoCallLauncher
              joinUrl={videoRoomQuery.data.join_url}
              onJoin={() => markJoined()}
              onLeave={() => endMeeting()}
              studentName={studentName ?? videoRoomQuery.data.student_name}
              title={role === 'staff' ? `Video, ${studentName ?? 'Student'}` : 'Interview prep video call'}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
  },
});
