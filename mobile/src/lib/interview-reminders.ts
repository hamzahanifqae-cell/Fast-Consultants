/** Local push reminders are disabled until Firebase/FCM is configured for production. */

export async function ensureNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function syncInterviewLocalReminders(interviewAt: string | null): Promise<void> {
  void interviewAt;
}

export function isInterviewAlarmType(type: string | null | undefined): boolean {
  return Boolean(
    type &&
      (type === 'interview_scheduled' ||
        type === 'interview_reminder' ||
        type === 'interview_reminder_urgent' ||
        type === 'interview_starting'),
  );
}
