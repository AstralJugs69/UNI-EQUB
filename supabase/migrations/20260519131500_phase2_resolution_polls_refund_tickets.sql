-- Phase 2 additive frozen-group polls and simulated refund tickets.
-- Canonical MVP EqubGroup rows stay unchanged; unresolved/disbandment-like
-- outcomes remain explicit companion-table state for this capstone phase.

create table if not exists public.group_resolution_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public."EqubGroup"("Group_ID"),
  freeze_event_id uuid not null references public.group_freeze_events(id),
  created_by_admin_id uuid not null references public."User"("User_ID"),
  status text not null default 'Open',
  opens_at timestamp with time zone not null default now(),
  closes_at timestamp with time zone not null,
  required_threshold_type text not null default 'SimpleMajority',
  eligible_voter_user_ids jsonb not null default '[]'::jsonb,
  winning_option_id uuid,
  closed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint group_resolution_polls_status_ck check (status in ('Open', 'Closed', 'Expired', 'Cancelled')),
  constraint group_resolution_polls_threshold_ck check (required_threshold_type in ('SimpleMajority')),
  constraint group_resolution_polls_window_ck check (closes_at > opens_at),
  constraint group_resolution_polls_eligible_array_ck check (jsonb_typeof(eligible_voter_user_ids) = 'array')
);

comment on table public.group_resolution_polls is
  'Phase 2 companion table for member voting on frozen-group resolution. The canonical EqubGroup row remains Frozen or Active.';

create table if not exists public.group_resolution_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_resolution_polls(id) on delete cascade,
  option_label text not null,
  option_description text,
  resolution_action text not null,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint group_resolution_poll_options_action_ck check (
    resolution_action in ('ContinueWithReserveFrozen', 'KeepFrozenForReview', 'CreateRefundTickets')
  )
);

comment on table public.group_resolution_poll_options is
  'Phase 2 companion table for admin-approved frozen-group resolution options.';

create table if not exists public.group_resolution_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_resolution_polls(id) on delete cascade,
  voter_user_id uuid not null references public."User"("User_ID"),
  option_id uuid not null references public.group_resolution_poll_options(id),
  voted_at timestamp with time zone not null default now(),
  constraint group_resolution_votes_unique unique (poll_id, voter_user_id)
);

comment on table public.group_resolution_votes is
  'Phase 2 companion table for one frozen-group poll vote per eligible non-defaulted member.';

create table if not exists public.refund_tickets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public."EqubGroup"("Group_ID"),
  round_id uuid references public."Round"("Round_ID"),
  user_id uuid not null references public."User"("User_ID"),
  amount numeric(10,2) not null default 0,
  currency char(3) not null default 'ETB',
  reason text not null,
  status text not null default 'Created',
  calculation_snapshot jsonb not null default '{}'::jsonb,
  offset_applied_amount numeric(10,2) not null default 0,
  created_by_event_id uuid references public.group_freeze_events(id),
  created_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  constraint refund_tickets_amount_ck check (amount >= 0 and offset_applied_amount >= 0),
  constraint refund_tickets_status_ck check (status in ('Created', 'PendingReview', 'SimulatedCompleted', 'Cancelled')),
  constraint refund_tickets_unique unique (group_id, round_id, user_id, created_by_event_id)
);

comment on table public.refund_tickets is
  'Phase 2 companion table for simulated refund handling after unresolved frozen-group failure. No real money is moved.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'group_resolution_polls_winning_option_id_fkey'
  ) then
    alter table public.group_resolution_polls
      add constraint group_resolution_polls_winning_option_id_fkey
      foreign key (winning_option_id)
      references public.group_resolution_poll_options(id);
  end if;
end;
$$;

drop trigger if exists group_resolution_polls_set_updated_at on public.group_resolution_polls;
create trigger group_resolution_polls_set_updated_at
before update on public.group_resolution_polls
for each row
execute function public.set_phase2_updated_at();

create unique index if not exists idx_group_resolution_polls_one_open_per_freeze
  on public.group_resolution_polls (freeze_event_id)
  where status = 'Open';

create index if not exists idx_group_resolution_polls_group_status
  on public.group_resolution_polls (group_id, status, closes_at);

create index if not exists idx_group_resolution_polls_freeze_status
  on public.group_resolution_polls (freeze_event_id, status);

create index if not exists idx_group_resolution_poll_options_poll
  on public.group_resolution_poll_options (poll_id, display_order);

create index if not exists idx_group_resolution_votes_poll_option
  on public.group_resolution_votes (poll_id, option_id);

create index if not exists idx_refund_tickets_group_status
  on public.refund_tickets (group_id, status, created_at desc);

create index if not exists idx_refund_tickets_user_status
  on public.refund_tickets (user_id, status, created_at desc);

create index if not exists idx_refund_tickets_freeze_event
  on public.refund_tickets (created_by_event_id);

alter table public.group_resolution_polls enable row level security;
alter table public.group_resolution_poll_options enable row level security;
alter table public.group_resolution_votes enable row level security;
alter table public.refund_tickets enable row level security;
