# UniEqub Phase 2 Completed Features Demo

Last Updated: 2026-05-19

## Demo Positioning

This demo shows the completed UniEqub MVP spine plus the Phase 2 features that are implemented in the repo today.

Use this wording during the demo:

> UniEqub is demonstrated as a capstone-safe Equb simulation platform. It preserves the original MVP core tables while adding Phase 2 companion workflows for group formation, contribution obligations, mock payment attempts, payout maturity/reserves, reliability, and default restriction handling. Payments and wallet behavior are simulated for academic defense and do not represent real custody or live financial rails.

Do not claim that real payment processing, real wallet custody, production Play Store signing, remote deployment freshness, screenshots, emulator/physical-device UAT, or supervisor approval are finished unless fresh evidence exists.

## Demo Modes

### In-App Demo Mode

Use this as the preferred phone-ready showcase when you want completed flows connected neatly without depending on OTP or live Supabase availability.

1. Install/run the app with the standalone release APK or use `npm run android:dev` during development.
2. On the splash screen, tap **Try Demo Mode**.
3. Tap **Launch Member Demo** to enter Dawit's seeded member workspace.
4. Show Dashboard -> reliability label -> Pay This Round -> direct mock payment or USSD -> Payment Success -> Wallet -> History/Notifications.
5. Show Explore -> Join With Code -> `FORM-2026`; then Profile reliability label and Group Status contributor ring.
6. Return with logout, tap **Try Demo Mode**, then tap **Launch Admin Demo** for Saba Admin.
7. Show Admin Dashboard -> Review KYC -> Approve Groups -> frozen recovery/member vote -> reliability summary -> audit timeline -> Reports.

The in-app demo uses the mock service layer intentionally. It is repeatable, resets seeded state on each launch, and keeps live Supabase behavior available through the normal sign-in path.

Standalone APK evidence:

- `mobile/android/app/build/outputs/apk/release/app-release.apk`
- `Build/delivery/evidence/phase2-release-build.json`

This APK contains `assets/index.android.bundle` and does not require Metro to launch. The latest Phase 9 rebuild used debug fallback signing because release signing env vars were not set; rebuild with `UNIEQUB_RELEASE_*` values before presenting it as a demo/prod release-key artifact.

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
npm run qa:phase2-freeze-recovery
npm run qa:phase2-polls-refunds
npm run qa:phase2-durable-notifications
npm run qa:phase2-kyc-history
npm run qa:phase2-final-ux-states
npm run qa:phase2-final-handoff
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

- Member/admin login with phone number and password
- Member registration with OTP retained for phone/KYC verification
- KYC submission state
- Admin KYC approval if a test account is available

Say:

- Member access is gated by role, session token, and KYC status.
- Login no longer uses OTP. Real registration/KYC phone verification still needs an OTP-capable phone and should not be faked.

Evidence:

- `Build/delivery/evidence/direct-login-validation.json`
- `Build/delivery/evidence/kyc-upload-validation.json`

### 3. Phase 2 Group Formation

Show:

- Member opens the in-app demo and sees a public forming request in Explore
- Member taps Join With Code, previews seeded code `FORM-2026`, accepts terms, and is auto-accepted into the forming group
- Member taps Create Equb, creates a forming request, and returns to it from My requests
- Creator creates/share invite codes, reviews participants, and sees accepted `X/5` readiness before submit/start
- Admin demo reviews the seeded `Campus Demo Formation` request
- Admin approval creates canonical `EqubGroup`, `GroupMembers`, initial `Round`, and obligations

Important narration:

- `Rejected` lives in `group_requests`, not canonical `EqubGroup.Status`.
- Formation is pre-canonical; approval creates the MVP group rows.
- Public invite-code redemption auto-accepts verified eligible users; normal public discovery requests still require creator approval.

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

- Member public reliability label on dashboard/profile
- Admin reliability summary
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
- `Build/delivery/evidence/phase2-final-ux-states-validation.json`

### 7. Frozen-Group Recovery, Polls, And Refund Tickets

Show:

- Admin frozen-group recovery controls
- Member resolution vote state
- Simulated refund ticket visibility after unresolved/frozen resolution

Important narration:

- Frozen-group recovery is a controlled Phase 2 companion workflow.
- Refund tickets are simulated records for defense; no real money moves.
- The canonical `EqubGroup` status is not overloaded with request-only rejection/disbandment states.

Evidence:

- `Build/delivery/evidence/phase2-freeze-recovery-validation.json`
- `Build/delivery/evidence/phase2-polls-refunds-validation.json`

### 8. Admin Reports, Audit, And Export

Show:

- Admin overview
- Reliability summary
- Read-only audit timeline
- Report list
- CSV/PDF export evidence

Evidence:

- `Build/delivery/evidence/report-export-validation.json`
- `Build/delivery/evidence/phase2-final-ux-states-validation.json`
- `Build/delivery/evidence/phase2-final-handoff-validation.json`

## Demo Close

End with the honest remaining work:

- Remote deployment proof for the latest migrations/functions is still user-run.
- Full emulator/physical-device UAT, screenshots, production Play Store signing, and final report/diagram updates remain user-facing delivery work.

Recommended close:

> The completed work demonstrates the core Phase 2 architecture and the highest-risk backend workflows. The remaining work is mainly deployment confirmation, device evidence, screenshots, report updates, and supervisor approval.
