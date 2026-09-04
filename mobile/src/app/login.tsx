import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/auth-background';
import { BrandLogo } from '@/components/brand-logo';
import { AuthSheet } from '@/components/scoop-chrome';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemedText } from '@/components/themed-text';
import { api, getApiErrorMessage } from '@/lib/api';
import { Brand } from '@/constants/theme';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { type LoginPortal, portalMatchesUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse } from '@/types/auth';

function parsePortal(value: string | string[] | undefined): LoginPortal {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'super_admin' || raw === 'superadmin') return 'super_admin';
  if (raw === 'staff' || raw === 'admin' || raw === 'consultant') return 'staff';
  return 'student';
}

function portalLabel(portal: LoginPortal): string {
  if (portal === 'super_admin') return 'Super Admin';
  if (portal === 'staff') return 'Staff';
  return 'Student';
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const portal = useMemo(() => parsePortal(params.role), [params.role]);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const keyboardInset = useKeyboardBottomInset();
  const keyboardVisible = keyboardInset > 0;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const androidStatusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  const topInset = Math.max(insets.top, androidStatusBar);

  const inputStyle = useMemo(
    () => ({
      backgroundColor: theme.inputFill,
      color: theme.text,
    }),
    [theme],
  );

  const label = portalLabel(portal);
  const isStudent = portal === 'student';

  async function onSubmit() {
    setError(null);
    setSubmitting(true);

    try {
      const { data } = await api.post<AuthResponse>('/login', { email, password });
      if (!portalMatchesUser(portal, data.user)) {
        await clearSession();
        setError(
          portal === 'student'
            ? 'Only student accounts can sign in here.'
            : portal === 'super_admin'
              ? 'Only Super Admin accounts can sign in here.'
              : 'Only Staff or Admin accounts can sign in here. Super Admin must use the Super Admin login.',
        );
        return;
      }
      await setSession(data.token, data.user);
      router.replace('/home');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not sign in.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <AuthBackground />

      <View style={styles.avoider}>
        <SafeAreaView
          style={[
            styles.hero,
            keyboardVisible && styles.heroCollapsed,
            { paddingTop: topInset + 8 },
          ]}
          edges={['left', 'right']}>
          <Pressable
            accessibilityLabel="Back to role selection"
            hitSlop={8}
            onPress={() => router.replace('/welcome')}
            style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          {!keyboardVisible ? (
            <View style={styles.heroBottom}>
              <View style={styles.brandBlock}>
                <BrandLogo size={56} />
                <Text style={styles.roleTag}>{label}</Text>
                <Text style={styles.brand}>Fast Consultants</Text>
                <Text style={styles.heroSub}>
                  {portal === 'student'
                    ? 'Sign in to continue your application.'
                    : portal === 'super_admin'
                      ? 'Super Admin sign in only.'
                      : 'Staff and Admin sign in only.'}
                </Text>
              </View>
            </View>
          ) : null}
        </SafeAreaView>

        <View
          style={[
            { marginBottom: keyboardInset },
            keyboardVisible && styles.sheetLift,
          ]}>
          <AuthSheet
            fill={keyboardVisible}
            disabled={submitting}
            label={submitting ? 'Signing in…' : 'Sign In'}
            onPress={() => void onSubmit()}>
            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={keyboardVisible ? styles.formScrollFill : styles.formScrollAuto}
              contentContainerStyle={[
                styles.form,
                keyboardVisible && styles.formKeyboardOpen,
              ]}>
              {!keyboardVisible ? <ThemeToggle /> : null}
              <View style={styles.signUpBlock}>
                {isStudent ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.signUpHint}>
                      Don’t have an account?
                    </ThemedText>
                    <Link href={{ pathname: '/register', params: { role: 'student' } }} asChild>
                      <Pressable>
                        <ThemedText type="linkPrimary">Create account</ThemedText>
                      </Pressable>
                    </Link>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.signUpHint}>
                    Accounts are created by Super Admin. Use the matching portal for your role.
                  </ThemedText>
                )}
              </View>

              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                style={[styles.emailInput, inputStyle]}
                value={email}
              />

              <View style={styles.passwordWrap}>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  style={[styles.passwordInput, inputStyle]}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eye}>
                  <Text style={[styles.eyeIcon, { color: theme.textSecondary }]}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>

              {error ? (
                <ThemedText type="small" themeColor="danger" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}

              <ThemedText type="link" style={styles.forgot}>
                Forgot password?
              </ThemedText>
            </ScrollView>
          </AuthSheet>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.ink,
  },
  avoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetLift: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
  },
  hero: {
    flex: 1,
    paddingHorizontal: 28,
  },
  heroCollapsed: {
    flex: 0,
    flexGrow: 0,
    minHeight: 56,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: -1,
  },
  heroBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 28,
  },
  brandBlock: {
    gap: 10,
  },
  roleTag: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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
  form: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 8,
    gap: 14,
  },
  formScrollAuto: {
    flexGrow: 0,
  },
  formScrollFill: {
    flexGrow: 0,
    flexShrink: 1,
  },
  formKeyboardOpen: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  signUpBlock: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  signUpHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  emailInput: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingRight: 48,
    fontSize: 16,
  },
  eye: {
    position: 'absolute',
    right: 12,
    height: 28,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  eyeIcon: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
  },
  forgot: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
  },
});
