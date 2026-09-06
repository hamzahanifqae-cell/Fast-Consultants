import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { handoffLockMessage, useStudentHandoff } from '@/hooks/use-student-handoff';
import { api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { StudentSummary, University } from '@/types/auth';

export default function ConsultantUniversitiesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [assignId, setAssignId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const studentId = selected?.id ?? null;

  const handoffQuery = useStudentHandoff(studentId);
  const shareLock = handoffLockMessage(handoffQuery.data, 'universities');

  const catalogQuery = useQuery({
    queryKey: ['consultant-universities'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/consultant/universities');
      return data.data;
    },
  });

  const assignedQuery = useQuery({
    queryKey: ['student-assigned-universities', studentId],
    enabled: Boolean(token) && isConsultant && Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>(
        `/consultant/students/${studentId}/universities`,
      );
      return data.data;
    },
  });

  const assignedIds = useMemo(
    () => new Set((assignedQuery.data ?? []).map((item) => item.id)),
    [assignedQuery.data],
  );

  const available = useMemo(
    () => (catalogQuery.data ?? []).filter((item) => !assignedIds.has(item.id)),
    [catalogQuery.data, assignedIds],
  );

  const assignUniversity = useMutation({
    mutationFn: async () => {
      await api.post(`/consultant/students/${studentId}/universities`, {
        university_id: assignId,
      });
    },
    onSuccess: async () => {
      setAssignId(null);
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['student-assigned-universities', studentId],
      });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not share university.')),
  });

  const removeAssignment = useMutation({
    mutationFn: async (universityId: number) => {
      await api.delete(`/consultant/students/${studentId}/universities/${universityId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['student-assigned-universities', studentId],
      });
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  return (
    <StudentScreen showBack title="Share with students">
      <Pressable onPress={() => router.push('/consultant-universities-catalog')}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          Open catalog →
        </ThemedText>
      </Pressable>

      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={setSelected}
        onClear={() => setSelected(null)}
        hint="Choose a student to share catalog options with them.">
        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        {shareLock ? (
          <ThemedText type="small" style={styles.warn}>
            {shareLock}
          </ThemedText>
        ) : null}

        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">Shared with this student</ThemedText>
          {assignedQuery.isLoading ? <ActivityIndicator /> : null}
          {(assignedQuery.data ?? []).map((university) => (
            <View key={university.id} style={[styles.row, { backgroundColor: theme.inputFill }]}>
              <View style={styles.copy}>
                <ThemedText type="smallBold">{university.name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {[university.city, university.country].filter(Boolean).join(', ')}
                </ThemedText>
              </View>
              <Pressable onPress={() => removeAssignment.mutate(university.id)}>
                <ThemedText type="smallBold" style={styles.error}>
                  Remove
                </ThemedText>
              </Pressable>
            </View>
          ))}
          {!assignedQuery.isLoading && (assignedQuery.data ?? []).length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No universities shared yet.
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">Share from catalog</ThemedText>
          {available.map((university) => (
            <Pressable
              key={university.id}
              onPress={() => setAssignId(university.id)}
              style={[
                styles.row,
                {
                  backgroundColor:
                    assignId === university.id ? theme.successMuted : theme.inputFill,
                },
              ]}>
              <ThemedText type="smallBold">{university.name}</ThemedText>
            </Pressable>
          ))}
          {available.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              All catalog universities are already shared, or the catalog is empty.
            </ThemedText>
          ) : null}
          <Pressable
            disabled={!assignId || assignUniversity.isPending || Boolean(shareLock)}
            onPress={() => assignUniversity.mutate()}
            style={[
              styles.button,
              { backgroundColor: theme.inverted, opacity: assignId && !shareLock ? 1 : 0.5 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
              Share with student
            </ThemedText>
          </Pressable>
        </ThemedView>
      </DepartmentStudentGate>
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
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: { flex: 1, gap: 2 },
  button: {
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  error: { color: '#D92D20' },
  warn: { color: '#B54708', lineHeight: 20 },
});
