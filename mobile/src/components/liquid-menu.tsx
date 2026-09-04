import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type LiquidMenuItem = {
  emoji: string;
  label: string;
  onPress: () => void;
  badge?: number;
};

type LiquidMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: LiquidMenuItem[];
  onLogout?: () => void;
};

const ITEM_TINTS: ThemeColor[] = ['cardLime', 'cardTeal', 'cardGold', 'cardCoral'];

export function LiquidMenu({ visible, onClose, items, onLogout }: LiquidMenuProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(screenWidth * 0.9, 380);
  const androidStatusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  const topInset = Math.max(insets.top, androidStatusBar);

  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = 0;
      progress.value = withSpring(1, {
        damping: 22,
        stiffness: 240,
        mass: 0.75,
      });
      return;
    }

    progress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.45], Extrapolation.CLAMP),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-panelWidth, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal animationType="none" transparent visible={mounted} onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            panelStyle,
            {
              width: panelWidth,
              backgroundColor: theme.background,
              paddingTop: topInset + Spacing.three,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="heading">Menu</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Quick navigation
              </ThemedText>
            </View>
            <Pressable
              accessibilityLabel="Close menu"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: theme.border,
                },
                pressed && { opacity: 0.75 },
              ]}>
              <ThemedText style={[styles.closeIcon, { color: theme.text }]}>×</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.list}>
            {items.map((item, index) => {
              const tintKey = ITEM_TINTS[index % ITEM_TINTS.length];
              const tint = theme[tintKey];

              return (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: theme.backgroundElement,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}>
                  <View style={[styles.itemIcon, { backgroundColor: tint }]}>
                    <ThemedText style={styles.itemEmoji}>{item.emoji}</ThemedText>
                  </View>
                  <View style={styles.itemCopy}>
                    <ThemedText type="smallBold">{item.label}</ThemedText>
                  </View>
                  {(item.badge ?? 0) > 0 ? (
                    <View style={[styles.itemBadge, { backgroundColor: theme.primary }]}>
                      <ThemedText type="caption" style={{ color: theme.onPrimary, fontWeight: '800' }}>
                        {item.badge! > 99 ? '99+' : item.badge}
                      </ThemedText>
                    </View>
                  ) : (
                    <ThemedText type="caption" themeColor="textSecondary">
                      ›
                    </ThemedText>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <ThemeToggle />
            {onLogout ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onLogout();
                }}
                style={({ pressed }) => [
                  styles.logoutBtn,
                  {
                    backgroundColor: theme.inverted,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
                  Log out
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  closeIcon: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '400',
    marginTop: -2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logoutBtn: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
});
