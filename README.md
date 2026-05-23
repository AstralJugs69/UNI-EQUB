# UniEqub

UniEqub is a React Native and Supabase implementation of a verified digital Equb workflow for students and admins. The workspace contains the Android mobile app, Supabase schema and Edge Functions, an explicit scenario seeding engine, and an Electron desktop simulation controller for ADB-connected devices.

The project is intentionally seedless by default. Databases should start empty, and demo data should be created only through the seeding engine or simulation tools.

## What Is In This Repo

| Path | Purpose |
| --- | --- |
| `mobile/` | React Native Android app for members and admins. |
| `supabase/` | Migrations, config, and Edge Functions. |
| `desktop/` | Electron simulation controller for ADB-connected UniEqub devices. |
| `tools/seeding/` | TypeScript CLI for deterministic seed scenarios and wipes. |
| `scripts/` | PowerShell launch/build helpers for mobile and desktop workflows. |
| `Build/` | Historical specs, evidence, and delivery artifacts. Useful as reference, not the current README source of truth. |

## Current Product Surface

### Member App

- Email and password login, with phone and full name collected during account creation.
- Email verification through Brevo-backed verification codes and app links.
- OTP gates for the first registered test account, reset password, and protected payment entry where applicable.
- KYC submission, pending, resubmission, approved, and banned states.
- Home dashboard with active group status, contribution deadline, voting state, wallet summary, and recent activity.
- Explore hub for public forming groups, invite-code joins, and group creation.
- Group Preview for approved joinable groups and Group Cycle for active contribution/draw groups.
- Formation creator workflow with participant request review, profile/trust context, join-window activation, and private/public flows.
- Payment flow with Telebirr/native USSD test path, stable `groupId` routing, transaction history, and PDF receipt support.
- Notification inbox, notification badge count, whitelisted deep links, and Android system notifications for supported events.
- Profile, preferences, theme/language settings, KYC status access, account switching, profile photo upload, and generated-avatar fallback.

### Admin App

- Admin dashboard with KYC, group, report, and profile hubs.
- KYC queue and full KYC review decisions.
- Group review queue for formations, frozen groups, and legacy group actions.
- Resolution poll escalation when member votes end without consensus.
- Reminder batches, report export, destructive-action confirmations, and success/error feedback.

### Backend

- Supabase Postgres schema with the original core tables plus companion tables for formation, obligations, payment attempts, wallet ledger, payout vesting, reliability, durable notifications, KYC history, announcement board, simulation, email verification, join windows, and refund/recovery flows.
- Edge Functions protect business writes and return structured error envelopes.
- Durable notifications and derived notifications support app inbox rows, system notifications, and safe deep links.
- Lifecycle logic supports contribution obligations, draw completion, payout vesting, cycle-completion votes, frozen recovery, refunds, and simulation commands.

### Desktop Simulation Controller

- Electron app for demo/dev lifecycle control.
- Uses `adb` directly; Android Studio is not required for the controller itself.
- Discovers ADB-visible devices, filters for `com.uniequb`, detects running state, launches the app, and sends signed simulation commands through the Android intent bridge.
- Calls the `simulation-controller` Edge Function for database-authoritative actions such as paying users, advancing time, manipulating active groups, recording draw seeds, and refreshing connected devices.
- Simulation power is intended for active groups only and should stay limited to dev/demo builds and authorized controller sessions.

## Requirements

- Windows PowerShell.
- Node.js 22 or newer.
- npm.
- Android SDK platform tools, including `adb`.
- JDK 17 or Android Studio bundled JBR. The scripts prefer Android Studio JBR when available.
- Supabase CLI.
- A Supabase project for live/backend work.
- A physical or ADB-visible Android device for full mobile and desktop-controller testing.

## Install

Install the root package dependencies first:

```powershell
npm install
```

Install mobile dependencies:

```powershell
npm --prefix mobile install
```

Install desktop dependencies:

```powershell
npm --prefix desktop install
```

## Environment

### Mobile Runtime

Create `mobile/.env`:

```powershell
Copy-Item mobile/.env.example mobile/.env
```

Set:

```text
UNIEQUB_SUPABASE_URL=https://your-project-ref.supabase.co
UNIEQUB_SUPABASE_ANON_KEY=your-anon-key
```

Restart Metro after changing `mobile/.env`.

### Supabase Function Secrets

The Edge Functions expect these secrets in Supabase:

```text
APP_JWT_SECRET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
BREVO_API_KEY
UNIEQUB_EMAIL_FROM
UNIEQUB_CONTROLLER_SECRET
USSD_SIMULATOR_SECRET
```

Set secrets with:

```powershell
supabase secrets set APP_JWT_SECRET="..."
supabase secrets set TWILIO_ACCOUNT_SID="..."
supabase secrets set TWILIO_AUTH_TOKEN="..."
supabase secrets set TWILIO_VERIFY_SERVICE_SID="..."
supabase secrets set BREVO_API_KEY="..."
supabase secrets set UNIEQUB_EMAIL_FROM="..."
supabase secrets set UNIEQUB_CONTROLLER_SECRET="..."
supabase secrets set USSD_SIMULATOR_SECRET="..."
```

### Seeding CLI

The seeding engine uses service-role access because it can wipe and create data:

```powershell
$env:UNIEQUB_SUPABASE_URL="https://your-project-ref.supabase.co"
$env:UNIEQUB_SUPABASE_ANON_KEY="your-anon-key"
$env:UNIEQUB_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

For non-local targets, destructive commands require an explicit confirmation:

```powershell
$env:UNIEQUB_SEED_TARGET="staging"
$env:UNIEQUB_SEED_CONFIRM="staging:wipe"
```

Optional admin bootstrap overrides:

```powershell
$env:UNIEQUB_BOOTSTRAP_ADMIN_PHONE="0999000000"
$env:UNIEQUB_BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
$env:UNIEQUB_BOOTSTRAP_ADMIN_PASSWORD="admin1234"
$env:UNIEQUB_BOOTSTRAP_ADMIN_NAME="UniEqub Admin"
```

## Run The Mobile App

The recommended Android launcher is the root script:

```powershell
npm run android:dev
```

Clean install:

```powershell
npm run android:dev:clean
```

Lower-level commands are also available:

```powershell
npm run mobile:start
npm run mobile:android
```

Build APKs:

```powershell
npm run mobile:apk:debug
npm run mobile:apk:release
```

Release signing can be configured with:

```text
UNIEQUB_RELEASE_STORE_FILE
UNIEQUB_RELEASE_STORE_PASSWORD
UNIEQUB_RELEASE_KEY_ALIAS
UNIEQUB_RELEASE_KEY_PASSWORD
```

If release signing is not configured, the Gradle config falls back to debug signing for local testing.

## Run The Desktop Controller

Start the controller from the repo root:

```powershell
npm run desktop:app
```

Development mode with Vite renderer reload:

```powershell
npm run desktop:app:dev
```

Clean generated desktop build before launch:

```powershell
npm run desktop:app:clean
```

Useful checks:

```powershell
npm run desktop:typecheck
npm run desktop:test
npm run desktop:build
```

ADB checks:

```powershell
adb devices -l
adb -s <device-id> shell pm path com.uniequb
adb -s <device-id> shell pidof com.uniequb
```

The controller expects UniEqub to be installed with package id `com.uniequb`.

## Supabase Workflow

Push schema migrations:

```powershell
supabase db push
```

Deploy all active functions:

```powershell
supabase functions deploy announcement-board contribution-reconcile default-maintenance group-formation group-lifecycle kyc-submit-review notification-center payment-attempt payout-withdraw profile-center register-login report-export round-complete simulation-controller ussd-simulator wallet-clearance
```

Common targeted deploys:

```powershell
supabase functions deploy register-login profile-center notification-center
supabase functions deploy group-formation group-lifecycle contribution-reconcile simulation-controller
```

If the CLI reports a database login-role or password error, verify:

- `SUPABASE_DB_PASSWORD` is set for the linked project.
- The project is linked to the expected Supabase project.
- The database role being used has permission for CLI migrations.

Do not commit `supabase/.temp/*`; it is local Supabase CLI state.

## Seeding

The database should stay empty unless you explicitly seed it.

List available scenarios:

```powershell
npm run seed:catalog
```

Validate the seeding engine:

```powershell
npm run seed:validate
```

Wipe app tables:

```powershell
npm run seed:wipe
```

Bootstrap one admin:

```powershell
npm run seed:bootstrap-admin
```

Run a named scenario:

```powershell
npm run seed:scenario -- active-cycle
```

Current scenario catalog:

- `empty`
- `bootstrap-admin`
- `onboarding-member`
- `kyc-queue`
- `forming-public`
- `forming-private`
- `active-cycle`
- `final-draw`
- `frozen-recovery`
- `announcements`
- `account-switching`

Some scenarios are intentionally destructive because they start from a clean database. Use confirmation variables for staging or linked remote targets.

## Test And Quality Gates

Run the main mobile checks:

```powershell
npm run mobile:typecheck
npm run mobile:test
```

Run desktop checks:

```powershell
npm run desktop:typecheck
npm run desktop:test
npm run desktop:build
```

Run seed validation:

```powershell
npm run seed:validate
```

Useful focused validations remain available under `qa:*` scripts in `package.json`. Prefer adding focused validations for new workflow risks instead of relying on the old long-form demo tracker.

## Important Architecture Rules

- Keep the app live-database-first. Do not reintroduce hidden seeded data into the mobile app.
- Use the seeding engine for demo data.
- Keep raw backend route names untrusted in notifications. Resolve only through the mobile whitelist in `mobile/src/navigation/notificationRoutes.ts`.
- Keep payment, KYC, formation approval, lifecycle, notification, and simulation writes behind Edge Functions.
- Do not expose service-role keys in the mobile app or desktop renderer.
- Use `UNIEQUB_CONTROLLER_SECRET` plus an admin session for backend simulation authority.
- Simulation commands can refresh or navigate the app, but durable lifecycle state belongs in Supabase.
- Profile photos may be uploaded by users; generated avatars remain the fallback when no uploaded image exists.

## Troubleshooting

### Metro Does Not Start

Run:

```powershell
npm --prefix mobile run start -- --reset-cache
```

Then reinstall:

```powershell
npm run android:dev:clean
```

### Android Build Cannot Find Java

Use Android Studio JBR:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
```

### Device Cannot Reach Metro

Make sure the launcher configured reverse port forwarding:

```powershell
adb reverse tcp:8081 tcp:8081
```

### Desktop Controller Shows No Devices

Run:

```powershell
adb devices -l
```

Accept the USB debugging prompt on the phone, then relaunch:

```powershell
npm run desktop:app
```

### Email Verification Fails

Check Supabase function secrets:

```powershell
supabase secrets list
```

The email verification helper requires `BREVO_API_KEY` and `UNIEQUB_EMAIL_FROM`.

### Push/Deploy Succeeds But App Still Shows Old Behavior

- Restart Metro.
- Reinstall the Android app.
- Confirm the intended Edge Function was deployed.
- Confirm migrations were pushed to the same linked Supabase project used by `mobile/.env`.

## Git Hygiene

- Commit source changes, migrations, and function updates.
- Do not commit local secrets, `node_modules`, generated desktop bundles, release keystores, or `supabase/.temp`.
- Keep schema changes in timestamped files under `supabase/migrations/`.
- Keep reusable demo data in `tools/seeding/`, not in app code.

## Quick Command Reference

```powershell
npm run android:dev
npm run desktop:app
npm run mobile:typecheck
npm run mobile:test
npm run desktop:typecheck
npm run desktop:test
npm run seed:catalog
npm run seed:validate
supabase db push
supabase functions deploy notification-center profile-center register-login
```
