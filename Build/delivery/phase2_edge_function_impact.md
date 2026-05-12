# Phase 2 Database Additions and Edge Function Impact Analysis

Version: 1.0
Last Updated: 2026-05-12
Status: Planning companion to `Build/delivery/phase2_expansion_spec.md`

## 1. Purpose

This document explains what the Phase 2 database additions do to UniEqub's current heavy reliance on Supabase Edge Functions.

The short answer is:

> The new tables should reduce Edge Function responsibility for storing state, deriving status, and preventing duplicates, but they should not remove Edge Functions from orchestration, authorization, mock provider simulation, admin decisions, or multi-table business workflows.

Phase 2 should move UniEqub from a function-heavy model where many states are derived from the five MVP tables into a hybrid model:

- PostgreSQL stores durable workflow state, constraints, idempotency keys, status rows, audit rows, notification rows, and simulated ledger entries.
- Edge Functions remain the controlled command/API layer that validates actors, applies business decisions, writes multiple related tables, and calls mock provider flows.
- The mobile app continues to call services, not raw tables, for sensitive actions.

## 2. Current Edge Function Reliance

The current backend is intentionally compact. A small set of Edge Functions performs most business work:

| Current Function | Current Responsibility | Phase 2 Pressure Point |
| --- | --- | --- |
| `register-login` | registration, OTP, login, restore | Still needed; may later write audit/notification rows |
| `kyc-submit-review` | signed KYC upload, submit, pending list, approve, ban | Should write `kyc_submissions`, `kyc_documents`, durable notifications, audit events |
| `group-lifecycle` | active browse, detail, dashboard, direct create request, approve/reject/freeze, join | Should split pre-approval formation into `group-formation`; keep canonical group lifecycle |
| `contribution-reconcile` | direct/mock payment, USSD session, callback reconciliation, transaction insert, wallet snapshot | Should become an orchestrator around obligations, payment attempts, ledger entries, and payout readiness |
| `_shared/roundLifecycle.ts` | transaction-count readiness, draw, payout transaction creation, next round | Should become obligation-based and create payout requests/reserve schedules |
| `notification-center` | derives notifications from current state and stores read IDs on device | Should read/write durable `notifications` while temporarily preserving fallback derived notices |
| `report-export` | admin overview, reminder derivation, report export | Should use materialized/durable Phase 2 tables and audit exports |
| `wallet-clearance` / `payout-withdraw` | clears pending payout transaction | Should route through `payout_requests`, payout attempts, ledger entries, and maturity rules |

The current `_shared/contracts.ts` action model is also function-centric: each Edge Function accepts an `action` string and a payload. Phase 2 can keep that pattern initially, but the action set should become command-oriented around the new tables.

## 3. What the New Tables Should Move Out of Edge Functions

The Phase 2 tables should remove several kinds of hidden state and derived logic from Edge Function memory/code.

### 3.1 Workflow State

Today, many states are implied:

- an unpaid member is derived from active membership minus successful contribution transaction
- a pending payout is derived from `Transaction.Type = Payout` and `Status = Pending`
- KYC pending review is derived from `User.KYC_Status = Unverified`
- notifications are reconstructed every time from user/group/transaction state

Phase 2 tables make those states explicit:

| Hidden/Derived Today | Phase 2 Durable State |
| --- | --- |
| forming group before approval | `group_requests`, `group_join_requests`, `group_invitations` |
| expected contribution | `contribution_obligations` |
| provider session/callback state | `payment_provider_attempts` |
| simulated balance/reserve changes | `ledger_entries` |
| payout lifecycle | `payout_requests`, `payout_release_schedules` |
| user trust/default state | `user_reliability_profiles`, `user_restrictions` |
| notification inbox | `notifications` |
| system/admin history | `audit_events` |
| configurable rules | `app_config` |

Result: Edge Functions should stop recomputing everything from core tables and instead read/write explicit workflow records.

### 3.2 Data Integrity and Idempotency

Edge Functions currently enforce duplicate contribution protection in service logic before inserting a `Transaction`. Phase 2 should add database constraints so the database also protects the invariant.

Move these from function-only checks into database-backed constraints/indexes:

- one successful contribution per user per round
- one obligation per user per round
- one payout request per winner per round
- unique provider idempotency key
- unique non-null gateway reference where applicable
- unique non-null virtual account/reference where applicable

Result: Edge Functions still check early for better errors, but PostgreSQL becomes the final guardrail.

### 3.3 Read Models and Dashboard Queries

Some read-heavy endpoints currently loop through multiple tables and derive snapshots. Phase 2 can add views or SQL functions for stable read models.

Good database-side read candidates:

- active group summary
- formation request summary
- obligation progress per round
- member reliability summary
- payout reserve summary
- admin dashboard counts
- unread notification count
- audit timeline by entity

Result: Edge Functions become thinner query wrappers for protected views instead of custom derivation engines.

## 4. What Must Stay in Edge Functions

The new tables should not push sensitive workflow decisions directly to the mobile client. These responsibilities should remain server-side Edge Function work.

### 4.1 Authorization and Actor Validation

Keep in Edge Functions:

- token verification
- role checks
- KYC checks
- reliability/restriction checks
- ownership checks
- admin-only review decisions
- group creator-only actions

Database RLS can help, but Edge Functions should remain the command boundary for sensitive actions.

### 4.2 Multi-Table Commands

These workflows write multiple tables and should remain Edge Function commands:

- approve group request -> create `EqubGroup`, create `GroupMembers`, create initial `Round`, create obligations, notify members, write audit event
- submit contribution -> update obligation, create provider attempt, create transaction, create ledger entries, trigger draw check, notify, audit
- execute draw -> lock round, select winner, create payout request, create payout transaction/reserve schedule, create ledger entries, notify, audit
- mark default -> update obligation, freeze reserve, restrict user, possibly freeze group, notify, audit
- approve KYC -> update submission, update `User.KYC_Status`, notify, audit

Database transactions can make these atomic, but an Edge Function should decide when the command is allowed.

### 4.3 Mock Provider Simulation

The mock provider flow is part of the capstone story. It should remain an Edge Function/service workflow because it simulates external behavior:

- success
- failure
- timeout
- duplicate callback
- wrong amount
- cancelled payment
- pending status

The database should persist attempts and enforce idempotency, but the Edge Function should simulate and verify the provider event.

### 4.4 Admin Decisions and Human Workflow

Keep in Edge Functions:

- admin approves/rejects group request
- admin clears restriction
- admin creates frozen-group poll options
- admin resolves freeze manually
- admin exports report

These are not passive database events; they are audited commands by a privileged actor.

## 5. Where PostgreSQL Can Safely Take More Responsibility

Phase 2 can use PostgreSQL for deterministic, local, data-integrity work.

### 5.1 Constraints and Indexes

Recommended DB-owned responsibility:

- status check constraints
- positive amount checks
- uniqueness and partial uniqueness
- foreign keys to core tables
- indexes for query performance

This reduces the risk that a missed Edge Function branch corrupts data.

### 5.2 Triggers for Low-Risk Side Effects

Use triggers sparingly. Good trigger candidates:

- maintain `updated_at`
- create default `user_reliability_profiles` row when a member is created
- validate immutable/append-only tables by preventing updates/deletes on `audit_events` and `ledger_entries`
- optionally create audit rows for low-level row changes if actor metadata is available

Avoid triggers for complex business decisions such as selecting winners, freezing groups, or calculating payout vesting. Those should stay in Edge Functions or explicit database RPC called by Edge Functions.

### 5.3 SQL Functions / RPC for Atomic Internal Operations

PostgreSQL functions can help when atomicity matters, but they should usually be called by Edge Functions, not directly by mobile.

Good RPC candidates:

- `create_round_obligations(round_id)`
- `mark_obligation_paid(attempt_id)`
- `record_ledger_entry(...)`
- `apply_payout_release(schedule_id)`
- `calculate_round_readiness(round_id)`
- `get_admin_overview()`

This can reduce TypeScript branching while keeping Edge Functions as the authorization layer.

### 5.4 Views for Read-Only State

Views are useful for dashboards and reports.

Good view candidates:

- `v_group_request_summary`
- `v_round_obligation_progress`
- `v_member_reliability_summary`
- `v_payout_reserve_summary`
- `v_admin_dashboard_overview`
- `v_notification_inbox`

Read-only views reduce repeated SQL in multiple Edge Functions.

## 6. Function-by-Function Phase 2 Impact

### 6.1 `register-login`

Likely impact: low to medium.

Keep:

- registration
- password hash/verify
- OTP request/verify
- token issuance/restore

Add:

- initialize `user_reliability_profiles` for new members, either directly or through a DB trigger
- write `audit_events` for registration/login-sensitive events where appropriate
- optionally write welcome/KYC-required notification

Do not add:

- separate auth/session tables in Phase 2 unless explicitly promoted from deferred scope

### 6.2 `kyc-submit-review`

Likely impact: medium.

Current KYC should stop being only `User.Student_ID_Img` plus `User.KYC_Status`.

Add:

- create `kyc_submissions`
- create `kyc_documents`
- map approved submission to `User.KYC_Status = Verified`
- keep rejected/needs-resubmission as `User.KYC_Status = Unverified`
- write durable notifications
- write audit events

Database helps by storing document metadata and review lifecycle. Edge Function still owns signed upload URL creation and admin review authorization.

### 6.3 `group-lifecycle`

Likely impact: high, but mostly by splitting responsibilities.

Keep in `group-lifecycle`:

- active group browse
- group detail/status
- dashboard
- canonical group freeze/active/completed handling
- active group join during legacy transition

Move/add to new `group-formation` function:

- create draft/forming request
- public forming discovery
- request join
- accept/remove participant
- invite/accept invite
- submit request for approval
- admin approve/reject request
- create canonical `EqubGroup` and `GroupMembers`

Database additions reduce awkward `Pending` group overload. Edge Functions still control approval and conversion.

### 6.4 `contribution-reconcile`

Likely impact: very high.

Current function writes successful transactions directly after checking membership, group status, duplicate payment, and amount.

Phase 2 should turn it into an orchestrator:

1. require active session
2. find active obligation
3. create or update `payment_provider_attempts`
4. verify provider event
5. update obligation status
6. insert `Transaction` only after successful verification
7. insert `ledger_entries`
8. call obligation-based draw readiness
9. create notifications/audit events

Database takes over idempotency and persisted attempt state. Edge Function still handles provider simulation and command orchestration.

### 6.5 `_shared/roundLifecycle.ts`

Likely impact: very high.

Current readiness is transaction-count-based. Phase 2 should make it obligation-based.

Change from:

- active member count equals successful contribution transaction count

To:

- all required obligations are settled

Add:

- payout request creation
- immediate release calculation
- reserve calculation
- release schedule creation
- ledger entries
- audit events

This can remain a shared helper, but it should call small helpers for obligations, payout vesting, ledger, audit, and notifications.

### 6.6 `wallet-clearance` / `payout-withdraw`

Likely impact: high.

Current function finds a pending payout `Transaction` and marks it successful.

Phase 2 should route through:

- `payout_requests`
- payout provider attempts if simulating payout processing
- release schedules
- ledger entries
- reliability/restriction checks
- notifications/audit

The endpoint can remain, but its semantics become “process mock payout clearance/release” rather than simply flipping a transaction status.

### 6.7 `notification-center`

Likely impact: high.

Current function derives notifications and mobile stores read IDs locally.

Phase 2 should:

- read durable `notifications`
- mark `notifications.read_at`
- temporarily merge legacy derived notices during migration
- eventually remove local derived read-ID dependency

Database becomes the notification inbox. Edge Function remains the access-controlled inbox API.

### 6.8 `report-export`

Likely impact: medium.

Reports should become easier because Phase 2 tables store the states reports need.

Add reads from:

- `group_requests`
- `contribution_obligations`
- `payment_provider_attempts`
- `ledger_entries`
- `payout_requests`
- `user_reliability_profiles`
- `user_restrictions`
- `audit_events`
- `notifications`

Add audit events for report export. Keep `report_exports` deferred unless history of generated files becomes required.

### 6.9 `ussd-simulator`

Likely impact: medium.

The simulator should write through the same attempt/obligation path as `contribution-reconcile` so the sandbox callback behaves like the app's mock provider flow.

Avoid maintaining a separate simulation ledger inside the simulator function.

## 7. Recommended New Edge Function Layout

Phase 2 does not need one huge function. Keep functions cohesive.

Recommended function surface:

| Function | Purpose |
| --- | --- |
| `group-formation` | draft/forming groups, joins, invites, submit/approve/reject request |
| `contribution-reconcile` | contribution command orchestration around obligations and attempts |
| `payouts` or expanded `wallet-clearance` | payout requests, mock payout processing, reserve release |
| `notification-center` | durable notification inbox and mark-read |
| `admin-ops` optional | restrictions, config updates, freeze review, manual resolution |
| existing auth/KYC/report functions | remain and gain audit/notification/table-aware writes |

Shared helpers should prevent duplicated logic:

- `_shared/config.ts`
- `_shared/audit.ts`
- `_shared/notifications.ts`
- `_shared/obligations.ts`
- `_shared/paymentAttempts.ts`
- `_shared/ledger.ts`
- `_shared/reliability.ts`
- `_shared/payoutVesting.ts`

## 8. Recommended Database vs Edge Function Boundary

| Concern | Database | Edge Function |
| --- | --- | --- |
| Store workflow state | Yes | Writes/updates intentionally |
| Enforce foreign keys/checks/uniqueness | Yes | Pre-checks for better errors |
| Token validation | No | Yes |
| Role/KYC/restriction authorization | RLS may help | Yes, primary |
| Mock provider outcome simulation | No | Yes |
| Duplicate callback final guard | Yes | Yes |
| Round readiness formula | SQL/RPC can compute | Calls and decides action |
| Winner selection | No direct trigger | Yes/shared helper |
| Payout maturity decision | SQL helper can calculate | Yes, command owner |
| Durable notifications | Yes | Creates/reads/marks read |
| Audit log | Yes append-only | Writes with actor context |
| Admin approval/rejection | No direct client writes | Yes |
| Reports | Views can help | Export orchestration |

## 9. Implementation Order to Reduce Edge Function Risk

1. Add constraints/indexes that protect current behavior first.
2. Add `app_config`, `audit_events`, and helper modules before feature workflows.
3. Add durable `notifications` with fallback derived notices.
4. Add `group_requests` and `group-formation`, but keep legacy `group-lifecycle.createRequest` during transition.
5. Add `contribution_obligations` and backfill current open rounds.
6. Add `payment_provider_attempts` and route mock payments through attempts.
7. Change draw readiness to obligations.
8. Add ledger and payout request/reserve schedules.
9. Add reliability/restriction enforcement to formation approval, join, pay, and payout.
10. Only then add frozen-group polls and refund tickets.

## 10. Main Architectural Tradeoff

Adding tables does not automatically make the system less complex. It moves complexity from hidden derivation inside Edge Functions into explicit durable workflow records.

That is a good tradeoff for this capstone because it improves:

- auditability
- testability
- reportability
- duplicate callback safety
- admin explainability
- defense clarity

But it also means Edge Functions must become better organized. The right goal is not fewer Edge Functions at all costs. The right goal is thinner, command-oriented Edge Functions backed by stronger database state, constraints, views, and shared helpers.

## 11. Final Position

Phase 2 database additions should not eliminate Supabase Edge Functions. They should make Edge Functions less stateful, less derivation-heavy, and less responsible for data integrity that PostgreSQL can enforce.

The final architecture should be:

- database for durable state, constraints, idempotency, views, simulated ledger, notifications, audit, and config
- Edge Functions for authorization, command orchestration, mock provider simulation, admin decisions, payout/draw/default workflows, and report export
- mobile services for user interaction only, not direct sensitive table writes
