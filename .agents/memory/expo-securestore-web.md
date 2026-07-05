---
name: expo-secure-store fails on web preview
description: expo-secure-store throws/no-ops on web platform; auth contexts using it break silently when previewed via app_preview screenshot or Expo web.
---

`expo-secure-store` has no web implementation — calling `getItemAsync`/`setItemAsync` on
`Platform.OS === "web"` throws or surfaces an error toast ("ExpoSecureStore.default.getValu...").

**Why:** Replit's `screenshot` tool for Expo artifacts renders the app via Expo web, not a
native simulator. Any auth/session context that unconditionally uses SecureStore will show
a broken/error state in every preview screenshot, even though it would work fine on-device.

**How to apply:** In any Expo auth/session storage layer, branch on `Platform.OS === "web"`
and use `@react-native-async-storage/async-storage` (already installed in the scaffold) for
web, keeping `expo-secure-store` for native. Wrap both behind one small storage helper so
call sites don't need to know the difference.
