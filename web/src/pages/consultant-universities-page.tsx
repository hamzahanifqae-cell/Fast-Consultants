import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { DepartmentStudentGate } from '@/components/department-student-gate';
import { SearchableSelect } from '@/components/searchable-select';
import { AppShell } from '@/components/shell';
import { useDepartmentStudentParam } from '@/hooks/use-department-student-param';
import { handoffLockMessage, useStudentHandoff } from '@/hooks/use-student-handoff';
import { api, getApiErrorMessage } from '@/lib/api';
import { departmentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';
import type { University } from '@/types/auth';
import './dashboard.css';

export function ConsultantUniversitiesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const portal = orgPortalForUser(user);
  const routes = departmentRoutes(portal);
  const { studentId, selectStudent, clearStudent } = useDepartmentStudentParam();
  const [assignId, setAssignId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const handoffQuery = useStudentHandoff(studentId);
  const shareLock = handoffLockMessage(handoffQuery.data, 'universities');

  const assignedIds = useMemo(
    () => new Set((assignedQuery.data ?? []).map((item) => item.id)),
    [assignedQuery.data],
  );

  const availableToAssign = useMemo(
    () => (catalogQuery.data ?? []).filter((item) => !assignedIds.has(item.id)),
    [catalogQuery.data, assignedIds],
  );
  const assignOptions = useMemo(
    () =>
      availableToAssign.map((university) => ({
        value: String(university.id),
        label: university.name,
      })),
    [availableToAssign],
  );

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

  function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!assignId) {
      setError('Choose a university to share.');
      return;
    }
    assignUniversity.mutate();
  }

  return (
    <AppShell
      badge="Universities"
      title="Share with students"
      backTo={routes.universities.root}
      backLabel="Universities">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link className="text-link-btn" to={routes.universities.catalog}>
          Open catalog
        </Link>
      </p>

      {error ? <p className="form-error">{error}</p> : null}

      <DepartmentStudentGate
        selectedId={studentId}
        onSelect={selectStudent}
        onClear={() => {
          clearStudent();
          setError(null);
        }}>
        <section className="panel">
          <h2>Shared with this student</h2>
          <div className="stack-list">
            {(assignedQuery.data ?? []).map((university) => (
              <div key={university.id} className="stack-item org-member">
                <div>
                  <strong>{university.name}</strong>
                  <span>{[university.city, university.country].filter(Boolean).join(', ')}</span>
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
            {shareLock ? <p className="handoff-lock">{shareLock}</p> : null}
            <label className="field">
              <span>From catalog</span>
              <SearchableSelect
                value={assignId}
                options={assignOptions}
                placeholder="Select university"
                searchPlaceholder="Search university"
                emptyMessage="No universities match your search"
                onChange={setAssignId}
              />
            </label>
            <label className="field">
              <span>Note for student (optional)</span>
              <input
                value={assignNotes}
                onChange={(event) => setAssignNotes(event.target.value)}
                placeholder="Why this option fits…"
              />
            </label>
            <button
              className="primary-btn"
              type="submit"
              disabled={assignUniversity.isPending || Boolean(shareLock)}>
              Share with student
            </button>
          </form>
        </section>
      </DepartmentStudentGate>
    </AppShell>
  );
}
