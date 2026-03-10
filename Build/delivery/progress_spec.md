# UniEqub Delivery Progress Spec

Version: 1.0
Last Updated: 2026-03-10
Current Wave: UI/UX redesign, native-Android polish, and screen modularization are active on top of the live contribution/draw stack; remaining focus is provider adapters, hardening, and release validation
Overall Status: In Progress

## 1. Execution Rules
- This document is the live execution tracker for the MVP.
- Tasks are ordered sequentially for single-builder delivery.
- A task is marked `Completed` only when the repo already satisfies its acceptance condition.
- A task is marked `In Progress` when implementation exists but the acceptance condition is not fully met.
- A task is marked `Not Started` when meaningful repo work has not begun.
- Scope may not be added here unless the implementation plan and traceability matrix are updated first.

## 2. Current Summary
- Finished enough to continue product work:
  - repo/workspace bootstrap
  - React Native scaffold
  - mirrored mock service layer
- Android native USSD shortcode launch for contribution initiation, with backend-confirmed simulated reconciliation after return
- Hosted provider-style USSD simulator callback endpoint and local harness for sandbox preparation
  - member/admin UI scaffolding
  - fixed-schema SQL bootstrap
  - Edge Function directory/contracts scaffold
  - modularized auth/member/admin screen structure with Android-leaning design system
  - automated Android debug startup script
  - live Supabase auth + Twilio OTP path
  - live KYC submit/review path
  - live group lifecycle backend and hybrid mobile wiring
  - live simulated contribution backend with persisted transaction writes
  - live server-side round completion and draw trigger
  - live notifications, reminder derivation, and admin overview reads
  - mobile env wiring no longer depends on hardcoded Supabase keys in source
  - real KYC storage upload path
- Still pending for real MVP completion:
  - real provider integrations beyond the simulated reconciliation path
  - emulator evidence, release APK flow, and broader UAT capture

## 3. Sequential Work Tracker

| Seq | ID | Stage | Task | Derived From | Status | Depends On | Evidence | Acceptance Condition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | A1 | Stage A | Create repo execution structure (`mobile`, `supabase`, delivery docs, root scripts) | Plan Stage A | Completed | None | `mobile/`, `supabase/`, root `package.json`, `README.md` | Workspace folders and root commands exist | Done |
| 02 | A2 | Stage A | Scaffold bare React Native Android app in TypeScript | Plan Stage A | Completed | A1 | `mobile/` RN project | App scaffold exists and compiles | Done |
| 03 | A3 | Stage A | Add runtime dependencies for navigation, query, forms, storage, Supabase client | Plan Stage A | Completed | A2 | `mobile/package.json` | Required dependencies are installed and referenced | Done |
| 04 | A4 | Stage A | Add root Android startup automation script | Plan Stage A | Completed | A2 | `scripts/start-android-dev.ps1` | Single command can start Metro, reverse port, install, and launch debug app | Done |
| 05 | A5 | Stage A | Confirm Android debug run on physical device/emulator | Plan Stage A | Completed | A4 | startup script run, physical-device install success | App installs and launches from automated startup flow | Done on connected physical device |
| 06 | A6 | Stage A | Establish environment/config strategy for mobile and backend | Plan Stage A | Completed | A1 | `mobile/.env.example`, `mobile/src/services/supabaseClient.ts`, `README.md` | Explicit env file strategy documented and wired | Mobile env now uses `.env`; backend secrets remain in Supabase project secrets |
| 07 | A7 | Stage A | Validate fixed schema against master spec | Plan Stage A | Completed | A1 | `supabase/sql/001_fixed_schema.sql` | Only fixed tables are represented | Done |
| 08 | B1 | Stage B | Define domain types aligned to fixed schema | Plan Stage B | Completed | A2 | `mobile/src/types/domain.ts` | Domain types cover fixed entities and app-facing snapshots | Done |
| 09 | B2 | Stage B | Define stable service contracts for auth/KYC/groups/payments/notifications/reports | Plan Stage B | Completed | B1 | `mobile/src/services/contracts/index.ts` | App depends on contracts, not direct backend shape guesses | Done |
| 10 | B3 | Stage B | Create deterministic seed data for users, groups, rounds, transactions, notifications | Plan Stage B | Completed | B1 | `mobile/src/data/seed.ts` | Seed data supports repeatable member/admin flows | Done |
| 11 | B4 | Stage B | Implement mirrored mock auth flow with session restore | Plan Stage B | Completed | B2, B3 | `mockBackend.ts`, auth provider | Register/login/restore exist with fixed-schema semantics | Done |
| 12 | B5 | Stage B | Implement mirrored OTP challenge flow | Plan Stage B | Completed | B4 | `mockBackend.ts`, auth screens, tests | OTP request and verify behave like service-layer auth logic | Done |
| 13 | B6 | Stage B | Implement mirrored KYC submit/review/ban flow | Plan Stage B | Completed | B2, B3 | `mockBackend.ts`, auth/admin screens | KYC gating and admin review paths function through contracts | Done |
| 14 | B7 | Stage B | Implement mirrored group request / approval / rejection / freeze behavior | Plan Stage B | Completed | B2, B3 | `mockBackend.ts`, admin/member screens | Group status transitions follow master spec and compliance control | Done |
| 15 | B8 | Stage B | Implement mirrored browse / join rules | Plan Stage B | Completed | B7 | group service + member screens | Join blocked for full or duplicate membership; active groups only | Done |
| 16 | B9 | Stage B | Implement mirrored contribution reconciliation flow, including USSD verification behavior | Plan Stage B | Completed | B8 | payment service + screens, `mockBackend.test.ts` | Successful contributions write transactions and update progress through the same contribution contract | Done in mock layer |
| 17 | B10 | Stage B | Implement mirrored automatic draw / payout creation flow | Plan Stage B | Completed | B9 | `mockBackend.ts`, tests | Last payment auto-completes round and creates pending payout | Done |
| 18 | B11 | Stage B | Implement mirrored payout wallet-clearance flow | Plan Stage B | Completed | B10 | wallet/withdraw screens, payment service | Pending payout can be cleared from the wallet ledger and status changes | Done |
| 19 | B12 | Stage B | Implement mirrored reminder queue and notification flow | Plan Stage B | Completed | B9 | notification service + admin report/reminder surfaces | Reminder generation and notification list exist behind contracts | Done |
| 20 | B13 | Stage B | Implement mirrored report list/export payloads | Plan Stage B | Completed | B2 | report service + admin reports screen | Export contract returns structured file payload | Done as mock output |
| 21 | B14 | Stage B | Add automated tests for critical mock state transitions | Plan Stage B | Completed | B4-B13 | `mockBackend.test.ts` | Tests cover auth, OTP, auto-draw, freeze behavior | Done |
| 22 | C1 | Stage C | Replace mock register/login with real Edge Function implementation | Plan Stage C | Completed | A6, B2 | `supabase/functions/register-login/index.ts`, deployed to project `yxgfvkxdiicvckcwpdmc`, `liveAuthService.ts`, device OTP test | Auth provider uses live backend endpoint for register/login | Done |
| 23 | C2 | Stage C | Implement real password hashing and fixed-table auth persistence | Plan Stage C | Completed | C1 | `supabase/functions/_shared/auth.ts`, successful live registration/login | `Password_Hash` is generated and verified server-side | Done |
| 24 | C3 | Stage C | Implement real stateless token issuance and validation | Plan Stage C | Completed | C1 | `supabase/functions/_shared/auth.ts`, `AuthProvider.tsx`, live restore flow | Restore/session validation works against real backend tokens | Done |
| 25 | C4 | Stage C | Implement real OTP generation/verification path | Plan Stage C | Completed | C1 | `supabase/functions/_shared/twilioVerify.ts`, live SMS OTP test on device | OTP no longer mocked in service layer | Done |
| 26 | C5 | Stage C | Implement real KYC file storage and image reference handling | Plan Stage C | Completed | A6, C1 | `kyc-submit-review`, `liveKycService.ts`, signed upload path | `Student_ID_Img` stores real uploaded reference | Storage upload is real; current UI still uploads a dev placeholder image until image-picker work lands |
| 27 | C6 | Stage C | Implement real admin KYC review/ban path | Plan Stage C | Completed | C5 | `supabase/functions/kyc-submit-review/index.ts`, `liveKycService.ts`, deployed function | KYC decisions persist against live backend | Done, with storage upload still pending under C5 |
| 28 | D1 | Stage D | Implement live browseable groups query | Plan Stage D | Completed | C3 | `supabase/functions/group-lifecycle/index.ts`, `liveGroupsService.ts`, hosted runtime check | Browse screen uses real backend data | Done |
| 29 | D2 | Stage D | Implement live create-group request path | Plan Stage D | Completed | C6 | `group-lifecycle` createRequest, hosted runtime check | Verified member can submit `Pending` group request | Done |
| 30 | D3 | Stage D | Implement live admin approve/reject/freeze path | Plan Stage D | In Progress | D2 | `group-lifecycle` admin actions, hosted runtime check | Group status transitions persist server-side | Approve and freeze are live; reject follows the fixed-schema pending-state rule and needs final UX handling |
| 31 | D4 | Stage D | Generate and persist `Virtual_Acc_Ref` on approval | Plan Stage D | Completed | D3 | `group-lifecycle` approve action, hosted runtime check | Approved groups receive unique collection ref | Done |
| 32 | D5 | Stage D | Implement live join validation and membership write | Plan Stage D | Completed | D1, D3 | `group-lifecycle` join action, hosted runtime check | Group join rules enforced by backend | Done |
| 33 | D6 | Stage D | Implement live dashboard/group-status snapshots | Plan Stage D | Completed | D5 | `group-lifecycle` dashboard/status actions, `liveGroupsService.ts`, hosted runtime check | Member dashboard and group status fully run from live backend | Done |
| 34 | E1 | Stage E | Implement live contribution initiation contract matching the Android-native USSD launch flow | Plan Stage E | Completed | D6 | `supabase/functions/contribution-reconcile/index.ts`, `livePaymentsService.ts`, Android native launcher, hosted runtime check | App launches native carrier shortcode and keeps backend in control of reconciliation | Done |
| 35 | E2 | Stage E | Implement live simulated USSD payment reconciliation path after native return | Plan Stage E | Completed | E1 | `contribution-reconcile` hosted runtime check, native USSD confirmation flow | Successful user-confirmed USSD payment writes real transaction row | Done |
| 36 | E3 | Stage E | Implement sender phone normalization in backend | Plan Stage E | Completed | E2 | `_shared/phone.ts`, `contribution-reconcile` callback reconciliation | `+251` normalization and matching logic exists live | Done |
| 37 | E4 | Stage E | Prevent duplicate current-round contribution at backend | Plan Stage E | Completed | E2 | `contribution-reconcile` validation path | Same user cannot pay same round twice | Done |
| 38 | E5 | Stage E | Replace transaction history query with live backend data | Plan Stage E | Completed | E2 | `livePaymentsService.ts`, `contribution-reconcile` read action | History is fully backed by real transactions | Done |
| 39 | E6 | Stage E | Add Chapa sandbox adapter behind payment contract | Plan Stage E | In Progress | E1 | `_shared/paymentProviders.ts`, `contribution-reconcile` | Chapa path exists without changing app service contract | Adapter boundary is live-simulated; no real Chapa server calls yet |
| 40 | F1 | Stage F | Implement live round completion detection | Plan Stage F | Completed | E2-E4 | `contribution-reconcile`, `_shared/roundLifecycle.ts`, hosted runtime check | Backend detects when round payments equal active members | Done |
| 41 | F2 | Stage F | Implement live automatic winner selection and win-once rule | Plan Stage F | Completed | F1 | `_shared/roundLifecycle.ts`, deterministic hosted runtime check | Winner is selected automatically server-side | Done |
| 42 | F3 | Stage F | Implement live payout transaction creation | Plan Stage F | Completed | F2 | `_shared/roundLifecycle.ts`, contribution completion response with payout amount | Pending payout transaction created for winner | Done |
| 43 | F4 | Stage F | Implement live payout wallet-clearance mutation | Plan Stage F | Completed | F3 | `livePaymentsService.ts`, `wallet-clearance/`, `Build/delivery/evidence/wallet-clearance-validation.json` | Pending payout transitions out of the wallet ledger without external gateway dependency | Done |
| 44 | F5 | Stage F | Implement live unpaid-member reminder derivation | Plan Stage F | Completed | F1 | `report-export`, `liveNotificationsService.ts` | Reminder queue derives from memberships minus successful contributions | Done |
| 45 | F6 | Stage F | Replace wallet/notification/reminder UI with live backend data | Plan Stage F | Completed | F3-F5 | `livePaymentsService.ts`, `liveNotificationsService.ts`, `liveReportsService.ts` | Wallet and notifications no longer depend on mock backend | Done |
| 46 | G1 | Stage G | Implement live admin metrics/overview data | Plan Stage G | Completed | C-D-F stages | `report-export`, admin dashboard query path | Admin dashboard uses real backend metrics | Done |
| 47 | G2 | Stage G | Implement real report export generation (PDF/CSV) | Plan Stage G | Completed | G1 | `report-export`, `liveReportsService.ts`, `Build/delivery/evidence/report-export-validation.json` | Export outputs are generated, not placeholder strings | CSV is text; PDF is binary base64 with `%PDF-` header |
| 48 | G3 | Stage G | Add full loading / empty / retry / low-bandwidth UX states | Plan Stage G | In Progress | B-stage app screens | modularized screen files, redesigned shared UI primitives, loading/empty states added across auth/member/admin | All critical screens have production-ready state handling | Loading and empty states are now broadly implemented; retry and low-bandwidth tuning remain |
| 49 | G4 | Stage G | Remove remaining mock/demo wording from user-facing UI | Plan Stage G | Completed | B-stage app screens | redesigned screen copy in modular auth/member/admin surfaces | No debug/mock language visible in normal user surfaces | Experimental one-shot USSD labeling remains intentionally explicit |
| 50 | G5 | Stage G | Review security hardening for transport, token checks, retries | Plan Stage G | Not Started | C-F live backend | None | Security review items implemented against live backend | Pending |
| 51 | H1 | Stage H | Expand automated tests beyond mock backend core | Plan Stage H | In Progress | B-stage app scaffold | Jest service tests exist | Screen/provider/backend integration tests added | Partial |
| 52 | H2 | Stage H | Run emulator validation with scripted startup | Plan Stage H | Not Started | Android SDK + AVD | None | App verified on emulator | Pending |
| 53 | H3 | Stage H | Run physical-device validation and log evidence | Plan Stage H | In Progress | A5 | physical install/launch already proven | Full member and admin flows validated on device with evidence captured | Partial |
| 54 | H4 | Stage H | Generate debug APK artifact and document path | Plan Stage H | Completed | H2 or H3 | `Build/delivery/evidence/debug-apk-build.json`, `mobile/android/app/build/outputs/apk/debug/app-debug.apk` | Debug APK build path recorded in evidence log | Done |
| 55 | H5 | Stage H | Generate release APK path that works without Metro | Plan Stage H | Not Started | live/backend readiness not required, signing needed | None | Release APK builds successfully | Pending |
| 56 | H6 | Stage H | Prepare UAT checklist and final delivery evidence pack | Plan Stage H | In Progress | H2-H5 | `Build/delivery/uat_checklist.md`, `Build/delivery/evidence/` | Delivery evidence complete and traceable | Checklist and core evidence artifacts are in place; full final pack still needs emulator/device/UAT completion |

## 4. Milestone State Summary

| Milestone | Current State | Honest Status |
| --- | --- | --- |
| M0 Bootstrap | Workspace, scripts, schema scaffold, and startup automation exist | Mostly Completed |
| M1 Domain / Contracts | Types, contracts, seeds, and mirrored mock backend exist | Mostly Completed |
| M2 Auth / KYC | Live auth, OTP, KYC review, and storage upload path are active | In Progress |
| M3 Groups | Live browse/create/approve/join/dashboard flow is active; reject UX still needs final handling under the fixed-schema rule | In Progress |
| M4 Payments | Live simulated contribution writes, history reads, normalization, and adapter boundaries are active; real provider calls are still absent | In Progress |
| M5 Auto Draw / Payout / Reminders | Live round completion, payout creation, reminder derivation, and wallet clearance are active | In Progress |
| M6 Admin / Reports / Hardening | Admin overview and live CSV/PDF export are active; hardening remains incomplete | In Progress |
| M7 QA / APK / Submission | Only partial validation exists | Not Started |

## 5. Evidence Inventory
- Workspace bootstrap: `mobile/`, `supabase/`, root `package.json`, `README.md`
- Fixed schema: `supabase/sql/001_fixed_schema.sql`
- Seed data: `supabase/sql/002_seed_minimal.sql`, `mobile/src/data/seed.ts`
- Service contracts: `mobile/src/services/contracts/index.ts`
- Mirrored mock backend: `mobile/src/services/mock/mockBackend.ts`
- Mock backend tests: `mobile/src/services/mock/mockBackend.test.ts`
- Live auth/KYC backend: `supabase/functions/register-login/index.ts`, `supabase/functions/kyc-submit-review/index.ts`
- Live mobile auth/KYC wiring: `mobile/src/services/live/liveAuthService.ts`, `mobile/src/services/live/liveKycService.ts`, `mobile/src/providers/AuthProvider.tsx`
- Live group lifecycle backend: `supabase/functions/group-lifecycle/index.ts`, `mobile/src/services/live/liveGroupsService.ts`
- Live simulated contribution backend: `supabase/functions/contribution-reconcile/index.ts`, `mobile/src/services/live/livePaymentsService.ts`
- Live notifications/reports: `mobile/src/services/live/liveNotificationsService.ts`, `mobile/src/services/live/liveReportsService.ts`, `supabase/functions/report-export/index.ts`
- Mobile env wiring: `mobile/.env.example`, `mobile/src/services/supabaseClient.ts`
- Seed script for final-draw scenario: `mobile/scripts/seed-final-draw.js`
- Startup automation: `scripts/start-android-dev.ps1`
- Evidence artifacts: `Build/delivery/evidence/kyc-upload-validation.json`, `Build/delivery/evidence/wallet-clearance-validation.json`, `Build/delivery/evidence/report-export-validation.json`, `Build/delivery/evidence/debug-apk-build.json`, `Build/delivery/evidence/ussd-simulator-validation.json`
- UAT checklist: `Build/delivery/uat_checklist.md`
- Delivery docs: `Build/delivery/implementation_plan.md`, `Build/delivery/implementation_traceability_matrix.md`, `Build/delivery/progress_spec.md`

## 6. Open Risks
- Live backend implementation is only partial; auth, KYC, groups, contributions, reminders, and admin overview are live, but some payout, export, and provider behaviors still use simplified implementations.
- The original `payout-withdraw` slug was inconsistent in the hosted project; the app now uses the stable `wallet-clearance` route instead.
- The seeded final-draw scenario needs one real member phone number because OTP login is mandatory; a dummy seeded tester account would not be usable by the user.
- The fixed schema has no persisted group description or rejected status field. The live backend currently honors that constraint, which means rejected-group UX and rich group copy still need a product-safe handling strategy.
- True image capture is wired, but it still relies on device camera/gallery permissions and has not yet been validated on a physical device in this workspace session.
- Android debug testing is now automated, but release APK generation and emulator validation are still pending.
- Major screen-level inline style debt was removed by modularizing auth/member/admin surfaces and rebuilding the shared UI layer; residual polish still needs on-device validation.
- The mock layer is now close to the intended backend contracts, but any future contract change must be updated in both the mock implementation and the Edge Function scaffolds immediately.



