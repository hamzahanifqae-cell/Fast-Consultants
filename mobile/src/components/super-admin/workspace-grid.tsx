import { Pressable, StyleSheet, View } from 'react-native';

import { StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type WorkspaceItem = {
  id: string;
  title: string;
  subtitle?: string;
  emoji: string;
  tint: string;
  badge?: number;
  onPress: () => void;
};

type Props = {
  items: WorkspaceItem[];
};

export function WorkspaceGrid({ items }: Props) {
  const theme = useTheme();

  return (
    <StudentSurface style={styles.panel}>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: theme.backgroundSelected,
                borderColor: theme.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
              <ThemedText style={styles.emoji}>{item.emoji}</ThemedText>
              {(item.badge ?? 0) > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.warningMuted }]}>
                  <ThemedText style={styles.badgeText} type="caption">
                    {item.badge! > 99 ? '99+' : item.badge}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText numberOfLines={1} type="smallBold">
              {item.title}
            </ThemedText>
            {item.subtitle ? (
              <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">
                {item.subtitle}
              </ThemedText>
            ) : null}
          </Pressable>
        ))}
      </View>
    </StudentSurface>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 108,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
