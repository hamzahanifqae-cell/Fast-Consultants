/** First name for greetings; falls back when the profile name is missing. */
export function displayFirstName(fullName: string | null | undefined): string {
  const part = fullName?.trim().split(/\s+/).filter(Boolean)[0];
  return part || 'there';
}

export function timeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Local date + time shown under every home greeting. */
export function welcomeTimestamp(now = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
}

/** e.g. "Good afternoon, Ayesha" — uses first name only. */
export function welcomeTitle(fullName: string | null | undefined, now = new Date()): string {
  return `${timeOfDayGreeting(now)}, ${displayFirstName(fullName)}`;
}

/** e.g. "Good afternoon, Super Admin" — keeps the full role label. */
export function welcomeRoleTitle(roleLabel: string, now = new Date()): string {
  return `${timeOfDayGreeting(now)}, ${roleLabel.trim() || 'there'}`;
}
