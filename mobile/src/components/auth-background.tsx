import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';

export function AuthBackground() {
  return (
    <LinearGradient
      colors={[...Brand.authGradient]}
      end={{ x: 0.75, y: 1 }}
      locations={[0, 0.55, 1]}
      pointerEvents="none"
      start={{ x: 0.15, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
