# UniEqub Phase 2 Development Progress Tracker

Version: 1.22
Last Updated: 2026-05-16
Status: Phase 1 database foundation complete in repo and applied remotely; Phase 2 shared helper/type scaffolding complete; Phase 3 group-formation backend paths through admin/creator/member UI started; Phase 4 obligation generation/status/payment-attempt idempotency/outcome/reminder/readiness work started; Phase 5 payment-attempt ledger memo, payout maturity helper, payout request, immediate release, reserve ledger, release schedule, payout idempotency, and reserve release work started; Phase 1 existing-state backfill migration added; legacy group creation compatibility preserved
Primary Sources: `Build/delivery/phase2_expansion_spec.md`, `Build/delivery/phase2_edge_function_impact.md`, current mobile/Supabase codebase, delivery evidence, and MVP progress tracker

## 1. Purpose

This tracker breaks the full path from the current MVP spine to the desired Phase 2 capstone app into small, sequenced, acceptance-driven steps.

It intentionally includes two kinds of work:

- **Agent-doable work**: code, SQL, Edge Functions, tests, documentation updates, scripts, and repo-local evidence that the coding agent can implement.
- **User-required work**: decisions, credentials, Supabase project actions, device testing, OTP phone access, screenshots, thesis diagrams, defense wording, and approvals that cannot be completed by the coding agent alone.

The tracker should be updated after every implementation batch. A row is `Completed` only when the acceptance condition and evidence are present in the repo or in the delivery evidence pack.

## 2. Owner Labels

| Owner | Meaning |
| --- | --- |
| Agent | Coding/documentation work that can be completed in the repo by the coding agent. |
| User | Work requiring human decisions, credentials, real devices, institution context, or non-repo deliverables. |
| Both | Requires code/doc changes by the agent and validation, decisions, or evidence from the user. |

## 3. Status Labels

| Status | Meaning |
| --- | --- |
| Completed | Acceptance condition is satisfied and evidence is recorded. |
| In Progress | Some implementation/evidence exists, but acceptance is not fully met. |
| Not Started | No meaningful work has begun. |
| Blocked | Cannot proceed until a dependency or user-provided item is available. |
| Deferred | Accepted scope, but intentionally delayed until prerequisites are stable. |

## 4. Current Baseline Assessment

| Area | Current State | Implication For Phase 2 |
| --- | --- | --- |
| Mobile app | React Native Android-first member/admin app exists with live service wiring and mock backend fallback. | Keep existing services/screens while adding Phase 2 contracts gradually. |
| Core schema | `User`, `EqubGroup`, `GroupMembers`, `Round`, and `Transaction` exist as MVP baseline. | Add companion migrations; do not destructively replace core tables. |
| Edge Functions | Auth, KYC, group lifecycle, contribution reconciliation, notifications, reports, wallet clearance, and USSD simulator exist. | Refactor toward command-oriented functions backed by durable Phase 2 tables. |
| Payments | Simulated/USSD-style payment flow and callback reconciliation exist. | Keep sandbox/mock; add provider attempts, idempotency, obligation updates, and ledger entries. |
| Draw/payout | Round completion and pending payout transaction creation exist. | Replace transaction-count readiness with obligations; add payout requests/reserves/release schedules. |
| Notifications | Notifications are derived; read state is mobile-local. | Add durable `notifications`, then phase out derived fallback. |
| QA/release | Debug APK evidence exists; release APK/emulator/full UAT still pending. | Preserve original MVP validation while Phase 2 is built. |

## 5. Master Progress Roadmap

### Phase 0 — Alignment, Decisions, and Access

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-000 | Agent | Maintain this tracker as the execution source for Phase 2 implementation batches. | Completed | Existing Phase 2 specs | Tracker exists and distinguishes Agent/User/Both tasks. | `Build/delivery/phase2_development_progress_tracker.md` |
| P2-001 | User | Confirm Phase 2 scope is accepted for the capstone defense and that additive companion tables are allowed. | Not Started | Phase 2 specs | Written confirmation or meeting note is added to delivery evidence. | `Build/delivery/evidence/phase2-scope-approval.*` |
| P2-002 | User | Decide whether wallet terminology remains acceptable for defense-stage UI and documentation. | Not Started | Phase 2 spec | Decision recorded with final wording constraints. | `Build/delivery/evidence/wallet-terminology-decision.md` |
| P2-003 | User | Provide target Supabase project reference, local/remote database access method, and deployment preference. | Completed | None | Agent knows whether to generate SQL only, run local migrations, or prepare remote deployment commands. | Linked project `yxgfvkxdiicvckcwpdmc`; `Build/delivery/evidence/phase2-db-migration.json` |
| P2-004 | User | Provide or confirm secrets strategy for Supabase service role, anon key, Twilio Verify, and any mock provider keys. | Not Started | P2-003 | Secrets are available outside git and documented as environment requirements. | Updated `.env` notes / Supabase secret checklist |
| P2-005 | User | Provide at least one real phone number for OTP/device validation and final-draw seeded scenario. | Not Started | P2-004 | Test phone can receive OTP and be used in UAT. | `Build/delivery/evidence/test-phone-validation.md` |
| P2-006 | User | Decide Phase 2 policy values: min members, max members, formation expiry, grace period, payout release ratio, active group limit, poll hours. | Not Started | Phase 2 spec | Values are approved and ready for `app_config` seed migration. | `Build/delivery/evidence/app-config-decisions.md` |
| P2-007 | Agent | Convert approved policy values into `app_config` seed data once user decisions exist. | Blocked | P2-006 | Seed migration or SQL seed script includes approved values. | Migration/seed SQL |
| P2-008 | User | Confirm whether KYC history tables should be built in the first implementation wave or after the core Phase 2 tables. | Not Started | Phase 2 spec | Priority decision is recorded. | `Build/delivery/evidence/kyc-history-priority.md` |
| P2-009 | User | Confirm whether disbanded groups map to `Completed`, a new `Disbanded` status, or freeze-event-only terminal state. | Not Started | Phase 2 spec | Canonical disbandment representation is chosen before refund-ticket work. | `Build/delivery/evidence/disbanded-group-status-decision.md` |
| P2-010 | Agent | Keep README, implementation plan, traceability, and progress docs aligned when scope or priority changes. | In Progress | Ongoing implementation | Docs point to current Phase 2 tracker/specs and do not contradict implementation. | Updated delivery docs; latest batches updated tracker/progress/traceability/README |

### Phase 1 — Database Foundation and Guardrails

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-101 | Agent | Add SQL migration for `app_config` with JSONB value, type, description, updater, and timestamp columns. | Completed | Phase 2 spec; P2-006 still required for approved production values | Migration creates table, checks, indexes, and seed values. | `supabase/migrations/20260513090000_phase2_foundation_companion_tables.sql`; `Build/delivery/evidence/phase2-foundation-validation.json` |
| P2-102 | Agent | Add SQL migration for append-oriented `audit_events`. | Completed | None | Table exists with actor/entity metadata and update/delete prevention strategy documented or enforced. | Migration creates table comment and `audit_events_prevent_update_delete` trigger |
| P2-103 | Agent | Add SQL migration for durable `notifications`. | Completed | None | Table supports user inbox, severity, action route, related entity, metadata, read timestamp, expiry, and delivery timestamp. | Migration creates table and inbox/related-entity indexes |
| P2-104 | Agent | Add SQL migration for `group_requests`. | Completed | P2-101 | Table supports draft/forming/pending/approved/rejected/expired/cancelled lifecycle and links to approved `EqubGroup`. | Migration creates table with status checks, approval link, and workflow indexes |
| P2-105 | Agent | Add SQL migration for `group_join_requests`. | Completed | P2-104 | Table stores public/private pre-membership interest with decision metadata. | Migration creates table with status checks and unique request-per-user guardrail |
| P2-106 | Agent | Add SQL migration for `group_invitations`. | Completed | P2-104 | Table supports invite code/link and direct phone/student-ID invitation. | Migration creates table with target check and unique non-null invite-code index |
| P2-107 | Agent | Add SQL migration for `contribution_obligations`. | Completed | Core schema | Table has one expected payment row per user/round with statuses and paid transaction link. | Migration creates table with `contribution_obligations_round_user_unique` |
| P2-108 | Agent | Add SQL migration for `payment_provider_attempts`. | Completed | P2-107 | Table stores mock provider lifecycle, payloads, idempotency key, gateway ref, verification result, and failure details. | Migration creates table with idempotency and gateway-reference guardrails |
| P2-109 | Agent | Add SQL migration for append-oriented `ledger_entries`. | Completed | Core schema | Table stores simulated wallet/ledger entries with direction, entry type, metadata, and references. | Migration creates table comment and `ledger_entries_prevent_update_delete` trigger |
| P2-110 | Agent | Add SQL migration for `payout_requests`. | Completed | Core schema | Table separates payout lifecycle from `Transaction` and stores immediate/reserved amounts. | Migration creates table with round/winner uniqueness and payout amount checks |
| P2-111 | Agent | Add SQL migration for `payout_release_schedules`. | Completed | P2-110, P2-107 | Table stores release triggers, amounts, status, and release timestamp. | Migration creates table with payout/status and trigger-obligation indexes |
| P2-112 | Agent | Add SQL migration for `user_reliability_profiles`. | Completed | Core `User` | Table stores public status and internal metrics separate from KYC. | Migration creates table with reliability status/count checks |
| P2-113 | Agent | Add SQL migration for `user_restrictions`. | Completed | P2-112 | Table stores active/cleared/escalated restriction records and recovery counters. | Migration creates table with active restriction uniqueness by user/type |
| P2-114 | Agent | Add mandatory duplicate-protection indexes for current `Transaction` behavior. | Completed | Core schema | DB prevents duplicate successful contribution per user/round and duplicate payout request per winner/round. | Migration adds `idx_transaction_successful_contribution_once` and `idx_transaction_active_payout_once` |
| P2-115 | Agent | Add indexes for Phase 2 query paths and admin dashboards. | Completed | P2-101-P2-113 | Indexes cover formation, obligations, attempts, ledger references, payout requests, restrictions, audit, and notifications. | Migration adds lookup, active/pending workflow, idempotency, and dashboard indexes |
| P2-116 | Agent | Add table comments or migration notes explaining Phase 2 companion-table relationship to core MVP tables. | Completed | P2-101-P2-113 | Future readers understand that core tables are preserved. | Migration header and `comment on table` statements for each companion table |
| P2-117 | Agent | Create local SQL validation script or checklist for Phase 2 migrations. | Completed | P2-101-P2-116 | SQL can be validated locally or through documented Supabase command. | `mobile/scripts/validate-phase2-foundation.js`; `npm run qa:phase2-foundation` evidence |
| P2-118 | User | Apply or approve Phase 2 migrations in the target Supabase environment. | Completed | P2-101-P2-117, P2-003 | Target database contains Phase 2 foundation tables. | User-provided `supabase db push` log recorded in `Build/delivery/evidence/phase2-db-migration.json` |
| P2-119 | Agent | Backfill default `user_reliability_profiles` for existing users. | Completed | P2-112 | Existing members/admins have profile rows with correct initial status. | `supabase/migrations/20260516112000_phase2_backfill_existing_state.sql`; `mobile/scripts/validate-phase2-backfill.js`; `Build/delivery/evidence/phase2-backfill-validation.json` |
| P2-120 | Agent | Backfill contribution obligations for existing open rounds in demo data. | Completed | P2-107 | Existing open rounds have obligations or documented exclusion. | `supabase/migrations/20260516112000_phase2_backfill_existing_state.sql`; `mobile/scripts/validate-phase2-backfill.js`; `Build/delivery/evidence/phase2-backfill-validation.json` |

### Phase 2 — Shared Backend Helpers and Contract Types

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-201 | Agent | Split domain types into `EqubGroupStatus` and `GroupRequestStatus`. | Completed | P2-104 | `Rejected` is not modeled as canonical `EqubGroup.Status`; group request statuses are separate. | `mobile/src/types/domain.ts`; `supabase/functions/_shared/types.ts`; `Build/delivery/evidence/phase2-shared-validation.json`; typecheck passing |
| P2-202 | Agent | Add Phase 2 domain types for config, audit, notifications, formation, obligations, attempts, ledger, payouts, reliability, restrictions. | Completed | P2-101-P2-113 | Mobile/shared TypeScript can represent Phase 2 payloads without overloading MVP types. | `mobile/src/types/domain.ts`; `supabase/functions/_shared/types.ts`; typecheck passing |
| P2-203 | Agent | Add `_shared/config.ts` helper for loading and validating `app_config`. | Completed | P2-101 | Edge Functions read config consistently with fallback/default behavior. | `supabase/functions/_shared/config.ts`; `npm run qa:phase2-shared` |
| P2-204 | Agent | Add `_shared/audit.ts` helper for append-only audit event writes. | Completed | P2-102 | Sensitive functions can write audit events with actor/entity metadata. | `supabase/functions/_shared/audit.ts`; `npm run qa:phase2-shared` |
| P2-205 | Agent | Add `_shared/notifications.ts` helper for durable notification creation. | Completed | P2-103 | Functions can create consistent notification rows. | `supabase/functions/_shared/notifications.ts`; `npm run qa:phase2-shared` |
| P2-206 | Agent | Add `_shared/reliability.ts` helper for public status, active restrictions, and active group limits. | Completed | P2-112, P2-113 | Join/pay/payout checks can query a single helper. | `supabase/functions/_shared/reliability.ts`; `npm run qa:phase2-shared` |
| P2-207 | Agent | Add `_shared/obligations.ts` helper for round obligation generation and readiness. | Completed | P2-107 | Round open and payment flows can generate/read obligations idempotently. | `supabase/functions/_shared/obligations.ts`; `npm run qa:phase2-shared` |
| P2-208 | Agent | Add `_shared/paymentAttempts.ts` helper for idempotent provider attempt lifecycle. | Completed | P2-108 | Mock provider callbacks cannot duplicate successful transactions. | `supabase/functions/_shared/paymentAttempts.ts`; `npm run qa:phase2-shared`; typecheck passing |
| P2-209 | Agent | Add `_shared/ledger.ts` helper for append-oriented simulated ledger entries. | Completed | P2-109 | Contribution, payout, reserve, default, refund flows write ledger entries consistently. | `supabase/functions/_shared/ledger.ts`; `npm run qa:phase2-shared`; typecheck passing |
| P2-210 | Agent | Add `_shared/payoutVesting.ts` helper for maturity, immediate release, reserve, and release schedule calculation. | Completed | P2-101, P2-110, P2-111, P2-112 | Payout flow can compute trusted vs probationary payouts deterministically. | `supabase/functions/_shared/payoutVesting.ts`; `npm run qa:phase2-shared`; typecheck passing |
| P2-211 | Agent | Update `_shared/contracts.ts` with Phase 2 command payloads without breaking existing MVP actions. | Completed | P2-201-P2-210 | Old actions still compile; new action payloads are typed. | `supabase/functions/_shared/contracts.ts`; group formation, payment attempt, and payout payload scaffolds added; typecheck passing |
| P2-212 | Agent | Add service-contract placeholders for frontend-facing Phase 2 services only where screens need them. | Completed | P2-202 | `AppServices` grows intentionally and does not expose sensitive direct-write helpers. | `mobile/src/services/contracts/index.ts`; `mobile/src/services/live/liveGroupFormationService.ts`; `npm run mobile:typecheck` |
| P2-213 | Agent | Add tests for helper-level status transitions and idempotency. | In Progress | P2-203-P2-210 | Tests cover config, audit write, obligation generation, duplicate attempt, payout vesting formula. | Static helper validation exists in `Build/delivery/evidence/phase2-shared-validation.json`; deeper behavior tests still pending |

### Phase 3 — Group Formation Lobby

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-301 | Agent | Create `supabase/functions/group-formation/index.ts`. | Completed | P2-104-P2-106, P2-203-P2-206 | Function skeleton validates sessions and routes formation actions. | `supabase/functions/group-formation/index.ts`; `supabase/config.toml`; `Build/delivery/evidence/phase2-formation-validation.json` |
| P2-302 | Agent | Implement create draft/forming request. | Completed | P2-301 | Verified, unrestricted member can create `group_requests` row with expiry and config-driven min/max rules. | `supabase/functions/group-formation/index.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-303 | Agent | Implement public forming group discovery. | Completed | P2-302 | Eligible users can list public forming requests without seeing private requests. | `supabase/functions/group-formation/index.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-304 | Agent | Implement request-to-join forming group. | Completed | P2-303 | Eligible users can request join after accepting group terms. | `supabase/functions/group-formation/index.ts`; `supabase/functions/_shared/contracts.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-305 | Agent | Implement creator accept/reject/remove participant. | Completed | P2-304 | Creator can manage pending/accepted formation participants with audit events. | `supabase/functions/group-formation/index.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-306 | Agent | Implement invite code/direct invitation and accept invite. | Completed | P2-301 | Private invite flow can add accepted participants without public discovery. | `supabase/functions/group-formation/index.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-307 | User | Decide final wording for payout vesting risk warning and mandatory join agreement. | Not Started | P2-006 | Wording is approved for UI and defense. | `Build/delivery/evidence/vesting-warning-copy.md` |
| P2-308 | Agent | Implement private vesting override with creator warning acceptance. | Not Started | P2-306, P2-307 | Creator can disable vesting only for private invite-based request and audit event is written. | Function test/evidence |
| P2-309 | Agent | Implement submit-for-approval when accepted participants meet configured minimum. | Completed | P2-305/P2-306 | Request moves to `PendingApproval`; notifications/audit are written. | `supabase/functions/group-formation/index.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-310 | Agent | Implement admin approve/reject group request. | Completed | P2-309 | Approve creates canonical `EqubGroup`, `GroupMembers`, initial round, obligations, notifications, audit; reject stays in `group_requests.status = Rejected`. | `supabase/functions/group-formation/index.ts`; `Build/delivery/evidence/phase2-formation-validation.json`; `npm run qa:phase2-formation` |
| P2-311 | Agent | Keep legacy `group-lifecycle.createRequest` compatible during migration. | Completed | P2-301-P2-310 | Existing mobile group creation does not break before UI migration is complete. | `mobile/scripts/validate-phase2-legacy-group-compat.js`; `Build/delivery/evidence/phase2-legacy-group-compatibility.json`; Jest regression in `mobile/src/services/mock/mockBackend.test.ts`; `npm test` |
| P2-312 | Agent | Add mobile formation service contract and live implementation. | Completed | P2-301-P2-310 | Mobile can call formation list/detail/create/join/invite/submit actions. | `mobile/src/services/contracts/index.ts`; `mobile/src/services/live/liveGroupFormationService.ts`; `mobile/src/providers/ServicesProvider.tsx`; `Build/delivery/evidence/phase2-mobile-formation-validation.json`; Jest regression in `mobile/src/services/mock/mockBackend.test.ts`; typecheck passing |
| P2-313 | Agent | Add member UI for forming groups discovery and detail. | Completed | P2-312 | Member can browse public forming requests and request to join. | `mobile/src/screens/member/ExploreScreen.tsx`; `mobile/src/screens/member/FormationDetailScreen.tsx`; `Build/delivery/evidence/phase2-member-formation-ui-validation.json`; typecheck/lint passing |
| P2-314 | Agent | Add creator UI for draft request setup and participant management. | Completed | P2-312 | Creator can create request, invite, accept/remove, and submit for approval. | `mobile/src/screens/member/CreateGroupRulesScreen.tsx`; `mobile/src/screens/member/FormationCreatorScreen.tsx`; `Build/delivery/evidence/phase2-creator-formation-ui-validation.json`; Jest invitation regression; typecheck/lint passing |
| P2-315 | Agent | Add admin UI for Phase 2 group request review. | Completed | P2-310 | Admin sees proposed terms, participants, risk, vesting setting, and can approve/reject. | `mobile/src/screens/admin/AdminGroupsScreen.tsx`; `mobile/scripts/validate-phase2-admin-formation-ui.js`; `Build/delivery/evidence/phase2-admin-formation-ui-validation.json`; Jest admin approval regression; typecheck/lint passing |
| P2-316 | User | Validate group formation flows on emulator/physical device with at least two test accounts. | Blocked | P2-313-P2-315, device access | UAT evidence proves public/private formation and admin approval work. | `Build/delivery/evidence/group-formation-uat.*` |

### Phase 4 — Contribution Obligations and Mock Provider Attempts

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-401 | Agent | Modify `ensureOpenRoundForGroup` to generate obligations idempotently when a new round opens. | Completed | P2-207 | Every active member has one obligation per open round. | `supabase/functions/_shared/rounds.ts`; `supabase/functions/_shared/roundLifecycle.ts`; `mobile/scripts/validate-phase2-round-obligations.js`; `Build/delivery/evidence/phase2-round-obligation-generation-validation.json`; typecheck/lint passing |
| P2-402 | Agent | Update dashboard/status queries to use obligations for paid/unpaid counts. | Completed | P2-401 | Dashboard and group status show obligation-derived progress. | `supabase/functions/_shared/obligations.ts`; `supabase/functions/group-lifecycle/index.ts`; `mobile/scripts/validate-phase2-dashboard-obligations.js`; `Build/delivery/evidence/phase2-dashboard-obligation-status-validation.json`; typecheck/lint passing |
| P2-403 | Agent | Add payment initiation path that creates `payment_provider_attempts` and marks obligation `PendingPayment`. | Completed | P2-208 | Payment start records attempt and pending obligation without creating successful transaction. | `supabase/functions/payment-attempt/index.ts`; `supabase/functions/_shared/paymentAttempts.ts`; `supabase/functions/_shared/obligations.ts`; `mobile/scripts/validate-phase2-payment-attempt-initiation.js`; `Build/delivery/evidence/phase2-payment-attempt-initiation-validation.json`; typecheck/lint passing |
| P2-404 | Agent | Route direct `payContribution` mock flow through provider attempts. | Completed | P2-403 | Direct mock contribution creates attempt, verifies event, marks obligation paid, writes transaction/ledger. | `supabase/functions/contribution-reconcile/index.ts`; `supabase/functions/_shared/obligations.ts`; `mobile/scripts/validate-phase2-direct-payment-attempt-flow.js`; `Build/delivery/evidence/phase2-direct-payment-attempt-flow-validation.json`; typecheck/lint passing |
| P2-405 | Agent | Route USSD session flow through provider attempts. | Completed | P2-403 | USSD success/failure/cancel paths update attempts/obligations consistently. | `supabase/functions/contribution-reconcile/index.ts`; `supabase/functions/_shared/auth.ts`; `supabase/functions/_shared/obligations.ts`; `mobile/scripts/validate-phase2-ussd-payment-attempt-flow.js`; `Build/delivery/evidence/phase2-ussd-payment-attempt-flow-validation.json`; typecheck/lint passing |
| P2-406 | Agent | Route `reconcileProviderCallback` through idempotency and attempt verification. | Completed | P2-403 | Duplicate callback writes audit/attempt metadata but no duplicate successful transaction. | `supabase/functions/contribution-reconcile/index.ts`; `mobile/scripts/validate-phase2-provider-callback-idempotency.js`; `Build/delivery/evidence/phase2-provider-callback-idempotency-validation.json`; typecheck/lint passing |
| P2-407 | Agent | Implement wrong amount, timeout, failure, cancelled, and pending mock outcomes. | Completed | P2-403 | All supported mock events are representable and leave obligation in correct status. | `supabase/functions/payment-attempt/index.ts`; `supabase/functions/_shared/contracts.ts`; `supabase/config.toml`; `mobile/scripts/validate-phase2-payment-outcomes.js`; `Build/delivery/evidence/phase2-payment-outcome-validation.json` |
| P2-408 | Agent | Update `notification-center` or helper writes for payment confirmation/failure/timeout and contribution reminder. | Not Started | P2-205, P2-407 | Payment events create durable notifications. | Function test/evidence |
| P2-409 | Agent | Update admin reminder derivation to use `contribution_obligations`. | Completed | P2-402 | Reminder queue derives from unpaid/late obligations, not transaction-minus-membership only. | `supabase/functions/report-export/index.ts`; `supabase/functions/_shared/obligations.ts`; `mobile/scripts/validate-phase2-reminder-obligations.js`; `Build/delivery/evidence/phase2-reminder-obligation-validation.json` |
| P2-410 | Agent | Change round readiness to settled-obligation logic. | Completed | P2-401-P2-407 | Draw triggers only when all required obligations are settled. | `supabase/functions/_shared/roundLifecycle.ts`; `supabase/functions/_shared/obligations.ts`; `mobile/scripts/validate-phase2-round-readiness.js`; `Build/delivery/evidence/phase2-round-readiness-validation.json` |
| P2-411 | Agent | Add obligation/payment tests to mock backend or live service test harness. | Not Started | P2-401-P2-410 | Tests cover unpaid, pending, paid, failed, duplicate, wrong amount, and readiness. | Jest/script output |
| P2-412 | User | Validate contribution flows on device with success, cancel, wrong amount, duplicate callback, and timeout demo cases. | Blocked | P2-404-P2-411 | Evidence shows all mock outcomes behave defensibly. | `Build/delivery/evidence/payment-attempt-uat.*` |

### Phase 5 — Wallet Ledger, Payout Maturity, and Reliability

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-501 | Agent | Add ledger writes for successful contribution and failed/pending payment attempt memos. | Completed | P2-109, P2-404-P2-407 | Ledger reflects contribution/payment attempt events. | `supabase/functions/contribution-reconcile/index.ts`; `supabase/functions/payment-attempt/index.ts`; `mobile/scripts/validate-phase2-attempt-ledger.js`; `Build/delivery/evidence/phase2-attempt-ledger-validation.json` |
| P2-502 | Agent | Add payout maturity calculation for `New`, `BuildingTrust`, and `Trusted` users. | Completed | P2-210, P2-112 | Immediate/reserved amount follows app config and strict first-cycle rule. | `supabase/functions/_shared/payoutVesting.ts`; `mobile/scripts/validate-phase2-payout-maturity.js`; `Build/delivery/evidence/phase2-payout-maturity-validation.json` |
| P2-503 | Agent | Modify draw completion to create `payout_requests`. | Completed | P2-410, P2-502 | Draw creates payout request instead of only one pending full payout transaction. | `supabase/functions/_shared/roundLifecycle.ts`; `mobile/scripts/validate-phase2-payout-request-flow.js`; `Build/delivery/evidence/phase2-payout-request-flow-validation.json` |
| P2-504 | Agent | Create immediate payout `Transaction` only for immediate release amount. | Completed | P2-503 | Probationary early winner does not receive full early payout transaction. | `supabase/functions/_shared/roundLifecycle.ts`; `Build/delivery/evidence/phase2-payout-request-flow-validation.json` |
| P2-505 | Agent | Create reserve ledger entries and `payout_release_schedules` for withheld amount. | Completed | P2-503 | Reserved payout appears in ledger/schedule and is not immediately withdrawable. | `supabase/functions/_shared/roundLifecycle.ts`; `Build/delivery/evidence/phase2-payout-request-flow-validation.json` |
| P2-506 | Agent | Release reserved payout after later successful obligations. | Completed | P2-505, P2-410 | Successful later contribution triggers scheduled release and ledger entry. | `supabase/functions/_shared/payoutReserves.ts`; `supabase/functions/contribution-reconcile/index.ts`; `supabase/migrations/20260517100000_phase2_payout_round_idempotency.sql`; `Build/delivery/evidence/phase2-payout-idempotency-reserve-release-validation.json` |
| P2-507 | Agent | Update wallet/payout screens to explain immediate release, reserve, and simulated wallet behavior. | Not Started | P2-503-P2-506, P2-307 | User-facing UI is clear and defense-safe. | Screenshots |
| P2-508 | Agent | Enforce new/probationary active group limit during join and formation approval. | Not Started | P2-206, P2-310 | New user cannot exceed configured active group limit through direct join or formation approval. | Tests |
| P2-509 | Agent | Update reliability metrics after group completion, late payment, default, and restriction events. | Not Started | P2-112, P2-113, P2-410 | Perfect completed group count and public status update correctly. | Tests |
| P2-510 | Agent | Add admin/member UI for public reliability label without exposing detailed internal score. | Not Started | P2-509 | UI shows New/Building Trust/Trusted/Restricted/Banned appropriately. | Screenshots |
| P2-511 | User | Validate early-winner payout maturity scenario using seeded final-draw data. | Blocked | P2-501-P2-510, test phone | Evidence shows immediate payout, reserve, later release, and trusted/final-round behavior. | `Build/delivery/evidence/payout-maturity-uat.*` |

### Phase 6 — KYC History, Durable Notifications, Audit, and Reports

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-601 | Agent | Add `kyc_submissions` migration if promoted into this wave. | Not Started | P2-008 | Submission lifecycle table exists. | Migration |
| P2-602 | Agent | Add `kyc_documents` migration if promoted into this wave. | Not Started | P2-601 | Document metadata table exists. | Migration |
| P2-603 | Agent | Update KYC submit flow to create submission/document rows while preserving `User.Student_ID_Img`. | Not Started | P2-601-P2-602 | KYC upload history exists and compatibility field remains updated. | Function tests/evidence |
| P2-604 | Agent | Update admin KYC queue to query latest active submissions, not all unverified users. | Not Started | P2-603 | Admin sees review-ready submissions only. | Function tests |
| P2-605 | Agent | Update KYC approve/reject/needs-resubmission flow with notifications and audit. | Not Started | P2-603-P2-604, P2-205/P2-204 | KYC decision creates durable notification and audit event. | Tests/evidence |
| P2-606 | Agent | Modify `notification-center` to read durable `notifications` first. | Not Started | P2-103, P2-205 | User inbox reads DB notifications. | Function test |
| P2-607 | Agent | Keep derived notification fallback during transition. | Not Started | P2-606 | Existing notification behavior does not disappear while writers are incomplete. | Regression tests |
| P2-608 | Agent | Change `markAllRead` to update `notifications.read_at` for durable rows and local fallback IDs only for derived rows. | Not Started | P2-606-P2-607 | Read state is durable for DB notifications. | Function/mobile tests |
| P2-609 | Agent | Add audit writes to auth, KYC, group formation, contribution attempts, draw, payout, restrictions, group freeze, and report export. | Not Started | P2-204 | Sensitive actions produce audit events with actor/entity metadata. | Tests/evidence |
| P2-610 | Agent | Update report export/admin overview to include Phase 2 tables. | Not Started | P2-101-P2-113, P2-606-P2-609 | Reports include formation, obligations, attempts, ledger, payout, reliability, restrictions, audit counts. | Report validation evidence |
| P2-611 | Agent | Add admin audit timeline/read-only view. | Not Started | P2-609 | Admin can inspect sensitive event history. | Screenshots/evidence |
| P2-612 | User | Provide sample KYC documents or test media for validation. | Not Started | P2-603 | Agent/user can run KYC history UAT without real private student data in repo. | Local test media notes |
| P2-613 | User | Validate durable notifications and audit timeline with member/admin accounts. | Blocked | P2-606-P2-611 | Evidence shows read/unread behavior and audit entries. | `Build/delivery/evidence/notifications-audit-uat.*` |

### Phase 7 — Defaults, Frozen Groups, Polls, and Refund Tickets

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-701 | Agent | Add `group_freeze_events` migration. | Not Started | P2-009 | Freeze events can record unresolved default or insufficient reserve. | Migration |
| P2-702 | Agent | Mark obligations late/defaulted based on due/grace rules. | Not Started | P2-107, P2-101 | Late/default statuses update from config-driven due/grace logic. | Tests |
| P2-703 | Agent | Restrict defaulting user and block normal create/join/pay/payout. | Not Started | P2-113, P2-702 | Restricted user cannot perform blocked normal flows. | Tests |
| P2-704 | Agent | Freeze group when reserve is insufficient and admin review is required. | Not Started | P2-701-P2-703 | Group freeze event is created and notifications/audit are written. | Tests/evidence |
| P2-705 | Agent | Add admin manual resolution for frozen group without polls. | Not Started | P2-704 | Admin can resolve freeze in a controlled, audited manner. | Tests/screenshots |
| P2-706 | Agent | Add `group_resolution_polls`, options, votes, and eligible voter snapshot. | Deferred | P2-705 stable | Poll tables and constraints exist. | Migration |
| P2-707 | Agent | Implement poll open/vote/close logic. | Deferred | P2-706 | Non-defaulted eligible members can vote once; majority and timeout rules work. | Tests/evidence |
| P2-708 | Agent | Add `refund_tickets` migration. | Deferred | P2-009, P2-707 | Refund ticket table exists with calculation snapshot and statuses. | Migration |
| P2-709 | Agent | Implement refund ticket creation after unresolved disbanded/frozen group. | Deferred | P2-708 | Non-defaulted eligible members receive simulated refund tickets; defaulters excluded. | Tests/evidence |
| P2-710 | User | Validate default/freeze/restriction/recovery scenario with agreed demo data. | Blocked | P2-701-P2-709 | Evidence shows default handling is defensible. | `Build/delivery/evidence/default-recovery-uat.*` |

### Phase 8 — Mobile UX Completion

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-801 | Agent | Update navigation routes for formation, requests, invitations, payout reserve, reliability, audit/admin views. | Not Started | Relevant backend services | Navigation supports Phase 2 screens without breaking MVP routes. | Typecheck/screenshots |
| P2-802 | Agent | Add loading/empty/error/retry states for all new Phase 2 screens. | Not Started | P2-801 | No new screen relies on blank/error-prone states. | Screenshots |
| P2-803 | Agent | Add member onboarding explanations for forming groups, vesting, simulated wallet, reliability, and restrictions. | Not Started | P2-307 | Users can understand the new rules before joining/paying. | Screenshots/copy review |
| P2-804 | Agent | Add admin dashboard sections for formation queue, KYC queue, payment attempts, defaults, restrictions, audit, and reports. | Not Started | Backend services | Admin can operate Phase 2 without raw database access. | Screenshots |
| P2-805 | Agent | Replace or annotate any misleading real-money wording with defense-stage simulation wording. | Not Started | P2-002 | UI clearly states wallet/payment behavior is simulated/mock. | Copy review/screenshots |
| P2-806 | User | Review all Phase 2 user-facing copy for academic defense clarity. | Not Started | P2-803-P2-805 | User approves final wording. | `Build/delivery/evidence/phase2-copy-approval.md` |
| P2-807 | User | Validate screen fit and readability on the target Android phone/emulator. | Blocked | P2-801-P2-805 | Evidence confirms key screens fit target device. | Screenshots/video |

### Phase 9 — QA, Evidence, Release, and Academic Submission

| ID | Owner | Task | Status | Depends On | Acceptance Condition | Required Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| P2-901 | Agent | Expand Jest/service tests for Phase 2 helper logic and critical flows. | Not Started | Implemented phases | Tests cover formation, obligations, attempts, duplicate callbacks, payout maturity, restrictions, notifications, audit. | `npm test`/Jest output |
| P2-902 | Agent | Add validation scripts for Phase 2 backend scenarios. | Not Started | Implemented phases | Scripts can generate evidence JSON for key scenarios. | `mobile/scripts/validate-phase2-*.js` |
| P2-903 | Agent | Update UAT checklist for Phase 2 flows. | Not Started | Phase 2 UI/backend | Checklist includes user-only validation steps and expected evidence. | `Build/delivery/uat_checklist.md` |
| P2-904 | User | Run emulator validation pass. | Blocked | P2-903, local Android setup | App installs and passes Phase 2 smoke/UAT on emulator. | `Build/delivery/evidence/phase2-emulator-uat.*` |
| P2-905 | User | Run physical Android device validation pass. | Blocked | P2-903, device | App installs and passes Phase 2 smoke/UAT on physical device. | `Build/delivery/evidence/phase2-device-uat.*` |
| P2-906 | Agent | Generate debug APK after Phase 2 implementation. | Not Started | Stable Phase 2 build | Debug APK path, size, and timestamp are recorded. | `Build/delivery/evidence/phase2-debug-apk-build.json` |
| P2-907 | User | Provide Android release signing decision and keystore if release APK is required. | Not Started | Stable Phase 2 build | Signing material/decision is available outside git. | `Build/delivery/evidence/release-signing-decision.md` |
| P2-908 | Agent | Generate release APK/AAB if signing material and environment are available. | Blocked | P2-907 | Release artifact builds without Metro. | `Build/delivery/evidence/phase2-release-build.json` |
| P2-909 | User | Capture final screenshots/videos for defense/demo. | Blocked | P2-904/P2-905 | Evidence pack includes critical member/admin flows. | `Build/delivery/evidence/screenshots/` or video links |
| P2-910 | Agent | Update README and delivery docs with final Phase 2 run/test/deploy instructions. | Not Started | Stable Phase 2 implementation | Docs match actual commands and evidence. | Updated docs |
| P2-911 | User | Update capstone report diagrams: use case, sequence, activity, class, ERD, relational mapping. | Not Started | Stable Phase 2 design | Academic document diagrams match implementation. | Updated report/docx or exported diagrams |
| P2-912 | User | Update capstone prose: scope, limitations, requirements, security, testing, conclusion. | Not Started | Stable Phase 2 design | Written report no longer contradicts Phase 2 implementation. | Updated report/docx |
| P2-913 | User | Obtain supervisor/instructor approval for final Phase 2 scope and defense wording. | Not Started | P2-911/P2-912 | Approval or feedback is recorded. | `Build/delivery/evidence/supervisor-approval.md` |
| P2-914 | Both | Prepare final handoff package with code, APK, evidence, UAT checklist, and report updates. | Not Started | P2-901-P2-913 | Final package is complete and traceable. | Final delivery folder/checklist |

## 6. Current Critical Path

The shortest clean path from the current repo state is:

1. User confirms Phase 2 scope, config decisions, Supabase access mode, and wallet wording.
2. User applies or approves the Phase 2 foundation migration against the target Supabase environment.
3. Agent implements shared helpers and type splits.
4. Agent implements group formation before touching payment complexity.
5. Agent implements obligations and provider attempts before changing draw logic.
6. Agent changes draw and payout only after obligations/attempts are stable.
7. Agent adds durable notifications/audit and report updates across all flows.
8. User validates on emulator/physical device and updates academic diagrams/prose.
9. Agent/user package final release evidence.

## 7. User-Only Work Summary

These items cannot be honestly completed by the coding agent without user action:

- approving Phase 2 scope and terminology decisions
- providing Supabase project/deployment access mode
- providing secrets outside git
- providing real OTP-capable phone/test accounts
- choosing app policy values for `app_config`
- choosing KYC priority and disbanded-group representation
- validating flows on emulator/physical Android device
- capturing final screenshots/videos
- providing Android release signing materials if release build is required
- updating capstone diagrams/report prose or approving generated drafts
- obtaining supervisor/instructor approval

## 8. Agent-Only First Batch Recommendation

Initial repo-local Phase 1 foundation batch completed on 2026-05-13:

1. created Phase 2 migration `supabase/migrations/20260513090000_phase2_foundation_companion_tables.sql`
2. added companion tables for config, audit, notifications, formation, obligations, provider attempts, ledger, payout requests/schedules, reliability, and restrictions
3. added duplicate/idempotency guardrails for successful contributions, active payout transactions, provider idempotency keys, gateway references, obligations, payout requests, and active restrictions
4. added table comments and RLS enablement for Phase 2 companion tables
5. added `mobile/scripts/validate-phase2-foundation.js` and evidence at `Build/delivery/evidence/phase2-foundation-validation.json`

Remote Phase 1 foundation apply evidence recorded on 2026-05-16:

1. user ran `supabase db push` against linked project `yxgfvkxdiicvckcwpdmc`
2. migration `20260513090000_phase2_foundation_companion_tables.sql` was applied successfully
3. Supabase notices were expected first-apply notices for pre-existing extension state and trigger drops
4. evidence is recorded in `Build/delivery/evidence/phase2-db-migration.json`

Phase 1 existing-state backfill batch completed on 2026-05-16:

1. added `supabase/migrations/20260516112000_phase2_backfill_existing_state.sql`
2. backfill inserts missing `user_reliability_profiles` rows for existing users while preserving any existing profile rows
3. backfill maps existing banned accounts to reliability `Banned` and other users to initial `New`
4. backfill inserts missing `contribution_obligations` for active members in existing open rounds
5. backfill marks obligations `Paid` when an existing successful contribution transaction already proves payment
6. added `mobile/scripts/validate-phase2-backfill.js` and evidence at `Build/delivery/evidence/phase2-backfill-validation.json`

Second repo-local Phase 2 helper/type batch completed on 2026-05-13:

1. split canonical `EqubGroupStatus` from pre-approval `GroupRequestStatus`
2. added Phase 2 companion record types in mobile and shared Edge Function type files
3. added shared helpers for config, audit event writes, durable notification writes, reliability gates, and contribution obligations
4. added group-formation command payload scaffolding without changing existing MVP action names
5. added `mobile/scripts/validate-phase2-shared.js` and evidence at `Build/delivery/evidence/phase2-shared-validation.json`

Third repo-local Phase 2 helper batch completed on 2026-05-13:

1. added `_shared/paymentAttempts.ts` for idempotency keys, attempt creation, callback updates, and success status helpers
2. added `_shared/ledger.ts` for append-oriented simulated ledger entry creation and reference lookups
3. added `_shared/payoutVesting.ts` for probationary payout split calculation and release schedule amount distribution
4. completed `_shared/contracts.ts` Phase 2 command payload scaffolding for group formation, payment attempts, and payouts
5. extended `mobile/scripts/validate-phase2-shared.js` and refreshed `Build/delivery/evidence/phase2-shared-validation.json`

Remaining first-wave work is deeper helper behavior tests, target Supabase migration application, and user-only policy approval tasks.

First repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. added `supabase/functions/group-formation/index.ts`
2. registered `[functions.group-formation]` in `supabase/config.toml`
3. added token validation, banned-user rejection, member/admin role gates, reliability eligibility gate for create/join routes, and explicit routing for the planned formation actions
4. returned honest `501` placeholders for workflow branches that are intentionally deferred to P2-302 and later
5. added `mobile/scripts/validate-phase2-formation.js` and evidence at `Build/delivery/evidence/phase2-formation-validation.json`

Second repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `createRequest` branch in `supabase/functions/group-formation/index.ts`
2. loaded `min_group_members`, `max_group_members`, and `group_formation_expiry_days` through Phase 2 app config helpers
3. validated group name, amount, frequency, visibility, invite mode, min/max member bounds, and private-only vesting override warning acceptance
4. inserted a `Forming` `group_requests` row with `expires_at` and added the creator as an `Accepted` `group_join_requests` participant
5. refreshed `Build/delivery/evidence/phase2-formation-validation.json` with static evidence for the create-request path

Third repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `listPublic` branch in `supabase/functions/group-formation/index.ts`
2. kept member verification and reliability eligibility checks before listing public forming requests
3. filtered discovery to `visibility = 'Public'`, `status = 'Forming'`, and non-expired requests only
4. added accepted participant counts and remaining slot values for read-friendly mobile consumption
5. refreshed `Build/delivery/evidence/phase2-formation-validation.json` with static evidence for public discovery

Fourth repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `requestJoin` branch in `supabase/functions/group-formation/index.ts`
2. added `groupTermsAccepted` and `acceptedTermsVersion` to the group-formation command payload contract
3. required member eligibility, current terms acceptance, public visibility, `Forming` status, non-expired request state, and available capacity before join requests are created
4. created or reused a `Requested` `group_join_requests` row so duplicate requests are handled idempotently
5. refreshed `Build/delivery/evidence/phase2-formation-validation.json` with static evidence for request-to-join behavior

Fifth repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `acceptJoin` and `removeParticipant` branches in `supabase/functions/group-formation/index.ts`
2. required creator ownership, `Forming` request status, non-expired request state, and protected the creator participant row from management changes
3. allowed creators to accept `Requested` participants while enforcing remaining capacity
4. mapped `removeParticipant` to `Rejected` for pending requests and `Removed` for accepted participants
5. wrote audit events for accepted, rejected, and removed formation participants and refreshed `Build/delivery/evidence/phase2-formation-validation.json`

Sixth repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `invite` and `acceptInvite` branches in `supabase/functions/group-formation/index.ts`
2. allowed creators to create invite-code and direct invitations for invite-enabled forming requests
3. required pending, non-expired invitation state and actor/user or phone target matching before invite acceptance
4. required current group terms acceptance before an invited member is added as an `Accepted` formation participant
5. wrote audit events for invitation creation and acceptance and refreshed `Build/delivery/evidence/phase2-formation-validation.json`

Seventh repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `submitForApproval` branch in `supabase/functions/group-formation/index.ts`
2. required creator ownership, `Forming` status, non-expired request state, and accepted participants meeting the greater of request minimum and configured Phase 2 minimum
3. updated eligible requests to `PendingApproval` with `submitted_by` and `submitted_at`
4. created durable notifications for admins and the submitting creator
5. wrote a `group_formation_submitted_for_approval` audit event and refreshed `Build/delivery/evidence/phase2-formation-validation.json`

Eighth repo-local Phase 3 group-formation batch completed on 2026-05-13:

1. implemented the `adminApprove` and `adminReject` branches in `supabase/functions/group-formation/index.ts`
2. approval creates a canonical `EqubGroup`, canonical `GroupMembers`, an initial open `Round`, and first-round `contribution_obligations`
3. approval updates `group_requests` to `Approved` with `approved_group_id`, `reviewed_by`, `reviewed_at`, and `created_group_at`
4. rejection updates `group_requests` to `Rejected` with review metadata and reason, without creating canonical MVP group rows
5. durable notifications and audit events are written for approval/rejection and `Build/delivery/evidence/phase2-formation-validation.json` was refreshed

Ninth repo-local Phase 3 compatibility batch completed on 2026-05-15:

1. preserved the existing `group-lifecycle.createRequest` path that inserts canonical `EqubGroup` rows in `Pending` status
2. confirmed `mobile/src/services/live/liveGroupsService.ts` still calls `group-lifecycle` for legacy `GroupService.createRequest`
3. added `mobile/scripts/validate-phase2-legacy-group-compat.js`
4. added `Build/delivery/evidence/phase2-legacy-group-compatibility.json`
5. added a Jest regression proving mock legacy group creation remains pending and visible in admin pending approvals

Tenth repo-local Phase 3 mobile service batch completed on 2026-05-15:

1. added mobile `GroupFormationService` contract methods for list, detail, create, join, invite, submit, and admin review actions
2. added `mobile/src/services/live/liveGroupFormationService.ts` to call the `group-formation` Edge Function instead of exposing sensitive writes in the app
3. wired the service provider with the live formation service and mirrored the contract in the mock backend for local tests
4. replaced the `getRequest` pending Edge Function stub with a detail response containing participants, creator/admin invitations, accepted count, and remaining slots
5. added `mobile/scripts/validate-phase2-mobile-formation.js`, `Build/delivery/evidence/phase2-mobile-formation-validation.json`, and a Jest regression for the pre-UI formation service flow

Eleventh repo-local Phase 3 member UI batch completed on 2026-05-15:

1. added `routes.formationDetail` and registered `FormationDetailScreen` in the member stack
2. extended `ExploreScreen` with a separate public forming-groups lane before approved canonical groups
3. added `FormationDetailScreen` with participant progress, terms version, remaining slots, and request-to-join action
4. added React Query hooks and mutation invalidation for formation list/detail/request-join paths
5. added `mobile/scripts/validate-phase2-member-formation-ui.js` and `Build/delivery/evidence/phase2-member-formation-ui-validation.json`; on-device screenshot/UAT evidence remains under P2-316

Twelfth repo-local Phase 3 creator UI batch completed on 2026-05-15:

1. migrated the member create request screen flow to create Phase 2 `group_requests` through `GroupFormationService`
2. added `routes.formationCreator` and `FormationCreatorScreen` for creator-side participant management
3. added creator actions for invitation creation, accept/remove participant, and submit-for-approval through service mutations
4. added a Jest regression for private creator invitations in the mock formation service
5. added `mobile/scripts/validate-phase2-creator-formation-ui.js` and `Build/delivery/evidence/phase2-creator-formation-ui-validation.json`; on-device screenshot/UAT evidence remains under P2-316

Thirteenth repo-local Phase 3 admin UI batch completed on 2026-05-16:

1. added admin-only `listPendingApproval` support to the `group-formation` Edge Function and mobile formation service
2. updated `AdminGroupsScreen` to show Phase 2 formation requests before legacy MVP requests
3. displayed proposed terms, participants, risk level, vesting setting, agreement state, and review checks for admin decisions
4. added admin approve/reject formation mutations while preserving legacy `EqubGroup` approval controls during migration
5. added `mobile/scripts/validate-phase2-admin-formation-ui.js`, `Build/delivery/evidence/phase2-admin-formation-ui-validation.json`, and a Jest regression for pending formation approval

First repo-local Phase 4 obligations batch completed on 2026-05-16:

1. updated `ensureOpenRoundForGroup` to call `ensureContributionObligationsForRound` for existing open rounds
2. updated `ensureOpenRoundForGroup` to generate obligations immediately after it creates a new open round
3. updated round lifecycle next-round creation to generate active-member obligations for the newly opened round
4. kept obligation generation idempotent through the existing `round_id,user_id` upsert guardrail
5. added `mobile/scripts/validate-phase2-round-obligations.js` and `Build/delivery/evidence/phase2-round-obligation-generation-validation.json`

Second repo-local Phase 4 obligations batch completed on 2026-05-16:

1. added shared `deriveRoundObligationProgress` and `getRoundObligationProgress` helpers for dashboard/status counts
2. updated group status snapshots to use obligation-derived paid and total-member counts
3. updated group status payment eligibility to use obligation-derived paid user IDs
4. updated member dashboard group selection and progress to use obligation-derived state
5. preserved MVP transaction-backed paid state as a documented transition guardrail until provider-attempt payment routing marks obligations paid directly
6. added `mobile/scripts/validate-phase2-dashboard-obligations.js` and `Build/delivery/evidence/phase2-dashboard-obligation-status-validation.json`

Third repo-local Phase 4 payment-attempt batch completed on 2026-05-16:

1. added `supabase/functions/payment-attempt/index.ts` as the Phase 2 payment-attempt command boundary
2. implemented `initiateContributionAttempt` to require an active group, active membership, current open round, and matching actor obligation
3. created idempotent `payment_provider_attempts` rows in `Pending` state with mock/sandbox provider metadata
4. marked the matching contribution obligation `PendingPayment` without creating a successful `Transaction`
5. extended shared helpers for pending-payment obligation updates and configurable initial attempt status
6. added `mobile/scripts/validate-phase2-payment-attempt-initiation.js` and `Build/delivery/evidence/phase2-payment-attempt-initiation-validation.json`

Fourth repo-local Phase 4 direct payment batch completed on 2026-05-16:

1. routed direct `payContribution` through an idempotent `payment_provider_attempts` row
2. recorded a simulated successful provider callback before creating the contribution transaction
3. marked the matching contribution obligation `PendingPayment` and then `Paid` with the created transaction id
4. wrote a `ContributionReceived` ledger entry linked to the provider attempt
5. preserved USSD and external callback flows for their later tracker rows
6. added `mobile/scripts/validate-phase2-direct-payment-attempt-flow.js` and `Build/delivery/evidence/phase2-direct-payment-attempt-flow-validation.json`

Fifth repo-local Phase 4 USSD payment batch completed on 2026-05-16:

1. routed `startContributionUssd` through a pending `MockUSSD` provider attempt
2. carried provider attempt and obligation ids through signed USSD session tokens
3. marked the matching contribution obligation `PendingPayment` when the USSD session starts
4. recorded cancelled USSD sessions as `Cancelled` provider callbacks and returned obligations to `Unpaid`
5. recorded successful PIN completion as a verified provider callback before transaction creation, paid obligation update, ledger write, and round finalization
6. added `mobile/scripts/validate-phase2-ussd-payment-attempt-flow.js` and `Build/delivery/evidence/phase2-ussd-payment-attempt-flow-validation.json`

Sixth repo-local Phase 4 provider-callback batch completed on 2026-05-16:

1. routed `reconcileProviderCallback` through provider-attempt lookup/creation by gateway reference and idempotency key
2. resolved callback sender phone to an active group member before reconciliation
3. verified callback amount against the active group amount before transaction creation
4. reused the shared successful completion helper for provider callback success
5. detected duplicate callbacks from existing successful contributions and marked the provider attempt `Duplicate` without creating another transaction
6. added `mobile/scripts/validate-phase2-provider-callback-idempotency.js` and `Build/delivery/evidence/phase2-provider-callback-idempotency-validation.json`

Seventh repo-local Phase 4 payment-outcome/reminder batch completed on 2026-05-16:

1. registered `payment-attempt` in `supabase/config.toml`
2. added `PaymentAttemptOutcome` contract fields for success, failure, timeout, cancelled, wrong amount, and pending mock outcomes
3. implemented `recordProviderCallback`, `markAttemptTimeout`, and `markAttemptCancelled` in `supabase/functions/payment-attempt/index.ts`
4. kept successful contribution callbacks routed through `contribution-reconcile` so transaction, obligation, ledger, and draw updates remain atomic
5. mapped failed, timeout, cancelled, and invalid-amount outcomes back to `Unpaid` obligations while pending outcomes stay `PendingPayment`
6. updated admin reminder derivation in `report-export` to use obligation progress, including late obligation counts and the existing MVP transaction overlay
7. added `mobile/scripts/validate-phase2-payment-outcomes.js`, `mobile/scripts/validate-phase2-reminder-obligations.js`, `Build/delivery/evidence/phase2-payment-outcome-validation.json`, and `Build/delivery/evidence/phase2-reminder-obligation-validation.json`

Eighth repo-local Phase 4 round-readiness batch completed on 2026-05-16:

1. updated `finalizeRoundIfReady` to ensure contribution obligations exist before checking draw readiness
2. replaced successful-transaction-count readiness with active-member settled-obligation readiness
3. changed winner eligibility to use settled obligation user ids while preserving the existing MVP payout transaction behavior
4. left payout requests, reserves, and maturity release scheduling for Phase 5
5. added `mobile/scripts/validate-phase2-round-readiness.js` and `Build/delivery/evidence/phase2-round-readiness-validation.json`

First repo-local Phase 5 ledger memo batch completed on 2026-05-16:

1. added payment-attempt memo ledger writes for pending contribution attempts
2. added failed-attempt memo ledger writes for failed, cancelled, timeout, and invalid-amount outcomes
3. recorded pending attempt memos from direct, USSD, and explicit payment-attempt initiation paths
4. recorded failed attempt memo on USSD cancellation before returning the obligation to `Unpaid`
5. de-duplicated attempt memo writes by attempt reference and entry type
6. added `mobile/scripts/validate-phase2-attempt-ledger.js` and `Build/delivery/evidence/phase2-attempt-ledger-validation.json`

Second repo-local Phase 5 payout maturity helper batch completed on 2026-05-16:

1. tightened `_shared/payoutVesting.ts` so `New` and `BuildingTrust` early winners use the strict first-cycle immediate payout cap
2. preserved full payout calculation for trusted winners and final-round winners when vesting is enabled
3. blocked restricted and banned users from the normal payout maturity calculation path
4. added profile-based payout maturity calculation from `user_reliability_profiles.public_status`
5. left payout request creation, reserve ledger entries, and release schedules for the next Phase 5 flow batch
6. added `mobile/scripts/validate-phase2-payout-maturity.js` and `Build/delivery/evidence/phase2-payout-maturity-validation.json`

Third repo-local Phase 5 payout request/reserve batch completed on 2026-05-16:

1. updated `finalizeRoundIfReady` to create a `payout_requests` row after winner selection
2. preserved full pending payout behavior for legacy MVP groups without Phase 2 formation-request vesting metadata
3. applied approved `group_requests.vesting_enabled` and reliability profile status to payout maturity calculation for Phase 2 groups
4. created the MVP pending payout `Transaction` only for the immediate release amount when that amount is greater than zero
5. recorded payout request, immediate release, and reserved amount ledger entries against the payout request
6. created pending `payout_release_schedules` for withheld reserve amounts, leaving release execution for P2-506
7. added `mobile/scripts/validate-phase2-payout-request-flow.js` and `Build/delivery/evidence/phase2-payout-request-flow-validation.json`

Fourth repo-local Phase 5 review-fix/reserve-release batch completed on 2026-05-17:

1. added `supabase/migrations/20260517100000_phase2_payout_round_idempotency.sql` to enforce one active payout lifecycle row per round
2. changed `finalizeRoundIfReady` to claim only `Open` rounds before selecting a winner, preventing duplicate concurrent draw completion
3. removed fabricated personal-contribution fallback from payout maturity input so waived/refund-settled readiness cannot inflate early release amounts
4. added `_shared/payoutReserves.ts` to claim one pending reserve release schedule after a later successful contribution
5. created a mock pending payout `Transaction` and `ReserveReleased`/`PayoutReleased` ledger entries for reserve releases
6. updated `payout_requests` immediate/reserved totals and lifecycle status when reserved payout is released
7. added `mobile/scripts/validate-phase2-payout-idempotency-reserve-release.js` and `Build/delivery/evidence/phase2-payout-idempotency-reserve-release-validation.json`
