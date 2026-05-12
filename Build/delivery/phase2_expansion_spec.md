# UniEqub Phase 2 Capstone Expansion Specification

Version: 1.0
Last Updated: 2026-05-12
Status: Planning source of truth for Phase 2 expansion
Related Edge Function impact analysis: `Build/delivery/phase2_edge_function_impact.md`
Detailed development tracker: `Build/delivery/phase2_development_progress_tracker.md`
Supersedes: the original MVP-only fixed-table constraint for Phase 2 work while preserving the five core MVP tables

## 1. Purpose of This Expansion

This document defines the agreed Phase 2 expansion plan for UniEqub. The expansion improves the current capstone system without replacing the existing MVP implementation.

The current codebase already has a working MVP spine:

- React Native Android-first client
- Supabase Edge Function service layer
- Core five-table schema
- Auth/KYC/group/payment/reporting flows
- Simulated contribution flow
- Automatic draw and payout transaction creation
- Notification derivation and admin reporting

Therefore, this expansion must wrap, extend, and companion the existing implementation instead of rewriting it.

The expansion strengthens the system in these areas:

- Group formation before admin approval
- Public and private group gathering
- Contribution obligations and round readiness
- Mock/sandbox payment provider tracking
- Wallet/payout request and vesting flow
- New-user default prevention
- Reliability and restriction management
- Durable notifications
- Audit logging
- Configuration-driven business rules
- Frozen-group handling, polling, and refund tickets as staged additions

## 2. Core Implementation Rules

### 2.1 Preserve Existing Implementation

The original implementation and core tables must not be removed. The redesign must be additive.

Existing core tables to keep:

- `User`
- `EqubGroup`
- `GroupMembers`
- `Round`
- `Transaction`

These remain the academic MVP foundation. New tables should extend them through foreign keys, companion records, views, constraints, indexes, and service-layer logic.

### 2.2 Phase 2 Persistence Rule

The original living spec and Stage A-H delivery docs treated the five-table model as immutable. That restriction is lifted for Phase 2 only.

Phase 2 may add companion tables when they preserve the existing MVP core and avoid destructive rewrites. The original five tables remain canonical for the MVP flows already implemented, while new tables provide formation, obligations, provider attempts, ledger, payout vesting, reliability, notifications, audit, and configuration support.

### 2.3 Additive Service Design

Existing service contracts should not be violently replaced. The expansion should add companion service modules gradually.

Recommended service/module direction:

Frontend-facing services, added only when screens need them:

- `formationService`
- `obligationService`
- `reliabilityService`
- `payoutsService` if payout vesting needs a separate screen contract

Backend-only shared helpers or internal modules:

- `config.ts`
- `audit.ts`
- `notifications.ts`
- `ledger.ts`
- `paymentAttempts.ts`
- `mockPaymentProvider.ts`
- `payoutVesting.ts`

Existing group, payment, notification, KYC, and reporting services can continue to operate while new screens and flows are migrated incrementally. Mobile clients should not directly create audit, ledger, provider-attempt, payout-request, or reliability rows; protected Edge Functions should perform those writes.

### 2.4 Payment Scope

The capstone implementation will use sandbox/mock payments with a future-ready payment architecture.

The system will not process real financial transactions or require approval from Telebirr, Chapa, banks, or legal/financial authorities.

Instead, payment providers will be simulated through mock flows that imitate:

- payment initiation
- payment confirmation
- payment failure
- timeout
- duplicate callback
- wrong amount
- cancelled payment
- pending payment
- payout processing
- refund-ticket generation

Real payment integrations are future work only.

### 2.5 Wallet Terminology Decision

For the defense-stage capstone, wallet terminology can remain in the documentation and UI because the project is being demonstrated as a controlled academic simulation, not launched as a real financial product.

Accepted terms for defense-stage use:

- wallet
- wallet balance
- wallet clearance
- withdraw payout
- payout reserve
- locked wallet amount
- refund ticket

Important clarification:

The system must clearly state that wallet behavior is simulated/mock in the current capstone. In a real launch, wallet/custody wording and functionality would need legal review, provider approval, and possible terminology changes.

### 2.6 Database and Edge Function Boundary

Phase 2 database additions are not intended to eliminate Supabase Edge Functions. They are intended to move durable workflow state, idempotency, constraints, audit, notifications, simulated ledger entries, and reporting-friendly records into PostgreSQL while keeping Edge Functions as the command boundary for authorization, admin decisions, mock provider simulation, multi-table workflows, draw/payout/default orchestration, and report export.

Detailed impact guidance is documented in `Build/delivery/phase2_edge_function_impact.md`.

## 3. Feature Expansion Overview

The agreed expansion introduces the following feature systems:

- Group Formation Lobby
- Public and Private Group Gathering
- Admin Group Approval
- Lightweight Group Communication
- Contribution Obligations
- Mock Payment Provider Attempts
- Wallet Ledger / Simulated Ledger Entries
- Payout Request and Vesting Flow
- New-User Payout Maturity System
- Reliability Status System
- Restriction and Recovery System
- Default Handling and Group Recovery
- Frozen-Group Polling
- Refund Ticket Simulation
- Student Verification/KYC Expansion
- Durable Notification System
- Audit Event System
- App Configuration System

## 4. Group Formation System

### 4.1 Problem Being Solved

The system requires a minimum of 5 people before a group creation request can be submitted, but the original MVP allows a verified member to directly create an `EqubGroup` row in `Pending` status. Joining currently happens only after a group is already active.

The expansion introduces a Group Formation Lobby before canonical group creation.

### 4.2 Important Design Rule

Do not replace `EqubGroup`.

Use `group_requests` as the draft/forming/admin-review layer. When a request is approved, the system creates or links to the canonical `EqubGroup` row.

### 4.3 Legacy Create-Group Compatibility

During Phase 2, the existing `GroupService.createRequest` flow should not disappear abruptly. User-facing group creation screens should migrate to formation requests first, while the legacy direct `EqubGroup` pending creation path is either:

- kept temporarily as a compatibility path,
- re-routed internally to `formation-lobby:createRequest`, or
- restricted to admin/internal maintenance once the formation lobby is live.

The long-term user-facing flow should create a `group_requests` row first, not a direct pending `EqubGroup` row.

### 4.4 Group Formation Lifecycle

1. Creator creates a draft/forming group request.
2. Creator sets proposed terms:
   - group name
   - description/purpose
   - contribution amount
   - frequency
   - minimum members
   - maximum members
   - visibility
   - invite mode
   - start date
   - grace period
   - late-payment policy
   - payout maturity/vesting setting where applicable
3. System creates a formation lobby.
4. Students gather through public or private paths.
5. When the configured minimum number of accepted participants is reached, the creator can submit the request for admin approval.
6. Admin reviews the request.
7. If approved, the system creates the canonical `EqubGroup`.
8. The system creates `GroupMembers` rows for accepted participants.
9. `group_requests.approved_group_id` links to the created `EqubGroup`.
10. The group moves to active or pending-start state.

### 4.5 Group Size and Expiry Rules

Business rules:

- Minimum group size: 5 members
- Maximum group size: admin-configured
- Draft/forming group expiry: 3 days

Implementation note:

The business minimum is 5, but the value should be stored in `app_config` as `min_group_members = 5` so the code does not rely on scattered hardcoded values.

### 4.6 Public Group Path

Public groups appear in a “Forming Groups” discovery area.

Public group creators can:

- accept join requests
- remove pending or accepted formation participants
- invite members
- submit the group for approval once minimum members are reached

Eligible members can:

- browse public forming groups
- view proposed terms
- request to join
- accept the group rules before joining

Existing active group browsing should remain focused on approved active `EqubGroup` rows. Public formation discovery should use `group_requests`, not `EqubGroup.Status = Pending`.

### 4.7 Private Group Path

Private groups support both:

- invite code/link
- direct invitation by phone/student ID

Private invite-based group creators may disable new-user payout vesting, but only after seeing a clear risk warning.

Creator-only override applies. Member vote is not required for disabling vesting during private group formation.

### 4.8 Admin Approval Requirement

All group creation requests require admin approval, regardless of whether the group is:

- public
- private
- invite-only

Admin reviews:

- proposed members
- contribution amount
- group rules
- visibility
- payout vesting setting
- risk level
- creator status
- agreement/terms version

### 4.9 Recommended Formation Endpoints

A new Edge Function or service route can be added for formation features.

Recommended capability names:

- `formation-lobby:listPublic`
- `formation-lobby:getRequest`
- `formation-lobby:createRequest`
- `formation-lobby:requestJoin`
- `formation-lobby:acceptJoin`
- `formation-lobby:removeParticipant`
- `formation-lobby:invite`
- `formation-lobby:acceptInvite`
- `formation-lobby:submitForApproval`
- `formation-lobby:adminApprove`
- `formation-lobby:adminReject`

## 5. Lightweight Group Communication

Full real-time group chat is rejected for MVP because it adds moderation, storage, abuse handling, and UI complexity.

MVP communication should use lightweight features:

- group announcements
- simple comments/questions if needed
- system notices
- rule updates
- admin messages

`group_announcements` should support both formation-stage and approved-group announcements.

Recommended rule:

- formation announcement: `group_request_id` is set, `group_id` may be null
- approved group announcement: `group_id` is set, `group_request_id` may optionally remain for lineage

A check constraint or service validation should prevent unclear attachment states.

## 6. Contribution Handling System

### 6.1 Contribution Obligations

Contribution obligations are mandatory rows generated at the start of each round.

Purpose:

- know who is expected to pay before payment occurs
- show paid/unpaid/late/defaulted status clearly
- avoid relying only on transaction records
- determine when a round is ready for draw
- support default handling and reliability tracking

### 6.2 Round Opening Integration Point

`ensureOpenRoundForGroup` should become the round-opening integration point. When it creates a new `Round`, it should call an idempotent helper such as `ensureContributionObligationsForRound(group, round)` and create one obligation per active member.

Existing open rounds should be backfilled idempotently before contribution payment starts, so users cannot pay against a round that has no obligations.

### 6.3 Contribution Flow

1. Round opens.
2. System generates one `contribution_obligations` row for each active member.
3. Each obligation begins as `Unpaid`.
4. Member starts payment.
5. Obligation becomes `PendingPayment`.
6. Provider attempt is created.
7. Callback/event is verified.
8. If successful and amount matches:
   - create/update `Transaction`
   - write `ledger_entries`
   - mark obligation as `Paid`
   - run draw-readiness check
9. If failure, timeout, cancellation, duplicate, or wrong amount occurs:
   - provider attempt records the event
   - obligation returns to `Unpaid`, becomes `Late`, or remains `PendingPayment` depending on event and timing

### 6.4 Suggested Obligation Statuses

- `Unpaid`
- `PendingPayment`
- `Paid`
- `Late`
- `Defaulted`
- `Waived`
- `RefundPending`

### 6.5 Round Readiness

Round readiness must be obligation-based.

Replace this logic:

> successful transaction count equals active member count

With this logic:

> all required obligations for the round are in a settled status

A settled obligation may be:

- `Paid`
- handled by approved reserve/default logic
- waived by admin-approved resolution
- converted into refund/disbandment flow

`Transaction` remains important, but it becomes supporting evidence for obligations instead of the only readiness source.

## 7. Mock Payment Provider Architecture

### 7.1 Purpose

The payment system should behave like a real integration while remaining safe for the capstone.

`payment_provider_attempts` becomes the durable lifecycle record for mock provider simulation. `Transaction` remains the academic financial event record.

### 7.2 Supported Mock Events

The mock provider should simulate:

- success
- failure
- timeout
- duplicate callback
- wrong amount
- cancelled payment
- pending status
- payout success
- payout failure
- refund-ticket creation

### 7.3 Provider Attempt Flow

1. User clicks Pay Contribution.
2. System creates payment intent/provider attempt.
3. Mock provider screen opens.
4. User confirms, cancels, or fails the payment.
5. Mock callback/event is recorded.
6. System verifies amount, user, round, method, and obligation.
7. System creates transaction and ledger entries only if verification succeeds.
8. Contribution obligation is marked paid only after successful verification.

### 7.4 Attempt Lifecycle and Immutable Event History

`payment_provider_attempts` is a current lifecycle row and may transition from initiated/pending to success/failure/timeout/cancelled/invalid. Immutable history should be captured through `audit_events`, and a future `payment_provider_attempt_events` table may be added if callback replay history becomes necessary.

### 7.5 Duplicate Callback Rule

Duplicate callbacks must not create duplicate successful transactions.

A duplicate callback should:

- create an audit event
- update or link to the existing provider attempt where appropriate
- avoid creating another successful `Transaction`

Duplicate callback handling should be a first-class test case.

## 8. Wallet Ledger / Simulated Ledger Entries

### 8.1 Purpose

`ledger_entries` provides a detailed wallet/simulated accounting trail for contributions, payouts, reserves, releases, defaults, and refund tickets.

For the defense stage, wallet terminology is acceptable as long as the system explains that the wallet is simulated/mock.

### 8.2 Relationship With Transaction

Do not replace `Transaction`.

Use:

- `Transaction` = academic canonical contribution/payout record used by existing screens, reports, and history
- `ledger_entries` = detailed wallet/accounting/audit companion record

### 8.3 Ledger Perspective and Direction

Ledger entries should be written from the platform simulated ledger perspective unless a specific report explicitly transforms them into a user-facing balance view.

Suggested `direction` values:

- `Credit`
- `Debit`
- `Memo`

`Memo` is used for non-balance-changing records such as reserve freeze notes or audit-aligned ledger annotations.

### 8.4 Ledger Entry Types

Recommended entry types:

- `ContributionReceived`
- `PaymentAttemptPending`
- `PaymentAttemptFailed`
- `PayoutRequestCreated`
- `PayoutReleased`
- `PayoutReserved`
- `PayoutReleaseScheduled`
- `PayoutReleaseCancelled`
- `ReserveReleased`
- `ReserveFrozen`
- `DefaultOffset`
- `RefundTicketCreated`
- `PenaltySimulated`
- `GroupDisbandmentAdjustment`

### 8.5 Append-Only Rule

`ledger_entries` should be append-only where possible.

Do not update amounts after insertion except under rare admin-only audited correction flows.

## 9. Payout Request and Payout Maturity System

### 9.1 Problem Being Solved

In Equb, a user who wins early may lose motivation to keep contributing in later rounds. This is one of the highest trust risks because it harms members who have not yet received their payout.

### 9.2 KYC Clarification

KYC is a general platform prerequisite. It should not be repeated as a special per-group anti-default check.

The app should already prevent non-verified users from participating in restricted financial flows.

### 9.3 Reliability Labels

Use clean reliability labels instead of numeric public scores.

Code-safe values:

- `New`
- `BuildingTrust`
- `Trusted`
- `Restricted`
- `Banned`

Display label for `BuildingTrust`:

- “Building Trust”

Detailed reliability metrics may be stored internally, but normal users should only see the basic public status.

### 9.4 Keep Reliability Separate From KYC

Do not put reliability into `User.KYC_Status`.

Use:

- `User.KYC_Status` = identity/compliance status
- `user_reliability_profiles.public_status` = trust/default behavior status
- `user_restrictions` = active restriction records

`User.KYC_Status` should remain:

- `Unverified`
- `Verified`
- `Banned`

Precedence rule:

- `User.KYC_Status = Banned` means account-level platform ban
- `user_reliability_profiles.public_status = Restricted` means default/reliability restriction
- reliability `Banned` should mirror or be derived from account-level ban only if needed

### 9.5 Payout Maturity Period

New users remain in the payout maturity period until they complete 3 Equb groups perfectly.

Perfect completion means:

- no defaults
- no late payments

After 3 perfect completed groups, the user becomes `Trusted`.

### 9.6 Active Group Limit During Maturity

A new/probationary user can join only one active Equb at a time.

A penalized/restricted user is blocked from normal groups and may only participate in approved recovery paths.

This rule must be enforced both when a user joins an active group and when accepted formation participants are converted into `GroupMembers` during group-request approval.

### 9.7 When Payout Vesting Applies

Payout vesting applies to all new users by default.

Exception:

- private invite-based groups may disable it
- only the group creator can disable it
- creator must see a clear warning explaining the default risk
- all group requests still require admin approval

### 9.8 Strict Payout Release Rule

The strict payout rule is intentionally kept.

Reason:

- it is simple enough to explain
- it is easy for users and examiners to follow
- it directly addresses the early-winner default incentive
- it avoids complex payout formulas during the defense-stage capstone

Rule:

If a probationary user wins before the final round, they do not receive the full payout immediately.

Use this strict release model:

- immediate payout must not exceed the amount the user has already contributed
- during the user’s first cycle, immediate payout must be less than the amount personally contributed so far
- the difference becomes a locked wallet/payout reserve
- withheld payout is released gradually after each later successful contribution
- final-round winners receive full payout; this rule is unchangeable

Implementation note:

The rule may use `app_config` values for exact percentages or safety-buffer ratios, but the principle must stay unchanged.

Recommended config keys:

- `first_cycle_payout_release_ratio` with value greater than 0 and less than 1
- `minimum_immediate_payout_amount`
- `payout_rounding_strategy`

Example first-cycle formula:

`immediate_release = floor(personal_contributed_so_far * first_cycle_payout_release_ratio)`

The implementation must still enforce `immediate_release < personal_contributed_so_far` for first-cycle early winners.

### 9.9 Final-Round Definition

A final-round winner is the winner selected in the draw where, after that draw, every eligible cycle participant has won once.

Eligibility should be based on the cycle participant set captured by the group’s active membership/obligation snapshot for the cycle. If replacement/removal rules are later added, the cycle participant snapshot must make the final-round decision deterministic.

### 9.10 Payout Flow After Draw

When the draw selects a winner:

1. Determine if the winner is `Trusted`, `BuildingTrust`, or `New`.
2. Determine whether vesting applies for the group.
3. Create `payout_requests`.
4. Create immediate payout `Transaction` only for the immediate release amount.
5. Create ledger entries:
   - `PayoutReleased` for immediate amount
   - `PayoutReserved` for withheld amount
6. Create `payout_release_schedules` for future release triggers.
7. Notify the user.

### 9.11 User-Facing Explanation

The app should explain this with simple wording and guided UI.

Suggested wording:

> Because you are still building trust on UniEqub, part of your payout will be released as you continue completing your future contributions. Once you complete 3 groups without late or missed payments, you become trusted and can receive full early payouts in future groups.

### 9.12 Mandatory Agreement

The strict payout/vesting rule must be shown before joining.

Users must accept it as part of the group agreement.

## 10. Default Handling System

### 10.1 Early Winner Default Handling

If a probationary early winner fails to pay after receiving partial payout:

- their remaining locked wallet/payout reserve is frozen
- the reserved amount is used in the simulated wallet/ledger to continue the group if possible
- the user is removed/kicked out according to group rules
- user reliability status becomes `Restricted`
- admin review is triggered

### 10.2 Restricted Status

A defaulted/kicked user should first become `Restricted`, not immediately permanently banned.

Restricted users are blocked from:

- joining normal groups
- creating groups
- receiving payouts

### 10.3 Clearing Restricted Status

Restricted status can be cleared by either:

- admin decision, or
- successful completion of 3 low-risk recovery groups

Low-risk recovery groups mean:

- very low payout groups
- admin-approved recovery groups

Recovery-group automation is future work. The Phase 2 implementation should focus on restriction creation, admin clearing, blocked normal participation, and optional manually flagged recovery groups.

The low-risk threshold should be admin-configured through `app_config`.

Restricted users may join recovery groups only if the creator accepts them.

## 11. Group Continuation After Default

### 11.1 If Locked/Reserved Funds Are Enough

If locked/reserved wallet funds are enough to keep the group balanced, the group may continue after the defaulter is removed.

### 11.2 If Locked/Reserved Funds Are Not Enough

If funds are not enough and the group has more than a defined minimum number of people:

- group is frozen
- admin reviews the case
- admin creates valid resolution options
- non-defaulted members vote
- member vote becomes final

### 11.3 Staging Warning

Default handling touches many systems:

- obligations
- payout reserves
- reliability
- membership removal
- admin workflow
- notifications
- audit
- reports
- polls
- refund tickets

Therefore, implementation should be staged.

Recommended order:

1. obligation late/default statuses
2. user restriction creation
3. group freeze event
4. admin review/manual resolution
5. polls
6. refund tickets

## 12. Frozen-Group Polling

Frozen-group polling is a strong feature, but it should come after obligations, payout reserves, reliability, notifications, and audit are stable.

### 12.1 Poll Rules

- only non-defaulted members can vote
- simple majority of eligible non-defaulted voters is required
- poll window lasts 24 hours
- group remains frozen until enough eligible members vote, but only within the 24-hour window
- if the voting window ends without enough votes, the group is disbanded and refund tickets are issued

### 12.2 Poll Options

Possible poll options vary by situation, but may include:

- continue with adjusted schedule
- replace removed member
- terminate group and simulate refunds
- wait for manual/admin resolution

Admin review happens before polling. After admin provides valid options, the member vote is the final decision.

### 12.3 Eligible Voter Snapshot

Eligible voters should not change during a poll.

Store eligible voters at poll creation using either:

- `eligible_voter_user_ids` JSONB on `group_resolution_polls`, or
- a separate `group_resolution_poll_eligible_voters` table

## 13. Refund Ticket Simulation

Refund tickets are used instead of real refunds in the academic implementation.

### 13.1 When Refund Tickets Are Created

Refund tickets are created automatically when a group is disbanded due to unresolved default/frozen-group failure.

### 13.2 Who Receives Refund Tickets

Refund tickets are created for non-defaulted members who:

- have not yet received their payout, and/or
- contributed in the round where the default occurred

### 13.3 Defaulted User Refund Handling

Defaulted users are excluded from refund tickets.

Any available locked/reserved wallet balance connected to the defaulter should first be used to offset the default impact before disbandment/refund-ticket calculations.

### 13.4 Reliability Impact

Disbanded groups should affect only the reliability status of the defaulter(s), not innocent non-defaulted members.

### 13.5 Canonical Group Status Decision

Phase 2 must choose how disbandment is represented before implementing refund tickets.

Allowed options:

- map disbanded groups to `EqubGroup.Status = Completed` and record the disbandment reason in `group_freeze_events`, `refund_tickets`, and `audit_events`
- add a new `Disbanded` canonical status and update backend types, mobile types, admin UI, browse filters, and report logic
- keep the group `Frozen` while a freeze event records a terminal disbandment state

Recommended Phase 2 default: use `Completed` plus explicit freeze/refund/audit metadata unless the team is ready to update all canonical group status handling.

## 14. Student Verification/KYC Expansion

The current single student ID image model is too limited. However, `User.Student_ID_Img` should not be removed immediately because existing code may depend on it.

### 14.1 Additive KYC Design

Keep:

- `User.Student_ID_Img` as latest/primary image reference for compatibility
- `User.KYC_Status` as account eligibility summary

Add:

- `kyc_submissions`
- `kyc_documents`

### 14.2 KYC Submission Statuses

Use these statuses in `kyc_submissions`, not in `User.KYC_Status`:

- `Submitted`
- `UnderReview`
- `Approved`
- `Rejected`
- `NeedsResubmission`

### 14.3 User KYC Status Mapping

`User.KYC_Status` remains:

- `Unverified`
- `Verified`
- `Banned`

Mapping:

- approved KYC submission -> `User.KYC_Status = Verified`
- rejected or needs resubmission -> keep `User.KYC_Status = Unverified`
- banned -> `User.KYC_Status = Banned`

### 14.4 Admin Queue Migration

After `kyc_submissions` is introduced, admin pending KYC should query the latest active submission with status in `Submitted`, `UnderReview`, or `NeedsResubmission`, not every user whose `User.KYC_Status = Unverified`.

This prevents users who have not submitted documents from appearing as review-ready submissions.

## 15. Durable Notification System

### 15.1 Current Issue

Current notifications are derived dynamically from existing tables, and read/unread state may be local-device based.

### 15.2 Additive Notification Design

Add durable `notifications` table.

Keep derived notification fallback temporarily until all event writers exist.

Migration approach:

1. Add `notifications` table.
2. Add notification helper/service.
3. Write notifications on major events.
4. Read durable notifications first.
5. Optionally merge legacy derived notices during transition.
6. `markAllRead` should update `notifications.read_at` for durable rows.
7. During transition, derived fallback read IDs may still be stored locally until derived fallback is removed.

Final target:

- remove local read-ID storage
- rely on durable `notifications.read_at`

### 15.3 Notification Events

Notifications should support:

- group invitation
- join request accepted/rejected
- group submitted for review
- group approved/rejected
- contribution reminder
- payment confirmation
- payment failed/timeout
- late payment warning
- winner announcement
- payout release update
- payout reserve update
- group frozen
- poll opened
- poll result
- refund ticket created
- KYC approved/rejected
- restriction status update

## 16. Audit Event System

### 16.1 Purpose

Audit events should record sensitive admin and system actions.

Add `audit_events` early and create a shared helper such as:

- `supabase/functions/_shared/audit.ts`

### 16.2 Events To Audit

Audit events should include:

- KYC submit/review/reject/resubmit
- group formation submit/approve/reject
- creator disables vesting
- member accepts vesting agreement
- contribution obligations generated
- payment attempt received
- duplicate callback detected
- draw executed
- payout request created
- reserve created/released/frozen
- default/restriction
- group freeze
- poll created/completed
- refund ticket generated
- report export

### 16.3 Append-Only Rule

Audit events should be insert-only where possible.

Avoid update/delete APIs for audit records.

## 17. App Configuration System

`app_config` should be added early so policy rules are not scattered as hardcoded values.

Recommended seed keys:

- `min_group_members = 5`
- `max_group_members`
- `group_formation_expiry_days = 3`
- `frozen_group_poll_hours = 24`
- `required_perfect_groups_for_trusted_status = 3`
- `new_user_active_group_limit = 1`
- `low_risk_recovery_group_max_payout`
- `default_grace_period_hours`
- `mock_payment_timeout_minutes`
- `first_cycle_payout_release_ratio`
- `minimum_immediate_payout_amount`
- `payout_rounding_strategy`
- `enable_private_vesting_override`

Recommended table shape:

- `key text primary key`
- `value jsonb not null`
- `value_type text`
- `description text`
- `updated_by uuid references User(User_ID)`
- `updated_at timestamp`

Configuration values must be validated by key. Examples:

- `min_group_members` must be an integer greater than or equal to 2, seeded as 5
- `first_cycle_payout_release_ratio` must be greater than 0 and less than 1
- `frozen_group_poll_hours` must be a positive integer

## 18. Phase 2 Security Rules

Adding operational tables increases the security surface. Phase 2 must preserve server-side control.

Rules:

- All writes to sensitive Phase 2 tables should happen through Edge Functions.
- Mobile clients must not directly insert or update audit, ledger, provider attempt, payout request, reliability, or restriction rows.
- Admin-only actions must verify role server-side.
- Member actions must verify ownership, KYC, reliability, group, and obligation eligibility server-side.
- RLS policies or restricted grants should prevent direct unauthorized access if Supabase client table access is enabled.
- Audit writes should be server-only.
- Report export should audit report title, format, actor, timestamp, and export outcome even if a dedicated `report_exports` table is deferred.

## 19. Recommended Additive Database Tables

### 19.1 Must Add First

These tables form the core Phase 2 database foundation.

#### `app_config`

Purpose: stores admin-configured platform rules.

Important fields:

- `key`
- `value`
- `value_type`
- `description`
- `updated_by`
- `updated_at`

#### `audit_events`

Purpose: append-only audit trail for sensitive system/admin actions.

Important fields:

- `id`
- `actor_user_id`
- `actor_role`
- `event_type`
- `entity_type`
- `entity_id`
- `metadata`
- `ip_address`
- `created_at`

#### `notifications`

Purpose: durable in-app notification inbox.

Important fields:

- `id`
- `user_id`
- `type`
- `severity`
- `title`
- `message`
- `action_route`
- `related_entity_type`
- `related_entity_id`
- `metadata`
- `read_at`
- `expires_at`
- `delivered_in_app_at`
- `created_at`

#### `group_requests`

Purpose: stores draft/forming group proposals before they become approved groups.

Important fields:

- `id`
- `creator_id`
- `submitted_by`
- `proposed_group_name`
- `description`
- `contribution_amount`
- `frequency`
- `min_members`
- `max_members`
- `visibility`
- `invite_mode`
- `status`
- `risk_level`
- `terms_version`
- `agreement_required`
- `vesting_enabled`
- `vesting_disabled_by_creator`
- `risk_warning_accepted_at`
- `expires_at`
- `submitted_at`
- `reviewed_by`
- `reviewed_at`
- `approval_decision_note`
- `rejection_reason`
- `approved_group_id`
- `created_group_at`
- `created_at`
- `updated_at`

Suggested statuses:

- `Draft`
- `Forming`
- `PendingApproval`
- `Approved`
- `Rejected`
- `Expired`
- `Cancelled`

#### `group_join_requests`

Purpose: stores public/private join interest before actual membership.

Important fields:

- `id`
- `group_request_id`
- `user_id`
- `status`
- `requested_at`
- `accepted_at`
- `rejected_at`
- `removed_at`
- `decision_by`
- `decision_reason`

Suggested statuses:

- `Requested`
- `Accepted`
- `Rejected`
- `Removed`
- `Withdrawn`
- `Expired`

#### `group_invitations`

Purpose: supports invite code/link and direct invitations.

Important fields:

- `id`
- `group_request_id`
- `invited_user_id`
- `invited_phone_or_student_id`
- `invite_code`
- `status`
- `expires_at`
- `created_by`
- `accepted_at`
- `declined_at`
- `created_at`

#### `contribution_obligations`

Purpose: expected payment rows generated for each member at round start.

Important fields:

- `id`
- `round_id`
- `group_id`
- `user_id`
- `amount_due`
- `currency`
- `due_at`
- `grace_ends_at`
- `status`
- `paid_transaction_id`
- `paid_at`
- `late_at`
- `defaulted_at`
- `created_at`
- `updated_at`

Suggested statuses:

- `Unpaid`
- `PendingPayment`
- `Paid`
- `Late`
- `Defaulted`
- `Waived`
- `RefundPending`

#### `payment_provider_attempts`

Purpose: records mock/sandbox payment provider attempts and callbacks.

Important fields:

- `id`
- `provider_name`
- `provider_mode`
- `event_type`
- `attempt_sequence`
- `user_id`
- `group_id`
- `round_id`
- `contribution_obligation_id`
- `payout_request_id`
- `amount`
- `currency`
- `normalized_phone`
- `gateway_reference`
- `idempotency_key`
- `request_payload`
- `callback_payload`
- `status`
- `verification_result`
- `verified_at`
- `verified_by_system`
- `failure_code`
- `failure_message`
- `created_at`
- `callback_received_at`

Suggested statuses:

- `Initiated`
- `Pending`
- `Successful`
- `Failed`
- `Timeout`
- `Cancelled`
- `Duplicate`
- `InvalidAmount`

#### `ledger_entries`

Purpose: append-only wallet/simulated ledger for contributions, payouts, reserves, releases, defaults, and refund tickets.

Important fields:

- `id`
- `user_id`
- `group_id`
- `round_id`
- `transaction_id`
- `payout_request_id`
- `entry_type`
- `direction`
- `amount`
- `currency`
- `description`
- `reference_type`
- `reference_id`
- `metadata`
- `created_at`

#### `payout_requests`

Purpose: separates payout lifecycle from normal contribution transactions.

Important fields:

- `id`
- `group_id`
- `round_id`
- `winner_user_id`
- `total_payout_amount`
- `immediate_release_amount`
- `reserved_amount`
- `currency`
- `status`
- `destination_type`
- `destination_reference`
- `provider_attempt_id`
- `requested_at`
- `processed_at`
- `failed_reason`
- `created_at`

Suggested statuses:

- `Pending`
- `PartiallyReleased`
- `Completed`
- `Failed`
- `Frozen`
- `Cancelled`

#### `payout_release_schedules`

Purpose: tracks gradual release of withheld payout after later successful contributions.

Important fields:

- `id`
- `payout_request_id`
- `user_id`
- `group_id`
- `round_id`
- `trigger_obligation_id`
- `release_amount`
- `currency`
- `status`
- `released_at`
- `created_at`

Suggested statuses:

- `Pending`
- `Released`
- `Frozen`
- `Cancelled`

#### `user_reliability_profiles`

Purpose: stores public reliability label and internal metrics.

Important fields:

- `user_id`
- `public_status`
- `completed_groups_count`
- `perfect_completed_groups_count`
- `late_payment_count`
- `default_count`
- `restriction_count`
- `current_maturity_completed_count`
- `updated_at`

Public statuses:

- `New`
- `BuildingTrust`
- `Trusted`
- `Restricted`
- `Banned`

#### `user_restrictions`

Purpose: tracks restriction reason, admin review, and recovery requirements.

Important fields:

- `id`
- `user_id`
- `restriction_type`
- `reason`
- `status`
- `created_by`
- `created_at`
- `cleared_by`
- `cleared_at`
- `required_recovery_groups`
- `completed_recovery_groups`

Suggested statuses:

- `Active`
- `ClearedByAdmin`
- `ClearedByRecovery`
- `EscalatedToBan`

### 19.2 Strongly Recommended If Time Allows

#### `kyc_submissions`

Purpose: stores KYC review lifecycle.

Important fields:

- `id`
- `user_id`
- `status`
- `submitted_at`
- `reviewed_by`
- `reviewed_at`
- `rejection_reason`
- `created_at`
- `updated_at`

#### `kyc_documents`

Purpose: stores uploaded KYC document metadata.

Important fields:

- `id`
- `kyc_submission_id`
- `document_type`
- `storage_path`
- `content_type`
- `file_size`
- `uploaded_at`

Implementation note: these are strongly recommended before a deeper reliability/restriction UI because the current single-image KYC model is thin.

#### `group_announcements`

Purpose: lightweight group communication for MVP.

Important fields:

- `id`
- `group_request_id`
- `group_id`
- `author_id`
- `message`
- `created_at`
- `updated_at`

#### `group_freeze_events`

Purpose: records group freeze events after unresolved default or insufficient reserve.

Important fields:

- `id`
- `group_id`
- `trigger_user_id`
- `trigger_round_id`
- `reason`
- `status`
- `frozen_at`
- `resolved_at`
- `resolved_by`

### 19.3 Defer Until Foundation Is Stable

#### `group_resolution_polls`

Purpose: stores admin-approved poll options for frozen-group resolution.

Important fields:

- `id`
- `group_id`
- `freeze_event_id`
- `created_by_admin_id`
- `status`
- `opens_at`
- `closes_at`
- `required_threshold_type`
- `eligible_voter_user_ids`
- `created_at`

Threshold:

- simple majority of eligible non-defaulted voters

#### `group_resolution_poll_options`

Purpose: stores options members can vote on.

Important fields:

- `id`
- `poll_id`
- `option_label`
- `option_description`
- `resolution_action`

#### `group_resolution_votes`

Purpose: stores votes from eligible non-defaulted members.

Important fields:

- `id`
- `poll_id`
- `voter_user_id`
- `option_id`
- `voted_at`

#### `refund_tickets`

Purpose: simulates refund handling when a group is disbanded.

Important fields:

- `id`
- `group_id`
- `round_id`
- `user_id`
- `amount`
- `currency`
- `reason`
- `status`
- `calculation_snapshot`
- `offset_applied_amount`
- `created_by_event_id`
- `created_at`
- `processed_at`

Suggested statuses:

- `Created`
- `PendingReview`
- `SimulatedCompleted`
- `Cancelled`

## 20. Tables Deferred or Rejected for Now

### 20.1 Deferred

These may be useful later, but are not required for the current expansion:

- `auth_credentials`
- `auth_sessions`
- `otp_challenges`
- `user_devices`
- `login_attempts`
- `notification_deliveries`
- `notification_preferences`
- `report_exports`
- `risk_flags`
- real provider adapter tables
- full dispute messaging tables
- recovery-group automation tables

Reason: they are useful for production, but would expand implementation too much for the current capstone phase.

### 20.2 Rejected for Current Expansion

#### Sponsor/Vouch System

Rejected for now.

Reason: it complicates responsibility, penalties, and user relationships too much for the current capstone expansion.

#### Full Real-Time Group Chat

Rejected for MVP.

Reason: lightweight announcements/comments are enough for coordination and easier to defend.

#### Real Deposits, Escrow, or Live Penalty Collection

Rejected for current implementation.

Reason: these imply real financial custody and would require legal, institutional, and payment-provider approval before real launch.

## 21. Constraint and Index Improvements

### 21.1 Check Constraints

Good core constraints:

- `User.KYC_Status IN ('Unverified', 'Verified', 'Banned')`
- `User.Role IN ('Member', 'Admin')`
- `EqubGroup.Status IN ('Pending', 'Active', 'Frozen', 'Completed')`
- `Round.Status IN ('Open', 'Locked', 'Completed')`
- `Transaction.Type IN ('Contribution', 'Payout')`
- `Transaction.Status IN ('Pending', 'Successful', 'Failed')`
- `Amount > 0`
- `Round_Number > 0`

Important correction:

Do not add `Rejected` to `EqubGroup.Status`.

Rejected pre-approval groups belong in:

- `group_requests.status = 'Rejected'`

Suggested `group_requests.status` constraint:

- `Draft`
- `Forming`
- `PendingApproval`
- `Approved`
- `Rejected`
- `Expired`
- `Cancelled`

Type cleanup task:

- split `EqubGroupStatus = Pending | Active | Frozen | Completed`
- add `GroupRequestStatus = Draft | Forming | PendingApproval | Approved | Rejected | Expired | Cancelled`

### 21.2 Member Count Constraints

Formation and approval should enforce:

- `group_requests.min_members >= app_config.min_group_members`
- `group_requests.max_members >= group_requests.min_members`

The capstone business rule is minimum 5, but active groups may later lose members due to default/removal, so rigid permanent checks on `EqubGroup.Max_Members` should be applied carefully.

### 21.3 Uniqueness Rules

Add uniqueness rules for dangerous duplicate cases:

- one successful contribution per user per round
- one payout request per winner per round
- unique `payment_provider_attempts.idempotency_key`
- unique non-null `payment_provider_attempts.gateway_reference`
- unique non-null `EqubGroup.Virtual_Acc_Ref`
- unique `contribution_obligations(round_id, user_id)`

Mandatory partial unique index:

```sql
unique ("Round_ID", "User_ID")
where "Type" = 'Contribution' and "Status" = 'Successful'
```

Recommended payout request uniqueness:

```sql
unique (round_id, winner_user_id)
```

### 21.4 Indexes

Recommended indexes:

- `User(Phone_Number)`
- `EqubGroup(Status)`
- `EqubGroup(Creator_ID)`
- `GroupMembers(User_ID, Status)`
- `GroupMembers(Group_ID, Status)`
- `Round(Group_ID, Status)`
- `Transaction(User_ID, Date DESC)`
- `Transaction(Round_ID, Type, Status)`
- `Transaction(Gateway_Ref)`
- `group_requests(status, visibility, expires_at)`
- `group_requests(creator_id, status)`
- `group_join_requests(group_request_id, status)`
- `group_join_requests(user_id, status)`
- `group_invitations(invite_code)`
- `contribution_obligations(round_id, user_id, status)`
- `payment_provider_attempts(idempotency_key)`
- `payment_provider_attempts(gateway_reference)`
- `payment_provider_attempts(contribution_obligation_id, status)`
- `ledger_entries(reference_type, reference_id)`
- `payout_requests(group_id, round_id, winner_user_id)`
- `payout_release_schedules(payout_request_id, status)`
- `user_restrictions(user_id, status)`
- `refund_tickets(user_id, status)`
- `audit_events(entity_type, entity_id)`
- `audit_events(created_at DESC)`
- `notifications(user_id, read_at, created_at)`

## 22. Implementation Roadmap

### Phase 0 — Documentation and Terminology Alignment

This phase is a blocker before implementation.

Update documentation to say:

- new tables are now allowed for Phase 2
- original five tables remain the core foundation
- new tables are additive companion tables
- implementation is mock/sandbox only
- wallet terms are defense-stage simulation terms, not a real launch/custody claim

Documents that must be updated or explicitly superseded:

- `Build/delivery/implementation_plan.md`
- `Build/delivery/progress_spec.md`
- `Build/delivery/implementation_traceability_matrix.md`
- `Build/master_spec/uni_equb_living_technical_spec_v_1.md`
- `README.md`

### Phase 1 — Database Foundation

Add migrations for:

- `app_config`
- `audit_events`
- `notifications`
- `group_requests`
- `group_join_requests`
- `group_invitations`
- `contribution_obligations`
- `payment_provider_attempts`
- `ledger_entries`
- `payout_requests`
- `payout_release_schedules`
- `user_reliability_profiles`
- `user_restrictions`

### Phase 2 — Shared Backend Helpers

Add shared Edge Function helpers:

- `config.ts`
- `audit.ts`
- `notifications.ts`
- `reliability.ts`
- `obligations.ts`
- `ledger.ts`
- `paymentAttempts.ts`
- `mockPaymentProvider.ts`
- `payoutVesting.ts`

### Phase 3 — Group Formation Backend

Add a new group formation service or Edge Function.

Capabilities:

- create draft/forming request
- list public forming groups
- request join
- accept/reject join
- invite
- accept invite
- submit for admin approval
- admin approve/reject request
- on approval create `EqubGroup` and `GroupMembers`

### Phase 4 — Contribution Obligations and Mock Provider Attempts

Modify round creation and contribution flow:

- generate obligations when round opens
- create provider attempts when payment starts
- record success/failure/timeout/cancel/duplicate/wrong amount
- mark obligation paid only after verification
- write ledger entries
- trigger draw readiness from obligations

### Phase 5 — Payout Maturity / Vesting

Modify draw completion:

- check reliability profile
- check group vesting setting
- create payout request
- create immediate release transaction
- reserve remainder in wallet/ledger
- schedule future releases

### Phase 6 — Durable Notifications and Audit Everywhere

Start writing notifications and audit events from:

- KYC review
- group formation
- group approval/rejection
- contribution attempts
- draw
- payout reserve/release
- restriction
- group freeze
- report export

Keep derived notification fallback during transition.

### Phase 7 — Defaults, Freeze Events, Polls, Refund Tickets

Implement in this order:

1. mark obligations late/defaulted
2. restrict defaulting user
3. freeze group if reserve is insufficient
4. admin creates resolution
5. member poll
6. refund tickets if unresolved

Do not attempt full polling/refund-ticket workflow before obligations, payout reserves, reliability, notifications, and audit exist.

## 23. Revised MVP Expansion Priority

### Must Add First

- `app_config`
- `audit_events`
- `notifications`
- `group_requests`
- `group_join_requests`
- `group_invitations`
- `contribution_obligations`
- `payment_provider_attempts`
- `ledger_entries`
- `payout_requests`
- `payout_release_schedules`
- `user_reliability_profiles`
- `user_restrictions`

### Strongly Recommended in the Same Expansion, If Time Allows

- `kyc_submissions`
- `kyc_documents`
- `group_announcements`
- `group_freeze_events`

### Defer Until Foundation Is Stable

- `group_resolution_polls`
- `group_resolution_poll_options`
- `group_resolution_votes`
- `refund_tickets`
- recovery group automation
- report export history
- notification delivery retries
- device/session security tables
- real provider adapters
- full dispute messaging system
- full real-time group chat

## 24. Documentation Sections To Update

The capstone documentation should be updated in these places:

- Scope of the Study
- Limitations of the Study
- Functional Requirements
- Non-Functional Requirements
- Use Case Descriptions
- Use Case Diagram
- Sequence Diagrams
- Activity Diagrams
- Class Diagram
- Database Design
- ER Diagram
- Relational Mapping
- Security Methodology
- Testing and Deployment Methodology
- Conclusion and Recommendation
- Existing implementation/delivery notes that still say new tables are not allowed

## 25. Suggested New Use Cases

Add or revise these use cases:

- Create Group Formation Lobby
- Invite Member to Draft Group
- Request to Join Forming Group
- Submit Group for Admin Approval
- Approve/Reject Group Request
- Generate Contribution Obligations
- Process Mock Contribution Payment
- Handle Failed or Duplicate Payment Callback
- Execute Auditable Draw
- Create Payout Request
- Apply Payout Maturity Rule
- Release Reserved Payout After Contribution
- Mark Member as Defaulted
- Restrict Defaulted Member
- Freeze Group After Default
- Create Frozen-Group Poll
- Vote on Group Resolution
- Generate Refund Tickets
- Update Reliability Status
- Review KYC Submission
- Send Durable Notification
- Log Audit Event

## 26. Final Design Position

The expanded UniEqub system should become:

> A capstone-safe Equb simulation platform with realistic group formation, payment attempt tracking, wallet/simulated ledger entries, obligation-based round readiness, payout reserve/maturity rules, reliability restrictions, durable notifications, and audit logs — while preserving the current MVP core tables and service flow.

This is an expansion, not a rewrite.

It does not process live financial transactions. It does not claim to be a licensed financial service. Wallet behavior is simulated for defense-stage demonstration.

The result is a stronger, more defensible capstone system that can later be prepared for real launch only after proper legal, institutional, and payment-provider approval.
