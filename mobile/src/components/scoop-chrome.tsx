import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useBottomSafeInset } from '@/hooks/use-bottom-safe-inset';
import { useTheme } from '@/hooks/use-theme';

type AuthSheetProps = {
  children: ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Fill remaining screen height (needed when keyboard is open). */
  fill?: boolean;
};

/**
 * White auth card with a normal primary CTA — no decorative notch/SVG,
 * so the button stays readable when the keyboard is open.
 */
export function AuthSheet({
  children,
  label,
  onPress,
  disabled = false,
  fill = false,
}: AuthSheetProps) {
  const theme = useTheme();
  const bottomPad = useBottomSafeInset(16);

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: theme.backgroundElement },
        fill ? styles.sheetFill : styles.sheetAuto,
      ]}>
      <View style={fill ? styles.sheetBodyFill : styles.sheetBodyAuto}>{children}</View>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.ctaWrap,
            {
              opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
              transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
            },
          ]}>
          <LinearGradient
            colors={[...Brand.buttonGradient]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.cta}>
            <Text style={styles.ctaLabel}>{label}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  sheetAuto: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetFill: {
    flex: 1,
    minHeight: 0,
  },
  sheetBodyAuto: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetBodyFill: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  ctaWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  cta: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
