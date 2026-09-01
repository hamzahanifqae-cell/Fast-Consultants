import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { isInterviewMeetingCancelled } from '@/lib/interview';
import { useAuthStore } from '@/stores/auth-store';
import type { ApplicationChecklistItem, ApplicationStatusResponse } from '@/types/auth';

function ChecklistRow({
  title,
  item,
}: {
  title: string;
  item: ApplicationChecklistItem;
}) {
  return (
    <View style={styles.checklistRow}>
      <View
        style={[
          styles.checkMark,
          { backgroundColor: item.accepted ? Brand.successMuted : Brand.warningMuted },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: item.accepted ? Brand.success : Brand.warning }}>
          {item.accepted ? '✓' : '!'}
        </ThemedText>
      </View>
      <View style={styles.checklistText}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {item.accepted
            ? `All accepted (${item.approved})`
            : `Approved ${item.approved}, Pending ${item.pending}, Rejected ${item.rejected}`}
        </ThemedText>
      </View>
    </View>
  );
}

export default function StudentStatusScreen() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;

  const statusQuery = useQuery({
    queryKey: ['student-application-status'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: ApplicationStatusResponse }>(
        '/student/application-status',
      );
      return data.data;
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  const status = statusQuery.data;
  const interview = status?.application.interview;
  const meetingCancelled = isInterviewMeetingCancelled(interview);

  return (
    <StudentScreen
      showBack
      title="My status">

      {statusQuery.isLoading ? <ActivityIndicator color={Brand.primary} /> : null}

      {status ? (
        <>
          <View style={styles.heroCard}>
            <ThemedText type="section" style={styles.heroKicker}>
              Current stage
            </ThemedText>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              {status.current_status}
            </ThemedText>
            <ThemedText type="small" style={styles.heroCopy}>
              {status.application.everything_accepted
                ? 'Documents and charge slips are accepted. Continue with preparation and interview.'
                : 'Complete document and charge slip approvals to unlock preparation.'}
            </ThemedText>
          </View>

          <StudentSurface>
            <ThemedText type="smallBold">Checklist</ThemedText>
            <ChecklistRow title="Documents" item={status.checklist.documents} />
            <ChecklistRow title="Charge receipts" item={status.checklist.charge_receipts} />
          </StudentSurface>

          <StudentSurface>
            <ThemedText type="smallBold">Next steps</ThemedText>

            {status.preparation_available || status.interview_available ? (
              <>
                {meetingCancelled ? (
                  <View style={styles.cancelledBanner}>
                    <ThemedText type="smallBold" style={styles.cancelledTitle}>
                      Meeting cancelled
                    </ThemedText>
                    <ThemedText type="small" style={styles.cancelledCopy}>
                      Staff cancelled your meeting. You will be notified when a new session is
                      scheduled.
                    </ThemedText>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => router.push('/student-interview')}
                  style={styles.primaryButton}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>
                    Open interview
                  </ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary">
                  Preparation notes and the meeting live in one place.
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Interview unlocks after documents and charge slips are accepted.
              </ThemedText>
            )}
          </StudentSurface>
        </>
      ) : null}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#E0D7FF',
    borderRadius: 28,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  heroKicker: {
    color: '#111111',
  },
  heroTitle: {
    color: '#111111',
  },
  heroCopy: {
    color: '#444444',
  },
  checklistRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  checkMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistText: {
    flex: 1,
    gap: 2,
  },
  primaryButton: {
    backgroundColor: Brand.primary,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButton: {
    backgroundColor: Brand.primarySoft,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: Brand.primary,
  },
  cancelledBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  cancelledTitle: {
    color: Brand.danger,
  },
  cancelledCopy: {
    color: '#991B1B',
  },
});
