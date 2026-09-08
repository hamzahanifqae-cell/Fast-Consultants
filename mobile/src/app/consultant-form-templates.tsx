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

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { SponsorshipLetterDocument } from '@/components/sponsorship-letter-document';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type {
  FormTemplateAssignment,
  FormTemplateDefinition,
  StudentSummary,
} from '@/types/auth';

export default function ConsultantFormTemplatesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [expandedApproved, setExpandedApproved] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const studentId = selected?.id ?? null;

  const catalogQuery = useQuery({
    queryKey: ['consultant-form-templates-catalog'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: FormTemplateDefinition[] }>(
        '/consultant/form-templates/catalog',
      );
      return data.data;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ['consultant-form-templates', studentId],
    enabled: Boolean(token) && isConsultant && Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: FormTemplateAssignment[] }>(
        '/consultant/form-templates',
        { params: { student_id: studentId } },
      );
      return data.data;
    },
  });

  const letter = catalogQuery.data?.[0] ?? null;
  const items = templatesQuery.data ?? [];
  const awaitingStudent = useMemo(
    () => items.filter((item) => item.status === 'awaiting_student' || item.status === 'rejected'),
    [items],
  );
  const awaitingReview = useMemo(
    () => items.filter((item) => item.status === 'awaiting_review'),
    [items],
  );
  const approved = useMemo(
    () => items.filter((item) => item.status === 'approved'),
    [items],
  );

  const sendLetter = useMutation({
    mutationFn: async () => {
      await api.post('/consultant/form-templates', {
        student_id: studentId,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-form-templates', studentId] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not send letter.'));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      rejection_reason,
    }: {
      id: number;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      await api.patch(`/consultant/form-templates/${id}/status`, {
        status,
        rejection_reason: rejection_reason ?? null,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-form-templates', studentId] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not update status.'));
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/consultant/form-templates/${id}`);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-form-templates', studentId] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not delete letter.'));
    },
  });

  if (!isConsultant) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <StudentScreen title="Sponsorship letter" subtitle="Send and review">
      <DepartmentStudentGate onSelect={setSelected} selected={selected}>
        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}

        <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{letter?.title ?? 'Sponsorship letter'}</ThemedText>
          <Pressable
            disabled={sendLetter.isPending}
            onPress={() => sendLetter.mutate()}
            style={[styles.button, styles.primary, { opacity: sendLetter.isPending ? 0.6 : 1 }]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {sendLetter.isPending ? 'Sending…' : 'Send to student'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="subtitle" style={{ marginTop: Spacing.three }}>
          Awaiting student
        </ThemedText>
        {awaitingStudent.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            None
          </ThemedText>
        ) : null}
        {awaitingStudent.map((item) => (
          <ThemedView
            key={item.id}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{item.title}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {item.status_label}
              {item.rejection_reason ? ` — ${item.rejection_reason}` : ''}
            </ThemedText>
            <Pressable
              disabled={deleteAssignment.isPending}
              onPress={() => deleteAssignment.mutate(item.id)}
              style={[styles.button, styles.reject]}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                Delete
              </ThemedText>
            </Pressable>
          </ThemedView>
        ))}

        <ThemedText type="subtitle" style={{ marginTop: Spacing.three }}>
          Awaiting review
        </ThemedText>
        {awaitingReview.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            None
          </ThemedText>
        ) : null}
        {awaitingReview.map((item) => {
          const reason = rejectionReasons[item.id] ?? '';
          return (
            <ThemedView
              key={item.id}
              style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.reviewHead}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Pending review
                </ThemedText>
                <Pressable
                  disabled={deleteAssignment.isPending}
                  onPress={() => deleteAssignment.mutate(item.id)}>
                  <ThemedText type="caption" style={{ color: '#b91c1c', fontWeight: '700' }}>
                    Delete
                  </ThemedText>
                </Pressable>
              </View>

              <SponsorshipLetterDocument item={item} showHeader={false} />

              <Pressable
                disabled={updateStatus.isPending}
                onPress={() => updateStatus.mutate({ id: item.id, status: 'approved' })}
                style={[styles.button, styles.approve]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Approve
                </ThemedText>
              </Pressable>
              <TextInput
                multiline
                onChangeText={(value) =>
                  setRejectionReasons((current) => ({ ...current, [item.id]: value }))
                }
                placeholder="Reason for rejection"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
                value={reason}
              />
              <Pressable
                disabled={updateStatus.isPending || reason.trim().length === 0}
                onPress={() =>
                  updateStatus.mutate({
                    id: item.id,
                    status: 'rejected',
                    rejection_reason: reason.trim(),
                  })
                }
                style={[
                  styles.button,
                  styles.reject,
                  { opacity: reason.trim().length === 0 ? 0.55 : 1 },
                ]}>
                <ThemedText type="smallBold" style={styles.buttonText}>
                  Reject
                </ThemedText>
              </Pressable>
            </ThemedView>
          );
        })}

        <ThemedText type="subtitle" style={{ marginTop: Spacing.three }}>
          Approved
        </ThemedText>
        {templatesQuery.isLoading ? <ActivityIndicator /> : null}
        {approved.length === 0 && !templatesQuery.isLoading ? (
          <ThemedText type="small" themeColor="textSecondary">
            None
          </ThemedText>
        ) : null}
        {approved.map((item) => {
          const open = Boolean(expandedApproved[item.id]);
          return (
            <View key={item.id}>
              <ThemedView style={[styles.card, { backgroundColor: theme.inputFill }]}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="caption" style={{ color: '#047857', fontWeight: '700' }}>
                  Approved
                </ThemedText>
                <Pressable
                  onPress={() =>
                    setExpandedApproved((current) => ({
                      ...current,
                      [item.id]: !current[item.id],
                    }))
                  }
                  style={[styles.button, styles.primary]}>
                  <ThemedText type="smallBold" style={styles.buttonText}>
                    {open ? 'Hide letter' : 'View letter'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
              {open ? <SponsorshipLetterDocument item={item} showHeader={false} /> : null}
            </View>
          );
        })}
      </DepartmentStudentGate>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  reviewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 12,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#0f766e',
  },
  approve: {
    backgroundColor: '#15803d',
  },
  reject: {
    backgroundColor: '#b91c1c',
  },
  buttonText: {
    color: '#fff',
  },
});
