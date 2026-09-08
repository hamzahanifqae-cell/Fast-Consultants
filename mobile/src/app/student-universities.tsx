import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PageLoader } from '@/components/page-loader';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isOrganizationUser } from '@/lib/roles';
import {
  documentRequirementStatus,
  universityDocumentCoverage,
  universityDocumentStatusLabel,
} from '@/lib/university-document-requirements';
import { useAuthStore } from '@/stores/auth-store';
import type { StudentDocument, University, UniversitySuggestion } from '@/types/auth';

type CatalogOption = {
  id: number | null;
  name: string;
  country: string;
  city: string | null;
  in_catalog: boolean;
};

type DraftUniversity = {
  key: string;
  name: string;
  city: string;
};

function optionKey(item: Pick<CatalogOption, 'name' | 'city'>) {
  return `${item.name.toLowerCase()}|${(item.city ?? '').toLowerCase()}`;
}

export default function StudentUniversitiesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isConsultant = isOrganizationUser(user);

  const [country, setCountry] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [customList, setCustomList] = useState<DraftUniversity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedQuery = useQuery({
    queryKey: ['student-universities'],
    enabled: Boolean(token) && !isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/student/universities');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    enabled: Boolean(token) && !isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const suggestionsQuery = useQuery({
    queryKey: ['student-university-suggestions'],
    enabled: Boolean(token) && !isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: UniversitySuggestion[] }>(
        '/student/university-suggestions',
      );
      return data.data;
    },
  });

  const countriesQuery = useQuery({
    queryKey: ['student-university-countries'],
    enabled: Boolean(token) && !isConsultant,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>('/student/universities/countries');
      return data.data;
    },
  });

  const catalogQuery = useQuery({
    queryKey: ['student-university-catalog', country],
    enabled: Boolean(token) && !isConsultant && Boolean(country),
    queryFn: async () => {
      const { data } = await api.get<{ data: CatalogOption[] }>('/student/universities/catalog', {
        params: { country },
      });
      return data.data;
    },
  });

  const universities = useMemo(() => selectedQuery.data ?? [], [selectedQuery.data]);
  const docs = documentsQuery.data ?? [];
  const coverage = useMemo(
    () => universityDocumentCoverage(universities, docs),
    [universities, docs],
  );
  const suggestions = suggestionsQuery.data ?? [];
  const pendingNames = useMemo(
    () =>
      new Set(
        suggestions
          .filter((item) => item.status === 'pending' && item.country === country)
          .map((item) => item.name.toLowerCase()),
      ),
    [suggestions, country],
  );
  const catalog = catalogQuery.data ?? [];
  const visibleCatalog = useMemo(
    () => catalog.filter((item) => !pendingNames.has(item.name.toLowerCase())),
    [catalog, pendingNames],
  );

  const submitSuggestions = useMutation({
    mutationFn: async () => {
      const fromCatalog = visibleCatalog
        .filter((item) => selectedKeys.includes(optionKey(item)))
        .map((item) => ({ name: item.name, city: item.city }));
      const fromCustom = customList.map((item) => ({
        name: item.name,
        city: item.city.trim() || null,
      }));

      const { data } = await api.post<{ data: UniversitySuggestion[]; added: number }>(
        '/student/university-suggestions',
        {
          country,
          universities: [...fromCatalog, ...fromCustom],
        },
      );
      return data;
    },
    onSuccess: async () => {
      setSelectedKeys([]);
      setCustomList([]);
      setDraftName('');
      setDraftCity('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-university-suggestions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send suggestions.')),
  });

  const removeSuggestion = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/student/university-suggestions/${id}`);
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-university-suggestions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not remove suggestion.')),
  });

  function addCustomUniversity() {
    const name = draftName.trim();
    if (!country) {
      setError('Select a country first.');
      return;
    }
    if (!name) {
      setError('Enter a university name.');
      return;
    }
    if (visibleCatalog.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setError('That university is already listed. Select it above.');
      return;
    }
    if (customList.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setError('That university is already in your custom list.');
      return;
    }
    setCustomList((current) => [
      ...current,
      { key: `${name}-${Date.now()}`, name, city: draftCity.trim() },
    ]);
    setDraftName('');
    setDraftCity('');
    setError(null);
  }

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  if (isConsultant) {
    return <Redirect href="/home" />;
  }

  const selectedCount = selectedKeys.length + customList.length;

  return (
    <StudentScreen showBack title="Universities">
      <StudentSurface>
        <ThemedText type="subtitle">Suggest universities</ThemedText>

        <Pressable
          onPress={() => setCountryOpen((open) => !open)}
          style={[styles.dropdown, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small">{country ?? 'Select a country'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {countryOpen ? '▲' : '▼'}
          </ThemedText>
        </Pressable>

        {countryOpen ? (
          <View style={[styles.dropdownMenu, { backgroundColor: theme.backgroundSelected }]}>
            {(countriesQuery.data ?? []).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setCountry(item);
                  setCountryOpen(false);
                  setSelectedKeys([]);
                  setCustomList([]);
                  setError(null);
                }}
                style={styles.dropdownItem}>
                <ThemedText type="smallBold">{item}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {country ? (
          <View style={styles.catalogList}>
            <ThemedText type="smallBold">Universities in {country}</ThemedText>
            {catalogQuery.isLoading ? (
              <PageLoader compact message="Loading universities…" />
            ) : null}
            {visibleCatalog.map((university) => {
              const key = optionKey(university);
              const checked = selectedKeys.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() =>
                    setSelectedKeys((current) =>
                      current.includes(key)
                        ? current.filter((value) => value !== key)
                        : [...current, key],
                    )
                  }
                  style={[
                    styles.catalogRow,
                    {
                      backgroundColor: checked ? theme.successMuted : theme.background,
                      borderColor: theme.border,
                    },
                  ]}>
                  <ThemedText type="smallBold">{checked ? '✓' : '○'}</ThemedText>
                  <View style={styles.catalogCopy}>
                    <ThemedText type="smallBold">{university.name}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {[university.city, university.country].filter(Boolean).join(', ')}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
            {!catalogQuery.isLoading && visibleCatalog.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No listed universities for this country yet.
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {country ? (
          <>
            <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
              Not in the list?
            </ThemedText>
            <TextInput
              onChangeText={setDraftName}
              placeholder="University name"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              value={draftName}
            />
            <TextInput
              onChangeText={setDraftCity}
              placeholder="City (optional)"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              value={draftCity}
            />
            <Pressable
              disabled={!draftName.trim()}
              onPress={addCustomUniversity}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: theme.backgroundSelected,
                  opacity: !draftName.trim() ? 0.5 : 1,
                },
              ]}>
              <ThemedText type="smallBold">Add to selection</ThemedText>
            </Pressable>
          </>
        ) : null}

        {customList.map((item) => (
          <View
            key={item.key}
            style={[styles.draftRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.catalogCopy}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {[item.city, country].filter(Boolean).join(', ')}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setCustomList((current) => current.filter((row) => row.key !== item.key))}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Remove
              </ThemedText>
            </Pressable>
          </View>
        ))}

        <Pressable
          disabled={!country || selectedCount === 0 || submitSuggestions.isPending}
          onPress={() => submitSuggestions.mutate()}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: theme.inverted,
              opacity: !country || selectedCount === 0 || submitSuggestions.isPending ? 0.5 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
            {submitSuggestions.isPending
              ? 'Sending…'
              : `Suggest ${selectedCount || ''} to staff`.trim()}
          </ThemedText>
        </Pressable>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </StudentSurface>

      <ThemedText type="subtitle">Your suggestions</ThemedText>
      {suggestionsQuery.isLoading ? <PageLoader compact message="Loading…" /> : null}
      {suggestions.length ? (
        suggestions.map((item) => (
          <View
            key={item.id}
            style={[styles.draftRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.catalogCopy}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {[item.city, item.country].filter(Boolean).join(', ')} · {item.status_label}
              </ThemedText>
            </View>
            {item.status === 'pending' ? (
              <Pressable onPress={() => removeSuggestion.mutate(item.id)}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>
                  Remove
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))
      ) : suggestionsQuery.isLoading ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          No suggestions yet.
        </ThemedText>
      )}

      <ThemedText type="subtitle">Accepted / shared with you</ThemedText>
      {!coverage.complete && coverage.requiredCount > 0 ? (
        <StudentSurface>
          <ThemedText type="smallBold">Documents still needed</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {coverage.missingLabels.length > 0
              ? `Upload: ${coverage.missingLabels.join(', ')}.`
              : `${coverage.pendingCount} document${coverage.pendingCount === 1 ? '' : 's'} waiting for staff approval.`}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/student-documents')}
            style={[styles.primaryBtn, { backgroundColor: theme.inverted, marginTop: Spacing.two }]}>
            <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
              Open documents
            </ThemedText>
          </Pressable>
        </StudentSurface>
      ) : null}
      {selectedQuery.isLoading ? (
        <PageLoader compact message="Loading universities…" />
      ) : null}
      {universities.length ? (
        universities.map((university) => (
          <View
            key={university.id}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardTop}>
              <View style={styles.cardCopy}>
                <ThemedText type="caption" themeColor="textSecondary">
                  {[university.city, university.country].filter(Boolean).join(', ') || 'University'}
                </ThemedText>
                <ThemedText type="subtitle" style={styles.cardTitle}>
                  {university.name}
                </ThemedText>
              </View>
              <View style={[styles.avatar, { backgroundColor: theme.cardTeal }]}>
                <ThemedText style={styles.avatarGlyph}>🎓</ThemedText>
              </View>
            </View>
            {(university.required_documents ?? []).length > 0 ? (
              <View style={styles.docChips}>
                {(university.required_documents ?? []).map((requirement) => {
                  const status = documentRequirementStatus(docs, requirement.type);
                  return (
                    <View
                      key={`${university.id}-${requirement.type}`}
                      style={[
                        styles.docChip,
                        {
                          borderColor: theme.border,
                          backgroundColor:
                            status === 'approved'
                              ? theme.successMuted
                              : status === 'pending'
                                ? theme.cardGold
                                : theme.background,
                        },
                      ]}>
                      <ThemedText type="caption" style={{ fontWeight: '700' }}>
                        {requirement.label}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {universityDocumentStatusLabel(status)}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ))
      ) : selectedQuery.isLoading ? null : (
        <ThemedText type="small" themeColor="textSecondary">
          No universities accepted yet.
        </ThemedText>
      )}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  dropdownMenu: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: Spacing.two,
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  catalogList: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  catalogRow: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  catalogCopy: {
    flex: 1,
    gap: 2,
  },
  input: {
    marginTop: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: Spacing.two,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    marginTop: Spacing.three,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  draftRow: {
    marginTop: Spacing.two,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: 18,
    paddingBottom: 18,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  docChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  docChip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    minWidth: 110,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontSize: 28,
    lineHeight: 34,
  },
});
