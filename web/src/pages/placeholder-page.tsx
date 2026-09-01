import { AppShell } from '@/components/shell';
import './dashboard.css';

type PlaceholderProps = {
  badge: string;
  title: string;
  subtitle: string;
  body: string;
};

export function PlaceholderPage({ badge, title, subtitle, body }: PlaceholderProps) {
  return (
    <AppShell badge={badge} title={title} subtitle={subtitle}>
      <div className="panel">
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
    </AppShell>
  );
}
