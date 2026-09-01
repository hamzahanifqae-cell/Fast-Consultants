import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { StudentSummary } from '@/types/auth';

type Props = {
  selectedId: number | null;
  onSelect: (student: StudentSummary) => void;
  onClear: () => void;
  children: ReactNode;
  hint?: string;
};

export function DepartmentStudentGate({
  selectedId,
  onSelect,
  onClear,
  children,
  hint = 'Select a student first, then provide information for them.',
}: Props) {
  const theme = useTheme();
  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const selected = (studentsQuery.data ?? []).find((item) => item.id === selectedId) ?? null;

  if (!selectedId || !selected) {
    return (
      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="subtitle">Select a student</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
        {studentsQuery.isLoading ? <ActivityIndicator /> : null}
        {(studentsQuery.data ?? []).map((student) => (
          <Pressable
            key={student.id}
            onPress={() => onSelect(student)}
            style={[styles.row, { backgroundColor: theme.inputFill }]}>
            <View style={styles.copy}>
              <ThemedText type="smallBold">{student.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {student.email}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">›</ThemedText>
          </Pressable>
        ))}
      </ThemedView>
    );
  }

  return (
    <View style={styles.wrap}>
      <ThemedView style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.copy}>
          <ThemedText type="caption" themeColor="textSecondary">
            Working with
          </ThemedText>
          <ThemedText type="smallBold">{selected.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {selected.email}
          </ThemedText>
        </View>
        <Pressable onPress={onClear} style={[styles.change, { backgroundColor: theme.inputFill }]}>
          <ThemedText type="smallBold">Change</ThemedText>
        </Pressable>
      </ThemedView>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  card: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  banner: {
    borderRadius: 24,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: { flex: 1, gap: 2 },
  row: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  change: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
