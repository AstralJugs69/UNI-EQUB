alter table public.group_requests
  add column if not exists join_window_hours integer not null default 72,
  add column if not exists join_window_ends_at timestamp with time zone,
  add column if not exists activated_at timestamp with time zone;

alter table public.group_requests
  drop constraint if exists group_requests_join_window_hours_ck;

alter table public.group_requests
  add constraint group_requests_join_window_hours_ck
  check (join_window_hours between 1 and 168);

comment on column public.group_requests.join_window_hours is
  'Hours approved groups stay open for joining before contribution obligations and draws activate.';

comment on column public.group_requests.join_window_ends_at is
  'Time when the approved group join window closes and the canonical group can activate.';

comment on column public.group_requests.activated_at is
  'Time when the canonical group was moved from open-joining Pending state to Active cycle state.';

create index if not exists idx_group_requests_join_window_activation
  on public.group_requests (approved_group_id, join_window_ends_at, activated_at)
  where status = 'Approved' and approved_group_id is not null;
