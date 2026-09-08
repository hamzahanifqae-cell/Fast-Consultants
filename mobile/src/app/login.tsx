import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuthBackground } from '@/components/auth-background';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useAuthStatusBar } from '@/hooks/use-auth-status-bar';
import { useAuthTopInset } from '@/hooks/use-auth-top-inset';
import { useBottomSafeInset } from '@/hooks/use-bottom-safe-inset';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
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
  const keyboardVisible = keyboardInset > 40;
  const topInset = useAuthTopInset();
  const bottomPad = useBottomSafeInset(24);
  const theme = useTheme();
  useAuthStatusBar();

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

      <View style={[styles.topChrome, { paddingTop: topInset }]}>
        <Pressable
          accessibilityLabel="Back to role selection"
          hitSlop={8}
          onPress={() => router.replace('/welcome')}
          style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
      </View>

      {/*
        Content-hugging sheet + paddingBottom = keyboard height.
        Never flex-expand the sheet (that created the huge white gap and
        parked Sign In under the keyboard).
      */}
      <View
        style={[
          styles.body,
          {
            paddingTop: topInset + 52,
            paddingBottom: keyboardVisible ? keyboardInset : 0,
          },
        ]}>
        {!keyboardVisible ? (
          <View style={styles.heroCopy}>
            <BrandLogo size={40} />
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
        ) : null}

        <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
          <ScrollView
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[
              styles.form,
              { paddingBottom: keyboardVisible ? 12 : 12 + bottomPad },
            ]}>
            <View style={styles.switchRow}>
              {isStudent ? (
                <View style={styles.switchCopy}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Don’t have an account?
                  </ThemedText>
                  <Link href={{ pathname: '/register', params: { role: 'student' } }} asChild>
                    <Pressable>
                      <ThemedText type="linkPrimary">Create account</ThemedText>
                    </Pressable>
                  </Link>
                </View>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Accounts are created by Super Admin.
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
              style={[styles.input, inputStyle]}
              value={email}
            />

            <View style={styles.passwordWrap}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput, inputStyle]}
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

            {!keyboardVisible ? (
              <ThemedText type="link" style={styles.forgot}>
                Forgot password?
              </ThemedText>
            ) : null}

            {/* CTA sits directly under password (8px gap) — never in a flex spacer */}
            <Pressable
              accessibilityLabel="Sign In"
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void onSubmit()}
              style={({ pressed }) => [
                styles.ctaWrap,
                { opacity: submitting ? 0.55 : pressed ? 0.9 : 1 },
              ]}>
              <LinearGradient
                colors={[...Brand.buttonGradient]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.cta}>
                <Text style={styles.ctaLabel}>{submitting ? 'Signing in…' : 'Sign In'}</Text>
              </LinearGradient>
            </Pressable>

            {!keyboardVisible ? (
              <View style={styles.themeBlock}>
                <ThemeToggle />
              </View>
            ) : null}
          </ScrollView>
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
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: -1,
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroCopy: {
    paddingHorizontal: 28,
    gap: 4,
    paddingBottom: 14,
  },
  roleTag: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    lineHeight: 20,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '78%',
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 8,
  },
  switchRow: {
    marginBottom: 2,
  },
  switchCopy: {
    gap: 2,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 56,
  },
  eye: {
    position: 'absolute',
    right: 12,
    height: 28,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    textAlign: 'center',
  },
  forgot: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  ctaWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 0,
  },
  cta: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  themeBlock: {
    marginTop: 4,
  },
});
