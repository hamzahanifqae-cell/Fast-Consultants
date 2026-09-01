import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { InlinePageLoader } from '@/components/app-loader';
import { PageEmpty } from '@/components/page-fill';
import {
  journeyProgressPalette,
  STUDENT_PROGRESS_SECTIONS,
  type StudentProgressRow,
} from '@/lib/student-progress';

type ProgressFilter = 'all' | 'behind' | 'on_track' | 'complete';

type Props = {
  students: StudentProgressRow[];
  loading?: boolean;
  studentHref: (id: number) => string;
  viewAllHref?: string;
  onSelectedStudentChange?: (studentId: number | null) => void;
};

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

export function StudentProgressReport({
  students,
  loading = false,
  studentHref,
  viewAllHref,
  onSelectedStudentChange,
}: Props) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const statuses = useMemo(() => {
    const unique = Array.from(new Set(students.map((student) => student.current_status))).sort();
    return unique;
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

  useEffect(() => {
    onSelectedStudentChange?.(selected?.id ?? null);
  }, [onSelectedStudentChange, selected?.id]);

  if (loading) {
    return (
      <div className="panel student-progress-report">
        <InlinePageLoader message="Loading student progress report…" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="panel student-progress-report">
        <PageEmpty title="No students yet" />
      </div>
    );
  }

  return (
    <div className="panel student-progress-report">
      <div className="student-progress-report-head">
        <div>
          <span className="student-progress-report-eyebrow">Student progress report</span>
          <h2>Journey overview</h2>
        </div>
        {viewAllHref ? (
          <Link className="text-link-btn" to={viewAllHref}>
            View all students
          </Link>
        ) : null}
      </div>

      <div className="student-progress-filters">
        <label className="student-progress-control">
          <span>Student</span>
          <select
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(Number(event.target.value) || null)}
            disabled={filtered.length === 0}>
            {filtered.length === 0 ? <option value="">No students match</option> : null}
            {filtered.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>

        <label className="student-progress-control">
          <span>Stage</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All stages</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="student-progress-control">
          <span>Progress</span>
          <select
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)}>
            <option value="all">All progress</option>
            <option value="behind">Behind (&lt; 50%)</option>
            <option value="on_track">On track (50 to 99%)</option>
            <option value="complete">Complete (100%)</option>
          </select>
        </label>
      </div>

      {!selected ? (
        <PageEmpty title="No students match these filters" />
      ) : (
        <div className="student-progress-report-body">
          <div className="student-progress-report-identity">
            <span className="dash-activity-avatar info">{initials(selected.name)}</span>
            <div className="student-progress-card-copy">
              <strong>{selected.name}</strong>
              <span title={selected.email}>{selected.email}</span>
            </div>
            <div className="student-progress-overall">
              <strong>{selected.overall_percent}%</strong>
              <span className="status-pill">{selected.current_status}</span>
            </div>
          </div>

          <div
            className="student-progress-overall-bar student-progress-overall-bar-lg"
            style={{ background: overallPalette!.track }}>
            <div
              className="student-progress-overall-fill"
              style={{
                width: `${Math.max(selected.overall_percent, selected.overall_percent > 0 ? 6 : 0)}%`,
                background: overallPalette!.fillGradient,
              }}
            />
            <span className="student-progress-overall-label">
              Overall journey, {selected.overall_percent}%
            </span>
          </div>

          <div className="student-progress-report-grid">
            {STUDENT_PROGRESS_SECTIONS.map((section) => {
              const progress = selected.sections[section.key];
              const percent = progress?.percent ?? 0;

              return (
                <div
                  key={section.key}
                  className="student-progress-report-section"
                  style={{ ['--section-accent' as string]: section.color }}>
                  <div className="student-progress-section-label">
                    <span>{section.label}</span>
                    <span>{percent}%</span>
                  </div>
                  <div
                    className="student-progress-section-track student-progress-section-track-lg"
                    style={{ background: withAlpha(section.color, '88') }}>
                    <div
                      className="student-progress-section-fill"
                      style={{
                        width: `${Math.max(percent, percent > 0 ? 8 : 0)}%`,
                        background: section.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="student-progress-report-actions">
            <Link className="primary-btn" to={studentHref(selected.id)}>
              Open student profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
