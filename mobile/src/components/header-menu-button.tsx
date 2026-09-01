import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type HeaderMenuButtonProps = {
  onPress: () => void;
};

export function HeaderMenuButton({ onPress }: HeaderMenuButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel="Open menu"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={[styles.button, { backgroundColor: theme.iconButton }]}>
      <View style={styles.bars}>
        <View style={[styles.bar, { backgroundColor: theme.iconButtonInk }]} />
        <View style={[styles.bar, { backgroundColor: theme.iconButtonInk }]} />
        <View style={[styles.bar, { backgroundColor: theme.iconButtonInk }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bars: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
  },
  bar: {
    height: 2.5,
    borderRadius: 2,
    width: '100%',
  },
});
