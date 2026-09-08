import type { FormTemplateAssignment, FormTemplateField } from '@/types/auth';

function answerValue(
  item: FormTemplateAssignment,
  field: FormTemplateField,
): string {
  const value = item.answers?.[field.key];
  if (field.type === 'checkbox') {
    return value === true || value === '1' || value === 'true' ? 'Yes' : 'No';
  }
  if (value == null || value === '') return '—';
  return String(value);
}

function statusPillClass(status: FormTemplateAssignment['status']): string {
  if (status === 'approved') return ' success';
  if (status === 'rejected') return ' danger';
  if (status === 'awaiting_student') return ' warn';
  return '';
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type Props = {
  item: FormTemplateAssignment;
  showHeader?: boolean;
  className?: string;
};

export function SponsorshipLetterDocument({
  item,
  showHeader = true,
  className = '',
}: Props) {
  const detailFields = item.fields.filter((field) => field.type !== 'checkbox');
  const declarationField = item.fields.find((field) => field.type === 'checkbox');
  const declared =
    declarationField != null && answerValue(item, declarationField) === 'Yes';
  const reviewed = formatDate(item.reviewed_at);
  const created = formatDate(item.created_at);

  return (
    <article className={`sponsorship-doc ${className}`.trim()}>
      {showHeader ? (
        <header className="sponsorship-doc-header">
          <div>
            <p className="sponsorship-doc-kicker">Financial sponsorship</p>
            <h3>{item.title}</h3>
          </div>
          <span className={`status-pill${statusPillClass(item.status)}`}>
            {item.status_label}
          </span>
        </header>
      ) : null}

      <div className="sponsorship-doc-body">
        <p className="sponsorship-doc-intro">
          The following sponsor details were submitted for this student&apos;s application.
        </p>

        <dl className="sponsorship-doc-fields">
          {detailFields.map((field) => (
            <div key={field.key} className="sponsorship-doc-row">
              <dt>{field.label}</dt>
              <dd>{answerValue(item, field)}</dd>
            </div>
          ))}
        </dl>

        {declarationField ? (
          <div className={`sponsorship-doc-declaration${declared ? ' is-confirmed' : ''}`}>
            <span className="sponsorship-doc-declaration-mark" aria-hidden>
              {declared ? '✓' : '—'}
            </span>
            <div>
              <strong>{declared ? 'Declaration confirmed' : 'Declaration not confirmed'}</strong>
              <p>{declarationField.label}</p>
            </div>
          </div>
        ) : null}
      </div>

      {(reviewed || created) && (
        <footer className="sponsorship-doc-meta">
          {reviewed && item.status === 'approved' ? (
            <span>Approved {reviewed}</span>
          ) : null}
          {reviewed && item.status === 'rejected' ? (
            <span>Reviewed {reviewed}</span>
          ) : null}
          {created ? <span>Issued {created}</span> : null}
        </footer>
      )}
    </article>
  );
}
