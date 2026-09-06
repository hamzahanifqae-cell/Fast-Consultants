import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { StudentStackCards } from '@/components/student/student-stack-card';
import { useTheme } from '@/hooks/use-theme';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

export default function ConsultantUniversitiesDepartmentScreen() {
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

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StudentScreen showBack title="Universities">
        <StudentStackCards
          items={[
            {
              title: 'Catalog',
              description: 'Add and manage university options in the master list.',
              color: theme.cardTeal,
              glyph: 'UN',
              actionLabel: 'Open',
              onPress: () => router.push('/consultant-universities-catalog'),
            },
            {
              title: 'Share with students',
              description: 'Assign catalog options to a student from the directory.',
              color: theme.cardCoral,
              glyph: 'SH',
              actionLabel: 'Share',
              onPress: () => router.push('/consultant-universities'),
            },
          ]}
        />
      </StudentScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
