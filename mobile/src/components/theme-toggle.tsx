import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type ThemePreference, useThemeStore } from '@/stores/theme-store';

type Props = {
  /** Use on dark surfaces such as the liquid menu. */
  variant?: 'default' | 'onDark';
};

const OPTIONS: Array<{ value: ThemePreference; label: string; emoji: string }> = [
  { value: 'light', label: 'Light', emoji: '☀️' },
  { value: 'dark', label: 'Dark', emoji: '🌙' },
  { value: 'system', label: 'System', emoji: '📱' },
];

export function ThemeToggle({ variant = 'default' }: Props) {
  const theme = useTheme();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const onDark = variant === 'onDark';

  return (
    <View style={styles.wrap}>
      <ThemedText
        style={[styles.label, onDark && styles.labelOnDark]}
        type="caption"
        themeColor={onDark ? undefined : 'textSecondary'}>
        Appearance
      </ThemedText>
      <View
        style={[
          styles.row,
          {
            backgroundColor: onDark ? 'rgba(255,255,255,0.08)' : theme.inputFill,
            borderColor: onDark ? 'rgba(255,255,255,0.12)' : theme.border,
          },
        ]}>
        {OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => void setPreference(option.value)}
              style={({ pressed }) => [
                styles.chip,
                active && {
                  backgroundColor: onDark ? '#FFFFFF' : theme.inverted,
                },
                pressed && { opacity: 0.88 },
              ]}>
              <ThemedText style={styles.emoji}>{option.emoji}</ThemedText>
              <ThemedText
                style={[
                  styles.chipLabel,
                  active && {
                    color: onDark ? '#111111' : theme.invertedText,
                    fontWeight: '700',
                  },
                  !active && onDark && { color: 'rgba(255,255,255,0.78)' },
                ]}
                type="caption">
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    width: '100%',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  labelOnDark: {
    color: 'rgba(255,255,255,0.55)',
  },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  emoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
