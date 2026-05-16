-- UniEqub Phase 2 backfill for existing MVP data.
-- This migration is additive and idempotent. It preserves the canonical MVP
-- tables while filling companion rows needed by Phase 2 workflows.

insert into public.user_reliability_profiles (
  user_id,
  public_status,
  completed_groups_count,
  perfect_completed_groups_count,
  late_payment_count,
  default_count,
  restriction_count,
  current_maturity_completed_count
)
select
  u."User_ID",
  case
    when u."KYC_Status" = 'Banned' then 'Banned'
    else 'New'
  end,
  0,
  0,
  0,
  0,
  0,
  0
from public."User" u
where not exists (
  select 1
  from public.user_reliability_profiles existing
  where existing.user_id = u."User_ID"
);

insert into public.contribution_obligations (
  round_id,
  group_id,
  user_id,
  amount_due,
  currency,
  status,
  paid_transaction_id,
  paid_at
)
select
  r."Round_ID",
  r."Group_ID",
  gm."User_ID",
  g."Amount",
  'ETB',
  case
    when tx."Trans_ID" is not null then 'Paid'
    else 'Unpaid'
  end,
  tx."Trans_ID",
  tx."Date"
from public."Round" r
join public."EqubGroup" g
  on g."Group_ID" = r."Group_ID"
join public."GroupMembers" gm
  on gm."Group_ID" = r."Group_ID"
 and gm."Status" = 'Active'
left join public."Transaction" tx
  on tx."Round_ID" = r."Round_ID"
 and tx."User_ID" = gm."User_ID"
 and tx."Type" = 'Contribution'
 and tx."Status" = 'Successful'
where r."Status" = 'Open'
on conflict (round_id, user_id) do nothing;

update public.contribution_obligations obligation
set
  status = 'Paid',
  paid_transaction_id = tx."Trans_ID",
  paid_at = tx."Date"
from public."Transaction" tx
where tx."Round_ID" = obligation.round_id
  and tx."User_ID" = obligation.user_id
  and tx."Type" = 'Contribution'
  and tx."Status" = 'Successful'
  and obligation.status in ('Unpaid', 'PendingPayment', 'Late')
  and obligation.paid_transaction_id is null;
