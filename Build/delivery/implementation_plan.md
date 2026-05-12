# UniEqub End-to-End MVP Implementation Plan

Version: 1.1
Last Updated: 2026-05-12
Source Inputs: `Build/master_spec/uni_equb_living_technical_spec_v_1.md`, `Build/delivery/phase2_expansion_spec.md`, `Build/delivery/phase2_edge_function_impact.md`, current repo state, active delivery decisions

## 1. Delivery Objective
UniEqub will be delivered as an Android-first MVP built with bare React Native and a Supabase-backed service layer. The original Stage A-H delivery covers the full member and admin lifecycle defined in the master spec: registration, KYC review, group creation and approval, joining, contribution tracking, automatic winner selection, payout withdrawal, reminders, history, and admin reporting.

For the original MVP baseline, `User`, `EqubGroup`, `GroupMembers`, `Round`, and `Transaction` remain the canonical academic foundation. Phase 2 lifts the earlier no-new-tables restriction and allows additive companion tables as defined in `Build/delivery/phase2_expansion_spec.md`. The Phase 2 rule is additive preservation: do not remove or destructively replace the existing MVP implementation; extend it through companion tables, service-layer logic, indexes, constraints, and new Edge Function capabilities.

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

### 2.1 Phase 2 Expansion Override
The original locked decision that prohibited new tables is superseded for Phase 2 by `Build/delivery/phase2_expansion_spec.md`. New tables may be added when they are additive companions to the five core MVP tables and preserve existing flows.

Phase 2 priorities are:
- group formation lobby before canonical `EqubGroup` creation
- contribution obligations and obligation-based round readiness
- mock payment provider attempts and duplicate-callback protection
- wallet/simulated ledger entries
- payout requests, reserves, and maturity/vesting release schedules
- reliability profiles and restrictions separate from KYC
- durable notifications and append-oriented audit events
- configuration-driven business rules through `app_config`

Wallet terminology is acceptable for defense-stage documentation and UI only when the system clearly states that wallet behavior is simulated/mock and not real fund custody.

## 3. Architecture To Build
### 3.1 Mobile Layers
- `src/types`: domain and API-facing types that mirror the MVP core schema, service responses, and Phase 2 companion models as they are introduced.
- `src/services/contracts`: stable interfaces for auth, KYC, groups, payments, notifications, and reports.
- `src/services/mock`: mirrored backend behavior used until live backend parity is achieved.
- `src/providers`: auth, services, query, app bootstrapping.
- `src/hooks`: query and mutation hooks; screens must not call raw services directly.
- `src/screens/auth`, `src/screens/member`, `src/screens/admin`: feature surfaces grouped by actor role.
- `src/components`: reusable UI primitives.
- `src/theme`: tokens and shared visual system.

### 3.2 Backend Layers
- `supabase/sql`: MVP baseline schema bootstrap, seed data, and Phase 2 additive migrations that preserve the core tables.
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
- MVP baseline storage constraints and Phase 2 companion-table constraints
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
- create `supabase/` structure and MVP baseline SQL bootstrap
- create delivery documents in `Build/delivery/`
- create initial implementation traceability matrix
- verify the repo compiles and unit tests run

Outputs:
- runnable RN workspace
- stable folder conventions
- root documentation and startup scripts
- MVP baseline SQL core

Acceptance:
- `npx tsc --noEmit` passes
- Jest passes
- Android debug startup can be scripted from the repo root

### Stage B — Domain Model, Service Contracts, and Mirrored Mock Backend
Goal: make the app flow against a realistic service layer before the real backend is implemented.

Tasks:
- define all domain types aligned to the MVP baseline schema
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
- implement OTP challenge generation and validation in service logic without new tables for the MVP baseline
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

## 8. Phase 2 Expansion Planning Addendum
Phase 2 implementation must follow `Build/delivery/phase2_expansion_spec.md` as the planning source of truth. This addendum does not erase the Stage A-H MVP plan; it extends the completed/in-progress MVP spine.

### 8.1 Documentation Alignment Requirement
Before Phase 2 code implementation, docs that still describe the five-table model as immutable must be updated or explicitly marked as MVP-baseline-only. The current implementation plan, progress spec, traceability matrix, README, and master spec must all point to the Phase 2 expansion rule.

### 8.2 Phase 2 Database Foundation
The first implementation wave should add migrations for the expansion foundation tables listed in the Phase 2 spec: `app_config`, `audit_events`, `notifications`, `group_requests`, `group_join_requests`, `group_invitations`, `contribution_obligations`, `payment_provider_attempts`, `ledger_entries`, `payout_requests`, `payout_release_schedules`, `user_reliability_profiles`, and `user_restrictions`.

### 8.3 Phase 2 Service Strategy
Frontend service contracts should be extended only when screens need them. Sensitive writes for audit, ledger, provider attempts, payout requests, reliability, and restrictions must be server-side Edge Function responsibilities. Existing auth, KYC, group, payment, notification, and reporting services remain valid during migration.

### 8.4 Phase 2 Acceptance Themes
Phase 2 acceptance is not just table creation. It must prove:
- group formation creates canonical groups only after approval
- contribution obligations are generated idempotently when rounds open
- draw readiness is obligation-based rather than transaction-count-only
- duplicate mock provider callbacks cannot create duplicate successful transactions
- payout maturity creates immediate release plus reserve records where required
- reliability restrictions are separate from KYC state
- notifications are durable while legacy derived notices are phased out
- sensitive admin/system actions write audit events

### 8.5 Edge Function Impact Guidance
Phase 2 database additions should not remove Edge Functions from sensitive workflows. `Build/delivery/phase2_edge_function_impact.md` defines the intended split: PostgreSQL owns durable workflow state, constraints, idempotency, views, notifications, ledger, audit, and config; Edge Functions remain responsible for authorization, command orchestration, mock provider simulation, admin decisions, draw/payout/default workflows, and report export.

