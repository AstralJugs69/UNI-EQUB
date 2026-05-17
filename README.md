# UniEqub Workspace

This repository is organized as an implementation workspace around the original academic MVP master spec and the Phase 2 additive expansion plan.

## Structure
- `mobile/`: Bare React Native Android-first client in TypeScript.
- `supabase/`: SQL and Edge Function implementation aligned to the original five-table MVP core plus Phase 2 additive companion tables.
- `Build/master_spec/`: source-of-truth technical specification.
- `Build/docs/`: original report and extracted UI reference assets.
- `Build/delivery/`: delivery tracker, implementation traceability, execution docs, and Phase 2 expansion planning.

## Current implementation status
- React Native mobile scaffold created.
- Mocked end-to-end member/admin flow implemented in-app through service contracts.
- MVP baseline SQL scaffold created for the five core tables; the first Phase 2 companion-table migration is now in `supabase/migrations/`.
- Edge Function skeletons created for the critical backend workflows.
- Delivery progress spec and traceability matrix initialized.


## Phase 2 expansion planning
- Source of truth: `Build/delivery/phase2_expansion_spec.md`
- Edge Function impact analysis: `Build/delivery/phase2_edge_function_impact.md`
- Phase 2 development tracker: `Build/delivery/phase2_development_progress_tracker.md`
- Phase 2 lifts the earlier no-new-tables restriction for additive companion tables only.
- The original five core MVP tables remain canonical: `User`, `EqubGroup`, `GroupMembers`, `Round`, and `Transaction`.
- The initial Phase 2 foundation migration adds group formation, contribution obligation, mock provider attempt, wallet/simulated ledger, payout request/schedule, reliability restriction, durable notification, audit event, and app configuration tables.
- The shared Phase 2 backend helper batch adds config, audit, notification, reliability, obligation, payment attempt, ledger, and payout vesting scaffolding while leaving sensitive writes behind Edge Functions.
- The `group-formation` Edge Function currently provides the Phase 2 command boundary for public admin approval/rejection and private invite-based auto-start, including canonical MVP group/member/round creation when a request is activated; mobile service/UI migration is being added incrementally.
- Payment behavior remains sandbox/mock for the capstone; real payment provider integration is future work only.

## Commands
- `npm test`
- `npm run mobile:start`
- `npm run mobile:android`
- `npm run mobile:test`
- `npm run mobile:typecheck`
- `npm run mobile:lint`
- `npm run mobile:apk:debug`
- `npm run mobile:apk:release`
- `npm run qa:kyc-upload`
- `npm run qa:wallet-clearance`
- `npm run qa:ussd-simulator`
- `npm run qa:phase2-foundation`
- `npm run qa:phase2-shared`
- `npm run qa:phase2-formation`
- `npm run qa:phase2-legacy-group`
- `npm run qa:phase2-mobile-formation`
- `npm run qa:phase2-member-formation-ui`
- `npm run qa:phase2-creator-formation-ui`
- `npm run qa:phase2-admin-formation-ui`
- `npm run qa:phase2-round-obligations`
- `npm run qa:phase2-dashboard-obligations`
- `npm run qa:phase2-payment-attempt-initiation`
- `npm run qa:phase2-direct-payment-attempt`
- `npm run qa:phase2-ussd-payment-attempt`
- `npm run qa:phase2-provider-callback-idempotency`
- `npm run qa:phase2-payment-outcomes`
- `npm run qa:phase2-reminder-obligations`
- `npm run qa:phase2-backfill`
- `npm run qa:phase2-round-readiness`
- `npm run qa:phase2-attempt-ledger`
- `npm run qa:phase2-payout-maturity`
- `npm run qa:phase2-payout-request-flow`
- `npm run qa:phase2-payout-idempotency-reserve-release`
- `npm run qa:phase2-payout-reserve-ui`
- `npm run qa:phase2-active-group-limit`
- `npm run qa:phase2-reliability-updates`
- `npm run qa:phase2-default-restriction`
- `npm run qa:phase2-demo-readiness`
- `npm run qa:phase2-in-app-demo`
- `node .\mobile\scripts\seed-final-draw.js --phone 09XXXXXXXX --name "Your Name"`

## Phase 2 demo
- Demo runbook: [phase2_completed_features_demo.md](C:/dev/projects/UNI-EQUB/Build/delivery/demo/phase2_completed_features_demo.md)
- Operator checklist: [phase2_demo_operator_checklist.md](C:/dev/projects/UNI-EQUB/Build/delivery/demo/phase2_demo_operator_checklist.md)
- Readiness validation: `npm run qa:phase2-demo-readiness`
- In-app demo validation: `npm run qa:phase2-in-app-demo`
- Device path: run/install the app, tap **Try Demo Mode**, then launch the seeded member or admin showcase. This uses local mock data and leaves normal Supabase login untouched.
- Standalone signed demo APK: `npm run mobile:apk:release` builds `mobile/android/app/build/outputs/apk/release/app-release.apk` with the React Native bundle packaged inside. Configure `UNIEQUB_RELEASE_STORE_FILE`, `UNIEQUB_RELEASE_STORE_PASSWORD`, `UNIEQUB_RELEASE_KEY_ALIAS`, and `UNIEQUB_RELEASE_KEY_PASSWORD` to use a release key; otherwise the Gradle file falls back to debug signing.

## Hosted USSD simulator
- Edge Function endpoint: `supabase/functions/ussd-simulator/`
- Local harness: [ussd_simulator_harness.html](C:/dev/projects/UNI-EQUB/Build/delivery/tools/ussd_simulator_harness.html)
- Validation command: `npm run qa:ussd-simulator`
- Supported callback shapes:
  - generic `sessionId/serviceCode/phoneNumber/text` with plain-text `CON` / `END`
  - Arkesel-style `sessionID/userID/msisdn/userData/newSession/network` with JSON `message` / `continueSession`

The simulator accepts either the generic gateway payload or the Arkesel-style payload so you can prepare a sandbox callback before integrating a real gateway.

## Mobile env setup
1. Copy [mobile/.env.example](C:/dev/projects/UNI-EQUB/mobile/.env.example) to `mobile/.env`
2. Set:
   - `UNIEQUB_SUPABASE_URL`
   - `UNIEQUB_SUPABASE_ANON_KEY`
3. Restart Metro after changing the file

The tracked source no longer hardcodes the mobile Supabase URL/key pair.

## Important persistence rule
The original MVP core tables remain preserved: `User`, `EqubGroup`, `GroupMembers`, `Round`, and `Transaction`. Phase 2 may add companion tables only when they extend the existing implementation additively and follow `Build/delivery/phase2_expansion_spec.md`.
