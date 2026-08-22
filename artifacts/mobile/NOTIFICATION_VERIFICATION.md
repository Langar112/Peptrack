# Dose Reminder Notification Verification

This document describes how to confirm that scheduled dose reminders fire correctly in a real Android build, and that the Expo Go guard does not accidentally suppress notifications outside of Expo Go.

---

## Static guard analysis

`artifacts/mobile/services/notifications.ts` contains the following guard inside `getNotifications()`:

```typescript
const isExpoGo = Constants.executionEnvironment === 'storeClient';
if (isExpoGo && Platform.OS === 'android') {
  notificationsModule = null;
  return null;
}
```

`Constants.executionEnvironment` is the supported detection API (`appOwnership` is deprecated since SDK 50+). Its values on native:

| Value | Environment |
|---|---|
| `'storeClient'` | Expo Go (the store client app) |
| `'bare'` | EAS development and production builds (bare workflow) |
| `'standalone'` | Classic pre-EAS standalone builds (legacy) |

The guard fires only when **both** conditions are true:
- `executionEnvironment === 'storeClient'` — exclusively set by Expo Go
- `Platform.OS === 'android'` — scoped to Android, where Expo Go removed remote push support in SDK 53

All EAS builds (`preview` and `production` profiles) produce `executionEnvironment === 'bare'`, so the guard never fires for them.

### Automated regression tests

`services/notifications.test.ts` covers every execution path:

| Test group | `executionEnvironment` | Expected |
|---|---|---|
| Android EAS build | `'bare'` | Notifications scheduled ✅ |
| Android legacy standalone | `'standalone'` | Notifications scheduled ✅ |
| Android Expo Go | `'storeClient'` | Suppressed (guard active) ✅ |
| iOS Expo Go | `'storeClient'` | Notifications scheduled ✅ (guard is Android-only) |

Run at any time:
```bash
pnpm --filter @workspace/mobile test
```

---

## Expo config verification

`app.json` includes the `expo-notifications` plugin, which is required for Android notification support:

```json
["expo-notifications", {
  "icon": "./assets/images/icon.png",
  "color": "#0ea5e9",
  "sounds": []
}]
```

This plugin injects `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, and `POST_NOTIFICATIONS` permissions into the generated `AndroidManifest.xml` during `expo prebuild`. Without this entry, notification channels cannot be registered and local notifications would not fire on Android.

---

## Manual verification — EAS preview APK

`eas.json` provides a `preview` profile that produces a self-contained release APK distributed internally. No Metro server or `expo-dev-client` dependency is required.

### Prerequisites
- Android device (API 26+) or Android emulator
- EAS CLI: `npm install -g eas-cli && eas login`
- Project linked: run `eas project:init` once if `app.json` has no `extra.eas.projectId`

### Steps

1. **Build and install the preview APK**
   ```bash
   cd artifacts/mobile
   eas build --profile preview --platform android
   # EAS prints a download URL when the build finishes.
   # Install via ADB:
   adb install <downloaded-file>.apk
   # Or scan the QR from the EAS build page to install via the Expo Orbit app.
   ```

2. **Confirm build context in the app**

   The **Notifications** developer section is visible in any installed non-Expo-Go build (gated on `Constants.executionEnvironment !== 'storeClient'`).

   - Open the installed app → tap **Settings** (gear icon) → scroll to the **Developer** section.
   - **Execution environment** must show `bare`.
   - Status line must read **✅ EAS/bare build — notifications active**.
   - If it shows `storeClient` or the Developer section is absent, you are in Expo Go — check that the correct APK was installed.

3. **Schedule a test notification**
   - Tap **"Schedule test notification (15 s)"**.
   - Grant notification permission when the Android dialog appears (first run only).
   - Status changes to: *✅ Notification scheduled for HH:MM:SS — put the app in the background to see it.*
   - Press the home button or switch to another app.
   - After ~15 seconds a notification appears in the status bar:
     - **Title:** 💉 Injection Time
     - **Body:** Dev Test — 250 mcg (10.0 units)

4. **Expected outcomes**

   | Check | Expected |
   |---|---|
   | Developer section visible | Yes (executionEnvironment = 'bare') |
   | Execution environment label | `bare` |
   | Status indicator | ✅ EAS/bare build — notifications active |
   | Android permission dialog | Shown on first run |
   | Status after tapping the button | Scheduled message with correct timestamp |
   | Notification arrival | Within 15 s while app is backgrounded |
   | Notification content | Correct title, cycle name, dose, units |

5. **Verify cancellation via re-schedule**
   - Tap the test button a second time before the first notification fires.
   - `scheduleCycleNotifications` always calls `cancelCycleNotifications` first for the same `cycleId`, so the previous notification is cancelled before the new one is registered.
   - Only one notification fires (~15 s after the **second** tap).

---

## Why the Expo Go guard cannot fire in EAS builds

`Constants.executionEnvironment` is set by the Expo runtime at launch:
- Expo Go always injects `'storeClient'`
- EAS `prebuild`-generated native projects always inject `'bare'`

There is no code path through which an EAS build can produce `'storeClient'`. The unit tests will catch any future regression that accidentally widens the guard condition.
