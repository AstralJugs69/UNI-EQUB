-- Phase 2 policy text correction.
-- Private invite-based formation starts without admin review once the accepted-member
-- minimum is met; public formation remains the admin-reviewed path.

update public.app_config
set
  description = 'Allows private invite-based creators to disable vesting only after warning acceptance. Private invite groups start without admin review once the accepted-member minimum is met.',
  updated_at = now()
where key = 'enable_private_vesting_override'
  and description like '%admin review%';
