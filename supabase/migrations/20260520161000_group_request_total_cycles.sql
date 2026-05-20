alter table public.group_requests
  add column if not exists total_cycles integer;

alter table public.group_requests
  drop constraint if exists group_requests_total_cycles_ck;

alter table public.group_requests
  add constraint group_requests_total_cycles_ck
  check (total_cycles is null or total_cycles between 1 and 120);

update public.group_requests
set total_cycles = coalesce(total_cycles, max_members)
where total_cycles is null;

comment on column public.group_requests.total_cycles is
  'Creator-selected number of draw rounds before the approved Equb cycle completes. Falls back to max_members for legacy requests.';
