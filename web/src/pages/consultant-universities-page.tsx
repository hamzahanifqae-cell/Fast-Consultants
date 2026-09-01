import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { PageStats, PageTips } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { api, getApiErrorMessage } from '@/lib/api';
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

export function ConsultantUniversitiesPage() {
  const queryClient = useQueryClient();
  const { studentId, selectStudent, clearStudent, studentsQuery } = useDepartmentStudentParam();
  const [assignId, setAssignId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['consultant-universities'],
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/consultant/universities');
      return data.data;
    },
  });

  const assignedQuery = useQuery({
    queryKey: ['student-assigned-universities', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>(
        `/consultant/students/${studentId}/universities`,
      );
      return data.data;
    },
  });

  const assignedIds = useMemo(
    () => new Set((assignedQuery.data ?? []).map((item) => item.id)),
    [assignedQuery.data],
  );

  const availableToAssign = useMemo(
    () => (catalogQuery.data ?? []).filter((item) => !assignedIds.has(item.id)),
    [catalogQuery.data, assignedIds],
  );
  const directoryCount = studentsQuery.data?.length ?? 0;

  const assignUniversity = useMutation({
    mutationFn: async () => {
      await api.post(`/consultant/students/${studentId}/universities`, {
        university_id: Number(assignId),
        notes: assignNotes.trim() || null,
      });
    },
    onSuccess: async () => {
      setAssignId('');
      setAssignNotes('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['student-assigned-universities', studentId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not share university.')),
  });

  const removeAssignment = useMutation({
    mutationFn: async (universityId: number) => {
      await api.delete(`/consultant/students/${studentId}/universities/${universityId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student-assigned-universities', studentId] });
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

  function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!assignId) {
      setError('Choose a university to share.');
      return;
    }
    assignUniversity.mutate();
  }

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !country.trim()) {
      setError('Name and country are required.');
      return;
    }
    createUniversity.mutate();
  }

  return (
    <AppShell
      badge="Universities"
      title="Universities">
      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={selectStudent}
        onClear={() => {
          clearStudent();
          setError(null);
        }}>
        {error ? <p className="form-error">{error}</p> : null}

        <PageStats
          items={[
            {
              label: 'Students',
              value: studentsQuery.isLoading ? '…' : directoryCount,
              hint: 'In the shared directory',
              icon: '🎓',
              tone: 'purple',
            },
            {
              label: 'Shared now',
              value: assignedQuery.isLoading ? '…' : (assignedQuery.data ?? []).length,
              hint: 'Visible to this student',
              icon: '🏫',
              tone: 'teal',
            },
            {
              label: 'Catalog',
              value: catalogQuery.isLoading ? '…' : (catalogQuery.data ?? []).length,
              hint: 'Master list',
              icon: '📚',
              tone: 'blue',
            },
            {
              label: 'Available to share',
              value: availableToAssign.length,
              hint: 'Not yet assigned',
              icon: '＋',
              tone: 'gold',
            },
          ]}
        />
        <PageTips
          title="Assignment tips"
          items={[
            'Students only see universities you share with them.',
            'Add options to the catalog first, then assign per student.',
            'Required documents on a university guide student uploads.',
          ]}
        />

        <div className="org-layout">
          <section className="panel">
            <h2>Shared with this student</h2>
            <div className="stack-list">
              {(assignedQuery.data ?? []).map((university) => (
                <div key={university.id} className="stack-item org-member">
                  <div>
                    <strong>{university.name}</strong>
                    <span>
                      {[university.city, university.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn danger"
                    onClick={() => removeAssignment.mutate(university.id)}>
                    Remove
                  </button>
                </div>
              ))}
              {!assignedQuery.isLoading && (assignedQuery.data ?? []).length === 0 ? (
                <p className="muted">No universities shared yet. Assign one below.</p>
              ) : null}
            </div>

            <form className="org-form" onSubmit={onAssign} style={{ marginTop: 18 }}>
              <h2>Share a university</h2>
              <label className="field">
                <span>From catalog</span>
                <select value={assignId} onChange={(event) => setAssignId(event.target.value)} required>
                  <option value="">Select university</option>
                  {availableToAssign.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Note for student (optional)</span>
                <input
                  value={assignNotes}
                  onChange={(event) => setAssignNotes(event.target.value)}
                  placeholder="Why this option fits…"
                />
              </label>
              <button className="primary-btn" type="submit" disabled={assignUniversity.isPending}>
                Share with student
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="dept-student-banner" style={{ padding: 0, boxShadow: 'none', background: 'transparent' }}>
              <h2 style={{ margin: 0 }}>Catalog</h2>
              <button type="button" className="ghost-btn" onClick={() => setShowCatalog((v) => !v)}>
                {showCatalog ? 'Hide catalog form' : 'Add to catalog'}
              </button>
            </div>
            <p className="muted">Build the master list, then share options with each student.</p>

            {showCatalog ? (
              <form className="org-form" onSubmit={onCreate}>
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
                  Add university
                </button>
              </form>
            ) : null}

            <div className="stack-list" style={{ marginTop: 16 }}>
              {(catalogQuery.data ?? []).map((university) => (
                <div key={university.id} className="stack-item">
                  <div>
                    <strong>{university.name}</strong>
                    <span>
                      {[university.city, university.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DepartmentStudentGate>
    </AppShell>
  );
}
