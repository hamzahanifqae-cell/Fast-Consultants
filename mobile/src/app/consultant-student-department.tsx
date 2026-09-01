import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { StudentStackCards } from '@/components/student/student-stack-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hasPermission, isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

export default function ConsultantStudentDepartmentScreen() {
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

  const showStudents =
    hasPermission(user, 'student_info.view') || hasPermission(user, 'student_info.manage');

  const items = [
    ...(showStudents
      ? [
          {
            title: 'Student information',
            description: 'View the details each student filled in their account.',
            color: theme.cardTeal,
            glyph: '👤',
            actionLabel: 'View',
            onPress: () => router.push('/consultant-students'),
          },
          {
            title: 'Student documents',
            description: 'Approve or reject student uploads.',
            color: theme.cardCoral,
            glyph: '📄',
            actionLabel: 'Open',
            onPress: () => router.push('/departments/documents'),
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StudentScreen
        showBack
        title="Student Info">
        <View style={[styles.badge, { backgroundColor: theme.cardTeal }]}>
          <ThemedText type="smallBold">Information & documents</ThemedText>
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
    marginBottom: Spacing.three,
  },
});
