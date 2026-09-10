/**
 * Convert an ISO instant to a value for `<input type="datetime-local">` (local wall clock).
 * Do not use `toISOString().slice(0, 16)` — that fills UTC into a local control.
 */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

/**
 * Convert a datetime-local (or "YYYY-MM-DD HH:mm") local string to UTC ISO.
 */
export function fromDateTimeLocalValue(local: string): string {
  const normalized = local.trim().replace(' ', 'T');
  const [datePart, timePart = '00:00'] = normalized.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes = 0, seconds = 0] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds || 0, 0).toISOString();
}
