import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { StudentStackCards } from '@/components/student/student-stack-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import { isOrganizationUser } from '@/lib/roles';

export default function ConsultantFinanceDepartmentScreen() {
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
      <StudentScreen
        showBack
        title="Finance Department">
        <View style={[styles.badge, { backgroundColor: theme.cardGold }]}>
          <ThemedText type="smallBold">Payments workflow</ThemedText>
        </View>

        <StudentStackCards
          items={[
            {
              title: 'Charge slips',
              description:
                'Send consultancy and university fee slips, then review payment screenshots.',
              color: theme.cardGold,
              glyph: '💳',
              actionLabel: 'Manage',
              onPress: () => router.push('/consultant-charge-receipts'),
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
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
