import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { SponsorshipLetterDocument } from '@/components/sponsorship-letter-document';
import { RejectionFeedback } from '@/components/student/rejection-feedback';
import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { FormTemplateAnswers, FormTemplateAssignment } from '@/types/auth';

function emptyAnswers(item: FormTemplateAssignment): FormTemplateAnswers {
  const next: FormTemplateAnswers = {};
  for (const field of item.fields) {
    next[field.key] = field.type === 'checkbox' ? false : '';
  }
  return next;
}

export default function StudentFormTemplatesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isStudent = user?.roles.includes('student') ?? false;

  const [drafts, setDrafts] = useState<Record<number, FormTemplateAnswers>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['student-form-templates'],
    enabled: Boolean(token) && isStudent,
    queryFn: async () => {
      const { data } = await api.get<{ data: FormTemplateAssignment[] }>(
        '/student/form-templates',
      );
      return data.data;
    },
  });

  const items = templatesQuery.data ?? [];

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const item of items) {
        if (next[item.id]) continue;
        next[item.id] = {
          ...emptyAnswers(item),
          ...(item.answers ?? {}),
        };
      }
      return next;
    });
  }, [items]);

  const submit = useMutation({
    mutationFn: async ({ id, answers }: { id: number; answers: FormTemplateAnswers }) => {
      const { data } = await api.put<{ data: FormTemplateAssignment }>(
        `/student/form-templates/${id}/answers`,
        { answers },
      );
      return data.data;
    },
    onSuccess: async () => {
      setError(null);
      setSubmittingId(null);
      await queryClient.invalidateQueries({ queryKey: ['student-form-templates'] });
    },
    onError: (err) => {
      setSubmittingId(null);
      setError(getApiErrorMessage(err, 'Could not submit Sponsorship letter.'));
    },
  });

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isStudent) {
    return <Redirect href="/home" />;
  }

  function updateDraft(id: number, key: string, value: string | boolean) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {}),
        [key]: value,
      },
    }));
  }

  return (
    <StudentScreen showBack title="Form templates">
      {error ? (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      {templatesQuery.isLoading ? (
        <PageLoader compact message="Loading form templates…" />
      ) : null}

      {!templatesQuery.isLoading && items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No letters
        </ThemedText>
      ) : null}

      {items.map((item) => {
        const canEdit = item.status === 'awaiting_student' || item.status === 'rejected';
        const answers = drafts[item.id] ?? emptyAnswers(item);

        if (!canEdit) {
          return <SponsorshipLetterDocument key={item.id} item={item} />;
        }

        return (
          <View
            key={item.id}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.head}>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {item.status_label}
              </ThemedText>
            </View>
            {item.instructions ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {item.instructions}
              </ThemedText>
            ) : null}
            {item.status === 'rejected' && item.rejection_reason ? (
              <RejectionFeedback reason={item.rejection_reason} />
            ) : null}

            {item.fields.map((field) => {
              if (field.type === 'checkbox') {
                return (
                  <View key={field.key} style={styles.switchRow}>
                    <ThemedText type="small" style={{ flex: 1 }}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </ThemedText>
                    <Switch
                      value={Boolean(answers[field.key])}
                      onValueChange={(value) => updateDraft(item.id, field.key, value)}
                    />
                  </View>
                );
              }

              return (
                <View key={field.key} style={styles.field}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </ThemedText>
                  <TextInput
                    multiline={field.type === 'textarea'}
                    onChangeText={(value) => updateDraft(item.id, field.key, value)}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      field.type === 'textarea' ? styles.multiline : null,
                      { backgroundColor: theme.background, color: theme.text },
                    ]}
                    value={String(answers[field.key] ?? '')}
                  />
                </View>
              );
            })}
            <Pressable
              disabled={submittingId === item.id}
              onPress={() => {
                setSubmittingId(item.id);
                submit.mutate({ id: item.id, answers });
              }}
              style={[
                styles.button,
                styles.primary,
                { opacity: submittingId === item.id ? 0.6 : 1 },
              ]}>
              <ThemedText type="smallBold" style={styles.buttonText}>
                {submittingId === item.id ? 'Submitting…' : 'Submit'}
              </ThemedText>
            </Pressable>
          </View>
        );
      })}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  head: {
    gap: 4,
  },
  field: {
    gap: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#1f3a5f',
  },
  buttonText: {
    color: '#fff',
  },
  error: {
    color: '#D92D20',
    marginBottom: Spacing.two,
  },
});
