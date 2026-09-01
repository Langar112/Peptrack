# PeptidePro mobile app

## Adding dependencies

Use Expo's version resolver when adding dependencies to this workspace. This
keeps Expo and React Native packages aligned with the SDK version used by the
app.

From the repository root, run:

```bash
pnpm --filter @workspace/mobile run add-dep -- expo-camera
```

The `add-dep` script wraps `expo install`, so replace `expo-camera` with the
package you need. Do not use `pnpm add` for Expo-ecosystem dependencies;
installing those packages directly can select versions that are incompatible
with the app's Expo SDK. Use `pnpm add` only for packages that are not part of
the Expo or React Native ecosystem.