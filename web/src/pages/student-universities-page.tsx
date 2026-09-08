import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageEmpty, SectionProgress } from '@/components/page-fill';
import { SearchableSelect } from '@/components/searchable-select';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { StudentRoutes } from '@/lib/department-routes';
import {
  documentRequirementStatus,
  universityDocumentCoverage,
  universityDocumentStatusLabel,
} from '@/lib/university-document-requirements';
import type { StudentDocument, University, UniversitySuggestion } from '@/types/auth';
import './dashboard.css';

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

export function StudentUniversitiesPage() {
  const queryClient = useQueryClient();
  const [country, setCountry] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [customList, setCustomList] = useState<DraftUniversity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedQuery = useQuery({
    queryKey: ['student-universities'],
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/student/universities');
      return data.data;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['student-documents'],
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/student/documents');
      return data.data;
    },
  });

  const suggestionsQuery = useQuery({
    queryKey: ['student-university-suggestions'],
    queryFn: async () => {
      const { data } = await api.get<{ data: UniversitySuggestion[] }>(
        '/student/university-suggestions',
      );
      return data.data;
    },
  });

  const countriesQuery = useQuery({
    queryKey: ['student-university-countries'],
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>('/student/universities/countries');
      return data.data;
    },
  });

  const catalogQuery = useQuery({
    queryKey: ['student-university-catalog', country],
    enabled: Boolean(country),
    queryFn: async () => {
      const { data } = await api.get<{ data: CatalogOption[] }>('/student/universities/catalog', {
        params: { country },
      });
      return data.data;
    },
  });

  const list = selectedQuery.data ?? [];
  const docs = documentsQuery.data ?? [];
  const coverage = useMemo(() => universityDocumentCoverage(list, docs), [list, docs]);
  const suggestions = suggestionsQuery.data ?? [];
  const pendingSuggestions = suggestions.filter((item) => item.status === 'pending');
  const pendingNames = useMemo(
    () =>
      new Set(
        pendingSuggestions
          .filter((item) => item.country === country)
          .map((item) => item.name.toLowerCase()),
      ),
    [pendingSuggestions, country],
  );

  const catalog = catalogQuery.data ?? [];
  const visibleCatalog = useMemo(
    () => catalog.filter((item) => !pendingNames.has(item.name.toLowerCase())),
    [catalog, pendingNames],
  );

  const countryOptions = useMemo(
    () => (countriesQuery.data ?? []).map((item) => ({ value: item, label: item })),
    [countriesQuery.data],
  );

  const universitiesProgress =
    list.length === 0 && pendingSuggestions.length === 0
      ? {
          percent: 0,
          title: 'Universities incomplete',
          description: 'No universities yet.',
        }
      : list.length === 0
        ? {
            percent: 50,
            title: 'Suggestions pending',
            description: `${pendingSuggestions.length} suggestion${pendingSuggestions.length === 1 ? '' : 's'} waiting for university staff.`,
          }
        : coverage.requiredCount === 0
          ? {
              percent: 100,
              title: 'Universities selected',
              description: `${list.length} accepted option${list.length === 1 ? '' : 's'} shared with you.`,
            }
          : {
              percent: Math.round((coverage.coveredCount / coverage.requiredCount) * 100),
              title: coverage.complete
                ? 'University documents complete'
                : 'University documents needed',
              description: coverage.complete
                ? `${list.length} option${list.length === 1 ? '' : 's'} · all ${coverage.requiredCount} required documents approved.`
                : `${coverage.coveredCount}/${coverage.requiredCount} required documents approved. Upload the rest in Documents.`,
            };

  const submitSuggestions = useMutation({
    mutationFn: async () => {
      const fromCatalog = visibleCatalog
        .filter((item) => selectedKeys.includes(optionKey(item)))
        .map((item) => ({
          name: item.name,
          city: item.city,
        }));
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

  function optionKey(item: CatalogOption) {
    return `${item.name.toLowerCase()}|${(item.city ?? '').toLowerCase()}`;
  }

  function toggleOption(item: CatalogOption) {
    const key = optionKey(item);
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  }

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
    const existsInCatalog = visibleCatalog.some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (existsInCatalog) {
      setError('That university is already listed above. Select it from the list.');
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

  const selectedCount = selectedKeys.length + customList.length;

  return (
    <AppShell badge="Student" title="Universities">
      <div className="page-stack">
        <SectionProgress
          loading={selectedQuery.isLoading || suggestionsQuery.isLoading}
          title={universitiesProgress.title}
          percent={universitiesProgress.percent}
        />

        {error ? <p className="form-error">{error}</p> : null}

        <section className="panel">
          <h2>Suggest universities</h2>

          <label className="field">
            <span>Country</span>
            <SearchableSelect
              value={country}
              options={countryOptions}
              placeholder={
                countriesQuery.isLoading ? 'Loading countries…' : 'Select a country'
              }
              searchPlaceholder="Search country"
              emptyMessage="No countries available"
              onChange={(next) => {
                setCountry(next);
                setSelectedKeys([]);
                setCustomList([]);
                setError(null);
              }}
            />
          </label>

          {country ? (
            <div className="stack-list" style={{ marginTop: 16 }}>
              <p className="muted" style={{ margin: 0 }}>
                Universities in {country}
              </p>
              {catalogQuery.isLoading ? <p className="muted">Loading universities…</p> : null}
              {!catalogQuery.isLoading && visibleCatalog.length === 0 ? (
                <p className="muted">No listed universities for this country yet.</p>
              ) : null}
              {visibleCatalog.map((university) => {
                const key = optionKey(university);
                const checked = selectedKeys.includes(key);
                return (
                  <label key={key} className="stack-item uni-suggest-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(university)}
                    />
                    <div>
                      <strong>{university.name}</strong>
                      <span>
                        {[university.city, university.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : null}

          {country ? (
            <div className="org-form" style={{ marginTop: 18 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Not in the list?</h3>
              <label className="field">
                <span>University name</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Type another university"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addCustomUniversity();
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>City (optional)</span>
                <input
                  value={draftCity}
                  onChange={(event) => setDraftCity(event.target.value)}
                  placeholder="City"
                />
              </label>
              <button
                type="button"
                className="ghost-btn"
                disabled={!draftName.trim()}
                onClick={addCustomUniversity}>
                Add to selection
              </button>
            </div>
          ) : null}

          {customList.length > 0 ? (
            <div className="stack-list" style={{ marginTop: 16 }}>
              {customList.map((item) => (
                <div key={item.key} className="stack-item org-member">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{[item.city, country].filter(Boolean).join(', ')}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn danger"
                    onClick={() =>
                      setCustomList((current) => current.filter((row) => row.key !== item.key))
                    }>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 16 }}
            disabled={!country || selectedCount === 0 || submitSuggestions.isPending}
            onClick={() => submitSuggestions.mutate()}>
            {submitSuggestions.isPending
              ? 'Sending…'
              : `Suggest ${selectedCount || ''} universit${selectedCount === 1 ? 'y' : 'ies'} to staff`.trim()}
          </button>
        </section>

        <section className="panel">
          <h2>Your suggestions</h2>
          {!suggestionsQuery.isLoading && suggestions.length === 0 ? (
            <PageEmpty title="No suggestions yet" />
          ) : null}
          <div className="stack-list">
            {suggestions.map((item) => (
              <div key={item.id} className="stack-item org-member">
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {[item.city, item.country].filter(Boolean).join(', ')} · {item.status_label}
                  </span>
                </div>
                {item.status === 'pending' ? (
                  <button
                    type="button"
                    className="ghost-btn danger"
                    disabled={removeSuggestion.isPending}
                    onClick={() => removeSuggestion.mutate(item.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Accepted / shared with you</h2>
          {!coverage.complete && coverage.requiredCount > 0 ? (
            <div className="university-docs-callout">
              <div>
                <strong>Documents still needed</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {coverage.missingLabels.length > 0
                    ? `Upload: ${coverage.missingLabels.join(', ')}.`
                    : `${coverage.pendingCount} document${coverage.pendingCount === 1 ? '' : 's'} waiting for staff approval.`}
                </p>
              </div>
              <Link className="primary-btn" to={StudentRoutes.documents}>
                Open documents
              </Link>
            </div>
          ) : null}
          {!selectedQuery.isLoading && list.length === 0 ? (
            <PageEmpty title="No universities accepted yet" />
          ) : null}
          <div className="stack-list">
            {list.map((university) => {
              const requirements = university.required_documents ?? [];
              return (
                <div key={university.id} className="suggestion-review-card" style={{ padding: 16 }}>
                  <div>
                    <strong>{university.name}</strong>
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.9rem' }}>
                      {[university.city, university.country].filter(Boolean).join(', ') ||
                        'University'}
                    </span>
                    {university.description ? <p>{university.description}</p> : null}
                  </div>
                  {requirements.length > 0 ? (
                    <div className="university-doc-chip-row" style={{ marginTop: 12 }}>
                      {requirements.map((requirement) => {
                        const status = documentRequirementStatus(docs, requirement.type);
                        return (
                          <span
                            key={`${university.id}-${requirement.type}`}
                            className={`university-doc-chip status-${status}`}>
                            <strong>{requirement.label}</strong>
                            <span>{universityDocumentStatusLabel(status)}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted" style={{ marginBottom: 0 }}>
                      No required documents listed for this option yet.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
