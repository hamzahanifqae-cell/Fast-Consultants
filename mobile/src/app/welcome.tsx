import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/auth-background';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import type { AccountType } from '@/types/auth';

const ROLES: {
  type: AccountType;
  title: string;
  subtitle: string;
  emoji: string;
  tint: string;
}[] = [
  {
    type: 'student',
    title: 'Student',
    subtitle: 'Student accounts only, documents, fees, and interviews.',
    emoji: '🎓',
    tint: '#C1F2D0',
  },
  {
    type: 'staff',
    title: 'Staff',
    subtitle: 'Staff and Admin accounts only, department workspace.',
    emoji: '💼',
    tint: '#FFF3C1',
  },
  {
    type: 'super_admin',
    title: 'Super Admin',
    subtitle: 'Super Admin only, full access and team permissions.',
    emoji: '🛡️',
    tint: '#E0D7FF',
  },
];

export default function WelcomeScreen() {
  const token = useAuthStore((state) => state.token);
  const theme = useTheme();

  if (token) {
    return <Redirect href="/home" />;
  }

  function openRole(role: AccountType) {
    router.push({ pathname: '/login', params: { role } });
  }

  return (
    <View style={styles.screen}>
      <AuthBackground />

      <SafeAreaView style={styles.hero} edges={['top']}>
        <View style={styles.brandBlock}>
          <BrandLogo size={64} />
          <Text style={styles.brand}>Fast Consultants</Text>
          <Text style={styles.heroSub}>Choose your portal. Each login accepts only that role.</Text>
        </View>
      </SafeAreaView>

      <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <ThemeToggle />
        <Text style={[styles.sheetHint, { color: theme.textSecondary }]}>I am a…</Text>

        {ROLES.map((role) => (
          <Pressable
            key={role.type}
            accessibilityRole="button"
            onPress={() => openRole(role.type)}
            style={({ pressed }) => [
              styles.roleCard,
              { backgroundColor: theme.inputFill },
              pressed && styles.roleCardPressed,
            ]}>
            <View style={[styles.roleAvatar, { backgroundColor: role.tint }]}>
              <Text style={styles.roleEmoji}>{role.emoji}</Text>
            </View>
            <View style={styles.roleCopy}>
              <Text style={[styles.roleTitle, { color: theme.text }]}>{role.title}</Text>
              <Text style={[styles.roleSubtitle, { color: theme.textSecondary }]}>
                {role.subtitle}
              </Text>
            </View>
            <Text style={[styles.roleChevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.ink,
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 28,
  },
  brandBlock: {
    gap: 12,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  sheet: {
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 14,
  },
  sheetHint: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  roleCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  roleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEmoji: {
    fontSize: 26,
  },
  roleCopy: {
    flex: 1,
    gap: 4,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  roleSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  roleChevron: {
    fontSize: 28,
    fontWeight: '300',
    marginRight: 4,
  },
});
