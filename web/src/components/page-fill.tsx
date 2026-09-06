import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type EmptyProps = {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
};

export function PageEmpty({ title, body, actionLabel, actionTo }: EmptyProps) {
  return (
    <div className="page-empty panel">
      <div className="page-empty-mark" aria-hidden>
        FC
      </div>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {actionLabel && actionTo ? (
        <Link className="primary-btn page-empty-action" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

type SplitProps = {
  main: ReactNode;
  side: ReactNode;
};

export function PageSplit({ main, side }: SplitProps) {
  return (
    <div className="page-split">
      <div className="page-split-main">{main}</div>
      <aside className="page-split-side">{side}</aside>
    </div>
  );
}

type SectionProgressProps = {
  title: string;
  description?: string;
  percent: number;
  loading?: boolean;
};

export function SectionProgress({
  title,
  description,
  percent,
  loading = false,
}: SectionProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const complete = !loading && clamped >= 100;

  return (
    <div className="profile-progress panel">
      <div className="profile-progress-copy">
        <strong>{loading ? 'Loading…' : title}</strong>
        {description ? <span>{loading ? 'Fetching section details' : description}</span> : null}
      </div>
      <div className="profile-progress-meter" aria-hidden={loading}>
        <div className="profile-progress-track">
          <div
            className={`profile-progress-fill${complete ? ' is-complete' : ''}`}
            style={{
              width: loading ? '0%' : `${clamped}%`,
              ['--progress' as string]: Math.max(clamped, 1),
            }}
          />
        </div>
        <span className="profile-progress-pct">{loading ? '…' : `${clamped}%`}</span>
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
};

export function PageSection({ title, subtitle, children, action }: SectionProps) {
  return (
    <section className="page-section">
      <div className="page-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
