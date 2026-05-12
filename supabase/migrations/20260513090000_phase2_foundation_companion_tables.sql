-- Phase 2 foundation companion tables for UniEqub.
-- This migration preserves the five canonical MVP tables:
-- public."User", public."EqubGroup", public."GroupMembers", public."Round", and public."Transaction".
-- New tables below store durable Phase 2 workflow state, idempotency, audit, notifications,
-- simulated ledger rows, payout state, and reliability metadata for Edge Function orchestration.

create extension if not exists "pgcrypto";

create or replace function public.set_phase2_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_phase2_append_only_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only in Phase 2 companion-table design', tg_table_name;
end;
$$;

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  value_type text not null,
  description text not null,
  updated_by uuid references public."User"("User_ID"),
  updated_at timestamp with time zone not null default now(),
  constraint app_config_key_shape_ck check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint app_config_value_type_ck check (value_type in ('integer', 'number', 'boolean', 'string', 'object', 'placeholder')),
  constraint app_config_json_type_ck check (
    case value_type
      when 'integer' then jsonb_typeof(value) = 'number'
      when 'number' then jsonb_typeof(value) = 'number'
      when 'boolean' then jsonb_typeof(value) = 'boolean'
      when 'string' then jsonb_typeof(value) = 'string'
      when 'object' then jsonb_typeof(value) = 'object'
      when 'placeholder' then jsonb_typeof(value) = 'object'
      else false
    end
  ),
  constraint app_config_policy_value_ck check (
    case
      when key = 'min_group_members' and value_type <> 'placeholder'
        then value::text::numeric >= 2
      when key = 'group_formation_expiry_days' and value_type <> 'placeholder'
        then value::text::numeric > 0
      when key = 'frozen_group_poll_hours' and value_type <> 'placeholder'
        then value::text::numeric > 0
      when key = 'required_perfect_groups_for_trusted_status' and value_type <> 'placeholder'
        then value::text::numeric > 0
      when key = 'new_user_active_group_limit' and value_type <> 'placeholder'
        then value::text::numeric > 0
      when key = 'mock_payment_timeout_minutes' and value_type <> 'placeholder'
        then value::text::numeric > 0
      when key = 'first_cycle_payout_release_ratio' and value_type <> 'placeholder'
        then value::text::numeric > 0 and value::text::numeric < 1
      when key = 'minimum_immediate_payout_amount' and value_type <> 'placeholder'
        then value::text::numeric >= 0
      else true
    end
  )
);

comment on table public.app_config is
  'Phase 2 companion table for configuration-driven business rules. User-approved production values should replace documented placeholders through Edge Function/admin workflows.';

insert into public.app_config (key, value, value_type, description)
values
  ('min_group_members', '5'::jsonb, 'integer', 'Spec default minimum member count for forming a group; pending final user approval.'),
  ('max_group_members', '{"placeholder":true,"recommended":12,"requires_user_approval":true}'::jsonb, 'placeholder', 'Placeholder maximum member count until the user approves a Phase 2 policy value.'),
  ('group_formation_expiry_days', '3'::jsonb, 'integer', 'Spec default number of days before a forming group request expires; pending final user approval.'),
  ('frozen_group_poll_hours', '24'::jsonb, 'integer', 'Spec default voting window for frozen-group resolution polls; pending final user approval.'),
  ('required_perfect_groups_for_trusted_status', '3'::jsonb, 'integer', 'Spec default number of perfect completed groups required before Trusted reliability status.'),
  ('new_user_active_group_limit', '1'::jsonb, 'integer', 'Spec default active group limit for New or BuildingTrust users.'),
  ('low_risk_recovery_group_max_payout', '{"placeholder":true,"recommended":null,"requires_user_approval":true}'::jsonb, 'placeholder', 'Placeholder cap for recovery-group payout exposure until user approval.'),
  ('default_grace_period_hours', '{"placeholder":true,"recommended":24,"requires_user_approval":true}'::jsonb, 'placeholder', 'Placeholder default grace period until user approval.'),
  ('mock_payment_timeout_minutes', '15'::jsonb, 'integer', 'Sandbox default timeout for mock provider attempts; pending final user approval.'),
  ('first_cycle_payout_release_ratio', '{"placeholder":true,"recommended":0.8,"constraint":"greater_than_0_less_than_1","requires_user_approval":true}'::jsonb, 'placeholder', 'Placeholder first-cycle payout release ratio until user approval.'),
  ('minimum_immediate_payout_amount', '{"placeholder":true,"recommended":0,"requires_user_approval":true}'::jsonb, 'placeholder', 'Placeholder minimum immediate payout amount until user approval.'),
  ('payout_rounding_strategy', '"floor"'::jsonb, 'string', 'Spec example rounding strategy for payout maturity calculations; pending final user approval.'),
  ('enable_private_vesting_override', 'true'::jsonb, 'boolean', 'Allows private invite-based creators to disable vesting only after warning acceptance and admin review.')
on conflict (key) do nothing;

drop trigger if exists app_config_set_updated_at on public.app_config;
create trigger app_config_set_updated_at
before update on public.app_config
for each row
execute function public.set_phase2_updated_at();

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public."User"("User_ID"),
  actor_role text not null default 'System',
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamp with time zone not null default now(),
  constraint audit_events_actor_role_ck check (actor_role in ('Member', 'Admin', 'System', 'EdgeFunction')),
  constraint audit_events_event_type_ck check (length(trim(event_type)) > 0)
);

comment on table public.audit_events is
  'Phase 2 append-only companion table for sensitive admin, system, mock-provider, payout, and report-export events.';

drop trigger if exists audit_events_prevent_update_delete on public.audit_events;
create trigger audit_events_prevent_update_delete
before update or delete on public.audit_events
for each row
execute function public.prevent_phase2_append_only_mutation();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."User"("User_ID"),
  type text not null,
  severity text not null default 'Info',
  title text not null,
  message text not null,
  action_route text,
  related_entity_type text,
  related_entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamp with time zone,
  expires_at timestamp with time zone,
  delivered_in_app_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint notifications_severity_ck check (severity in ('Info', 'Success', 'Warning', 'Error')),
  constraint notifications_type_ck check (length(trim(type)) > 0),
  constraint notifications_title_ck check (length(trim(title)) > 0)
);

comment on table public.notifications is
  'Phase 2 companion table for a durable in-app inbox. Edge Functions should write and mark these rows read while derived notifications are phased out.';

create table if not exists public.group_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public."User"("User_ID"),
  submitted_by uuid references public."User"("User_ID"),
  proposed_group_name varchar(80) not null,
  description text,
  contribution_amount numeric(10,2) not null,
  frequency text not null,
  min_members integer not null default 5,
  max_members integer not null,
  visibility text not null default 'Public',
  invite_mode text not null default 'PublicRequest',
  status text not null default 'Draft',
  risk_level text not null default 'Low',
  terms_version text not null default 'phase2-v1',
  agreement_required boolean not null default true,
  vesting_enabled boolean not null default true,
  vesting_disabled_by_creator boolean not null default false,
  risk_warning_accepted_at timestamp with time zone,
  expires_at timestamp with time zone,
  submitted_at timestamp with time zone,
  reviewed_by uuid references public."User"("User_ID"),
  reviewed_at timestamp with time zone,
  approval_decision_note text,
  rejection_reason text,
  approved_group_id uuid references public."EqubGroup"("Group_ID"),
  created_group_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint group_requests_amount_ck check (contribution_amount > 0),
  constraint group_requests_frequency_ck check (frequency in ('Weekly', 'Bi-weekly', 'Monthly')),
  constraint group_requests_members_ck check (min_members >= 2 and max_members >= min_members),
  constraint group_requests_visibility_ck check (visibility in ('Public', 'Private')),
  constraint group_requests_invite_mode_ck check (invite_mode in ('PublicRequest', 'InviteCode', 'DirectInvite', 'InviteCodeAndDirect')),
  constraint group_requests_status_ck check (status in ('Draft', 'Forming', 'PendingApproval', 'Approved', 'Rejected', 'Expired', 'Cancelled')),
  constraint group_requests_risk_level_ck check (risk_level in ('Low', 'Medium', 'High')),
  constraint group_requests_approved_group_ck check (status <> 'Approved' or approved_group_id is not null),
  constraint group_requests_vesting_warning_ck check (not vesting_disabled_by_creator or risk_warning_accepted_at is not null)
);

comment on table public.group_requests is
  'Phase 2 companion table for draft/forming/admin-reviewed group proposals before a canonical EqubGroup row is created.';

drop trigger if exists group_requests_set_updated_at on public.group_requests;
create trigger group_requests_set_updated_at
before update on public.group_requests
for each row
execute function public.set_phase2_updated_at();

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_request_id uuid not null references public.group_requests(id) on delete cascade,
  user_id uuid not null references public."User"("User_ID"),
  status text not null default 'Requested',
  requested_at timestamp with time zone not null default now(),
  accepted_at timestamp with time zone,
  rejected_at timestamp with time zone,
  removed_at timestamp with time zone,
  decision_by uuid references public."User"("User_ID"),
  decision_reason text,
  constraint group_join_requests_status_ck check (status in ('Requested', 'Accepted', 'Rejected', 'Removed', 'Withdrawn', 'Expired')),
  constraint group_join_requests_user_once_unique unique (group_request_id, user_id)
);

comment on table public.group_join_requests is
  'Phase 2 companion table for public/private pre-membership interest before GroupMembers rows are created.';

create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_request_id uuid not null references public.group_requests(id) on delete cascade,
  invited_user_id uuid references public."User"("User_ID"),
  invited_phone_or_student_id text,
  invite_code text,
  status text not null default 'Pending',
  expires_at timestamp with time zone,
  created_by uuid not null references public."User"("User_ID"),
  accepted_at timestamp with time zone,
  declined_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint group_invitations_status_ck check (status in ('Pending', 'Accepted', 'Declined', 'Expired', 'Cancelled')),
  constraint group_invitations_target_ck check (
    invited_user_id is not null
    or nullif(trim(coalesce(invited_phone_or_student_id, '')), '') is not null
    or nullif(trim(coalesce(invite_code, '')), '') is not null
  )
);

comment on table public.group_invitations is
  'Phase 2 companion table for invite-code, link-style, phone, student-ID, and direct-user invitations into forming group requests.';

create table if not exists public.contribution_obligations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public."Round"("Round_ID"),
  group_id uuid not null references public."EqubGroup"("Group_ID"),
  user_id uuid not null references public."User"("User_ID"),
  amount_due numeric(10,2) not null,
  currency char(3) not null default 'ETB',
  due_at timestamp with time zone,
  grace_ends_at timestamp with time zone,
  status text not null default 'Unpaid',
  paid_transaction_id uuid references public."Transaction"("Trans_ID"),
  paid_at timestamp with time zone,
  late_at timestamp with time zone,
  defaulted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint contribution_obligations_amount_due_ck check (amount_due > 0),
  constraint contribution_obligations_status_ck check (status in ('Unpaid', 'PendingPayment', 'Paid', 'Late', 'Defaulted', 'Waived', 'RefundPending')),
  constraint contribution_obligations_round_user_unique unique (round_id, user_id),
  constraint contribution_obligations_paid_status_ck check (status <> 'Paid' or paid_at is not null)
);

comment on table public.contribution_obligations is
  'Phase 2 companion table for expected per-member, per-round contribution rows. Round readiness should migrate from transaction counting to obligation settlement.';

drop trigger if exists contribution_obligations_set_updated_at on public.contribution_obligations;
create trigger contribution_obligations_set_updated_at
before update on public.contribution_obligations
for each row
execute function public.set_phase2_updated_at();

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public."EqubGroup"("Group_ID"),
  round_id uuid not null references public."Round"("Round_ID"),
  winner_user_id uuid not null references public."User"("User_ID"),
  total_payout_amount numeric(10,2) not null,
  immediate_release_amount numeric(10,2) not null default 0,
  reserved_amount numeric(10,2) not null default 0,
  currency char(3) not null default 'ETB',
  status text not null default 'Pending',
  destination_type text,
  destination_reference text,
  provider_attempt_id uuid,
  requested_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  failed_reason text,
  created_at timestamp with time zone not null default now(),
  constraint payout_requests_amount_ck check (
    total_payout_amount > 0
    and immediate_release_amount >= 0
    and reserved_amount >= 0
    and immediate_release_amount + reserved_amount = total_payout_amount
  ),
  constraint payout_requests_status_ck check (status in ('Pending', 'PartiallyReleased', 'Completed', 'Failed', 'Frozen', 'Cancelled')),
  constraint payout_requests_round_winner_unique unique (round_id, winner_user_id)
);

comment on table public.payout_requests is
  'Phase 2 companion table that separates payout lifecycle, immediate release, and reserved amount from canonical Transaction rows.';

create table if not exists public.payment_provider_attempts (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null default 'MockUSSD',
  provider_mode text not null default 'Mock',
  event_type text not null default 'ContributionPayment',
  attempt_sequence integer not null default 1,
  user_id uuid not null references public."User"("User_ID"),
  group_id uuid references public."EqubGroup"("Group_ID"),
  round_id uuid references public."Round"("Round_ID"),
  contribution_obligation_id uuid references public.contribution_obligations(id),
  payout_request_id uuid references public.payout_requests(id),
  amount numeric(10,2),
  currency char(3) not null default 'ETB',
  normalized_phone text,
  gateway_reference text,
  idempotency_key text not null,
  request_payload jsonb not null default '{}'::jsonb,
  callback_payload jsonb not null default '{}'::jsonb,
  status text not null default 'Initiated',
  verification_result text,
  verified_at timestamp with time zone,
  verified_by_system boolean not null default false,
  failure_code text,
  failure_message text,
  created_at timestamp with time zone not null default now(),
  callback_received_at timestamp with time zone,
  constraint payment_provider_attempts_mode_ck check (provider_mode in ('Mock', 'Sandbox')),
  constraint payment_provider_attempts_event_type_ck check (event_type in ('ContributionPayment', 'PayoutProcessing', 'RefundTicket')),
  constraint payment_provider_attempts_sequence_ck check (attempt_sequence > 0),
  constraint payment_provider_attempts_amount_ck check (amount is null or amount > 0),
  constraint payment_provider_attempts_status_ck check (status in ('Initiated', 'Pending', 'Successful', 'Failed', 'Timeout', 'Cancelled', 'Duplicate', 'InvalidAmount')),
  constraint payment_provider_attempts_idempotency_key_unique unique (idempotency_key)
);

comment on table public.payment_provider_attempts is
  'Phase 2 companion table for mock/sandbox provider attempts, idempotency keys, callback payloads, verification results, and failure details.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payout_requests_provider_attempt_id_fkey'
  ) then
    alter table public.payout_requests
      add constraint payout_requests_provider_attempt_id_fkey
      foreign key (provider_attempt_id)
      references public.payment_provider_attempts(id);
  end if;
end;
$$;

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public."User"("User_ID"),
  group_id uuid references public."EqubGroup"("Group_ID"),
  round_id uuid references public."Round"("Round_ID"),
  transaction_id uuid references public."Transaction"("Trans_ID"),
  payout_request_id uuid references public.payout_requests(id),
  entry_type text not null,
  direction text not null,
  amount numeric(10,2) not null default 0,
  currency char(3) not null default 'ETB',
  description text,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint ledger_entries_amount_ck check (amount >= 0),
  constraint ledger_entries_direction_ck check (direction in ('Credit', 'Debit', 'Memo')),
  constraint ledger_entries_entry_type_ck check (
    entry_type in (
      'ContributionReceived',
      'PaymentAttemptPending',
      'PaymentAttemptFailed',
      'PayoutRequestCreated',
      'PayoutReleased',
      'PayoutReserved',
      'PayoutReleaseScheduled',
      'PayoutReleaseCancelled',
      'ReserveReleased',
      'ReserveFrozen',
      'DefaultOffset',
      'RefundTicketCreated',
      'PenaltySimulated',
      'GroupDisbandmentAdjustment'
    )
  )
);

comment on table public.ledger_entries is
  'Phase 2 append-only companion table for simulated wallet/ledger entries. Transaction remains the canonical MVP event row.';

drop trigger if exists ledger_entries_prevent_update_delete on public.ledger_entries;
create trigger ledger_entries_prevent_update_delete
before update or delete on public.ledger_entries
for each row
execute function public.prevent_phase2_append_only_mutation();

create table if not exists public.payout_release_schedules (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid not null references public.payout_requests(id),
  user_id uuid not null references public."User"("User_ID"),
  group_id uuid not null references public."EqubGroup"("Group_ID"),
  round_id uuid not null references public."Round"("Round_ID"),
  trigger_obligation_id uuid references public.contribution_obligations(id),
  release_amount numeric(10,2) not null,
  currency char(3) not null default 'ETB',
  status text not null default 'Pending',
  released_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint payout_release_schedules_amount_ck check (release_amount > 0),
  constraint payout_release_schedules_status_ck check (status in ('Pending', 'Released', 'Frozen', 'Cancelled'))
);

comment on table public.payout_release_schedules is
  'Phase 2 companion table for gradual release of reserved payout amounts after later successful obligations.';

create table if not exists public.user_reliability_profiles (
  user_id uuid primary key references public."User"("User_ID") on delete cascade,
  public_status text not null default 'New',
  completed_groups_count integer not null default 0,
  perfect_completed_groups_count integer not null default 0,
  late_payment_count integer not null default 0,
  default_count integer not null default 0,
  restriction_count integer not null default 0,
  current_maturity_completed_count integer not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint user_reliability_profiles_status_ck check (public_status in ('New', 'BuildingTrust', 'Trusted', 'Restricted', 'Banned')),
  constraint user_reliability_profiles_counts_ck check (
    completed_groups_count >= 0
    and perfect_completed_groups_count >= 0
    and perfect_completed_groups_count <= completed_groups_count
    and late_payment_count >= 0
    and default_count >= 0
    and restriction_count >= 0
    and current_maturity_completed_count >= 0
  )
);

comment on table public.user_reliability_profiles is
  'Phase 2 companion table for public reliability status and internal payment/default metrics separate from User.KYC_Status.';

drop trigger if exists user_reliability_profiles_set_updated_at on public.user_reliability_profiles;
create trigger user_reliability_profiles_set_updated_at
before update on public.user_reliability_profiles
for each row
execute function public.set_phase2_updated_at();

create table if not exists public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."User"("User_ID") on delete cascade,
  restriction_type text not null,
  reason text not null,
  status text not null default 'Active',
  created_by uuid references public."User"("User_ID"),
  created_at timestamp with time zone not null default now(),
  cleared_by uuid references public."User"("User_ID"),
  cleared_at timestamp with time zone,
  required_recovery_groups integer not null default 0,
  completed_recovery_groups integer not null default 0,
  constraint user_restrictions_status_ck check (status in ('Active', 'ClearedByAdmin', 'ClearedByRecovery', 'EscalatedToBan')),
  constraint user_restrictions_recovery_counts_ck check (
    required_recovery_groups >= 0
    and completed_recovery_groups >= 0
    and completed_recovery_groups <= required_recovery_groups
  ),
  constraint user_restrictions_type_ck check (length(trim(restriction_type)) > 0)
);

comment on table public.user_restrictions is
  'Phase 2 companion table for active, cleared, and escalated default/reliability restrictions and recovery progress.';

create unique index if not exists idx_transaction_successful_contribution_once
  on public."Transaction" ("Round_ID", "User_ID")
  where "Type" = 'Contribution' and "Status" = 'Successful';

create unique index if not exists idx_transaction_active_payout_once
  on public."Transaction" ("Round_ID", "User_ID")
  where "Type" = 'Payout' and "Status" in ('Pending', 'Successful');

create unique index if not exists idx_equbgroup_virtual_acc_ref_unique
  on public."EqubGroup" ("Virtual_Acc_Ref")
  where "Virtual_Acc_Ref" is not null;

create index if not exists idx_user_phone_number
  on public."User" ("Phone_Number");

create index if not exists idx_equbgroup_status
  on public."EqubGroup" ("Status");

create index if not exists idx_equbgroup_creator
  on public."EqubGroup" ("Creator_ID");

create index if not exists idx_groupmembers_user_status
  on public."GroupMembers" ("User_ID", "Status");

create index if not exists idx_groupmembers_group_status
  on public."GroupMembers" ("Group_ID", "Status");

create index if not exists idx_round_group_status
  on public."Round" ("Group_ID", "Status");

create index if not exists idx_transaction_user_date_desc
  on public."Transaction" ("User_ID", "Date" desc);

create index if not exists idx_transaction_round_type_status
  on public."Transaction" ("Round_ID", "Type", "Status");

create index if not exists idx_transaction_gateway_ref
  on public."Transaction" ("Gateway_Ref");

create index if not exists idx_app_config_updated_at
  on public.app_config (updated_at desc);

create index if not exists idx_audit_events_entity
  on public.audit_events (entity_type, entity_id);

create index if not exists idx_audit_events_actor_created_at
  on public.audit_events (actor_user_id, created_at desc);

create index if not exists idx_audit_events_created_at_desc
  on public.audit_events (created_at desc);

create index if not exists idx_notifications_user_inbox
  on public.notifications (user_id, read_at, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists idx_notifications_related_entity
  on public.notifications (related_entity_type, related_entity_id);

create index if not exists idx_group_requests_status_visibility_expiry
  on public.group_requests (status, visibility, expires_at);

create index if not exists idx_group_requests_creator_status
  on public.group_requests (creator_id, status);

create index if not exists idx_group_requests_active_workflow
  on public.group_requests (created_at desc)
  where status in ('Draft', 'Forming', 'PendingApproval');

create index if not exists idx_group_join_requests_group_status
  on public.group_join_requests (group_request_id, status);

create index if not exists idx_group_join_requests_user_status
  on public.group_join_requests (user_id, status);

create unique index if not exists idx_group_invitations_invite_code_unique
  on public.group_invitations (invite_code)
  where invite_code is not null;

create index if not exists idx_group_invitations_group_status
  on public.group_invitations (group_request_id, status);

create index if not exists idx_group_invitations_invited_user_status
  on public.group_invitations (invited_user_id, status);

create index if not exists idx_contribution_obligations_round_user_status
  on public.contribution_obligations (round_id, user_id, status);

create index if not exists idx_contribution_obligations_group_status
  on public.contribution_obligations (group_id, status);

create index if not exists idx_contribution_obligations_user_status
  on public.contribution_obligations (user_id, status);

create unique index if not exists idx_payment_provider_attempts_gateway_reference_unique
  on public.payment_provider_attempts (gateway_reference)
  where gateway_reference is not null;

create index if not exists idx_payment_provider_attempts_contribution_status
  on public.payment_provider_attempts (contribution_obligation_id, status);

create index if not exists idx_payment_provider_attempts_user_created_at
  on public.payment_provider_attempts (user_id, created_at desc);

create index if not exists idx_payment_provider_attempts_group_round
  on public.payment_provider_attempts (group_id, round_id);

create index if not exists idx_payment_provider_attempts_payout_status
  on public.payment_provider_attempts (payout_request_id, status);

create index if not exists idx_payout_requests_group_round_winner
  on public.payout_requests (group_id, round_id, winner_user_id);

create index if not exists idx_payout_requests_winner_status
  on public.payout_requests (winner_user_id, status);

create index if not exists idx_ledger_entries_reference
  on public.ledger_entries (reference_type, reference_id);

create index if not exists idx_ledger_entries_user_created_at
  on public.ledger_entries (user_id, created_at desc);

create index if not exists idx_ledger_entries_group_round
  on public.ledger_entries (group_id, round_id);

create index if not exists idx_payout_release_schedules_payout_status
  on public.payout_release_schedules (payout_request_id, status);

create index if not exists idx_payout_release_schedules_trigger_obligation
  on public.payout_release_schedules (trigger_obligation_id);

create index if not exists idx_user_reliability_profiles_status
  on public.user_reliability_profiles (public_status);

create index if not exists idx_user_restrictions_user_status
  on public.user_restrictions (user_id, status);

create unique index if not exists idx_user_restrictions_active_type_unique
  on public.user_restrictions (user_id, restriction_type)
  where status = 'Active';

alter table public.app_config enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.group_requests enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.group_invitations enable row level security;
alter table public.contribution_obligations enable row level security;
alter table public.payment_provider_attempts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payout_requests enable row level security;
alter table public.payout_release_schedules enable row level security;
alter table public.user_reliability_profiles enable row level security;
alter table public.user_restrictions enable row level security;
