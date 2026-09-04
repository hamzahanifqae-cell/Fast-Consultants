import { Platform, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type IconName =
  | 'message.fill'
  | 'bell.fill'
  | 'paperplane.fill'
  | 'chevron.right'
  | 'chevron.down'
  | 'chevron.left';

/** Monochrome paths aligned with the web notification / chat icons. */
const SVG_PATHS: Partial<Record<IconName, string>> = {
  'bell.fill':
    'M12 2a5 5 0 0 0-5 5v2.26c0 .7-.28 1.37-.78 1.86L4.3 13.7a1 1 0 0 0 .7 1.7h13.99a1 1 0 0 0 .71-1.71l-1.92-1.92A2.63 2.63 0 0 1 17 9.26V7a5 5 0 0 0-5-5Zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z',
  'message.fill':
    'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.4L5.7 20.3A1 1 0 0 1 4 19.5V6a2 2 0 0 1 2-2Z',
  'paperplane.fill': 'M3.4 11.2 20.1 3.4a1 1 0 0 1 1.3 1.2L14.6 21a1 1 0 0 1-1.8.1l-2.6-5.9-5.9-2.6a1 1 0 0 1-.9-1.4Z',
};

const EMOJI: Partial<Record<IconName, string>> = {
  'chevron.right': '›',
  'chevron.down': '⌄',
  'chevron.left': '‹',
};

type AppIconProps = {
  name: IconName | string;
  size?: number;
  tintColor?: string;
  style?: StyleProp<TextStyle | ViewStyle>;
};

/** Lightweight icon set for production Android builds (no SF Symbols). */
export function AppIcon({ name, size = 20, tintColor, style }: AppIconProps) {
  const color = tintColor ?? '#FFFFFF';
  const path = SVG_PATHS[name as IconName];

  if (path) {
    return (
      <Svg
        accessibilityElementsHidden
        height={size}
        importantForAccessibility="no"
        style={style as StyleProp<ViewStyle>}
        viewBox="0 0 24 24"
        width={size}>
        <Path d={path} fill={color} />
      </Svg>
    );
  }

  const glyph = EMOJI[name as IconName] ?? '•';

  return (
    <Text
      style={[
        {
          fontSize: size,
          lineHeight: size + 2,
          color,
          textAlign: 'center',
        },
        Platform.OS === 'android' && { includeFontPadding: false },
        style as StyleProp<TextStyle>,
      ]}>
      {glyph}
    </Text>
  );
}
