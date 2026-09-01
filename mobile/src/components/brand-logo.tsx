import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Fast Consultants favicon / app mark. */
export function BrandLogo({ size = 48, style }: BrandLogoProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={require('@/assets/images/icon.png')}
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: '#FFFFFF',
  },
});
