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
        ···
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

type TipProps = {
  title: string;
  items: string[];
};

export function PageTips(_props: TipProps) {
  return null;
}

export type PageStatTone = 'purple' | 'blue' | 'gold' | 'coral' | 'teal' | 'lilac';

export type PageStatItem = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
  tone?: PageStatTone;
};

export function PageStats({ items }: { items: PageStatItem[] }) {
  return (
    <div className={`dash-metric-grid${items.length === 3 ? ' dash-metric-grid-3' : ''}`}>
      {items.map((item) => (
        <div key={item.label} className="dash-metric panel">
          {item.icon ? (
            <span className={`dash-metric-icon ${item.tone ?? 'purple'}`}>{item.icon}</span>
          ) : null}
          <span className="dash-metric-label">{item.label}</span>
          <strong className="dash-metric-value">{item.value}</strong>
          {item.hint ? <span className="dash-metric-hint">{item.hint}</span> : null}
        </div>
      ))}
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
            style={{ width: loading ? '0%' : `${clamped}%` }}
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
