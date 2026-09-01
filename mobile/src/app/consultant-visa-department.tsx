import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { StudentStackCards } from '@/components/student/student-stack-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hasPermission, isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

export default function ConsultantVisaDepartmentScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  const showInterview =
    hasPermission(user, 'interview.view') || hasPermission(user, 'interview.manage');
  const showVisa = hasPermission(user, 'visa.view') || hasPermission(user, 'visa.manage');

  const items = [
    ...(showInterview
      ? [
          {
            title: 'Interview scheduling',
            description: 'Unlock preparation notes and arrange student interviews.',
            color: theme.cardCoral,
            glyph: '🗓️',
            actionLabel: 'Manage',
              onPress: () => router.push('/departments/interview'),
            },
        ]
      : []),
    ...(showVisa
      ? [
          {
            title: 'Visa appointments',
            description:
              'Schedule embassy appointments, update status, and notify the student.',
            color: theme.cardLime,
            glyph: '🛂',
            actionLabel: 'Manage',
            onPress: () => router.push('/consultant-visa-appointments'),
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StudentScreen
        showBack
        title="Visa Department">
        <View style={[styles.badge, { backgroundColor: theme.cardCoral }]}>
          <ThemedText type="smallBold">Visa workflow</ThemedText>
        </View>

        <StudentStackCards items={items} />
      </StudentScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
