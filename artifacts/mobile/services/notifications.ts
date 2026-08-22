/**
 * notifications.ts — Local push notification scheduling for injection reminders.
 * Native-only (iOS/Android). All functions are no-ops on web.
 *
 * iOS limits 64 pending local notifications per app; we schedule at most
 * MAX_PER_CYCLE upcoming events per cycle to leave room for multiple cycles.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null | undefined;

/**
 * Expo Go on Android removed remote push notification support in SDK 53.
 * The module logs an ERROR at load time in that environment, so skip the
 * import entirely when running inside Expo Go. Local notification scheduling
 * (dose reminders) continues to work in development builds and production.
 */
async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (notificationsModule !== undefined) return notificationsModule;

  // Guard: expo-notifications triggers DevicePushTokenAutoRegistration on load,
  // which throws on Android Expo Go. Bail out before the import to keep the
  // app error-free in that environment.
  //
  // Constants.executionEnvironment is the supported detection API (appOwnership
  // is deprecated). In Expo Go the value is 'storeClient'; EAS development and
  // production builds both report 'bare'.
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  if (isExpoGo && Platform.OS === 'android') {
    notificationsModule = null;
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowList: true,
      }),
    });
    notificationsModule = Notifications;
  } catch {
    notificationsModule = null;
  }

  return notificationsModule;
}

const NOTIF_MAP_KEY = '@peptidetracker/notif_ids';
const MAX_PER_CYCLE = 20; // stay well under iOS 64 limit

type NotificationPermissions = Awaited<
  ReturnType<NotificationsModule['getPermissionsAsync']>
>;

function hasNotificationPermission(
  Notifications: NotificationsModule,
  permissions: NotificationPermissions,
): boolean {
  if (Platform.OS === 'ios') {
    const status = permissions.ios?.status;
    return (
      status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }

  return (permissions.android?.importance ?? 0) > 0;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const existing = await Notifications.getPermissionsAsync();
  if (hasNotificationPermission(Notifications, existing)) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return hasNotificationPermission(Notifications, requested);
}

// ─── AsyncStorage map: cycleId → scheduled notification IDs ──────────────────

async function loadMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export interface NotifEvent {
  scheduledAt: string;        // ISO datetime string
  plannedDose: string;
  plannedDoseUnit: string;
  plannedSyringeUnits: string;
}

/**
 * Cancel any previously scheduled notifications for this cycle, then schedule
 * the next MAX_PER_CYCLE future injection events as local notifications.
 */
export async function scheduleCycleNotifications(
  cycleId: string,
  cycleName: string,
  events: NotifEvent[],
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  // Always cancel old ones first so we don't double-schedule on updates
  await cancelCycleNotifications(cycleId);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.scheduledAt) > now)
    .slice(0, MAX_PER_CYCLE);

  if (upcoming.length === 0) return;

  const ids: string[] = [];

  for (const event of upcoming) {
    const triggerDate = new Date(event.scheduledAt);
    const dose = `${event.plannedDose} ${event.plannedDoseUnit}`;
    const units = parseFloat(event.plannedSyringeUnits).toFixed(1);

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💉 Injection Time',
          body: `${cycleName} — ${dose} (${units} units)`,
          sound: true,
          data: { cycleId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      ids.push(id);
    } catch {
      // Silently skip events that can't be scheduled (e.g. trigger in the past)
    }
  }

  if (ids.length > 0) {
    const map = await loadMap();
    map[cycleId] = ids;
    await saveMap(map);
  }
}

// ─── Cancellation ─────────────────────────────────────────────────────────────

/**
 * Cancel all pending local notifications for a cycle (on delete/pause/archive).
 */
export async function cancelCycleNotifications(cycleId: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const map = await loadMap();
  const ids = map[cycleId] ?? [];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
    ),
  );
  delete map[cycleId];
  await saveMap(map);
}
