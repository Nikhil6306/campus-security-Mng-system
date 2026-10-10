# Campus Security Guard

Expo Router mobile frontend for the Campus Security Management System. This phase is a standalone, local demo: it does not connect to Supabase, the website, campus services, or an access-control system.

## Run

```bash
npm install
npx expo start
```

From the Expo CLI, open the app in Expo Go, an Android/iOS emulator, or a web browser. Camera scanning and camera capture require a device/browser with camera support and the user’s permission. Rebuild the native app after changing permission config in `app.json`.

## Demo features

- Splash, guard sign-in form, and validated password-reset request.
- Guard dashboard, visitor registration and local preview, photo selection/capture, QR scan/result states, checkout confirmation, and searchable/filterable visitor history.
- Emergency categories and confirmation, local emergency history, sample notifications, and profile preference toggles.
- Local sample visitor/emergency state is held in app memory and resets when the app reloads.
- Password checks are frontend validation only. No password reset email is sent.
- QR checks match local sample records only; a valid-looking result is not identity verification or permission to enter.
- Emergency actions create a local demo log only; no responder is contacted.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```

Routes are defined in `src/app/`, with shared UI in `src/components/security-ui.tsx` and demo state in `src/state/demo-store.tsx`.
