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
import { AppButton } from '@/components/ui/app-button';
import { Brand } from '@/constants/theme';
import { useAuthStatusBar } from '@/hooks/use-auth-status-bar';
import { useAuthTopInset } from '@/hooks/use-auth-top-inset';
import { useBottomSafeInset } from '@/hooks/use-bottom-safe-inset';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const attemptedConsultant = useMemo(() => {
    const raw = Array.isArray(params.role) ? params.role[0] : params.role;
    return raw === 'consultant';
  }, [params.role]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  async function onSubmit() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const { data } = await api.post<{ message?: string }>('/register', {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        account_type: 'student',
      });
      setSuccess(
        data.message ??
          'Account created. Leads staff will review your request. You can sign in after it is approved.',
      );
      setName('');
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the account.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (attemptedConsultant) {
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
        <View style={[styles.blockedBody, { paddingTop: topInset + 60 }]}>
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
      </View>
    );
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
            <Text style={styles.roleTag}>Student</Text>
            <Text style={styles.brand}>Fast Consultants</Text>
            <Text style={styles.heroSub}>
              Create a student account. Leads staff must approve it before you can sign in.
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
              <ThemedText type="small" themeColor="textSecondary">
                Already have an account?
              </ThemedText>
              <Link href={{ pathname: '/login', params: { role: 'student' } }} asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Sign In</ThemedText>
                </Pressable>
              </Link>
            </View>

            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Request submitted</Text>
                <Text style={[styles.successBody, { color: theme.text }]}>{success}</Text>
                <Link href={{ pathname: '/login', params: { role: 'student' } }} asChild>
                  <Pressable style={{ marginTop: 8 }}>
                    <ThemedText type="linkPrimary">Go to Sign In</ThemedText>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <>
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
                <View style={styles.passwordWrap}>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPassword}
                    placeholder="Password (min 8 characters)"
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
                <View style={styles.passwordWrap}>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPasswordConfirmation}
                    placeholder="Confirm password"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPasswordConfirmation}
                    style={[styles.input, styles.passwordInput, inputStyle]}
                    value={passwordConfirmation}
                  />
                  <Pressable
                    accessibilityLabel={
                      showPasswordConfirmation ? 'Hide confirm password' : 'Show confirm password'
                    }
                    hitSlop={8}
                    onPress={() => setShowPasswordConfirmation((value) => !value)}
                    style={styles.eye}>
                    <Text style={[styles.eyeIcon, { color: theme.textSecondary }]}>
                      {showPasswordConfirmation ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>

                {error ? (
                  <ThemedText type="small" themeColor="danger" style={styles.error}>
                    {error}
                  </ThemedText>
                ) : null}

                <AppButton
                  accessibilityLabel="Sign Up"
                  disabled={submitting}
                  label={submitting ? 'Creating…' : 'Sign Up'}
                  onPress={() => void onSubmit()}
                />
              </>
            )}

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
  blockedBody: {
    paddingHorizontal: 28,
    gap: 8,
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
    maxHeight: '82%',
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 8,
  },
  switchRow: {
    gap: 2,
    marginBottom: 2,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
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
  successBox: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
    backgroundColor: 'rgba(31, 157, 98, 0.12)',
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.ink,
  },
  successBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  themeBlock: {
    marginTop: 4,
  },
});
