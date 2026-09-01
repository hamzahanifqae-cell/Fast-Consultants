import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { LiquidProgressOverlay } from '@/components/student/liquid-progress-overlay';
import { Brand } from '@/constants/theme';

export type FluidProgressVariant = 'on-red' | 'default';

type FluidProgressBarProps = {
  percent: number;
  label?: string;
  variant?: FluidProgressVariant;
  height?: number;
  minFillPercent?: number;
  loading?: boolean;
};

/** Matches web `.step-progress` — gradient fill with animated liquid shimmer. */
export function FluidProgressBar({
  percent,
  label,
  variant = 'on-red',
  height = 40,
  minFillPercent = 8,
  loading = false,
}: FluidProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const visiblePercent = Math.max(clamped, clamped > 0 ? minFillPercent : 0);
  const fillWidth = trackWidth > 0 ? (trackWidth * visiblePercent) / 100 : 0;
  const onRed = variant === 'on-red';
  const gradientColors = onRed ? Brand.progressOnRedGradient : Brand.progressGradient;
  const trackBackground = onRed ? 'rgba(0, 0, 0, 0.18)' : Brand.primarySoft;
  const labelColor = onRed ? Brand.ink : '#FFFFFF';
  const labelShadow = onRed ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.28)';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  function onTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      onLayout={onTrackLayout}
      style={[styles.track, { height, backgroundColor: trackBackground }]}>
      {!loading && clamped > 0 && trackWidth > 0 ? (
        <View pointerEvents="none" style={[styles.fillClip, { width: fillWidth, height }]}>
          <LinearGradient
            colors={[...gradientColors]}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={{ width: trackWidth, height }}
          />
          <LiquidProgressOverlay
            animate={!reduceMotion}
            trackHeight={height}
            trackWidth={trackWidth}
          />
        </View>
      ) : null}

      {label ? (
        <ThemedText
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: labelColor,
              textShadowColor: labelShadow,
            },
          ]}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  label: {
    position: 'relative',
    zIndex: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.01,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
