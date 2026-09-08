import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, UniversitySuggestion } from '@/types/auth';

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

export default function ConsultantUniversitySuggestionsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<DocumentType[]>([]);

  const suggestionsQuery = useQuery({
    queryKey: ['consultant-university-suggestions', 'pending'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: UniversitySuggestion[] }>(
        '/consultant/university-suggestions',
        { params: { status: 'pending' } },
      );
      return data.data;
    },
  });

  const accept = useMutation({
    mutationFn: async ({
      id,
      required_documents,
    }: {
      id: number;
      required_documents: DocumentType[];
    }) => {
      await api.post(`/consultant/university-suggestions/${id}/accept`, {
        required_documents,
      });
    },
    onSuccess: async () => {
      setError(null);
      setAcceptingId(null);
      setRequiredDocs([]);
      await queryClient.invalidateQueries({ queryKey: ['consultant-university-suggestions'] });
      await queryClient.invalidateQueries({ queryKey: ['consultant-universities'] });
      await queryClient.invalidateQueries({ queryKey: ['student-assigned-universities'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not accept suggestion.')),
  });

  const reject = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/consultant/university-suggestions/${id}/reject`);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-university-suggestions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not reject suggestion.')),
  });

  function toggleDoc(type: DocumentType) {
    setRequiredDocs((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function startAccept(id: number) {
    setAcceptingId(id);
    setRequiredDocs(['passport']);
    setError(null);
  }

  function confirmAccept() {
    if (acceptingId == null) return;
    if (requiredDocs.length === 0) {
      setError('Select at least one required document before accepting.');
      return;
    }
    accept.mutate({ id: acceptingId, required_documents: requiredDocs });
  }

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  const list = suggestionsQuery.data ?? [];

  return (
    <StudentScreen showBack title="Student suggestions">
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <StudentSurface>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ThemedText type="subtitle">Pending review</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {suggestionsQuery.isLoading
                ? 'Loading…'
                : list.length === 0
                  ? 'No suggestions waiting for review.'
                  : `${list.length} awaiting a decision`}
            </ThemedText>
          </View>
          {list.length > 0 ? (
            <View style={[styles.pill, { backgroundColor: theme.cardGold }]}>
              <ThemedText type="caption" style={{ color: '#92400e', fontWeight: '700' }}>
                Needs review
              </ThemedText>
            </View>
          ) : null}
        </View>

        {suggestionsQuery.isLoading ? <ActivityIndicator color={theme.text} /> : null}

        {list.map((item) => {
          const isAccepting = acceptingId === item.id;
          const location = [item.city, item.country].filter(Boolean).join(', ');

          return (
            <View
              key={item.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.background,
                  borderColor: isAccepting ? theme.primary : theme.border,
                },
              ]}>
              <View style={styles.titleRow}>
                <ThemedText type="smallBold" style={styles.title}>
                  {item.name}
                </ThemedText>
                <View style={[styles.pill, { backgroundColor: theme.cardGold }]}>
                  <ThemedText type="caption" style={{ color: '#92400e', fontWeight: '700' }}>
                    Pending
                  </ThemedText>
                </View>
              </View>

              {location ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {location}
                </ThemedText>
              ) : null}

              {item.student ? (
                <View style={styles.metaBlock}>
                  <View style={styles.metaItem}>
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.metaLabel}>
                      STUDENT
                    </ThemedText>
                    <ThemedText type="smallBold">{item.student.name}</ThemedText>
                  </View>
                  <View style={styles.metaItem}>
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.metaLabel}>
                      EMAIL
                    </ThemedText>
                    <ThemedText type="smallBold">{item.student.email}</ThemedText>
                  </View>
                </View>
              ) : null}

              {isAccepting ? (
                <View style={[styles.acceptPanel, { borderTopColor: theme.border }]}>
                  <ThemedText type="smallBold">Required documents</ThemedText>
                  <View style={styles.chips}>
                    {DOCUMENT_TYPES.map((doc) => {
                      const active = requiredDocs.includes(doc.value);
                      return (
                        <Pressable
                          key={doc.value}
                          onPress={() => toggleDoc(doc.value)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: active ? theme.successMuted : theme.backgroundElement,
                              borderColor: theme.border,
                            },
                          ]}>
                          <ThemedText type="smallBold">{doc.label}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      disabled={accept.isPending}
                      onPress={confirmAccept}
                      style={[styles.primaryBtn, { backgroundColor: theme.inverted, flex: 1 }]}>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.invertedText, fontWeight: '700' }}>
                        {accept.isPending ? 'Accepting…' : 'Confirm & share'}
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      disabled={accept.isPending}
                      onPress={() => {
                        setAcceptingId(null);
                        setRequiredDocs([]);
                      }}
                      style={[styles.secondaryBtn, { borderColor: theme.border, flex: 1 }]}>
                      <ThemedText type="caption" style={{ fontWeight: '700' }}>
                        Cancel
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    disabled={accept.isPending || reject.isPending}
                    onPress={() => startAccept(item.id)}
                    style={[styles.primaryBtn, { backgroundColor: theme.inverted, flex: 1 }]}>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.invertedText, fontWeight: '700' }}>
                      Accept
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    disabled={accept.isPending || reject.isPending}
                    onPress={() => reject.mutate(item.id)}
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: theme.danger,
                        backgroundColor: `${theme.danger}14`,
                        flex: 1,
                      },
                    ]}>
                    <ThemedText type="caption" style={{ color: theme.danger, fontWeight: '700' }}>
                      Reject
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {!suggestionsQuery.isLoading && list.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No pending student suggestions.
          </ThemedText>
        ) : null}
      </StudentSurface>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 16,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaBlock: {
    gap: Spacing.two,
    marginTop: 2,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    letterSpacing: 0.6,
    fontSize: 11,
    fontWeight: '700',
  },
  acceptPanel: {
    gap: Spacing.two,
    marginTop: Spacing.one,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  primaryBtn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  secondaryBtn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
