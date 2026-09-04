import 'react-native-gesture-handler';

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, lazy, Suspense } from 'react';
import { View } from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { RootErrorBoundary } from '@/components/root-error-boundary';
import { AppProviders } from '@/providers/app-providers';
import { SaveFeedbackBar } from '@/components/save-feedback-bar';
import { Colors, Brand } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/auth-store';
import { useStatusBarStore } from '@/stores/status-bar-store';
import { useThemeStore } from '@/stores/theme-store';

const GlobalChatHost = lazy(async () => {
  const module = await import('@/components/global-chat-host');
  return { default: module.GlobalChatHost };
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const statusBarOverride = useStatusBarStore((state) => state.override);
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const canvas = Colors[colorScheme].background;
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    void hydrate();
    void hydrateTheme();
  }, [hydrate, hydrateTheme]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && hydrated && themeHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, hydrated, themeHydrated, fontsLoaded]);

  if ((!fontsLoaded && !fontError) || !hydrated || !themeHydrated) {
    return <PageLoader fullScreen message="Starting Fast Consultants…" />;
  }

  return (
    <RootErrorBoundary>
      <AppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1, backgroundColor: canvas }}>
          <StatusBar style={statusBarOverride ?? (colorScheme === 'dark' ? 'light' : 'dark')} />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              animationDuration: 280,
              contentStyle: { backgroundColor: canvas },
            }}>
          <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: Brand.ink } }} />
          <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: Brand.ink } }} />
          <Stack.Screen name="login" options={{ contentStyle: { backgroundColor: Brand.ink } }} />
          <Stack.Screen name="register" options={{ contentStyle: { backgroundColor: Brand.ink } }} />
          <Stack.Screen name="home" />
          <Stack.Screen name="consultant-student-department" />
          <Stack.Screen name="consultant-finance-department" />
          <Stack.Screen name="consultant-visa-department" />
          <Stack.Screen name="consultant-students/index" />
          <Stack.Screen name="consultant-students/[id]" />
          <Stack.Screen name="consultant-documents" />
          <Stack.Screen name="consultant-visa-appointments" />
          <Stack.Screen name="student-personal-information" />
          <Stack.Screen name="student-documents" />
          <Stack.Screen name="student-universities" />
          <Stack.Screen name="consultant-universities" />
          <Stack.Screen name="student-charge-receipts" />
          <Stack.Screen name="consultant-charge-receipts" />
          <Stack.Screen name="student-status" />
          <Stack.Screen name="student-preparation" />
          <Stack.Screen name="student-interview" />
          <Stack.Screen name="student-visa-appointments" />
          <Stack.Screen name="consultant-applications" />
          <Stack.Screen name="organization-team" />
          <Stack.Screen name="departments/student-info" />
          <Stack.Screen name="departments/documents" />
          <Stack.Screen name="departments/finance" />
          <Stack.Screen name="departments/visa" />
          <Stack.Screen name="departments/interview" />
          <Stack.Screen name="departments/universities" />
          <Stack.Screen name="departments/team" />
          </Stack>
          <SaveFeedbackBar />
          <Suspense fallback={null}>
            <GlobalChatHost />
          </Suspense>
        </View>
      </ThemeProvider>
      </AppProviders>
    </RootErrorBoundary>
  );
}
