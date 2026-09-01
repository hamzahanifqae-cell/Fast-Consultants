import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { StudentSummary, VisaAppointment } from '@/types/auth';

export default function ConsultantVisaAppointmentsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [studentId, setStudentId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [embassy, setEmbassy] = useState('');
  const [mode, setMode] = useState('In person');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ['consultant-visa-appointments'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/consultant/visa-appointments');
      return data.data;
    },
  });

  const selectedStudent = useMemo(
    () => studentsQuery.data?.find((student) => student.id === studentId) ?? null,
    [studentsQuery.data, studentId],
  );

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!studentId || !scheduledAt.trim()) {
        throw new Error('Select a student and appointment time.');
      }
      await api.post('/consultant/visa-appointments', {
        student_id: studentId,
        scheduled_at: new Date(scheduledAt.trim()).toISOString(),
        embassy: embassy.trim() || null,
        mode: mode.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      });
    },
    onSuccess: async () => {
      setStudentId(null);
      setScheduledAt('');
      setEmbassy('');
      setLocation('');
      setNotes('');
      setError(null);
            await queryClient.invalidateQueries({ queryKey: ['consultant-visa-appointments'] });
    },
    onError: (err) => {
            setError(getApiErrorMessage(err, 'Could not schedule appointment.'));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await api.put(`/consultant/visa-appointments/${id}`, { status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['consultant-visa-appointments'] });
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  return (
    <StudentScreen
      showBack
      title="Visa appointments">
      {appointmentsQuery.isLoading ? <ActivityIndicator /> : null}

      {(appointmentsQuery.data ?? []).map((appointment) => (
        <ThemedView
          key={appointment.id}
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{appointment.student?.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {appointment.scheduled_at
              ? new Date(appointment.scheduled_at).toLocaleString()
              : 'No time'}
            {appointment.embassy ? `, ${appointment.embassy}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {appointment.status_label}
          </ThemedText>
          {appointment.status === 'scheduled' ? (
            <View style={styles.row}>
              <Pressable
                onPress={() => updateStatus.mutate({ id: appointment.id, status: 'completed' })}
                style={[styles.button, { backgroundColor: theme.successMuted }]}>
                <ThemedText type="smallBold">Complete</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => updateStatus.mutate({ id: appointment.id, status: 'cancelled' })}
                style={[styles.button, { backgroundColor: theme.dangerMuted }]}>
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
            </View>
          ) : null}
        </ThemedView>
      ))}

      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="subtitle">Schedule appointment</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Student: {selectedStudent?.name ?? 'Tap a student below'}
        </ThemedText>
        <View style={styles.rowWrap}>
          {(studentsQuery.data ?? []).map((student) => (
            <Pressable
              key={student.id}
              onPress={() => setStudentId(student.id)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    studentId === student.id ? theme.successMuted : theme.inputFill,
                },
              ]}>
              <ThemedText type="smallBold">{student.name}</ThemedText>
            </Pressable>
          ))}
        </View>
        <TextInput
          onChangeText={setScheduledAt}
          placeholder="Time e.g. 2026-08-28 10:00"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          value={scheduledAt}
        />
        <TextInput
          onChangeText={setEmbassy}
          placeholder="Embassy"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          value={embassy}
        />
        <TextInput
          onChangeText={setMode}
          placeholder="Mode"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          value={mode}
        />
        <TextInput
          onChangeText={setLocation}
          placeholder="Location"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          value={location}
        />
        <TextInput
          onChangeText={setNotes}
          placeholder="Notes"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
          value={notes}
        />
        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
        <Pressable
          disabled={createAppointment.isPending}
          onPress={() => createAppointment.mutate()}
          style={[styles.submit, { backgroundColor: theme.inverted }]}>
          <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
            {createAppointment.isPending ? 'Saving…' : 'Schedule'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submit: {
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 14,
  },
  error: { color: '#E24B4B' },
  success: { color: '#2F9E6B' },
});
