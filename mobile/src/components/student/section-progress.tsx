import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
        <ThemedText type="smallBold" style={[styles.pct, { color: complete ? '#039855' : theme.text }]}>
          {loading ? '…' : `${clamped}%`}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: loading ? '0%' : `${clamped}%`,
              backgroundColor: complete ? '#039855' : '#2563eb',
            },
          ]}
        />
      </View>
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
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  pct: {
    fontVariant: ['tabular-nums'],
    fontSize: 15,
  },
});
