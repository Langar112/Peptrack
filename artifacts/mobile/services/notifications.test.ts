/**
 * notifications.test.ts
 *
 * Verifies that:
 *   1. The Expo Go guard does NOT suppress notifications in a real Android build
 *      (executionEnvironment !== 'storeClient').
 *   2. scheduleNotificationAsync is called with the correct trigger type (DATE)
 *      and content when scheduling cycle reminders on Android EAS builds.
 *   3. The guard DOES suppress notifications specifically on Android Expo Go
 *      (executionEnvironment === 'storeClient') to avoid the
 *      DevicePushTokenAutoRegistration error.
 *   4. requestNotificationPermissions returns true when Android permissions
 *      are granted.
 *   5. cancelCycleNotifications cancels each stored notification ID.
 *
 * Detection API: Constants.executionEnvironment
 *   - 'bare'        EAS development builds and EAS production builds
 *   - 'storeClient' Expo Go (the Expo client app)
 *   - 'standalone'  Classic (pre-EAS) standalone builds (legacy)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Shared mock state ─────────────────────────────────────────────────────────

const mockScheduleNotificationAsync = vi.fn().mockResolvedValue('notif-id-1');
const mockCancelScheduledNotificationAsync = vi.fn().mockResolvedValue(undefined);
const mockSetNotificationHandler = vi.fn();
const mockAddNotificationResponseReceivedListener = vi.fn().mockReturnValue({
  remove: vi.fn(),
});
const mockGetPermissionsAsync = vi.fn();
const mockRequestPermissionsAsync = vi.fn();

const mockAsyncStorageGetItem = vi.fn().mockResolvedValue(null);
const mockAsyncStorageSetItem = vi.fn().mockResolvedValue(undefined);
let notificationImportFailures = 0;

// ── Module factory helper ─────────────────────────────────────────────────────

/**
 * Register module mocks for a given scenario, then import the module under
 * test fresh. vi.resetModules() must be called first so the module-level
 * `notificationsModule` cache is cleared between tests.
 */
async function importNotifications(opts: {
  platformOS: 'android' | 'ios' | 'web';
  executionEnvironment: 'bare' | 'storeClient' | 'standalone';
  notificationImportFailures?: number;
}) {
  notificationImportFailures = opts.notificationImportFailures ?? 0;

  vi.doMock('react-native', () => ({
    Platform: { OS: opts.platformOS },
  }));

  vi.doMock('expo-constants', () => ({
    default: { executionEnvironment: opts.executionEnvironment },
  }));

  vi.doMock('expo-notifications', () => {
    if (notificationImportFailures > 0) {
      notificationImportFailures -= 1;
      throw new Error('transient notification module load failure');
    }

    return {
      setNotificationHandler: mockSetNotificationHandler,
      addNotificationResponseReceivedListener:
        mockAddNotificationResponseReceivedListener,
      scheduleNotificationAsync: mockScheduleNotificationAsync,
      cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
      getPermissionsAsync: mockGetPermissionsAsync,
      requestPermissionsAsync: mockRequestPermissionsAsync,
      // Trigger type enum used by scheduleCycleNotifications
      SchedulableTriggerInputTypes: { DATE: 'date' },
      IosAuthorizationStatus: { AUTHORIZED: 3, PROVISIONAL: 2 },
    };
  });

  vi.doMock('@react-native-async-storage/async-storage', () => ({
    default: {
      getItem: mockAsyncStorageGetItem,
      setItem: mockAsyncStorageSetItem,
    },
  }));

  // Dynamic import after mocks are registered so the fresh module picks them up.
  return import('./notifications');
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear the module registry so the cached `notificationsModule` variable is
  // reset to `undefined` before each test.
  vi.resetModules();
  vi.clearAllMocks();
  mockAsyncStorageGetItem.mockResolvedValue(null);
  notificationImportFailures = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A future event well past "now" so it passes the upcoming-events filter. */
function futureEvent(offsetMs = 60_000) {
  return {
    scheduledAt: new Date(Date.now() + offsetMs).toISOString(),
    plannedDose: '250',
    plannedDoseUnit: 'mcg',
    plannedSyringeUnits: '10',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. EAS production / development builds on Android (executionEnvironment = 'bare')
//    This is the environment produced by `eas build` for all non-Expo-Go builds.
// ═════════════════════════════════════════════════════════════════════════════

describe('Android EAS build (executionEnvironment = "bare")', () => {
  it('schedules a notification with a DATE trigger for each future event', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    const event = futureEvent();
    await scheduleCycleNotifications('cycle-1', 'Test Cycle', [event]);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledOnce();

    const [call] = mockScheduleNotificationAsync.mock.calls;
    const { content, trigger } = call[0] as {
      content: Record<string, unknown>;
      trigger: { type: string; date: Date };
    };

    // Trigger must be a DATE type pointing at the event's scheduledAt time
    expect(trigger.type).toBe('date');
    expect(trigger.date).toBeInstanceOf(Date);
    expect(trigger.date.toISOString()).toBe(event.scheduledAt);

    // Notification content must mention the cycle name and dose
    expect(content.title).toContain('Injection Time');
    expect(content.body).toContain('Test Cycle');
    expect(content.body).toContain('250 mcg');
    expect(content.data).toMatchObject({ cycleId: 'cycle-1' });
    expect(content.sound).toBe(true);
  });

  it('stores the returned notification ID in AsyncStorage', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    mockScheduleNotificationAsync.mockResolvedValue('stored-id');

    await scheduleCycleNotifications('cycle-2', 'My Cycle', [futureEvent()]);

    expect(mockAsyncStorageSetItem).toHaveBeenCalled();
    const [, storedJson] = mockAsyncStorageSetItem.mock.calls.at(-1) as [string, string];
    const map = JSON.parse(storedJson) as Record<string, string[]>;
    expect(map['cycle-2']).toContain('stored-id');
  });

  it('limits scheduled notifications to MAX_PER_CYCLE (20)', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    const events = Array.from({ length: 30 }, (_, i) => futureEvent(i * 60_000 + 60_000));
    await scheduleCycleNotifications('cycle-3', 'Big Cycle', events);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(20);
  });

  it('skips past events and does not schedule them', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    const pastEvent = {
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      plannedDose: '100',
      plannedDoseUnit: 'mcg',
      plannedSyringeUnits: '5',
    };

    await scheduleCycleNotifications('cycle-4', 'Past Cycle', [pastEvent]);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('initialises the notification handler when the module is first loaded', async () => {
    const { requestNotificationPermissions } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    mockGetPermissionsAsync.mockResolvedValue({ android: { importance: 4 } });
    await requestNotificationPermissions();

    expect(mockSetNotificationHandler).toHaveBeenCalledOnce();
  });

  it('retries a notification module import after a transient failure', async () => {
    const { requestNotificationPermissions } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
      notificationImportFailures: 1,
    });

    mockGetPermissionsAsync.mockResolvedValue({ android: { importance: 4 } });

    // The first call sees the transient import error and remains best effort.
    await expect(requestNotificationPermissions()).resolves.toBe(false);
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();

    // A later notification call retries instead of treating the module as
    // permanently unavailable.
    await expect(requestNotificationPermissions()).resolves.toBe(true);
    expect(mockGetPermissionsAsync).toHaveBeenCalledOnce();
    expect(mockSetNotificationHandler).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Legacy classic standalone build (executionEnvironment = 'standalone')
//    The guard must not fire here either — only 'storeClient' is suppressed.
// ═════════════════════════════════════════════════════════════════════════════

describe('Android legacy standalone build (executionEnvironment = "standalone")', () => {
  it('schedules notifications — guard does not block legacy standalone builds', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'standalone',
    });

    await scheduleCycleNotifications('cycle-legacy', 'Legacy Cycle', [futureEvent()]);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Expo Go on Android — guard must suppress to avoid startup errors
//    (executionEnvironment = 'storeClient')
// ═════════════════════════════════════════════════════════════════════════════

describe('Android Expo Go (executionEnvironment = "storeClient")', () => {
  it('returns without scheduling any notifications — guard is active', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'storeClient',
    });

    await scheduleCycleNotifications('cycle-go', 'Expo Go Cycle', [futureEvent()]);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('requestNotificationPermissions returns false — guard is active', async () => {
    const { requestNotificationPermissions } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'storeClient',
    });

    const granted = await requestNotificationPermissions();
    expect(granted).toBe(false);
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. iOS — guard is Android-only; notifications must work in Expo Go on iOS
//    (executionEnvironment = 'storeClient', platform = ios)
// ═════════════════════════════════════════════════════════════════════════════

describe('iOS Expo Go (executionEnvironment = "storeClient", platform = ios)', () => {
  it('schedules notifications — Expo Go guard only applies to Android', async () => {
    const { scheduleCycleNotifications } = await importNotifications({
      platformOS: 'ios',
      executionEnvironment: 'storeClient',
    });

    await scheduleCycleNotifications('cycle-ios', 'iOS Cycle', [futureEvent()]);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledOnce();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Permission handling on Android EAS builds
// ═════════════════════════════════════════════════════════════════════════════

describe('requestNotificationPermissions on Android EAS build', () => {
  it('returns true when permissions are already granted', async () => {
    const { requestNotificationPermissions } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    // importance > 0 means granted on Android
    mockGetPermissionsAsync.mockResolvedValue({ android: { importance: 4 } });

    const result = await requestNotificationPermissions();

    expect(result).toBe(true);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permissions when not yet granted and returns the result', async () => {
    const { requestNotificationPermissions } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    mockGetPermissionsAsync.mockResolvedValue({ android: { importance: 0 } });
    mockRequestPermissionsAsync.mockResolvedValue({ android: { importance: 3 } });

    const result = await requestNotificationPermissions();

    expect(mockRequestPermissionsAsync).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('returns false when the user denies permission', async () => {
    const { requestNotificationPermissions } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    mockGetPermissionsAsync.mockResolvedValue({ android: { importance: 0 } });
    mockRequestPermissionsAsync.mockResolvedValue({ android: { importance: 0 } });

    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Notification tap routing
// ═════════════════════════════════════════════════════════════════════════════

describe('notification response routing', () => {
  it('registers a listener and routes a dose reminder to its cycle', async () => {
    const {
      addNotificationResponseReceivedListener,
      routeNotificationResponse,
    } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    const navigate = vi.fn();
    const listener = (response: Parameters<typeof routeNotificationResponse>[0]) =>
      routeNotificationResponse(response, navigate);

    await addNotificationResponseReceivedListener(listener);

    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledOnce();

    const [registeredListener] =
      mockAddNotificationResponseReceivedListener.mock.calls[0] as [
        (response: Parameters<typeof routeNotificationResponse>[0]) => void,
      ];
    registeredListener({
      notification: {
        request: {
          content: {
            data: { cycleId: 'cycle-42' },
          },
        },
      },
    } as unknown as Parameters<typeof routeNotificationResponse>[0]);

    expect(navigate).toHaveBeenCalledWith('/cycle/cycle-42');
  });

  it('ignores responses without a cycle ID', async () => {
    const { routeNotificationResponse } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    const navigate = vi.fn();
    routeNotificationResponse(
      {
        notification: {
          request: {
            content: {
              data: {},
            },
          },
        },
      } as unknown as Parameters<typeof routeNotificationResponse>[0],
      navigate,
    );

    expect(navigate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Cancellation on Android EAS builds
// ═════════════════════════════════════════════════════════════════════════════

describe('cancelCycleNotifications on Android EAS build', () => {
  it('cancels each stored notification ID for the cycle', async () => {
    const { cancelCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ 'cycle-x': ['id-1', 'id-2'] }),
    );

    await cancelCycleNotifications('cycle-x');

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('id-1');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('id-2');
  });

  it('removes the cycle entry from the stored map after cancellation', async () => {
    const { cancelCycleNotifications } = await importNotifications({
      platformOS: 'android',
      executionEnvironment: 'bare',
    });

    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({ 'cycle-x': ['id-1'], 'cycle-y': ['id-2'] }),
    );

    await cancelCycleNotifications('cycle-x');

    const [, saved] = mockAsyncStorageSetItem.mock.calls.at(-1) as [string, string];
    const map = JSON.parse(saved) as Record<string, unknown>;
    expect(map).not.toHaveProperty('cycle-x');
    expect(map).toHaveProperty('cycle-y');
  });
});
