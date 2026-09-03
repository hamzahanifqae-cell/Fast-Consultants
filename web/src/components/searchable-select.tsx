import { useEffect, useId, useMemo, useRef, useState } from 'react';

import './searchable-select.css';

export type SearchableOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  /** When false, opens as a simple dropdown without a search box. */
  searchable?: boolean;
  onChange: (value: string) => void;
};

export function SearchableSelect({
  value,
  options,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  disabled = false,
  emptyMessage = 'No matches',
  searchable = true,
  onChange,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  function toggle() {
    if (disabled) return;
    setOpen((current) => {
      const next = !current;
      if (!next) setQuery('');
      return next;
    });
  }

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={`searchable-select${open ? ' open' : ''}${disabled ? ' disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="searchable-select-trigger"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={toggle}>
        <span className={selected ? 'searchable-select-value' : 'searchable-select-placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <span className="searchable-select-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="searchable-select-panel" id={listId} role="listbox">
          {searchable ? (
            <div className="searchable-select-search">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </div>
          ) : null}
          <div className="searchable-select-list">
            {filtered.length ? (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`searchable-select-option${
                    option.value === value ? ' selected' : ''
                  }`}
                  onClick={() => choose(option.value)}>
                  {option.label}
                </button>
              ))
            ) : (
              <p className="searchable-select-empty">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
