---
name: expo-notifications granted type
description: NotificationPermissionsStatus type mismatch between expo and expo-modules-core packages
---

`Notifications.getPermissionsAsync()` returns `NotificationPermissionsStatus extends PermissionResponse`. The runtime object has `granted: boolean` (from expo-modules-core), but the TypeScript resolution through the `expo` re-export doesn't expose it.

**Why:** expo-notifications imports PermissionResponse from `'expo'` which resolves differently than `expo-modules-core`, hiding the `granted` property from TypeScript.

**How to apply:** Cast the result: `(await Notifications.getPermissionsAsync() as unknown as { granted: boolean }).granted`
