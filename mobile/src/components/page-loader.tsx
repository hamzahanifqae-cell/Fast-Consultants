import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PageLoaderProps = {
  message?: string;
  /** Fill the screen (boot) vs inline block for page content */
  fullScreen?: boolean;
  compact?: boolean;
};

export function PageLoader({
  message = 'Loading…',
  fullScreen = false,
  compact = false,
}: PageLoaderProps) {
  const theme = useTheme();

  if (compact) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={message}
        style={[styles.compact, { backgroundColor: theme.backgroundElement }]}>
        <ActivityIndicator color={theme.primary} size="small" />
        <ThemedText type="small" themeColor="textSecondary">
          {message}
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      style={[
        styles.wrap,
        fullScreen && styles.fullScreen,
        { backgroundColor: fullScreen ? theme.background : 'transparent' },
      ]}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <BrandLogo size={52} />
        <ActivityIndicator color={theme.primary} size="large" />
        <View style={styles.copy}>
          <ThemedText type="smallBold">Fast Consultants</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  fullScreen: {
    flex: 1,
    minHeight: 280,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  copy: {
    alignItems: 'center',
    gap: 6,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
  },
});
