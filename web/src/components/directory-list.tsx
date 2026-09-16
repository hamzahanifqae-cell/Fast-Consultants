import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { PageEmpty } from '@/components/page-fill';

export type DirectoryListItem = {
  id: string | number;
  title: string;
  subtitle?: string | null;
  /** Extra text included in search matching (not shown). */
  searchText?: string | null;
  actionLabel?: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: ReactNode;
};

type DirectoryListProps = {
  title: string;
  description?: string;
  countLabel?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
  primaryColumn?: string;
  secondaryColumn?: string;
  items: DirectoryListItem[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  headerAction?: ReactNode;
  /** When false, render table only (no outer panel/header). Default true. */
  framed?: boolean;
  className?: string;
};

export function directoryInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function matchesQuery(item: DirectoryListItem, needle: string): boolean {
  if (!needle) return true;
  const haystack = [item.title, item.subtitle ?? '', item.searchText ?? '']
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function DirectoryList({
  title,
  description,
  countLabel,
  searchPlaceholder = 'Search by name or email',
  searchLabel = 'Search',
  primaryColumn = 'Student',
  secondaryColumn = 'Email',
  items,
  loading = false,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  headerAction,
  framed = true,
  className = '',
}: DirectoryListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => matchesQuery(item, needle));
  }, [items, query]);

  const table = (
    <>
      <label className="dept-directory-search field">
        <span className="sr-only">{searchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
        />
      </label>

      <div className="dept-directory-table" role="list">
        <div className="dept-directory-table-head" aria-hidden>
          <span>{primaryColumn}</span>
          <span>{secondaryColumn}</span>
          <span />
        </div>

        {loading ? <p className="muted dept-directory-status">Loading…</p> : null}

        {!loading
          ? filtered.map((item) => {
              const body = (
                <>
                  <span className="dept-directory-identity">
                    <span className="dept-directory-avatar" aria-hidden>
                      {directoryInitials(item.title)}
                    </span>
                    <span className="dept-directory-name">{item.title}</span>
                  </span>
                  <span className="dept-directory-email">{item.subtitle || '—'}</span>
                  <span className="dept-directory-action">
                    {item.badge ?? item.actionLabel ?? 'Open'}
                  </span>
                </>
              );

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    role="listitem"
                    className={`dept-directory-row${item.active ? ' is-active' : ''}`}
                    onClick={item.onClick}>
                    {body}
                  </Link>
                );
              }

              if (item.onClick) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={`dept-directory-row${item.active ? ' is-active' : ''}`}
                    onClick={item.onClick}>
                    {body}
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  role="listitem"
                  className={`dept-directory-row is-static${item.active ? ' is-active' : ''}`}>
                  {body}
                </div>
              );
            })
          : null}

        {!loading && items.length === 0 ? (
          <PageEmpty title={emptyTitle} body={emptyBody} />
        ) : null}

        {!loading && items.length > 0 && filtered.length === 0 ? (
          <p className="muted dept-directory-status">No results match “{query.trim()}”.</p>
        ) : null}
      </div>
    </>
  );

  if (!framed) {
    return <div className={`dept-directory dept-directory-embed ${className}`.trim()}>{table}</div>;
  }

  return (
    <section className={`panel dept-directory ${className}`.trim()}>
      <header className="dept-directory-header">
        <div className="dept-directory-heading">
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        <div className="dept-directory-meta">
          {countLabel ? <span className="dept-directory-count">{countLabel}</span> : null}
          {headerAction}
        </div>
      </header>
      {table}
    </section>
  );
}
