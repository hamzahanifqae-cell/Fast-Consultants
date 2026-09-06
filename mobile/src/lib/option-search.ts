/** Normalize for search: lowercase, strip accents, drop leading emoji/flags. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // Drop leading symbols/emoji/flags so "🇵🇰 Pakistan" searches as "pakistan".
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
    .toLowerCase();
}

export type SearchableFields = {
  label: string;
  value: string;
  prefix?: string;
};

/**
 * Match a typed query against an option.
 * Prefer names that start with the query (first-letter / prefix search).
 */
export function optionMatchesQuery(option: SearchableFields, rawQuery: string): boolean {
  const needle = normalizeSearchText(rawQuery);
  if (!needle) return true;

  const fields = [option.value, option.label, option.prefix ?? '']
    .map(normalizeSearchText)
    .filter(Boolean);

  return fields.some((field) => {
    if (field.startsWith(needle) || field.includes(needle)) return true;
    return field.split(/[\s/,()-]+/).some((part) => part.startsWith(needle));
  });
}

/** Rank starts-with matches ahead of mid-string matches. */
export function compareSearchMatch(a: SearchableFields, b: SearchableFields, rawQuery: string): number {
  const needle = normalizeSearchText(rawQuery);
  if (!needle) return 0;

  const score = (option: SearchableFields) => {
    const value = normalizeSearchText(option.value);
    const label = normalizeSearchText(option.label);
    if (value.startsWith(needle) || label.startsWith(needle)) return 0;
    if (value.split(/[\s/,()-]+/).some((part) => part.startsWith(needle))) return 1;
    if (label.split(/[\s/,()-]+/).some((part) => part.startsWith(needle))) return 1;
    return 2;
  };

  return score(a) - score(b);
}
