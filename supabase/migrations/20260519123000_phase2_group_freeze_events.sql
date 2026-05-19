-- Phase 2 additive group freeze/recovery events.
-- The canonical MVP EqubGroup table and Status values remain preserved; freeze
-- detail and manual recovery state live in this companion table.

create table if not exists public.group_freeze_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public."EqubGroup"("Group_ID"),
  trigger_user_id uuid references public."User"("User_ID"),
  trigger_round_id uuid references public."Round"("Round_ID"),
  trigger_obligation_id uuid references public.contribution_obligations(id),
  reason text not null,
  status text not null default 'Open',
  frozen_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone,
  resolved_by uuid references public."User"("User_ID"),
  resolution_action text,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint group_freeze_events_status_ck check (
    status in ('Open', 'UnderReview', 'ResolvedContinue', 'ResolvedKeepFrozen', 'Cancelled')
  ),
  constraint group_freeze_events_resolution_ck check (
    (status in ('Open', 'UnderReview') and resolved_at is null)
    or (status not in ('Open', 'UnderReview') and resolved_at is not null and resolved_by is not null)
  )
);

comment on table public.group_freeze_events is
  'Phase 2 companion table for group freeze/default recovery workflow. EqubGroup remains the canonical MVP group row.';

drop trigger if exists group_freeze_events_set_updated_at on public.group_freeze_events;
create trigger group_freeze_events_set_updated_at
before update on public.group_freeze_events
for each row
execute function public.set_phase2_updated_at();

create unique index if not exists idx_group_freeze_events_one_open_per_group
  on public.group_freeze_events (group_id)
  where status in ('Open', 'UnderReview');

create index if not exists idx_group_freeze_events_status_time
  on public.group_freeze_events (status, frozen_at desc);

create index if not exists idx_group_freeze_events_group_time
  on public.group_freeze_events (group_id, frozen_at desc);

create index if not exists idx_group_freeze_events_trigger_user
  on public.group_freeze_events (trigger_user_id, status);

create index if not exists idx_group_freeze_events_trigger_obligation
  on public.group_freeze_events (trigger_obligation_id);

alter table public.group_freeze_events enable row level security;
