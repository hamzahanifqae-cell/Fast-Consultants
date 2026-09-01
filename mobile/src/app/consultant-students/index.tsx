import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { ConsultantSummary } from '@/types/auth';
import { isOrganizationUser } from '@/lib/roles';

export default function ConsultantStudentsScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: ConsultantSummary[] }>('/consultant/students');
      return data.data;
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
      title="Student information">
      <StudentSurface style={{ backgroundColor: theme.backgroundElement }}>
        {studentsQuery.isLoading ? (
          <PageLoader compact message="Loading students…" />
        ) : null}

        {studentsQuery.data?.length ? (
          studentsQuery.data.map((student) => (
            <Pressable
              key={student.id}
              onPress={() => router.push(`/consultant-students/${student.id}`)}
              style={[styles.row, { backgroundColor: theme.inputFill }]}>
              <View style={[styles.avatar, { backgroundColor: theme.cardTeal }]}>
                <ThemedText style={styles.avatarText}>
                  {student.name.slice(0, 1).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.copy}>
                <ThemedText type="smallBold">{student.name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {student.email}
                </ThemedText>
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                ›
              </ThemedText>
            </Pressable>
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No students yet.
          </ThemedText>
        )}
      </StudentSurface>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    padding: Spacing.three,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
});
