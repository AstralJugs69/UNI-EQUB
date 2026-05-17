# UniEqub Phase 2 Demo Operator Checklist

Last Updated: 2026-05-17

## Pre-Demo Setup

- Confirm whether the demo is in-app demo mode, live mobile, evidence-backed, or hybrid.
- Confirm the target Supabase project is linked.
- Confirm current migrations have been pushed.
- Confirm the newest Edge Functions are deployed if doing live backend paths:
  - `register-login`
  - `kyc-submit-review`
  - `group-lifecycle`
  - `group-formation`
  - `contribution-reconcile`
  - `payment-attempt`
  - `wallet-clearance`
  - `report-export`
  - `ussd-simulator`
  - `default-maintenance`
- Confirm `mobile/.env` has:
  - `UNIEQUB_SUPABASE_URL`
  - `UNIEQUB_SUPABASE_ANON_KEY`
- Confirm an OTP-capable phone is available if demonstrating real auth.
- Confirm the user understands payments/wallets are simulated.

## In-App Demo Mode

Use this path when the goal is to show the working app flows on a device without relying on OTP delivery or remote state.

1. Start/install the debug app with `npm run android:dev`.
2. On the splash screen, tap **Try Demo Mode**.
3. Tap **Launch Member Demo** to show final contribution, mock/USSD payment, auto draw, wallet, history, notifications, and Explore.
4. Log out, return to **Try Demo Mode**, and tap **Launch Admin Demo** to show KYC, legacy group approval, Phase 2 formation approval, reminders, and reports.
5. Tell the audience this path uses seeded local mock data and simulated payment rails.

## Quick Validation Commands

Run before presenting:

```powershell
npm run qa:phase2-demo-readiness
npm run qa:phase2-in-app-demo
npm run mobile:typecheck
npm run mobile:test
npm run mobile:lint
```

Optional deeper evidence pass:

```powershell
npm run qa:phase2-formation
npm run qa:phase2-payment-outcomes
npm run qa:phase2-payout-reserve-ui
npm run qa:phase2-default-restriction
```

## Live Demo Accounts

Record locally before the demo. Do not commit private credentials.

| Role | Phone | Password note | Status |
| --- | --- | --- | --- |
| Admin |  |  | Needs login |
| Member creator |  |  | Needs verified KYC |
| Member participant |  |  | Needs verified KYC |
| Seeded final-draw member |  |  | Optional |

## Storyboard Timing

| Segment | Target time | Live action | Fallback evidence |
| --- | ---: | --- | --- |
| Scope/safety | 1 min | README/tracker | `phase2-foundation-validation.json` |
| Auth/KYC | 2 min | Login/KYC/admin approve | `kyc-upload-validation.json` |
| Formation | 4 min | Create/join/submit/admin approve | `phase2-formation-validation.json` |
| Obligations/payment | 4 min | Pay current obligation | payment-attempt evidence files |
| Draw/payout/reserve | 4 min | Seed final draw or show wallet | payout evidence files |
| Reliability/default | 3 min | Run/show default maintenance | `phase2-default-restriction-validation.json` |
| Reports | 2 min | Admin reports/export | `report-export-validation.json` |
| Remaining work | 1 min | Tracker rows | `phase2_development_progress_tracker.md` |

## Live Final-Draw Shortcut

Use only with a real verified member or OTP-capable test phone:

```powershell
node .\mobile\scripts\seed-final-draw.js --phone 09XXXXXXXX --name "Demo Member"
```

Then in the app:

1. Log in as the seeded member.
2. Open the current group/round.
3. Pay the one remaining contribution.
4. Confirm the round completes and payout is created.
5. Open wallet and show released payout vs reserve behavior where applicable.

## Things To Avoid Saying

- Do not say payments are real.
- Do not say wallet funds are held by the app.
- Do not say release APK or emulator validation is complete unless fresh evidence exists.
- Do not say durable notification/audit UI is complete.
- Do not say freeze polling/refund tickets are complete.

## Best Defense Line

> UniEqub demonstrates realistic Equb workflow controls without live financial risk: approval-based formation, obligation-based readiness, idempotent mock provider attempts, simulated ledger and payout reserves, reliability maturity, and default restrictions, while preserving the original MVP schema as the canonical core.
