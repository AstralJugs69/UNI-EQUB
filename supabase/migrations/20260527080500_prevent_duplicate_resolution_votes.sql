create unique index if not exists idx_group_resolution_votes_one_per_voter
  on public.group_resolution_votes (poll_id, voter_user_id);

