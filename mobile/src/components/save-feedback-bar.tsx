import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSaveFeedbackStore } from '@/stores/save-feedback-store';

export function SaveFeedbackBar() {
  const theme = useTheme();
  const message = useSaveFeedbackStore((state) => state.message);
  const visible = useSaveFeedbackStore((state) => state.visible);
  const hide = useSaveFeedbackStore((state) => state.hide);

  if (!visible || !message) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View accessibilityLiveRegion="polite" style={[styles.bar, { backgroundColor: theme.successMuted, borderColor: theme.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.success }]}>
          <ThemedText style={[styles.icon, { color: theme.invertedText }]}>✓</ThemedText>
        </View>
        <ThemedText style={[styles.copy, { color: theme.text }]} type="smallBold">
          {message}
        </ThemedText>
        <Pressable accessibilityLabel="Dismiss" hitSlop={8} onPress={hide}>
          <ThemedText style={[styles.dismiss, { color: theme.textSecondary }]}>×</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 56,
    right: Spacing.three,
    left: Spacing.three,
    alignItems: 'flex-end',
    zIndex: 10000,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 360,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  copy: {
    flex: 1,
  },
  dismiss: {
    opacity: 0.65,
    fontSize: 22,
    lineHeight: 22,
  },
});
