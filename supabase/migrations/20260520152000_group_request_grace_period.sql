alter table public.group_requests
  add column if not exists grace_period_hours integer not null default 6;

alter table public.group_requests
  drop constraint if exists group_requests_grace_period_hours_ck;

alter table public.group_requests
  add constraint group_requests_grace_period_hours_ck
  check (grace_period_hours between 1 and 72);

comment on column public.group_requests.grace_period_hours is
  'Creator-configured late-payment grace period in hours. Used when approved/forming groups create contribution obligations.';
