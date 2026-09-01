import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { PageLoader } from '@/components/page-loader';
import { SelectSheet } from '@/components/student/select-sheet';
import { StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  journeyProgressPalette,
  STUDENT_PROGRESS_SECTIONS,
  type StudentProgressRow,
} from '@/lib/student-progress';

type ProgressFilter = 'all' | 'behind' | 'on_track' | 'complete';

type Props = {
  students: StudentProgressRow[];
  loading?: boolean;
  onSelectedStudentChange?: (studentId: number | null) => void;
};

function FilterChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: theme.backgroundSelected,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText numberOfLines={1} style={styles.chipText} type="caption">
        {label}
      </ThemedText>
      <ThemedText style={styles.chipCaret} themeColor="textSecondary">
        ▾
      </ThemedText>
    </Pressable>
  );
}

function withAlpha(hex: string, alphaHex: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alphaHex}`;
  }
  return hex;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function matchesProgressFilter(student: StudentProgressRow, filter: ProgressFilter) {
  if (filter === 'all') return true;
  if (filter === 'behind') return student.overall_percent < 50;
  if (filter === 'on_track') return student.overall_percent >= 50 && student.overall_percent < 100;
  return student.overall_percent >= 100;
}

const PROGRESS_FILTER_LABELS: Record<ProgressFilter, string> = {
  all: 'All progress',
  behind: 'Behind (< 50%)',
  on_track: 'On track (50 to 99%)',
  complete: 'Complete (100%)',
};

const PROGRESS_FILTER_SHORT: Record<ProgressFilter, string> = {
  all: 'All',
  behind: 'Behind',
  on_track: 'On track',
  complete: 'Done',
};

export function StudentProgressReport({
  students,
  loading = false,
  onSelectedStudentChange,
}: Props) {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openSheet, setOpenSheet] = useState<'student' | 'status' | 'progress' | null>(null);

  const statuses = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.current_status))).sort();
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((student) => {
      if (statusFilter !== 'all' && student.current_status !== statusFilter) {
        return false;
      }
      return matchesProgressFilter(student, progressFilter);
    });
  }, [students, statusFilter, progressFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((student) => student.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((student) => student.id === selectedId) ?? null;
  const overallPalette = selected ? journeyProgressPalette(selected.overall_percent) : null;
  const studentChipLabel = selected
    ? selected.name.split(' ')[0]
    : 'Student';
  const stageChipLabel = statusFilter === 'all' ? 'All stages' : statusFilter;
  const progressChipLabel = PROGRESS_FILTER_SHORT[progressFilter];
  const filtersActive = statusFilter !== 'all' || progressFilter !== 'all';

  useEffect(() => {
    onSelectedStudentChange?.(selected?.id ?? null);
  }, [onSelectedStudentChange, selected?.id]);

  if (loading) {
    return (
      <StudentSurface>
        <PageLoader compact message="Loading student progress report…" />
      </StudentSurface>
    );
  }

  if (students.length === 0) {
    return (
      <StudentSurface>
        <ThemedText type="subtitle">No students yet</ThemedText>
      </StudentSurface>
    );
  }

  return (
    <StudentSurface style={styles.report}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <ThemedText type="caption" themeColor="textSecondary">
            Student progress report
          </ThemedText>
          <ThemedText type="subtitle">Journey overview</ThemedText>
        </View>
        <Pressable onPress={() => router.push('/consultant-students')}>
          <ThemedText type="smallBold">View all</ThemedText>
        </Pressable>
      </View>

      <View style={styles.filterBlock}>
        <View style={styles.filterHead}>
          <ThemedText type="caption" themeColor="textSecondary">
            Filters{filtersActive ? ', active' : ''}
          </ThemedText>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.filterRow}
          showsHorizontalScrollIndicator={false}>
          <FilterChip label={studentChipLabel} onPress={() => setOpenSheet('student')} />
          <FilterChip label={stageChipLabel} onPress={() => setOpenSheet('status')} />
          <FilterChip label={progressChipLabel} onPress={() => setOpenSheet('progress')} />
        </ScrollView>
      </View>

      {!selected ? (
        <ThemedText themeColor="textSecondary">No students match these filters.</ThemedText>
      ) : (
        <View style={styles.body}>
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.cardLime }]}>
              <ThemedText type="smallBold">{initials(selected.name)}</ThemedText>
            </View>
            <View style={styles.identityCopy}>
              <ThemedText type="smallBold">{selected.name}</ThemedText>
              <ThemedText numberOfLines={1} themeColor="textSecondary">
                {selected.email}
              </ThemedText>
            </View>
            <View style={styles.overallBadge}>
              <ThemedText type="subtitle">{selected.overall_percent}%</ThemedText>
              <View style={[styles.statusPill, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="caption">{selected.current_status}</ThemedText>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.overallTrack,
              { backgroundColor: overallPalette!.track },
            ]}>
            <LinearGradient
              colors={[overallPalette!.fillStart, overallPalette!.fillEnd]}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={[
                styles.overallFill,
                {
                  width: `${Math.max(selected.overall_percent, selected.overall_percent > 0 ? 6 : 0)}%`,
                },
              ]}
            />
            <ThemedText type="caption" style={styles.overallLabel}>
              Overall journey, {selected.overall_percent}%
            </ThemedText>
          </View>

          <View style={styles.sectionGrid}>
            {STUDENT_PROGRESS_SECTIONS.map((section) => {
              const progress = selected.sections[section.key];
              const percent = progress?.percent ?? 0;

              return (
                <View
                  key={section.key}
                  style={[styles.sectionCard, { borderColor: withAlpha(section.color, 'AA') }]}>
                  <View style={styles.sectionHead}>
                    <ThemedText type="smallBold">{section.label}</ThemedText>
                    <ThemedText type="smallBold">{percent}%</ThemedText>
                  </View>
                  <View
                    style={[
                      styles.sectionTrack,
                      { backgroundColor: withAlpha(section.color, '88') },
                    ]}>
                    <View
                      style={[
                        styles.sectionFill,
                        {
                          width: `${Math.max(percent, percent > 0 ? 8 : 0)}%`,
                          backgroundColor: section.color,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText themeColor="textSecondary">{progress?.report ?? 'None'}</ThemedText>
                  {progress?.meta ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {progress.meta}
                    </ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push(`/consultant-students/${selected.id}`)}
            style={[styles.primaryBtn, { backgroundColor: theme.inverted }]}>
            <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
              Open student profile
            </ThemedText>
          </Pressable>
        </View>
      )}

      <SelectSheet
        title="Student"
        visible={openSheet === 'student'}
        options={filtered.map((student) => ({
          value: String(student.id),
          label: student.name,
        }))}
        selected={selected ? String(selected.id) : null}
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => {
          setSelectedId(Number(value) || null);
          setOpenSheet(null);
        }}
      />

      <SelectSheet
        title="Stage"
        visible={openSheet === 'status'}
        options={[
          { value: 'all', label: 'All stages' },
          ...statuses.map((status) => ({ value: status, label: status })),
        ]}
        selected={statusFilter}
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => {
          setStatusFilter(value);
          setOpenSheet(null);
        }}
      />

      <SelectSheet
        title="Progress"
        visible={openSheet === 'progress'}
        options={(
          Object.entries(PROGRESS_FILTER_LABELS) as Array<[ProgressFilter, string]>
        ).map(([value, label]) => ({ value, label }))}
        selected={progressFilter}
        onClose={() => setOpenSheet(null)}
        onSelect={(value) => {
          setProgressFilter(value as ProgressFilter);
          setOpenSheet(null);
        }}
      />
    </StudentSurface>
  );
}

const styles = StyleSheet.create({
  report: {
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headCopy: {
    flex: 1,
    gap: 2,
  },
  filterBlock: {
    gap: 8,
  },
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 148,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    flexShrink: 1,
    fontWeight: '600',
  },
  chipCaret: {
    fontSize: 10,
    lineHeight: 12,
  },
  body: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  overallBadge: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  overallTrack: {
    height: 34,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  overallFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  overallLabel: {
    marginLeft: 14,
    fontWeight: '600',
  },
  sectionGrid: {
    gap: Spacing.two,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sectionFill: {
    height: '100%',
    borderRadius: 999,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
  },
});
