# UniEqub Phase 2 Completed Features Demo

Last Updated: 2026-05-17

## Demo Positioning

This demo shows the completed UniEqub MVP spine plus the Phase 2 features that are implemented in the repo today.

Use this wording during the demo:

> UniEqub is demonstrated as a capstone-safe Equb simulation platform. It preserves the original MVP core tables while adding Phase 2 companion workflows for group formation, contribution obligations, mock payment attempts, payout maturity/reserves, reliability, and default restriction handling. Payments and wallet behavior are simulated for academic defense and do not represent real custody or live financial rails.

Do not claim that real payment processing, real wallet custody, durable notification/audit UI, freeze polling, refund tickets, release APK, or full UAT are finished.

## Demo Modes

### In-App Demo Mode

Use this as the preferred phone-ready showcase when you want completed flows connected neatly without depending on OTP or live Supabase availability.

1. Install/run the app with `npm run android:dev` or open an already installed debug build.
2. On the splash screen, tap **Try Demo Mode**.
3. Tap **Launch Member Demo** to enter Dawit's seeded member workspace.
4. Show Dashboard -> Pay This Round -> direct mock payment or USSD -> Payment Success -> Wallet -> History/Notifications.
5. Return with logout, tap **Try Demo Mode**, then tap **Launch Admin Demo** for Saba Admin.
6. Show Admin Dashboard -> Review KYC -> Approve Groups -> Reports.

The in-app demo uses the mock service layer intentionally. It is repeatable, resets seeded state on each launch, and keeps live Supabase behavior available through the normal sign-in path.

### Live Mobile Demo

Use this when a connected Android device or emulator, Supabase environment, OTP phone, and deployed functions are ready.

Recommended command:

```powershell
npm run android:dev
```

For the seeded final-draw scenario:

```powershell
node .\mobile\scripts\seed-final-draw.js --phone 09XXXXXXXX --name "Demo Member"
```

The seed command requires Supabase CLI access to project `yxgfvkxdiicvckcwpdmc`, working API key lookup, and a verified member account or a phone that can be used for the demo.

### Evidence-Backed Demo

Use this when live device or OTP access is not available. Run and show the repo validation evidence instead:

```powershell
npm run qa:phase2-demo-readiness
npm run qa:phase2-in-app-demo
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
```

## Live Demo Storyboard

### 1. Open With Scope And Safety

Show:

- In-app splash screen with **Try Demo Mode**
- README Phase 2 notes
- Phase 2 tracker status
- Supabase foundation migration evidence

Say:

- The five canonical MVP tables remain preserved: `User`, `EqubGroup`, `GroupMembers`, `Round`, `Transaction`.
- Phase 2 adds companion tables and Edge Function orchestration.
- Payments are mock/sandbox only.

Evidence:

- `Build/delivery/evidence/phase2-db-migration.json`
- `Build/delivery/evidence/phase2-foundation-validation.json`
- `Build/delivery/phase2_development_progress_tracker.md`

### 2. Member Auth And KYC Gate

Show:

- Member registration/login
- KYC submission state
- Admin KYC approval if a test account is available

Say:

- Member access is gated by role, session token, and KYC status.
- Real OTP/device validation needs an OTP-capable phone and should not be faked.

Evidence:

- `Build/delivery/evidence/kyc-upload-validation.json`

### 3. Phase 2 Group Formation

Show:

- Member opens the in-app demo and sees a public forming request in Explore
- Member taps Create New Equb, creates a forming request, and returns to it from My group requests
- Creator manages participants or invitations from the creator workspace
- Admin demo reviews the seeded `Campus Demo Formation` request
- Admin approval creates canonical `EqubGroup`, `GroupMembers`, initial `Round`, and obligations

Important narration:

- `Rejected` lives in `group_requests`, not canonical `EqubGroup.Status`.
- Formation is pre-canonical; approval creates the MVP group rows.

Evidence:

- `Build/delivery/evidence/phase2-formation-validation.json`
- `Build/delivery/evidence/phase2-mobile-formation-validation.json`
- `Build/delivery/evidence/phase2-member-formation-ui-validation.json`
- `Build/delivery/evidence/phase2-creator-formation-ui-validation.json`
- `Build/delivery/evidence/phase2-admin-formation-ui-validation.json`

### 4. Obligations And Mock Payment Attempts

Show:

- Member demo dashboard starts with one remaining contribution in `Dorm A Savings Group`
- Current round obligation progress
- Initiate a contribution attempt
- Mock/USSD payment path
- Success, failed/cancelled/timeout/wrong-amount handling if using evidence mode

Important narration:

- Round readiness now uses settled obligations.
- Provider attempts are durable and idempotent.
- Successful settlement creates transaction and ledger records.

Evidence:

- `Build/delivery/evidence/phase2-round-obligation-generation-validation.json`
- `Build/delivery/evidence/phase2-payment-attempt-initiation-validation.json`
- `Build/delivery/evidence/phase2-direct-payment-attempt-flow-validation.json`
- `Build/delivery/evidence/phase2-ussd-payment-attempt-flow-validation.json`
- `Build/delivery/evidence/phase2-provider-callback-idempotency-validation.json`
- `Build/delivery/evidence/phase2-payment-outcome-validation.json`
- `Build/delivery/evidence/phase2-round-readiness-validation.json`

### 5. Draw, Payout Maturity, Reserve, And Wallet Copy

Show:

- In-app member demo final contribution completes the round
- Winner selection and payout request creation
- Immediate payout amount vs reserved payout amount
- Wallet screen language distinguishing released internal wallet clearance from reserve

Important narration:

- Trusted and final-round winners can receive full simulated payout.
- New/building-trust early winners use configured maturity and reserve logic.
- Reserved payout is released after later successful obligations.

Evidence:

- `Build/delivery/evidence/phase2-payout-maturity-validation.json`
- `Build/delivery/evidence/phase2-payout-request-flow-validation.json`
- `Build/delivery/evidence/phase2-payout-idempotency-reserve-release-validation.json`
- `Build/delivery/evidence/phase2-payout-reserve-ui-validation.json`
- `Build/delivery/evidence/wallet-clearance-validation.json`

### 6. Reliability And Restrictions

Show:

- Reliability profile update evidence
- Default maintenance evidence
- Restricted user blocking normal create/pay/payout paths

Important narration:

- Reliability is separate from KYC.
- Completed groups improve maturity.
- Late/default events affect reliability.
- Defaulted users become restricted, not automatically banned.

Evidence:

- `Build/delivery/evidence/phase2-active-group-limit-validation.json`
- `Build/delivery/evidence/phase2-reliability-update-validation.json`
- `Build/delivery/evidence/phase2-default-restriction-validation.json`

### 7. Admin Reports And Export

Show:

- Admin overview
- Report list
- CSV/PDF export evidence

Evidence:

- `Build/delivery/evidence/report-export-validation.json`

## Demo Close

End with the honest remaining work:

- Durable notifications and audit timeline are not finished.
- Freeze events, frozen-group resolution, polls, and refund tickets are still staged.
- Full emulator/physical-device UAT, screenshots, release signing, release APK, and final report/diagram updates remain user-facing delivery work.

Recommended close:

> The completed work demonstrates the core Phase 2 architecture and the highest-risk backend workflows. The remaining work is mainly durable notification/audit polish, frozen-group extensions, UI evidence, and final delivery packaging.
