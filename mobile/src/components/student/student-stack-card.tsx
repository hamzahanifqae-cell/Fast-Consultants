import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StudentStackItem = {
  title: string;
  description?: string;
  meta?: string;
  color: string;
  glyph: string;
  actionLabel?: string;
  /** 0–100; when set, the colored action bar fills as a progress bar */
  progressPercent?: number;
  onPress: () => void;
};

type Props = {
  items: StudentStackItem[];
};

function withAlpha(hex: string, alphaHex: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alphaHex}`;
  }
  return hex;
}

export function StudentStackCards({ items }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.stack}>
      {items.map((item) => {
        const hasProgress = typeof item.progressPercent === 'number';
        const percent = hasProgress
          ? Math.max(0, Math.min(100, Math.round(item.progressPercent ?? 0)))
          : null;
        const label =
          item.actionLabel ??
          (percent !== null && percent >= 100 ? 'Review' : 'Continue');

        return (
          <View key={item.title}>
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.backgroundElement,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}>
              <View style={styles.top}>
                <View style={styles.copy}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {item.meta ?? 'Open'}
                  </ThemedText>
                  <ThemedText type="subtitle" style={styles.title}>
                    {item.title}
                  </ThemedText>
                </View>
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                  <ThemedText style={styles.glyph}>{item.glyph}</ThemedText>
                </View>
              </View>

              {percent !== null ? (
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: withAlpha(item.color, '55') },
                  ]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(percent, percent > 0 ? 8 : 0)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                  <View style={styles.barContent}>
                    <ThemedText type="caption" style={styles.barText}>
                      {label}
                    </ThemedText>
                    <ThemedText type="caption" style={styles.barText}>
                      {percent}%
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <View style={[styles.barSolid, { backgroundColor: item.color }]}>
                  <ThemedText type="caption" style={styles.barText}>
                    {label}
                  </ThemedText>
                  <ThemedText type="caption" style={styles.barText}>
                    →
                  </ThemedText>
                </View>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: 18,
    paddingBottom: 14,
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 32,
    lineHeight: 38,
  },
  barTrack: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    minHeight: 40,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
  },
  barContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  barSolid: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barText: {
    fontWeight: '700',
  },
});
