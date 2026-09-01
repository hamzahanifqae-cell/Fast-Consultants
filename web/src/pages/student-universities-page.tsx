import { useQuery } from '@tanstack/react-query';

import { PageEmpty, PageTips, SectionProgress } from '@/components/page-fill';
import { AppShell } from '@/components/shell';
import { api } from '@/lib/api';
import type { University } from '@/types/auth';
import './dashboard.css';

export function StudentUniversitiesPage() {
  const universitiesQuery = useQuery({
    queryKey: ['student-universities'],
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/student/universities');
      return data.data;
    },
  });

  const list = universitiesQuery.data ?? [];
  const requiredCount = list.reduce(
    (sum, university) => sum + (university.required_documents?.length ?? 0),
    0,
  );
  const universitiesProgress =
    list.length === 0
      ? {
          percent: 0,
          title: 'Universities incomplete',
          description: 'Waiting for staff to share university options.',
        }
      : {
          percent: 100,
          title: 'Universities shared',
          description: `${list.length} option${list.length === 1 ? '' : 's'}, ${requiredCount} required document${requiredCount === 1 ? '' : 's'} listed.`,
        };

  return (
    <AppShell
      badge="Student"
      title="Universities">
      <div className="page-stack">
        <SectionProgress
          loading={universitiesQuery.isLoading}
          title={universitiesProgress.title}
          percent={universitiesProgress.percent}
        />

        {!universitiesQuery.isLoading && list.length === 0 ? (
          <PageEmpty
            title="No universities yet"
          />
        ) : null}

        <div className="stack-list">
          {universitiesQuery.isLoading ? <p className="muted">Loading universities…</p> : null}
          {list.map((university) => (
            <div key={university.id} className="panel">
              <h2>{university.name}</h2>
              <p>
                {[university.city, university.country].filter(Boolean).join(', ') || 'University'}
              </p>
              {university.description ? <p>{university.description}</p> : null}
              <div className="stack-list" style={{ marginTop: 12 }}>
                {(university.required_documents ?? []).map((doc) => (
                  <div key={doc.type} className="stack-item">
                    <div>
                      <strong>{doc.label}</strong>
                      <span>Required for this university</span>
                    </div>
                  </div>
                ))}
                {(university.required_documents ?? []).length === 0 ? (
                  <p className="muted">No extra document list attached.</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <PageTips
          title="Reading this list"
          items={[
            'Only universities assigned to you are shown, not the full catalog.',
            'Required documents may differ by university.',
            'Message Universities if you need clarification on an option.',
          ]}
        />
      </div>
    </AppShell>
  );
}
