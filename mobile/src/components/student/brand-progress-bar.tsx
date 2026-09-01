import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { LiquidProgressOverlay } from '@/components/student/liquid-progress-overlay';
import { Brand } from '@/constants/theme';

type BrandProgressBarProps = {
  percent: number;
  height?: number;
  trackColor: string;
  complete?: boolean;
  minFillPercent?: number;
  borderRadius?: number;
  fluid?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Red fill that brightens toward the leading edge; optional liquid shimmer like web hero bar. */
export function BrandProgressBar({
  percent,
  height = 8,
  trackColor,
  complete = false,
  minFillPercent = 0,
  borderRadius = 999,
  fluid = false,
  style,
}: BrandProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const visiblePercent = complete ? 100 : Math.max(clamped, clamped > 0 ? minFillPercent : 0);
  const fillWidth = trackWidth > 0 ? (trackWidth * visiblePercent) / 100 : 0;
  const useFluid = fluid && height >= 32;

  useEffect(() => {
    if (!useFluid) return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, [useFluid]);

  function onTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={onTrackLayout}
      style={[
        styles.track,
        {
          height,
          borderRadius,
          backgroundColor: trackColor,
        },
        style,
      ]}>
      {complete ? (
        <View style={[styles.completeFill, { borderRadius, backgroundColor: Brand.success }]} />
      ) : visiblePercent > 0 && trackWidth > 0 ? (
        useFluid ? (
          <View pointerEvents="none" style={[styles.fillClip, { width: fillWidth, height, borderRadius }]}>
            <LinearGradient
              colors={[...Brand.progressGradient]}
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
        ) : (
          <>
            <LinearGradient
              colors={[...Brand.progressGradient]}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.mask,
                {
                  width: `${100 - visiblePercent}%`,
                  backgroundColor: trackColor,
                  borderTopRightRadius: borderRadius,
                  borderBottomRightRadius: borderRadius,
                },
              ]}
            />
          </>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  completeFill: {
    ...StyleSheet.absoluteFill,
  },
  mask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
});
