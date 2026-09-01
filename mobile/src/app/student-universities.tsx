import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, StudentDocument, University } from '@/types/auth';
import { isOrganizationUser } from '@/lib/roles';

function statusForType(
  documents: StudentDocument[] | undefined,
  type: DocumentType,
): 'missing' | 'pending' | 'approved' | 'rejected' {
  const matches = (documents ?? []).filter((document) => document.type === type);
  if (matches.some((document) => document.status === 'approved')) {
    return 'approved';
  }
  if (matches.some((document) => document.status === 'pending')) {
    return 'pending';
  }
  if (matches.some((document) => document.status === 'rejected')) {
    return 'rejected';
  }
  return 'missing';
}

export default function StudentUniversitiesScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const universitiesQuery = useQuery({
    queryKey: ['student-universities'],
    enabled: Boolean(token) && !isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/student/universities');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    enabled: Boolean(token) && !isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const universities = useMemo(() => universitiesQuery.data ?? [], [universitiesQuery.data]);

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (isConsultant) {
    return <Redirect href="/home" />;
  }

  return (
    <StudentScreen
      showBack
      title="Universities">
          {universitiesQuery.isLoading ? (
            <PageLoader compact message="Loading universities…" />
          ) : null}

          {universities.length ? (
            universities.map((university) => (
              <View
                key={university.id}
                style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {[university.city, university.country].filter(Boolean).join(', ') ||
                        'University'}
                    </ThemedText>
                    <ThemedText type="subtitle" style={styles.cardTitle}>
                      {university.name}
                    </ThemedText>
                    {university.consultant ? (
                      <ThemedText type="caption" themeColor="textSecondary">
                        Shared by {university.consultant.name}
                      </ThemedText>
                    ) : null}
                    {university.description ? (
                      <ThemedText type="small">{university.description}</ThemedText>
                    ) : null}
                  </View>
                  <View style={[styles.avatar, { backgroundColor: theme.cardTeal }]}>
                    <ThemedText style={styles.avatarGlyph}>🎓</ThemedText>
                  </View>
                </View>

                <View style={styles.requirements}>
                  <ThemedText type="smallBold">Documents required</ThemedText>
                  {(university.required_documents ?? []).map((requirement) => {
                    const status = statusForType(documentsQuery.data, requirement.type);

                    return (
                      <View key={requirement.type} style={styles.requirementRow}>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor:
                                status === 'approved'
                                  ? theme.cardTeal
                                  : status === 'rejected'
                                    ? theme.cardCoral
                                    : status === 'pending'
                                      ? theme.cardGold
                                      : theme.backgroundSelected,
                            },
                          ]}>
                          <ThemedText type="caption" style={styles.statusGlyph}>
                            {status === 'approved'
                              ? '✓'
                              : status === 'rejected'
                                ? '✗'
                                : status === 'pending'
                                  ? '•'
                                  : '○'}
                          </ThemedText>
                        </View>
                        <View style={styles.requirementText}>
                          <ThemedText type="smallBold">{requirement.label}</ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {status === 'approved'
                              ? 'Approved'
                              : status === 'rejected'
                                ? 'Rejected, upload again'
                                : status === 'pending'
                                  ? 'Uploaded, waiting for review'
                                  : 'Not uploaded yet'}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.footerBar, { backgroundColor: theme.cardTeal }]}>
                  <ThemedText type="caption" style={styles.barText}>
                    {(university.required_documents ?? []).length} required docs
                  </ThemedText>
                  <ThemedText type="caption" style={styles.barText}>
                    ›
                  </ThemedText>
                </View>
              </View>
            ))
          ) : universitiesQuery.isLoading ? null : (
            <ThemedText type="small" themeColor="textSecondary">
              No universities have been shared with you yet.
            </ThemedText>
          )}
        </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: 18,
    paddingBottom: 10,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontSize: 28,
    lineHeight: 34,
  },
  requirements: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: 10,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  statusPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGlyph: {
    color: '#111111',
    fontWeight: '700',
  },
  requirementText: {
    flex: 1,
    gap: 2,
  },
  footerBar: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barText: {
    fontWeight: '700',
  },
});
