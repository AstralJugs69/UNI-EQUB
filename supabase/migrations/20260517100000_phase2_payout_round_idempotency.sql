-- UniEqub Phase 2 payout idempotency guard.
-- This is additive and preserves the canonical MVP tables while ensuring a
-- completed draw has at most one active payout lifecycle row.

create unique index if not exists idx_payout_requests_round_active_once
  on public.payout_requests (round_id)
  where status in ('Pending', 'PartiallyReleased', 'Completed');
