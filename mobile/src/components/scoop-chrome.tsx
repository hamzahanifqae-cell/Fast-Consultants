import { type ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sign in notch: a bite taken out of the white sheet, opening from the
 * physical bottom edge of the screen. There is no baseline / dock bar,
 * left and right of the hump, white runs all the way to the edge.
 */
export function getNotchMetrics(screenWidth: number, bottomInset = 34) {
  const depth = Math.round(Math.max(bottomInset + 22, screenWidth * 0.12));
  const width = Math.round(screenWidth * 0.44);
  return { width, depth, half: width / 2 };
}

/** @deprecated use getNotchMetrics, kept for home padding */
export const NOTCH_RADIUS = 40;

/** Black fill = only the bell, sitting on y = height (the screen edge). */
function buildEdgeBellPath(cx: number, half: number, depth: number, height: number) {
  const steps = 56;
  let d = `M${(cx - half).toFixed(2)} ${height}`;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = cx - half + 2 * half * t;
    const y = height - depth * Math.sin(Math.PI * t) ** 2;
    d += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

type AuthSheetProps = {
  children: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Top inset so the control’s mid sits in the fat part of the sin² bell. */
function notchContentTop(depth: number, contentHeight = 28) {
  return Math.max(0, Math.round(depth * 0.58 - contentHeight / 2));
}

export function AuthSheet({ children, label, onPress, disabled = false }: AuthSheetProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { half, depth } = getNotchMetrics(screenWidth, insets.bottom);
  const cx = screenWidth / 2;

  const bellPath = useMemo(
    () => buildEdgeBellPath(cx, half, depth, depth),
    [cx, half, depth],
  );

  return (
    <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, flexShrink: 1 }]}>
      <View style={styles.sheetBody}>{children}</View>

      <View style={[styles.footer, { height: depth, width: screenWidth }]}>
        <Svg
          height={depth}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={screenWidth}>
          <Path d={bellPath} fill={Brand.primary} />
        </Svg>

        <View
          pointerEvents="box-none"
          style={[styles.notchCenter, { paddingTop: notchContentTop(depth) }]}>
          <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            disabled={disabled}
            hitSlop={8}
            onPress={onPress}
            style={({ pressed }) => [
              styles.notchHit,
              {
                opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
              },
            ]}>
            <Text style={styles.notchLabel}>{label}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type ScoopNavBarProps = {
  onPress: () => void;
  /** Hide while the liquid menu is morphing from this notch. */
  hidden?: boolean;
};

export function ScoopNavBar({ onPress, hidden = false }: ScoopNavBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { half, depth } = getNotchMetrics(screenWidth, insets.bottom);
  const footerH = depth;
  const cx = screenWidth / 2;

  const barPath = useMemo(
    () => buildEdgeBellPath(cx, half, depth, footerH),
    [cx, half, depth, footerH],
  );

  if (hidden) return null;

  return (
    <View pointerEvents="box-none" style={[styles.navWrap, { height: footerH }]}>
      <Svg
        height={footerH}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width={screenWidth}>
        <Path d={barPath} fill={Brand.primary} />
      </Svg>

      <View
        pointerEvents="box-none"
        style={[styles.notchCenter, { paddingTop: notchContentTop(depth) }]}>
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onPress}
          style={({ pressed }) => [
            styles.gridHit,
            {
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}>
          <View style={styles.grid}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  sheetBody: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  footer: {
    position: 'relative',
    flexShrink: 0,
  },
  notchCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  notchHit: {
    zIndex: 4,
    minWidth: 120,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  notchLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 20,
    textAlign: 'center',
  },
  navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridHit: {
    zIndex: 4,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
