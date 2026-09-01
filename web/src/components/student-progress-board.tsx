import { Link } from 'react-router-dom';

import { PageEmpty } from '@/components/page-fill';
import {
  journeyProgressPalette,
  STUDENT_PROGRESS_SECTIONS,
  type StudentProgressRow,
} from '@/lib/student-progress';

type Props = {
  students: StudentProgressRow[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  studentHref: (id: number) => string;
  limit?: number;
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

export function StudentProgressBoard({
  students,
  loading = false,
  emptyTitle = 'No students yet',
  emptyBody,
  studentHref,
  limit,
}: Props) {
  const rows = typeof limit === 'number' ? students.slice(0, limit) : students;

  if (loading) {
    return <p className="muted">Loading student progress…</p>;
  }

  if (rows.length === 0) {
    return <PageEmpty title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="student-progress-board">
      {rows.map((student) => {
        const overallPalette = journeyProgressPalette(student.overall_percent);

        return (
        <Link
          key={student.id}
          className="student-progress-card"
          to={studentHref(student.id)}
          title={student.email}>
          <div className="student-progress-card-top">
            <span className="dash-activity-avatar info">{initials(student.name)}</span>
            <div className="student-progress-card-copy">
              <strong>{student.name}</strong>
              <span>{student.email}</span>
            </div>
            <div className="student-progress-overall">
              <strong>{student.overall_percent}%</strong>
              <span>{student.current_status}</span>
            </div>
          </div>

          <div
            className="student-progress-overall-bar"
            style={{ background: overallPalette.track }}>
            <div
              className="student-progress-overall-fill"
              style={{
                width: `${Math.max(student.overall_percent, student.overall_percent > 0 ? 6 : 0)}%`,
                background: overallPalette.fillGradient,
              }}
            />
          </div>

          <div className="student-progress-sections">
            {STUDENT_PROGRESS_SECTIONS.map((section) => {
              const progress = student.sections[section.key];
              const percent = progress?.percent ?? 0;

              return (
                <div key={section.key} className="student-progress-section" title={progress?.report}>
                  <div className="student-progress-section-label">
                    <span>{section.label}</span>
                    <span>{percent}%</span>
                  </div>
                  <div
                    className="student-progress-section-track"
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
        </Link>
        );
      })}
    </div>
  );
}
