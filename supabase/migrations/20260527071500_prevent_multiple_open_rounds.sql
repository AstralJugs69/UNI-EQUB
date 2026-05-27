create unique index if not exists idx_round_one_open_per_group
  on public."Round" ("Group_ID")
  where "Status" = 'Open';

