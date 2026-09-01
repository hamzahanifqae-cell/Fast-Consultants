import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

type BlobSpec = {
  size: number;
  top: number | `${number}%`;
  left?: number | `${number}%`;
  right?: number | `${number}%`;
  color: string;
  delay: number;
  drift: number;
};

/** Soft red / white orbs — aligned with web pastel-blobs.tsx */
const BLOBS: BlobSpec[] = [
  { size: 220, top: -60, left: -70, color: Brand.primary, delay: 0, drift: 10 },
  { size: 180, top: '8%', right: -50, color: '#FF6B84', delay: 180, drift: 12 },
  { size: 120, top: '36%', left: '22%', color: '#FFFFFF', delay: 320, drift: 8 },
  { size: 90, top: '58%', right: '16%', color: '#FFB3C1', delay: 120, drift: 9 },
  { size: 70, top: '18%', left: '48%', color: Brand.primaryStrong, delay: 400, drift: 8 },
];

function FloatingBlob({ blob }: { blob: BlobSpec }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      blob.delay,
      withRepeat(
        withSequence(
          withTiming(-blob.drift, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(blob.drift, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [blob.delay, blob.drift, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.blob,
        style,
        {
          width: blob.size,
          height: blob.size,
          borderRadius: blob.size / 2,
          backgroundColor: blob.color,
          top: blob.top,
          left: blob.left,
          right: blob.right,
        },
      ]}
    />
  );
}

export function PastelBlobs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BLOBS.map((blob, index) => (
        <FloatingBlob key={index} blob={blob} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    opacity: 0.22,
  },
});
