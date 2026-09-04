import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

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

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function DepartmentStudentGate({
  selectedId,
  onSelect,
  onClear,
  children,
  hint = 'Choose a student to continue in this department.',
}: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const studentsQuery = useQuery({
    queryKey: ['consultant-students'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentSummary[] }>('/consultant/students');
      return data.data;
    },
  });

  const selected = (studentsQuery.data ?? []).find((item) => item.id === selectedId) ?? null;
  const students = studentsQuery.data ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(needle) ||
        student.email.toLowerCase().includes(needle),
    );
  }, [students, query]);

  if (!selectedId || !selected) {
    return (
      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ThemedText type="subtitle">Student directory</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {hint}
            </ThemedText>
          </View>
          <View style={[styles.count, { backgroundColor: theme.inputFill }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              {studentsQuery.isLoading ? '…' : `${students.length}`}
            </ThemedText>
          </View>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.search,
            {
              backgroundColor: theme.inputFill,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
        />

        {studentsQuery.isLoading ? <ActivityIndicator /> : null}

        <View style={styles.list}>
          {filtered.map((student) => (
            <Pressable
              key={student.id}
              onPress={() => onSelect(student)}
              style={[styles.row, { backgroundColor: theme.inputFill, borderColor: theme.border }]}>
              <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{studentInitials(student.name)}</ThemedText>
              </View>
              <View style={styles.copy}>
                <ThemedText type="smallBold">{student.name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {student.email}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Open
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {!studentsQuery.isLoading && students.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No students yet.
          </ThemedText>
        ) : null}

        {!studentsQuery.isLoading && students.length > 0 && filtered.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No students match “{query.trim()}”.
          </ThemedText>
        ) : null}
      </ThemedView>
    );
  }

  return (
    <View style={styles.wrap}>
      <ThemedView style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.avatar, { backgroundColor: theme.inputFill }]}>
          <ThemedText type="smallBold">{studentInitials(selected.name)}</ThemedText>
        </View>
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
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headerCopy: { flex: 1, gap: 4 },
  count: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  list: { gap: Spacing.two },
  banner: {
    borderRadius: 20,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  row: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
