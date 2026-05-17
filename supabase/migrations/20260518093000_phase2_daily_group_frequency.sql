-- Phase 2 additive cadence expansion.
-- Preserves the canonical MVP tables and extends companion group_requests to allow daily draw cycles.

alter table public.group_requests
  drop constraint if exists group_requests_frequency_ck;

alter table public.group_requests
  add constraint group_requests_frequency_ck
  check (frequency in ('Daily', 'Weekly', 'Bi-weekly', 'Monthly'));

comment on constraint group_requests_frequency_ck on public.group_requests is
  'Phase 2 formation cadence check. Daily draw cycles are allowed without replacing the MVP EqubGroup schema.';
