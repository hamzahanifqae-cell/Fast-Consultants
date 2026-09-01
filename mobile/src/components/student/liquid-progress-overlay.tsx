import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

function LiquidWave({
  trackWidth,
  trackHeight,
  duration,
  reverse = false,
  topRatio,
  opacity,
  animate,
}: {
  trackWidth: number;
  trackHeight: number;
  duration: number;
  reverse?: boolean;
  topRatio: number;
  opacity: number;
  animate: boolean;
}) {
  const progress = useSharedValue(0);
  const waveWidth = trackWidth * 1.4;
  const waveHeight = trackHeight * 1.4;
  const travel = trackWidth * 0.08;

  useEffect(() => {
    if (!animate) {
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      reverse,
    );
  }, [animate, duration, progress, reverse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 0.5, 1], [-travel, travel, -travel]) },
      {
        translateY: interpolate(progress.value, [0, 0.5, 1], [0, -trackHeight * 0.1, 0]),
      },
      { rotate: `${interpolate(progress.value, [0, 0.5, 1], [0, 12, 0])}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -trackWidth * 0.2,
          top: trackHeight * topRatio,
          width: waveWidth,
          height: waveHeight,
          borderTopLeftRadius: waveWidth * 0.42,
          borderTopRightRadius: waveWidth * 0.58,
          borderBottomRightRadius: waveWidth * 0.48,
          borderBottomLeftRadius: waveWidth * 0.52,
          backgroundColor: `rgba(255, 255, 255, ${opacity})`,
        },
        animate ? animatedStyle : null,
      ]}
    />
  );
}

type LiquidProgressOverlayProps = {
  trackWidth: number;
  trackHeight: number;
  animate: boolean;
};

/** Animated liquid shimmer matching web `.step-progress-liquid`. */
export function LiquidProgressOverlay({
  trackWidth,
  trackHeight,
  animate,
}: LiquidProgressOverlayProps) {
  if (trackWidth <= 0 || trackHeight <= 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LiquidWave
        animate={animate}
        duration={3600}
        opacity={0.24}
        topRatio={0.28}
        trackHeight={trackHeight}
        trackWidth={trackWidth}
      />
      <LiquidWave
        animate={animate}
        duration={4800}
        opacity={0.12}
        reverse
        topRatio={0.52}
        trackHeight={trackHeight}
        trackWidth={trackWidth}
      />
    </View>
  );
}
