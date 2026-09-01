import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  startContinuousInterviewAlarm,
  stopContinuousInterviewAlarm,
} from '@/lib/interview-call-alarm';
import type { InterviewCallStatus } from '@/lib/interview-call';
import { api } from '@/lib/api';

type Role = 'student' | 'staff';

type Options = {
  role: Role;
  studentId?: number | null;
  enabled?: boolean;
};

export function useInterviewCallSession({ role, studentId, enabled = true }: Options) {
  const queryClient = useQueryClient();
  const queryKey =
    role === 'student'
      ? ['interview-call-status', 'student']
      : ['interview-call-status', 'staff', studentId];

  const statusQuery = useQuery({
    queryKey,
    enabled: enabled && (role === 'student' || Boolean(studentId)),
    refetchInterval: 3000,
    queryFn: async () => {
      if (role === 'student') {
        const { data } = await api.get<{ data: InterviewCallStatus }>('/student/interview/call-status');
        return data.data;
      }
      const { data } = await api.get<{ data: InterviewCallStatus }>(
        `/consultant/applications/${studentId}/call-status`,
      );
      return data.data;
    },
  });

  useEffect(() => {
    const status = statusQuery.data;
    const secondsUntilStart = status?.seconds_until_start;
    const shouldAlarm =
      Boolean(status?.alarm_active) &&
      secondsUntilStart !== null &&
      secondsUntilStart !== undefined &&
      secondsUntilStart <= 0;

    if (shouldAlarm) {
      startContinuousInterviewAlarm();
      return () => stopContinuousInterviewAlarm();
    }
    stopContinuousInterviewAlarm();
    return undefined;
  }, [statusQuery.data]);

  async function markJoined(): Promise<void> {
    if (role === 'student') {
      await api.post('/student/interview/call/join');
    } else if (studentId) {
      await api.post(`/consultant/applications/${studentId}/call/join`);
    }
    await queryClient.invalidateQueries({ queryKey });
  }

  async function endMeeting(): Promise<void> {
    if (role === 'student') {
      await api.post('/student/interview/call/leave');
    } else if (studentId) {
      await api.post(`/consultant/applications/${studentId}/call/leave`);
    }
    stopContinuousInterviewAlarm();
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ['student-application-status'] });
    await queryClient.invalidateQueries({ queryKey: ['student-interview-video-room'] });
    if (studentId) {
      await queryClient.invalidateQueries({ queryKey: ['consultant-interview-video-room', studentId] });
    }
    await queryClient.invalidateQueries({ queryKey: ['consultant-applications'] });
  }

  return {
    callStatus: statusQuery.data,
    callStatusQuery: statusQuery,
    markJoined,
    endMeeting,
  };
}
