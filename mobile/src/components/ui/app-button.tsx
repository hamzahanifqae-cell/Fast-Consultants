import { LinearGradient } from 'expo-linear-gradient';
import {
  type PressableProps,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Brand, Radius } from '@/constants/theme';

type ButtonVariant = 'primary' | 'ghost' | 'danger';

type AppButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  /** Stretch to parent width. Default true for form CTAs; set false in button rows. */
  fullWidth?: boolean;
  textStyle?: TextStyle;
  contentStyle?: ViewStyle;
};

export function AppButton({
  label,
  variant = 'primary',
  fullWidth = true,
  disabled,
  style,
  textStyle,
  contentStyle,
  ...props
}: AppButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        isPrimary ? styles.primaryWrap : styles.secondaryWrap,
        variant === 'danger' ? styles.dangerWrap : null,
        variant === 'ghost' ? styles.ghostWrap : null,
        fullWidth ? styles.fullWidth : styles.intrinsicWidth,
        {
          opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style as ViewStyle,
      ]}
      {...props}>
      {isPrimary ? (
        <LinearGradient
          colors={[...Brand.buttonGradient]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[styles.primary, contentStyle]}>
          <Text style={[styles.primaryLabel, textStyle]}>{label}</Text>
        </LinearGradient>
      ) : (
        <Text
          style={[
            styles.secondaryLabel,
            variant === 'danger' ? styles.dangerLabel : null,
            textStyle,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export const buttonStyles = StyleSheet.create({
  primaryWrap: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  primary: {
    minHeight: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  secondaryWrap: {
    minHeight: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.canvas,
  },
  ghostWrap: {
    backgroundColor: '#EEEFF4',
  },
  dangerWrap: {
    borderColor: 'rgba(242, 78, 104, 0.32)',
    backgroundColor: 'rgba(242, 78, 104, 0.08)',
  },
  secondaryLabel: {
    color: Brand.ink,
    fontSize: 15,
    fontWeight: '650',
  },
  dangerLabel: {
    color: Brand.danger,
    fontWeight: '700',
  },
  fullWidth: {
    width: '100%',
  },
  intrinsicWidth: {
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
});
