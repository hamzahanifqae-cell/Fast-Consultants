import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { hasPermission } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { DocumentType, University } from '@/types/auth';
import './dashboard.css';

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

export function ConsultantUniversitiesCatalogPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);
  const canManageCatalog = hasPermission(user, 'universities.manage');

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['consultant-universities'],
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

  function onCreate(event: FormEvent) {
    event.preventDefault();
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

  const catalog = catalogQuery.data ?? [];

  return (
    <AppShell
      badge="Universities"
      title="University catalog"
      backTo={routes.universities.root}
      backLabel="Universities">
      {error ? <p className="form-error">{error}</p> : null}

      <section className="panel">
        <div
          className="dept-student-banner"
          style={{ padding: 0, boxShadow: 'none', background: 'transparent' }}>
          <div>
            <h2 style={{ margin: 0 }}>Catalog</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {catalogQuery.isLoading
                ? 'Loading…'
                : `${catalog.length} universit${catalog.length === 1 ? 'y' : 'ies'}`}
            </p>
          </div>
          {canManageCatalog ? (
            <button type="button" className="ghost-btn" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Hide form' : 'Add university'}
            </button>
          ) : null}
        </div>

        {canManageCatalog && showForm ? (
          <form className="org-form" onSubmit={onCreate} style={{ marginTop: 18 }}>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>Country</span>
              <input value={country} onChange={(event) => setCountry(event.target.value)} required />
            </label>
            <label className="field">
              <span>City</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <label className="field">
              <span>Description</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => setVisible(event.target.checked)}
              />
              Visible when shared with students
            </label>
            <div className="org-permissions">
              <legend>Required documents</legend>
              {DOCUMENT_TYPES.map((item) => (
                <label key={item.value} className="check-row">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(item.value)}
                    onChange={() => toggleType(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <button className="primary-btn" type="submit" disabled={createUniversity.isPending}>
              Save university
            </button>
          </form>
        ) : null}

        <div className="stack-list" style={{ marginTop: 16 }}>
          {catalog.map((university) => (
            <div key={university.id} className="stack-item">
              <div>
                <strong>{university.name}</strong>
                <span>
                  {[university.city, university.country].filter(Boolean).join(', ')}
                  {(university.required_documents ?? []).length
                    ? ` · ${(university.required_documents ?? []).length} required docs`
                    : ''}
                </span>
              </div>
            </div>
          ))}
          {!catalogQuery.isLoading && catalog.length === 0 ? (
            <p className="muted">Catalog is empty. Add a university to get started.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
