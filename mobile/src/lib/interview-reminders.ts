import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SCHEDULED_PREFIX = 'interview-reminder';

type NotificationsModule = typeof import('expo-notifications');

let handlerConfigured = false;

function canUseLocalNotifications(): boolean {
  // Push/local notification APIs were removed from Expo Go on Android (SDK 53+).
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    return false;
  }

  return true;
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!canUseLocalNotifications()) {
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerConfigured = true;
    }

    return Notifications;
  } catch {
    return null;
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Clears old local reminders. In-app alarm only beeps when the meeting timer runs out. */
export async function syncInterviewLocalReminders(interviewAt: string | null): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return;
  }

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((item) => item.identifier.startsWith(SCHEDULED_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );

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
