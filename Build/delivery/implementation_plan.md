# UniEqub End-to-End MVP Implementation Plan

Version: 1.0  
Last Updated: 2026-03-07  
Source Inputs: `Build/master_spec/uni_equb_living_technical_spec_v_1.md`, current repo state, active delivery decisions

## 1. Delivery Objective
UniEqub will be delivered as an Android-first MVP built with bare React Native and a Supabase-backed service layer. The project must cover the full member and admin lifecycle defined in the master spec: registration, KYC review, group creation and approval, joining, contribution tracking, automatic winner selection, payout withdrawal, reminders, history, and admin reporting. The fixed persistence model is non-negotiable. No new database tables may be introduced outside `User`, `EqubGroup`, `GroupMembers`, `Round`, and `Transaction`.

The implementation will proceed in two layers:
- A high-fidelity mocked service layer that mirrors the final backend contracts and business rules.
- A staged replacement of those mock implementations with real Supabase Edge Functions and SQL-backed behavior.

## 2. Locked Technical Decisions
- Mobile app: bare React Native, TypeScript, Android-first.
- State/query: TanStack Query.
- Forms/validation: React Hook Form + Zod.
- Secure session storage: react-native-keychain with AsyncStorage fallback.
- Backend runtime: Supabase PostgreSQL + Edge Functions.
- Auth source of truth: fixed `User` table with `Password_Hash`, not Supabase Auth primary identity.
- Payment strategy: mock-first gateway abstraction with a session-driven USSD contribution flow; Chapa sandbox is a later contribution integration behind the same contract.
- Withdrawal strategy before legal approval: internal wallet-clearance only; no Chapa withdrawal integration in the MVP submission build.
- Notification strategy: in-app notification center plus mocked provider logs until real provider integration exists.
- UI source of truth: master spec and approved product flows; the HTML mock is reference-only.
- Execution model: single builder, sequential delivery.

## 3. Architecture To Build
### 3.1 Mobile Layers
- `src/types`: domain and API-facing types that mirror the fixed schema and service responses.
- `src/services/contracts`: stable interfaces for auth, KYC, groups, payments, notifications, and reports.
- `src/services/mock`: mirrored backend behavior used until live backend parity is achieved.
- `src/providers`: auth, services, query, app bootstrapping.
- `src/hooks`: query and mutation hooks; screens must not call raw services directly.
- `src/screens/auth`, `src/screens/member`, `src/screens/admin`: feature surfaces grouped by actor role.
- `src/components`: reusable UI primitives.
- `src/theme`: tokens and shared visual system.

### 3.2 Backend Layers
- `supabase/sql`: fixed schema bootstrap, seed data, and future policy or view scripts that do not break schema constraints.
- `supabase/functions/register-login`: register, OTP, login, restore-session behavior.
- `supabase/functions/kyc-submit-review`: KYC upload/review/ban flows.
- `supabase/functions/group-lifecycle`: browse, create request, approve/reject, freeze, join.
- `supabase/functions/contribution-reconcile`: initiate payment, normalize sender phone, reconcile successful transactions.
- `supabase/functions/round-complete`: detect full round payment, lock round, select winner automatically, create payout transaction, open next round.
- `supabase/functions/payout-withdraw`: locate pending payout and clear the internal wallet ledger until legal approval exists for external withdrawal processing.
- `supabase/functions/report-export`: admin overview, report listing, PDF/CSV export.

### 3.3 Mock-to-Live Parity Rule
Every mock service must preserve the final backend contract shape and the same business rules. The mock layer must simulate:
- validation failures
- fixed-schema storage constraints
- KYC gating
- duplicate and conflict protection
- payment reconciliation results
- session-driven USSD input and confirmation behavior for contributions
- automatic round completion and payout creation
- freeze/suspend behavior
- reminder generation
- export payloads

The live backend replacement must only swap implementation behind the contract, not redesign the app flow.

## 4. End-to-End Delivery Stages

### Stage A — Workspace Bootstrap and Execution Baseline
Goal: establish a runnable mobile workspace and aligned backend scaffold.

Tasks:
- scaffold bare React Native Android app in `mobile/`
- add required runtime and dev dependencies
- establish root scripts for start, typecheck, lint, tests, and Android startup automation
- create `supabase/` structure and fixed-schema SQL bootstrap
- create delivery documents in `Build/delivery/`
- create initial implementation traceability matrix
- verify the repo compiles and unit tests run

Outputs:
- runnable RN workspace
- stable folder conventions
- root documentation and startup scripts
- fixed-schema SQL baseline

Acceptance:
- `npx tsc --noEmit` passes
- Jest passes
- Android debug startup can be scripted from the repo root

### Stage B — Domain Model, Service Contracts, and Mirrored Mock Backend
Goal: make the app flow against a realistic service layer before the real backend is implemented.

Tasks:
- define all domain types aligned to the fixed schema
- define stable service interfaces for auth, KYC, groups, payments, notifications, reports
- create deterministic seed data for members, admin, groups, rounds, transactions, notifications
- implement mirrored mock backend that enforces the same business rules expected from Edge Functions
- implement a session-driven mock USSD contribution prompt that uses numbered replies, merchant reference validation, amount confirmation, and PIN authorization
- add tests for mocked auth, OTP, automatic draw, and compliance states

Outputs:
- service contracts are stable
- mock backend can drive the app without fake UI-only shortcuts
- backend behavior is reproducible and testable

Acceptance:
- auth, KYC, group join, contribution, auto-draw, payout, reminder, and admin actions all work against the mock backend
- mock behavior is covered by unit tests for critical state transitions

### Stage C — Auth and KYC Production Path
Goal: replace mocked auth/KYC logic with real backend implementation.

Tasks:
- implement password hashing and user creation in fixed `User` table
- implement OTP challenge generation and validation in service logic without new tables
- implement stateless session token issuance and validation
- implement session restore and logout behavior
- implement KYC file storage path and `Student_ID_Img` updates
- implement admin KYC review and ban state transitions
- enforce KYC restrictions on protected operations

Outputs:
- real auth backend
- real KYC review flow
- app auth provider switched from mock to live endpoints

Acceptance:
- duplicate phone registration blocked
- banned login blocked
- pending KYC blocks create-group and withdraw actions
- verified KYC unlocks restricted flows

### Stage D — Group Lifecycle Production Path
Goal: move browse/create/approval/join flows to real backend execution.

Tasks:
- implement browseable active groups query
- implement create-group request submission with `Pending` status
- implement admin approve/reject/freeze behavior
- generate `Virtual_Acc_Ref` on approval
- implement join validation: active group only, verified member, not already joined, not full
- expose group detail and group status snapshots from backend logic

Outputs:
- real group discovery and administration flows
- real membership writes into `GroupMembers`

Acceptance:
- active groups are visible and joinable only when rules pass
- rejected groups stay non-public
- frozen groups block contributions and new joins

### Stage E — Contribution and Reconciliation Production Path
Goal: implement real backend-controlled contribution handling with mock-first provider behavior.

Tasks:
- formalize payment initiation contract
- implement live payment initiation to match the session-driven mock USSD contribution contract
- normalize sender phone numbers, including `+251 -> 09`
- reconcile contributions into `Transaction`
- prevent duplicate current-round contribution records for a user
- expose transaction history through backend queries
- maintain compatibility with later Chapa integration

Outputs:
- real contribution endpoint and reconciliation logic
- history based on `Transaction` table only

Acceptance:
- successful payment updates group progress from backend truth
- failed payment does not change ledger state
- duplicate pay for same round is blocked

### Stage F — Automatic Draw, Payout, and Reminder Production Path
Goal: move automatic winner selection and payout lifecycle to backend-controlled runtime.

Tasks:
- detect when successful contributions equal active memberships for the round
- lock the round
- derive eligible participants from payments and prior winners
- run RNG selection server-side
- persist `Winner_ID`, `Draw_Date`, and completed round state
- create pending payout transaction for the winner
- open next round where appropriate
- derive unpaid members and queue reminders
- expose reminder state and winner announcements to the app

Outputs:
- full automatic round lifecycle
- no manual draw control in client or admin UI
- real payout-ready state

Acceptance:
- last successful contribution automatically triggers winner selection
- payout becomes visible in wallet without manual admin action
- reminders derive only from actual unpaid members

### Stage G — Admin Oversight, Reporting, and Hardening
Goal: complete admin oversight flows and production-ready error handling.

Tasks:
- implement admin dashboards backed by real metrics
- implement freeze/suspend flow for flagged groups
- implement report generation payloads and final PDF/CSV export path
- add empty, retry, loading, and low-bandwidth-friendly states
- ensure HTTPS-only configuration, token validation, and provider retry/backoff
- remove remaining mock/demo language from user-facing UI

Outputs:
- complete admin workspace
- reporting and compliance controls
- hardened user experience states

Acceptance:
- admin can review KYC, approve groups, freeze groups, send reminders, and export reports
- admin cannot manually trigger draws or directly transfer funds

### Stage H — QA, APK Delivery, and Final Submission
Goal: finish validation, package the app, and document handoff.

Tasks:
- expand unit tests around service logic and key screens
- run emulator and physical-device validation passes
- verify seeded demonstration path end-to-end
- generate debug and release APKs
- prepare UAT checklist and final evidence log
- reconcile final implementation against traceability matrix and master spec

Outputs:
- tested APK deliverables
- evidence-backed delivery package
- final acceptance tracker

Acceptance:
- app installs and runs on emulator and physical Android device
- critical member and admin flows pass
- evidence is recorded in the progress spec and tracker

## 5. Required Public Interfaces and Behavioral Contracts
- Auth service must support register, OTP request/verify, login, restore, logout.
- KYC service must support submit, list pending, approve, ban.
- Group service must support browse, detail, status snapshot, create request, approve, reject, freeze, join, dashboard snapshot.
- Payment service must support contribution payment, transaction listing, wallet snapshot, payout withdrawal.
- Notification service must support list, mark all read, reminder batch generation.
- Report service must support admin overview, report list, export payload.
- Automatic draw contract is fixed: reconcile contribution -> check full round -> lock round -> derive eligible participants -> enforce win-once -> select winner -> create pending payout -> notify.

## 6. Test and Acceptance Matrix
### Required automated checks
- TypeScript compile passes
- lint passes or only has consciously accepted style warnings
- service-layer Jest tests cover auth, OTP, join rules, automatic draw, freeze behavior, payout readiness

### Required scenario validation
- register -> OTP -> KYC submit -> admin approve -> login -> create request
- verified member browse -> join -> pay -> auto draw -> payout ready -> withdraw
- admin review KYC -> approve/reject group -> freeze flagged group -> export report
- banned member cannot log in
- duplicate contribution in the same round is blocked
- full group cannot be joined
- frozen group cannot accept contribution

## 7. Assumptions and Constraints
- Current repo state already includes a working React Native scaffold and a mirrored mocked backend layer.
- Real backend work will replace the mock layer incrementally behind stable contracts.
- Android SDK/device setup is environment work, not product implementation, but remains necessary for release validation.
- The implementation plan is sequential because the project is being executed by a single builder.
- A task should be marked complete in the progress tracker only when its acceptance condition is met in the repo.

