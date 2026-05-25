-- Winner exit window after a non-final draw.
-- The winner can leave before the next round opens; otherwise the group continues.

create table if not exists public.winner_exit_windows (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public."EqubGroup"("Group_ID") on delete cascade,
  round_id uuid not null references public."Round"("Round_ID") on delete cascade,
  winner_user_id uuid not null references public."User"("User_ID"),
  status text not null default 'Open',
  opens_at timestamp with time zone not null default now(),
  closes_at timestamp with time zone not null,
  decision_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint winner_exit_windows_status_ck check (status in ('Open', 'Continued', 'Exited', 'Cancelled')),
  constraint winner_exit_windows_window_ck check (closes_at > opens_at),
  constraint winner_exit_windows_decision_ck check (
    (status = 'Open' and decision_at is null)
    or (status <> 'Open' and decision_at is not null)
  )
);

comment on table public.winner_exit_windows is
  'Companion table for the post-draw winner decision window before the next round opens.';

drop trigger if exists winner_exit_windows_set_updated_at on public.winner_exit_windows;
create trigger winner_exit_windows_set_updated_at
before update on public.winner_exit_windows
for each row
execute function public.set_phase2_updated_at();

create unique index if not exists idx_winner_exit_windows_one_per_round
  on public.winner_exit_windows (round_id);

create unique index if not exists idx_winner_exit_windows_one_open_per_group
  on public.winner_exit_windows (group_id)
  where status = 'Open';

create index if not exists idx_winner_exit_windows_group_status
  on public.winner_exit_windows (group_id, status, closes_at);

create index if not exists idx_winner_exit_windows_winner_status
  on public.winner_exit_windows (winner_user_id, status, closes_at);

alter table public.winner_exit_windows enable row level security;

insert into public.app_config (key, value, value_type, description)
values (
  'winner_exit_window_hours',
  '24'::jsonb,
  'integer',
  'Hours a round winner has to continue or exit before the next round opens automatically.'
)
on conflict (key) do nothing;
