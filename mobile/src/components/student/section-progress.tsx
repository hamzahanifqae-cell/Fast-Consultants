import { StyleSheet, View } from 'react-native';

import { BrandProgressBar } from '@/components/student/brand-progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionProgressProps = {
  title: string;
  description?: string;
  percent: number;
  loading?: boolean;
};

export function SectionProgress({
  title,
  description,
  percent,
  loading = false,
}: SectionProgressProps) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const complete = !loading && clamped >= 100;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <ThemedText type="smallBold" style={styles.title}>
            {loading ? 'Loading…' : title}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={[styles.pct, { color: complete ? Brand.success : theme.text }]}>
          {loading ? '…' : `${clamped}%`}
        </ThemedText>
      </View>
      <BrandProgressBar
        complete={complete}
        height={8}
        percent={loading ? 0 : clamped}
        trackColor={theme.backgroundSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
  },
  description: {
    lineHeight: 19,
    fontSize: 13,
  },
  pct: {
    fontVariant: ['tabular-nums'],
    fontSize: 15,
  },
});
