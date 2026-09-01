import { useQuery } from '@tanstack/react-query';

import { InterviewMeetingTimer } from '@/components/interview-meeting-timer';
import { InterviewVideoCall } from '@/components/interview-video-call';
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
    <div className="stack-list">
      <InterviewMeetingTimer role={role} status={callStatus} />

      {online && videoRoomQuery.data ? (
        <div className="panel interview-video-card">
          <h3 style={{ marginTop: 0 }}>In-app video call</h3>
          <p className="muted">
            Join here for interview preparation. The alarm stops once both student and staff have started
            the call.
          </p>
          <InterviewVideoCall
            joinUrl={videoRoomQuery.data.join_url}
            onJoin={() => markJoined()}
            onLeave={() => endMeeting()}
            studentName={studentName ?? videoRoomQuery.data.student_name}
            title={role === 'staff' ? `Video, ${studentName ?? 'Student'}` : 'Interview prep video call'}
          />
        </div>
      ) : null}
    </div>
  );
}
