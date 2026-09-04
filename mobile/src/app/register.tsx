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
import { ThemedText } from '@/components/themed-text';
import { ThemeToggle } from '@/components/theme-toggle';
import { api, getApiErrorMessage } from '@/lib/api';
import { Brand } from '@/constants/theme';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse } from '@/types/auth';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const attemptedConsultant = useMemo(() => {
    const raw = Array.isArray(params.role) ? params.role[0] : params.role;
    return raw === 'consultant';
  }, [params.role]);
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
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

  if (attemptedConsultant) {
    return (
      <View style={styles.screen}>
        <AuthBackground />
        <SafeAreaView style={styles.hero} edges={['top']}>
          <Pressable
            accessibilityLabel="Back to role selection"
            hitSlop={8}
            onPress={() => router.replace('/welcome')}
            style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <View style={styles.heroBottom}>
            <Text style={styles.roleTag}>Team</Text>
            <Text style={styles.brand}>Fast Consultants</Text>
            <Text style={styles.heroSub}>
              Team accounts are created by Super Admin. Sign in if you already have access.
            </Text>
            <Link href={{ pathname: '/login', params: { role: 'consultant' } }} asChild>
              <Pressable style={{ marginTop: 16 }}>
                <ThemedText type="linkPrimary">Go to Sign In</ThemedText>
              </Pressable>
            </Link>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);

    try {
      const { data } = await api.post<AuthResponse>('/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        account_type: 'student',
      });
      await setSession(data.token, data.user);
      router.replace('/home');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the account.'));
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
                <Text style={styles.roleTag}>Student</Text>
                <Text style={styles.brand}>Fast Consultants</Text>
                <Text style={styles.heroSub}>Create a student account to get started.</Text>
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
            label={submitting ? 'Creating…' : 'Sign Up'}
            onPress={() => void onSubmit()}>
            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={keyboardVisible ? styles.formScrollFill : styles.formScrollAuto}
              contentContainerStyle={[styles.form, keyboardVisible && styles.formKeyboardOpen]}>
              {!keyboardVisible ? <ThemeToggle /> : null}
              <View style={styles.signInBlock}>
                <ThemedText type="small" themeColor="textSecondary">
                  Already have an account?
                </ThemedText>
                <Link href={{ pathname: '/login', params: { role: 'student' } }} asChild>
                  <Pressable>
                    <ThemedText type="linkPrimary">Sign In</ThemedText>
                  </Pressable>
                </Link>
              </View>

              <TextInput
                autoComplete="name"
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, inputStyle]}
                value={name}
              />
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
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="Password (min 8 characters)"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.input, inputStyle]}
                value={password}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={setPasswordConfirmation}
                placeholder="Confirm password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[styles.input, inputStyle]}
                value={passwordConfirmation}
              />

              {error ? (
                <ThemedText type="small" themeColor="danger" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}
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
    flex: 0.34,
    minHeight: 120,
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
    paddingBottom: 20,
  },
  brandBlock: {
    gap: 8,
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
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  form: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 8,
    gap: 12,
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
  signInBlock: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
  },
});
