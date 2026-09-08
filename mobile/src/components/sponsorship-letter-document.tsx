import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FormTemplateAssignment, FormTemplateField } from '@/types/auth';

function answerValue(item: FormTemplateAssignment, field: FormTemplateField): string {
  const value = item.answers?.[field.key];
  if (field.type === 'checkbox') {
    return value === true || value === '1' || value === 'true' ? 'Yes' : 'No';
  }
  if (value == null || value === '') return '—';
  return String(value);
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function statusColor(status: FormTemplateAssignment['status'], theme: ReturnType<typeof useTheme>) {
  if (status === 'approved') return { bg: 'rgba(16,185,129,0.14)', text: '#047857' };
  if (status === 'rejected') return { bg: 'rgba(217,45,32,0.12)', text: '#b42318' };
  if (status === 'awaiting_student') return { bg: 'rgba(245,158,11,0.16)', text: '#92400e' };
  return { bg: theme.backgroundElement, text: theme.textSecondary };
}

type Props = {
  item: FormTemplateAssignment;
  showHeader?: boolean;
};

export function SponsorshipLetterDocument({ item, showHeader = true }: Props) {
  const theme = useTheme();
  const detailFields = item.fields.filter((field) => field.type !== 'checkbox');
  const declarationField = item.fields.find((field) => field.type === 'checkbox');
  const declared =
    declarationField != null && answerValue(item, declarationField) === 'Yes';
  const reviewed = formatDate(item.reviewed_at);
  const created = formatDate(item.created_at);
  const pill = statusColor(item.status, theme);

  return (
    <View
      style={[
        styles.doc,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundElement,
        },
      ]}>
      {showHeader ? (
        <View style={[styles.header, { borderBottomColor: theme.background }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.kicker}>
              Financial sponsorship
            </ThemedText>
            <ThemedText type="subtitle">{item.title}</ThemedText>
          </View>
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <ThemedText type="caption" style={{ color: pill.text, fontWeight: '700' }}>
              {item.status_label}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        <ThemedText type="caption" themeColor="textSecondary">
          The following sponsor details were submitted for this student's application.
        </ThemedText>

        <View style={[styles.fields, { backgroundColor: theme.background }]}>
          {detailFields.map((field, index) => (
            <View
              key={field.key}
              style={[
                styles.row,
                index < detailFields.length - 1
                  ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundElement }
                  : null,
              ]}>
              <ThemedText type="caption" themeColor="textSecondary">
                {field.label}
              </ThemedText>
              <ThemedText type="smallBold">{answerValue(item, field)}</ThemedText>
            </View>
          ))}
        </View>

        {declarationField ? (
          <View
            style={[
              styles.declaration,
              {
                backgroundColor: declared ? 'rgba(16,185,129,0.08)' : theme.background,
                borderColor: declared ? 'rgba(16,185,129,0.35)' : theme.backgroundElement,
              },
            ]}>
            <View
              style={[
                styles.mark,
                {
                  backgroundColor: declared ? 'rgba(16,185,129,0.16)' : theme.backgroundElement,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: declared ? '#047857' : theme.textSecondary }}>
                {declared ? '✓' : '—'}
              </ThemedText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold">
                {declared ? 'Declaration confirmed' : 'Declaration not confirmed'}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {declarationField.label}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      {(reviewed || created) && (
        <View style={[styles.meta, { borderTopColor: theme.background }]}>
          {reviewed && item.status === 'approved' ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Approved {reviewed}
            </ThemedText>
          ) : null}
          {reviewed && item.status === 'rejected' ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Reviewed {reviewed}
            </ThemedText>
          ) : null}
          {created ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Issued {created}
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  doc: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  fields: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 4,
  },
  declaration: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
