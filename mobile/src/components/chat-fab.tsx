import { AppIcon } from '@/components/app-icon';
import { Pressable, StyleSheet } from 'react-native';

import { useBottomSafeInset } from '@/hooks/use-bottom-safe-inset';
import { useTheme } from '@/hooks/use-theme';

type ChatFabProps = {
  onPress: () => void;
};

export function ChatFab({ onPress }: ChatFabProps) {
  const bottomPad = useBottomSafeInset(16);
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel="Open messages"
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.fab,
        {
          bottom: bottomPad + 8,
          right: 20,
          backgroundColor: theme.inverted,
          shadowColor: '#000000',
        },
      ]}>
      <AppIcon name="message.fill" size={22} tintColor={theme.invertedText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 40,
  },
});
