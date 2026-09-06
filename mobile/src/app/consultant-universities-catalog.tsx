import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { StudentScreen } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { hasPermission, isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, University } from '@/types/auth';

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'metric', label: 'Metric (Matric)' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree_certificate', label: 'Degree certificate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'english_test', label: 'IELTS score' },
  { value: 'recommendation_letter', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];

export default function ConsultantUniversitiesCatalogScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);
  const canManageCatalog = hasPermission(user, 'universities.manage');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['consultant-universities'],
    enabled: Boolean(token) && isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/consultant/universities');
      return data.data;
    },
  });

  const createUniversity = useMutation({
    mutationFn: async () => {
      await api.post('/consultant/universities', {
        name: name.trim(),
        country: country.trim(),
        city: city.trim() || null,
        description: description.trim() || null,
        is_visible_to_students: visible,
        required_documents: selectedTypes,
      });
    },
    onSuccess: async () => {
      setName('');
      setCountry('');
      setCity('');
      setDescription('');
      setVisible(true);
      setSelectedTypes([]);
      setShowForm(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['consultant-universities'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create university.')),
  });

  function toggleType(type: DocumentType) {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  function onCreate() {
    if (!name.trim() || !country.trim()) {
      setError('Name and country are required.');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('Choose at least one required document.');
      return;
    }
    createUniversity.mutate();
  }

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (!isConsultant) {
    return <Redirect href="/home" />;
  }

  const catalog = catalogQuery.data ?? [];

  return (
    <StudentScreen showBack title="University catalog">
      {error ? (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.sectionHead}>
          <View style={styles.copy}>
            <ThemedText type="subtitle">Catalog</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {catalogQuery.isLoading
                ? 'Loading…'
                : `${catalog.length} universit${catalog.length === 1 ? 'y' : 'ies'}`}
            </ThemedText>
          </View>
          {canManageCatalog ? (
            <Pressable onPress={() => setShowForm((value) => !value)}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                {showForm ? 'Cancel' : 'Add'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {canManageCatalog && showForm ? (
          <View style={styles.form}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="University name"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.inputFill, color: theme.text, borderColor: theme.border },
              ]}
            />
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.inputFill, color: theme.text, borderColor: theme.border },
              ]}
            />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="City (optional)"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.inputFill, color: theme.text, borderColor: theme.border },
              ]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: theme.inputFill, color: theme.text, borderColor: theme.border },
              ]}
            />
            <View style={styles.switchRow}>
              <ThemedText type="small" style={styles.switchLabel}>
                Visible when shared with students
              </ThemedText>
              <Switch value={visible} onValueChange={setVisible} />
            </View>
            <ThemedText type="smallBold">Required documents</ThemedText>
            <View style={styles.chips}>
              {DOCUMENT_TYPES.map((item) => {
                const active = selectedTypes.includes(item.value);
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => toggleType(item.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.successMuted : theme.inputFill,
                        borderColor: theme.border,
                      },
                    ]}>
                    <ThemedText type="smallBold">{item.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={createUniversity.isPending}
              onPress={onCreate}
              style={[styles.button, { backgroundColor: theme.inverted }]}>
              <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
                {createUniversity.isPending ? 'Saving…' : 'Save university'}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {catalogQuery.isLoading ? <ActivityIndicator /> : null}
        {catalog.map((university) => (
          <View key={university.id} style={[styles.row, { backgroundColor: theme.inputFill }]}>
            <View style={styles.copy}>
              <ThemedText type="smallBold">{university.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {[university.city, university.country].filter(Boolean).join(', ')}
                {(university.required_documents ?? []).length
                  ? ` · ${(university.required_documents ?? []).length} required docs`
                  : ''}
              </ThemedText>
            </View>
          </View>
        ))}
        {!catalogQuery.isLoading && catalog.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Catalog is empty. Add a university to get started.
          </ThemedText>
        ) : null}
      </ThemedView>

      <Pressable onPress={() => router.push('/consultant-universities')}>
        <ThemedText type="smallBold" style={{ color: theme.primary, textAlign: 'center' }}>
          Share with students →
        </ThemedText>
      </Pressable>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  switchLabel: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: { flex: 1, gap: 2 },
  button: {
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.one,
  },
  error: { color: '#D92D20' },
});
