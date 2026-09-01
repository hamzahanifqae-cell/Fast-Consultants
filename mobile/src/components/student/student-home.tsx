import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { LiquidMenu } from '@/components/liquid-menu';
import { StudentProgressCard } from '@/components/student/student-progress-card';
import { RejectionFeedback } from '@/components/student/rejection-feedback';
import { StudentScreen } from '@/components/student/student-screen';
import { StudentStackCards } from '@/components/student/student-stack-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import {
  documentsSectionProgress,
  feesSectionProgress,
  interviewSectionProgress,
  profileSectionProgress,
  statusSectionProgress,
  universitiesSectionProgress,
  visaSectionProgress,
} from '@/lib/student-section-progress';
import { useChatUiStore } from '@/stores/chat-ui-store';
import type {
  ApplicationStatusResponse,
  AuthUser,
  ChargeReceipt,
  StudentDocument,
  StudentProfile,
  University,
  VisaAppointment,
} from '@/types/auth';

type Props = {
  user: AuthUser;
  token: string;
  onLogout: () => Promise<void>;
};

export function StudentHome({ user, token, onLogout }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const openChat = useChatUiStore((state) => state.open);

  const messagesUnreadQuery = useQuery({
    queryKey: ['chat-conversations'],
    enabled: Boolean(token),
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await api.get<{ data: unknown[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });
  const messagesUnread = messagesUnreadQuery.data?.unread_count ?? 0;

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
  });

  const profileQuery = useQuery({
    queryKey: ['student-profile'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProfile }>('/student/profile');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const universitiesQuery = useQuery({
    queryKey: ['student-universities'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/student/universities');
      return data.data;
    },
  });

  const receiptsQuery = useQuery({
    queryKey: ['student-charge-receipts'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: ChargeReceipt[] }>('/student/charge-receipts');
      return data.data;
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ['student-visa-appointments'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: VisaAppointment[] }>('/student/visa-appointments');
      return data.data;
    },
  });

  const docs = documentsQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const receipts = receiptsQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];

  const reviewedDocuments = useMemo(
    () => docs.filter((document) => document.status === 'approved' || document.status === 'rejected'),
    [docs],
  );

  const profileProgress = useMemo(
    () => profileSectionProgress(profileQuery.data),
    [profileQuery.data],
  );
  const documentsProgress = useMemo(() => documentsSectionProgress(docs), [docs]);
  const universitiesProgress = useMemo(
    () => universitiesSectionProgress(universities, docs),
    [universities, docs],
  );
  const feesProgress = useMemo(() => feesSectionProgress(receipts), [receipts]);
  const interviewProgress = useMemo(
    () => interviewSectionProgress(statusQuery.data),
    [statusQuery.data],
  );
  const visaProgress = useMemo(() => visaSectionProgress(appointments), [appointments]);
  const overallStatusProgress = useMemo(
    () => statusSectionProgress(statusQuery.data, appointments),
    [statusQuery.data, appointments],
  );
  const profileComplete = profileProgress.complete;

  const firstName = user.name.split(' ')[0] ?? user.name;
  const prepOpen = Boolean(statusQuery.data?.preparation_available);
  const interviewOpen = Boolean(statusQuery.data?.interview_available);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['student-application-status'] }),
      queryClient.invalidateQueries({ queryKey: ['student-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['student-documents'] }),
      queryClient.invalidateQueries({ queryKey: ['student-universities'] }),
      queryClient.invalidateQueries({ queryKey: ['student-charge-receipts'] }),
      queryClient.invalidateQueries({ queryKey: ['student-visa-appointments'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
    ]);
    setRefreshing(false);
  }

  return (
    <>
      <StudentScreen
        contentStyle={styles.screenPad}
        onMenuPress={() => setMenuOpen(true)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        showMenu>
        <View style={styles.hero}>
          <ThemedText type="heading">Hello, {firstName} 🎓</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your admission workspace, documents, universities, fees, and interview in one place.
          </ThemedText>
        </View>

        <StudentProgressCard
          appointments={appointments}
          loading={statusQuery.isLoading || profileQuery.isLoading}
          profile={profileQuery.data}
          status={statusQuery.data}
        />

        <View style={styles.sectionBlock}>
          <ThemedText type="section" themeColor="textSecondary">
            My journey
          </ThemedText>

          <StudentStackCards
            items={[
              {
                title: 'Personal info',
                description: profileQuery.isLoading
                  ? 'Loading section progress…'
                  : profileProgress.report,
                meta: profileComplete ? 'All sections complete' : profileProgress.meta,
                color: theme.cardCoral,
                glyph: '👤',
                progressPercent: profileQuery.isLoading ? 0 : profileProgress.percent,
                actionLabel: profileComplete ? 'Review' : profileProgress.actionLabel,
                onPress: () => router.push('/student-personal-information'),
              },
              {
                title: 'Documents',
                description: documentsQuery.isLoading
                  ? 'Loading document progress…'
                  : documentsProgress.report,
                meta: documentsProgress.meta,
                color: theme.cardGold,
                glyph: '📄',
                progressPercent: documentsQuery.isLoading ? 0 : documentsProgress.percent,
                actionLabel: documentsProgress.actionLabel,
                onPress: () => router.push('/student-documents'),
              },
              {
                title: 'Universities',
                description: universitiesQuery.isLoading
                  ? 'Loading university progress…'
                  : universitiesProgress.report,
                meta: universitiesProgress.meta,
                color: theme.cardTeal,
                glyph: '🎓',
                progressPercent: universitiesQuery.isLoading ? 0 : universitiesProgress.percent,
                actionLabel: universitiesProgress.actionLabel,
                onPress: () => router.push('/student-universities'),
              },
              {
                title: 'Charge receipts',
                description: receiptsQuery.isLoading
                  ? 'Loading fee progress…'
                  : feesProgress.report,
                meta: feesProgress.meta,
                color: theme.cardLime,
                glyph: '💳',
                progressPercent: receiptsQuery.isLoading ? 0 : feesProgress.percent,
                actionLabel: feesProgress.actionLabel,
                onPress: () => router.push('/student-charge-receipts'),
              },
            ]}
          />
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText type="section" themeColor="textSecondary">
            Next stages
          </ThemedText>

          <StudentStackCards
            items={[
              {
                title: 'My status',
                description: statusQuery.isLoading
                  ? 'Loading checklist…'
                  : overallStatusProgress.report,
                meta: overallStatusProgress.meta,
                color: '#FFF3C1',
                glyph: '📋',
                progressPercent: statusQuery.isLoading ? 0 : overallStatusProgress.percent,
                actionLabel: overallStatusProgress.actionLabel,
                onPress: () => router.push('/student-status'),
              },
              {
                title: 'Interview',
                description: statusQuery.isLoading
                  ? 'Loading interview progress…'
                  : interviewProgress.report,
                meta: interviewProgress.meta,
                color: prepOpen || interviewOpen ? theme.cardCoral : '#E8E8EA',
                glyph: prepOpen || interviewOpen ? '🗓️' : '🔒',
                progressPercent: statusQuery.isLoading ? 0 : interviewProgress.percent,
                actionLabel: interviewProgress.actionLabel,
                onPress: () => router.push('/student-interview'),
              },
              {
                title: 'Visa appointments',
                description: appointmentsQuery.isLoading
                  ? 'Loading visa progress…'
                  : visaProgress.report,
                meta: visaProgress.meta,
                color: theme.cardLime,
                glyph: '🛂',
                progressPercent: appointmentsQuery.isLoading ? 0 : visaProgress.percent,
                actionLabel: visaProgress.actionLabel,
                onPress: () => router.push('/student-visa-appointments'),
              },
            ]}
          />
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.reviewHeader}>
            <ThemedText type="section" themeColor="textSecondary">
              Recent decisions
            </ThemedText>
            <Pressable onPress={() => router.push('/student-documents')}>
              <ThemedText type="caption" style={styles.manage}>
                Manage
              </ThemedText>
            </Pressable>
          </View>

          {reviewedDocuments.length ? (
            <View style={styles.decisionStack}>
              {reviewedDocuments.slice(0, 4).map((document) => {
                const approved = document.status === 'approved';
                const pastel = approved ? theme.cardTeal : theme.cardCoral;

                return (
                  <Pressable
                    key={document.id}
                    onPress={() => router.push('/student-documents')}
                    style={[styles.decisionCard, { backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.decisionTop}>
                      <View style={styles.decisionCopy}>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {document.type_label}
                        </ThemedText>
                        <ThemedText type="smallBold">{document.title}</ThemedText>
                        {document.status === 'rejected' && document.rejection_reason ? (
                          <RejectionFeedback reason={document.rejection_reason} />
                        ) : null}
                      </View>
                      <View style={[styles.decisionAvatar, { backgroundColor: pastel }]}>
                        <ThemedText style={styles.decisionGlyph}>
                          {approved ? '✓' : '✗'}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={[styles.decisionBar, { backgroundColor: pastel }]}>
                      <ThemedText type="caption" style={styles.barText}>
                        {approved ? 'Approved' : 'Rejected'}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.barText}>
                        ›
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.emptyAvatar, { backgroundColor: theme.cardGold }]}>
                <ThemedText style={styles.decisionGlyph}>📄</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                Approved and rejected documents will show up here after consultant review.
              </ThemedText>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => void onLogout()}
          style={[styles.logout, { backgroundColor: theme.inverted }]}>
          <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
            Log out
          </ThemedText>
        </Pressable>
      </StudentScreen>

      <LiquidMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={() => void onLogout()}
        items={[
          {
            emoji: '👤',
            label: 'Profile',
            onPress: () => router.push('/student-personal-information'),
          },
          {
            emoji: '📄',
            label: 'Documents',
            onPress: () => router.push('/student-documents'),
          },
          {
            emoji: '🎓',
            label: 'Universities',
            onPress: () => router.push('/student-universities'),
          },
          {
            emoji: '📊',
            label: 'My status',
            onPress: () => router.push('/student-status'),
          },
          {
            emoji: '💬',
            label: 'Messages',
            badge: messagesUnread,
            onPress: () => openChat(),
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screenPad: {
    paddingBottom: Spacing.five,
  },
  hero: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.one,
  },
  sectionBlock: {
    gap: Spacing.two,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manage: {
    fontWeight: '700',
  },
  decisionStack: {
    gap: 14,
  },
  decisionCard: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  decisionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: 18,
    paddingBottom: 14,
    gap: Spacing.three,
  },
  decisionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  decisionAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionGlyph: {
    fontSize: 28,
    lineHeight: 34,
  },
  decisionBar: {
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
  emptyCard: {
    borderRadius: 28,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
  },
  logout: {
    alignSelf: 'center',
    marginTop: Spacing.two,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
});
