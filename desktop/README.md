# UniEqub Desktop Simulation Controller

Electron controller for demo/dev lifecycle testing against real ADB-connected Android devices running UniEqub.

The controller is intentionally separate from Android Studio. It talks to devices through `adb`, sends app-side UI commands through an Android intent bridge, and can pair those UI commands with backend lifecycle mutations through the Supabase `simulation-controller` Edge Function.

## What It Does

- Finds ADB devices with `adb devices -l`.
- Filters for devices where `com.uniequb` is installed.
- Detects whether UniEqub is running with `adb shell pidof com.uniequb`.
- Launches UniEqub with `adb shell monkey -p com.uniequb 1`.
- Sends signed command envelopes with:

```powershell
adb shell am start -n com.uniequb/.MainActivity -a com.uniequb.SIM_COMMAND --es payload <base64-json>
```

Supported app-side command types in the current UI:

- `Refresh`
- `Navigate`
- `SelectActiveGroup`
- `PaymentReturn`
- `ShowBanner`
- `SpeedTime`
- `BackendLifecycle`

## Requirements

- Node.js compatible with the repo toolchain.
- `adb` available on `PATH`.
- A physical or ADB-visible Android device.
- UniEqub installed on that device with package id `com.uniequb`.
- A dev/demo build of the mobile app. The mobile bridge is enabled only in `__DEV__`.

Useful ADB checks:

```powershell
adb devices -l
adb -s <device-id> shell pm path com.uniequb
adb -s <device-id> shell pidof com.uniequb
```

## Setup

Install desktop dependencies:

```powershell
npm --prefix desktop install
```

Optional but recommended: set the controller secret to match the Supabase Edge Function secret.

```powershell
$env:UNIEQUB_CONTROLLER_SECRET="local-dev-controller"
```

The same value must be configured in Supabase as `UNIEQUB_CONTROLLER_SECRET` for backend simulation commands.

## Run

Start the Vite renderer:

```powershell
npm --prefix desktop run dev
```

In another terminal, start Electron:

```powershell
npm --prefix desktop run electron
```

Build/check:

```powershell
npm --prefix desktop run typecheck
npm --prefix desktop run test
npm --prefix desktop run build
```

Root aliases are also available:

```powershell
npm run desktop:dev
npm run desktop:electron
npm run desktop:typecheck
npm run desktop:test
npm run desktop:build
```

## Mobile Bridge

The mobile app includes:

- Android intent handling in `mobile/android/app/src/main/java/com/com.uniequb/MainActivity.kt`.
- Native event module in `mobile/android/app/src/main/java/com/com.uniequb/SimulationCommandModule.kt`.
- JS listener in `mobile/src/providers/SimulationBridgeProvider.tsx`.

Incoming payloads are base64-encoded JSON envelopes:

```json
{
  "command": {
    "id": "cmd-...",
    "type": "Refresh",
    "payload": {},
    "issuedAt": "2026-05-20T00:00:00.000Z"
  },
  "issuedAt": "2026-05-20T00:00:00.000Z",
  "signature": "hmac-sha256"
}
```

The native module drops commands unless simulation mode is enabled by the dev JS provider. The current JS listener checks for a signed envelope shape before acting; backend mutations still require the Supabase controller secret and an admin session.

## Backend Simulation

Durable lifecycle changes belong in the Supabase `simulation-controller` Edge Function, not only in the app UI. Use backend commands when you need to mutate source-of-truth state such as:

- advancing simulation clock
- marking obligations paid/late/defaulted
- removing members
- freezing/resuming groups
- creating test payments
- finalizing rounds

The desktop UI currently sends ADB app commands. Backend command wiring is scaffolded in the mobile/service layer and Edge Function, and can be expanded from `desktop/src/renderer/main.tsx` when a richer controller workflow is needed.

## Troubleshooting

- No devices shown: run `adb devices -l` and authorize the device.
- Device shown as unauthorized: accept the USB debugging prompt on the phone.
- App not detected: install/run a build whose package id is `com.uniequb`.
- Launch works but commands do nothing: make sure the app is a dev build and the JS bridge is active.
- Backend command rejected: verify `UNIEQUB_CONTROLLER_SECRET` is set locally and in Supabase, and use an admin session for backend calls.
