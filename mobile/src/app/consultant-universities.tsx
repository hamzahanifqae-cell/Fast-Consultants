import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import type { DocumentType, StudentSummary, University } from '@/types/auth';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'metric', label: 'Matric' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree_certificate', label: 'Degree certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'english_test', label: 'IELTS score' },
  { value: 'recommendation_letter', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];

export default function ConsultantUniversitiesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [assignId, setAssignId] = useState<number | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<DocumentType[]>([]);
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

  const selectedUniversity = useMemo(
    () => available.find((item) => item.id === assignId) ?? null,
    [available, assignId],
  );

  useEffect(() => {
    if (!selectedUniversity) {
      setRequiredDocs([]);
      return;
    }
    setRequiredDocs(
      (selectedUniversity.required_documents ?? []).map((item) => item.type as DocumentType),
    );
  }, [selectedUniversity]);

  const assignUniversity = useMutation({
    mutationFn: async () => {
      await api.post(`/consultant/students/${studentId}/universities`, {
        university_id: assignId,
        required_documents: requiredDocs,
      });
    },
    onSuccess: async () => {
      setAssignId(null);
      setRequiredDocs([]);
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['student-assigned-universities', studentId],
      });
      await queryClient.invalidateQueries({ queryKey: ['consultant-universities'] });
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

  function toggleDoc(type: DocumentType) {
    setRequiredDocs((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function onShare() {
    if (!assignId) {
      setError('Choose a university to share.');
      return;
    }
    if (requiredDocs.length === 0) {
      setError('Select at least one required document before sharing.');
      return;
    }
    assignUniversity.mutate();
  }

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
      <Pressable onPress={() => router.push('/consultant-university-suggestions')}>
        <ThemedText type="smallBold" style={{ color: theme.primary }}>
          Student suggestions →
        </ThemedText>
      </Pressable>

      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={setSelected}
        onClear={() => setSelected(null)}>
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
                {(university.required_documents ?? []).length > 0 ? (
                  <ThemedText type="caption" themeColor="textSecondary">
                    Required:{' '}
                    {(university.required_documents ?? []).map((doc) => doc.label).join(', ')}
                  </ThemedText>
                ) : null}
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
              No universities yet. Students can suggest options, or share from the catalog below.
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

          {assignId ? (
            <View style={styles.docBlock}>
              <ThemedText type="smallBold">Required documents</ThemedText>
              <View style={styles.chips}>
                {DOCUMENT_TYPES.map((item) => {
                  const active = requiredDocs.includes(item.value);
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => toggleDoc(item.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.successMuted : theme.inputFill,
                          borderColor: theme.border,
                        },
                      ]}>
                      <ThemedText type="smallBold">{item.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Pressable
            disabled={!assignId || assignUniversity.isPending || Boolean(shareLock)}
            onPress={onShare}
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
  docBlock: { gap: Spacing.two, marginTop: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  error: { color: '#D92D20' },
  warn: { color: '#B54708', lineHeight: 20 },
});
