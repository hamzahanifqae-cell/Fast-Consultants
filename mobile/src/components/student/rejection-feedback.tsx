import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RejectionFeedbackProps = {
  reason: string;
};

export function RejectionFeedback({ reason }: RejectionFeedbackProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.dangerMuted,
          borderLeftColor: theme.danger,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Reviewer feedback: ${reason}`}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        Reviewer feedback
      </ThemedText>
      <ThemedText type="small">{reason}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.one,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    gap: 4,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
