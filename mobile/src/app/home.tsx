import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LiquidMenu } from '@/components/liquid-menu';
import { SuperAdminHome } from '@/components/super-admin/super-admin-home';
import { StudentHome } from '@/components/student/student-home';
import { StudentScreen } from '@/components/student/student-screen';
import { StudentStackCards } from '@/components/student/student-stack-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { hasPermission, isOrganizationUser, isStaffPortalUser, isSuperAdminUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import { useChatUiStore } from '@/stores/chat-ui-store';

export default function HomeScreen() {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const isConsultant = isOrganizationUser(user);

  // Avoid racing logout → clearSession → Redirect /login (defaults to student).
  if (loggingOut) {
    return null;
  }

  if (!token || !user) {
    return <Redirect href="/welcome" />;
  }

  async function onLogout() {
    const accountRole = isSuperAdminUser(user)
      ? 'super_admin'
      : isStaffPortalUser(user) || isConsultant
        ? 'staff'
        : 'student';
    setLoggingOut(true);
    try {
      await api.post('/logout');
    } catch {
      // Token is cleared locally either way.
    }
    await clearSession();
    useChatUiStore.getState().close();
    router.replace({ pathname: '/login', params: { role: accountRole } });
  }

  if (!isConsultant) {
    return <StudentHome onLogout={onLogout} token={token} user={user} />;
  }

  if (isSuperAdminUser(user)) {
    return <SuperAdminHome onLogout={onLogout} token={token} user={user} />;
  }

  const firstName = user.name.split(' ')[0] ?? user.name;
  const showStudents =
    hasPermission(user, 'student_info.view') || hasPermission(user, 'student_info.manage');
  const showUniversities =
    hasPermission(user, 'universities.view') || hasPermission(user, 'universities.manage');
  const showFinance =
    hasPermission(user, 'finance.view') || hasPermission(user, 'finance.manage');
  const showVisa =
    hasPermission(user, 'visa.view') ||
    hasPermission(user, 'visa.manage') ||
    hasPermission(user, 'interview.view') ||
    hasPermission(user, 'interview.manage');
  const showTeam =
    Boolean(user.is_super_admin) ||
    hasPermission(user, 'users.view') ||
    hasPermission(user, 'users.manage');

  const departmentCards = [
    ...(showStudents
      ? [
          {
            title: 'Student Info',
            description: 'Student directory, personal details, and documents.',
            color: theme.cardTeal,
            glyph: '👤',
            meta: 'Profiles',
            actionLabel: 'Open',
            onPress: () => router.push('/departments/student-info'),
          },
          {
            title: 'Queries & replies',
            description: 'Read student questions and reply with guidance.',
            color: theme.cardLime,
            glyph: '💬',
            meta: 'Messages',
            actionLabel: 'Open',
            onPress: () => openChat(),
          },
        ]
      : []),
    ...(showUniversities
      ? [
          {
            title: 'Universities',
            description: 'University options and required documents for students.',
            color: theme.cardGold,
            glyph: '🎓',
            meta: 'Catalog',
            actionLabel: 'Open',
            onPress: () => router.push('/departments/universities'),
          },
        ]
      : []),
    ...(showFinance
      ? [
          {
            title: 'Finance Department',
            description:
              'Consultancy and university charge slips, payment screenshots, next step.',
            color: theme.cardGold,
            glyph: '💳',
            meta: 'Payments',
            actionLabel: 'Open',
            onPress: () => router.push('/departments/finance'),
          },
        ]
      : []),
    ...(showVisa
      ? [
          {
            title: 'Visa Department',
            description:
              'Interview scheduling, visa appointments, and visa-related information.',
            color: theme.cardCoral,
            glyph: '🛂',
            meta: 'Interview & Visa',
            actionLabel: 'Open',
            onPress: () => router.push('/departments/visa'),
          },
        ]
      : []),
    ...(showTeam
      ? [
          {
            title: 'Team & permissions',
            description: 'Create Admin and Staff and control which departments they can open.',
            color: theme.cardLime,
            glyph: '👥',
            meta: 'Organization',
            actionLabel: 'Manage',
            onPress: () => router.push('/departments/team'),
          },
        ]
      : []),
  ];

  const menuItems = [
    ...(showStudents
      ? [
          {
            emoji: '👤',
            label: 'Student Info',
            onPress: () => router.push('/departments/student-info'),
          },
        ]
      : []),
    ...(showUniversities
      ? [
          {
            emoji: '🎓',
            label: 'Universities',
            onPress: () => router.push('/departments/universities'),
          },
        ]
      : []),
    ...(showFinance
      ? [
          {
            emoji: '💳',
            label: 'Finance Dept',
            onPress: () => router.push('/departments/finance'),
          },
        ]
      : []),
    ...(showVisa
      ? [
          {
            emoji: '🛂',
            label: 'Visa Dept',
            onPress: () => router.push('/departments/visa'),
          },
        ]
      : []),
    ...(showTeam
      ? [
          {
            emoji: '👥',
            label: 'Team & access',
            onPress: () => router.push('/departments/team'),
          },
        ]
      : []),
    {
      emoji: '💬',
      label: 'Messages',
      badge: messagesUnread,
      onPress: () => openChat(),
    },
  ];

  const roleLabel = user.is_super_admin
    ? 'Super Admin'
    : user.is_staff
      ? (user.staff_department_label ?? 'Staff')
      : 'Admin';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StudentScreen
        contentStyle={styles.screenPad}
        onMenuPress={() => setMenuOpen(true)}
        showMenu
        title={`Hello, ${firstName}`}>
        <View style={[styles.badge, { backgroundColor: theme.cardLime }]}>
          <ThemedText type="smallBold">{roleLabel}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="section" themeColor="textSecondary">
            Departments
          </ThemedText>
          <StudentStackCards items={departmentCards} />
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
        items={menuItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenPad: {
    paddingBottom: Spacing.five,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  logout: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
});
