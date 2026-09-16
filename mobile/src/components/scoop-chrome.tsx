import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useBottomSafeInset } from '@/hooks/use-bottom-safe-inset';
import { useTheme } from '@/hooks/use-theme';
import { AppButton } from '@/components/ui/app-button';

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
        <AppButton disabled={disabled} label={label} onPress={onPress} />
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
});
