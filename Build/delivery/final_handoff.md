# UniEqub Final Phase Handoff

Last Updated: 2026-05-19

## Handoff Position

The repo now contains the MVP baseline plus repo-local Phase 2 expansion work through formation, obligations, mock provider attempts, payout maturity/reserves, reliability labels, defaults/freeze recovery, member polls, simulated refund tickets, durable notification reads, KYC history, admin audit timeline, and a phone-ready in-app demo mode.

The original MVP core remains canonical:

- `User`
- `EqubGroup`
- `GroupMembers`
- `Round`
- `Transaction`

Phase 2 additions are companion tables, shared helpers, Edge Function command paths, service contracts, UI surfaces, validators, and evidence files. Payments and wallet behavior remain mock/sandbox/simulated for the capstone.

## Main Demo Paths

- Standalone APK path: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- Latest APK evidence: `Build/delivery/evidence/phase2-release-build.json`
- Demo runbook: `Build/delivery/demo/phase2_completed_features_demo.md`
- Operator checklist: `Build/delivery/demo/phase2_demo_operator_checklist.md`
- UAT checklist: `Build/delivery/uat_checklist.md`
- Detailed tracker: `Build/delivery/phase2_development_progress_tracker.md`

Preferred device demo:

1. Install the release APK.
2. Tap **Try Demo Mode**.
3. Launch Member Demo.
4. Show dashboard, Explore, Join With Code, group creation, payment, wallet, notifications, profile reliability label, and group status.
5. Log out and launch Admin Demo.
6. Show KYC, group review, frozen-group recovery/member vote, reliability summary, audit timeline, reminders, and reports.

## Validation Commands

Run this high-signal suite before handoff:

```powershell
npm run qa:phase2-final-handoff
npm run qa:phase2-demo-readiness
npm run qa:phase2-in-app-demo
npm run qa:phase2-final-ux-states
npm run mobile:typecheck
npm run mobile:test
npm run mobile:lint
git diff --check
```

Use the deeper evidence suite when time allows:

```powershell
npm run qa:phase2-foundation
npm run qa:phase2-shared
npm run qa:phase2-formation
npm run qa:phase2-mobile-formation
npm run qa:phase2-member-formation-ui
npm run qa:phase2-creator-formation-ui
npm run qa:phase2-admin-formation-ui
npm run qa:phase2-round-obligations
npm run qa:phase2-payment-attempt-initiation
npm run qa:phase2-direct-payment-attempt
npm run qa:phase2-ussd-payment-attempt
npm run qa:phase2-provider-callback-idempotency
npm run qa:phase2-payment-outcomes
npm run qa:phase2-round-readiness
npm run qa:phase2-payout-request-flow
npm run qa:phase2-payout-idempotency-reserve-release
npm run qa:phase2-payout-reserve-ui
npm run qa:phase2-reliability-updates
npm run qa:phase2-default-restriction
npm run qa:phase2-freeze-recovery
npm run qa:phase2-polls-refunds
npm run qa:phase2-durable-notifications
npm run qa:phase2-kyc-history
```

## Supabase Deployment Checklist

Do not claim live readiness until these commands succeed against the intended Supabase project:

```powershell
supabase db push
supabase functions deploy register-login
supabase functions deploy kyc-submit-review
supabase functions deploy group-lifecycle
supabase functions deploy group-formation
supabase functions deploy contribution-reconcile
supabase functions deploy payment-attempt
supabase functions deploy wallet-clearance
supabase functions deploy payout-withdraw
supabase functions deploy notification-center
supabase functions deploy report-export
supabase functions deploy ussd-simulator
supabase functions deploy default-maintenance
```

The mobile app expects:

- `UNIEQUB_SUPABASE_URL`
- `UNIEQUB_SUPABASE_ANON_KEY`

Secrets such as service role keys, Twilio Verify settings, and release signing values must remain outside git.

The latest Phase 9 APK rebuild succeeded and does not require Metro, but release signing env vars were not set in this shell, so Gradle used debug fallback signing. Set `UNIEQUB_RELEASE_STORE_FILE`, `UNIEQUB_RELEASE_STORE_PASSWORD`, `UNIEQUB_RELEASE_KEY_ALIAS`, and `UNIEQUB_RELEASE_KEY_PASSWORD` before rebuilding if a demo/prod release key is required.

## Evidence Pack

Key repo-local evidence lives under `Build/delivery/evidence/`, including:

- Phase 2 foundation/backfill/shared validations
- direct login validation
- group formation and invite-code validations
- obligation/payment/readiness validations
- payout maturity/reserve validations
- reliability/default/freeze/poll/refund validations
- durable notification and KYC history validations
- final UX state validation
- demo readiness and in-app demo validations
- debug/release APK build evidence

The final handoff validator records:

- `Build/delivery/evidence/phase2-final-handoff-validation.json`

## User-Only Remaining Evidence

These remain blocked until the user provides real validation or decisions:

- emulator UAT evidence
- physical Android device UAT evidence
- final screenshots/videos
- production signing/Play Store decision, if needed
- OTP-capable test phone evidence
- final policy values for `app_config`
- wallet terminology approval
- final disbanded/frozen wording approval
- capstone report diagram/prose updates
- supervisor/instructor approval

## Defense-Safe Claims

Safe:

- The MVP core schema is preserved.
- Phase 2 companion workflows are additive.
- Group formation, invite-code joining, obligation readiness, mock provider attempts, payout reserves, reliability labels, default recovery, frozen-group polls, simulated refund tickets, KYC history, durable notification reads, admin audit timeline, and in-app demo mode exist repo-locally.
- Payments/wallets are simulated for academic defense.

Avoid:

- claiming real payment processing
- claiming real wallet custody
- claiming production signing
- claiming device/UAT/screenshots are complete without fresh evidence
- claiming remote Supabase migrations/functions are current unless deployment logs are captured
