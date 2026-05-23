-- Repair pending payout reserve schedules that were created from absolute round counts
-- instead of the current one-win-per-active-member cycle.

with schedule_context as (
  select
    pr.id as payout_request_id,
    count(gm."Membership_ID")::integer as active_member_count,
    r."Round_Number"::integer as round_number
  from public.payout_requests pr
  join public."Round" r on r."Round_ID" = pr.round_id
  join public."GroupMembers" gm
    on gm."Group_ID" = pr.group_id
   and gm."Status" = 'Active'
  where pr.reserved_amount > 0
    and pr.status in ('Pending', 'PartiallyReleased')
  group by pr.id, r."Round_Number"
),
expected_schedule_counts as (
  select
    payout_request_id,
    greatest(
      active_member_count - (((round_number - 1) % nullif(active_member_count, 0)) + 1),
      0
    )::integer as expected_count
  from schedule_context
  where active_member_count > 0
),
ranked_pending as (
  select
    prs.id,
    prs.payout_request_id,
    prs.release_amount,
    esc.expected_count,
    row_number() over (partition by prs.payout_request_id order by prs.created_at, prs.id) as position,
    count(*) over (partition by prs.payout_request_id) as pending_count
  from public.payout_release_schedules prs
  join expected_schedule_counts esc on esc.payout_request_id = prs.payout_request_id
  where prs.status = 'Pending'
),
extra_amounts as (
  select
    payout_request_id,
    sum(release_amount) as amount_to_merge
  from ranked_pending
  where expected_count > 0
    and pending_count > expected_count
    and position > expected_count
  group by payout_request_id
),
last_kept_schedule as (
  select ranked_pending.id, ranked_pending.payout_request_id
  from ranked_pending
  join extra_amounts on extra_amounts.payout_request_id = ranked_pending.payout_request_id
  where ranked_pending.position = ranked_pending.expected_count
)
update public.payout_release_schedules prs
set release_amount = prs.release_amount + extra_amounts.amount_to_merge
from last_kept_schedule
join extra_amounts on extra_amounts.payout_request_id = last_kept_schedule.payout_request_id
where prs.id = last_kept_schedule.id;

with schedule_context as (
  select
    pr.id as payout_request_id,
    count(gm."Membership_ID")::integer as active_member_count,
    r."Round_Number"::integer as round_number
  from public.payout_requests pr
  join public."Round" r on r."Round_ID" = pr.round_id
  join public."GroupMembers" gm
    on gm."Group_ID" = pr.group_id
   and gm."Status" = 'Active'
  where pr.reserved_amount > 0
    and pr.status in ('Pending', 'PartiallyReleased')
  group by pr.id, r."Round_Number"
),
expected_schedule_counts as (
  select
    payout_request_id,
    greatest(
      active_member_count - (((round_number - 1) % nullif(active_member_count, 0)) + 1),
      0
    )::integer as expected_count
  from schedule_context
  where active_member_count > 0
),
ranked_pending as (
  select
    prs.id,
    esc.expected_count,
    row_number() over (partition by prs.payout_request_id order by prs.created_at, prs.id) as position,
    count(*) over (partition by prs.payout_request_id) as pending_count
  from public.payout_release_schedules prs
  join expected_schedule_counts esc on esc.payout_request_id = prs.payout_request_id
  where prs.status = 'Pending'
)
update public.payout_release_schedules prs
set status = 'Cancelled'
from ranked_pending
where prs.id = ranked_pending.id
  and ranked_pending.expected_count > 0
  and ranked_pending.pending_count > ranked_pending.expected_count
  and ranked_pending.position > ranked_pending.expected_count;
