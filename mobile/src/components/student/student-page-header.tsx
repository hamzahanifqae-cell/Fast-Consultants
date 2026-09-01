import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle?: string;
};

export function StudentPageHeader({ title, subtitle }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={[styles.back, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" style={{ color: theme.text }}>
          ←
        </ThemedText>
      </Pressable>
      <ThemedText type="heading">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
