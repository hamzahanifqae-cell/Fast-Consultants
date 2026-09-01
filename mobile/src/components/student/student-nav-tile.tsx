import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type StudentNavTileProps = {
  label: string;
  description?: string;
  meta?: string;
  accent?: string;
  onPress: () => void;
};

export function StudentNavTile({
  label,
  description,
  meta,
  accent,
  onPress,
}: StudentNavTileProps) {
  const theme = useTheme();
  const markColor = accent ?? theme.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <View style={[styles.mark, { backgroundColor: `${markColor}22` }]}>
        <View style={[styles.markDot, { backgroundColor: markColor }]} />
      </View>
      <View style={styles.copy}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {meta ? (
          <ThemedText type="caption" style={{ color: markColor, marginTop: 2 }}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="smallBold" style={[styles.chevron, { color: theme.textSecondary }]}>
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 28,
    borderWidth: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
});
