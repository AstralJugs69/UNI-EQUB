create table if not exists public.user_profiles (
  user_id uuid primary key references public."User" ("User_ID") on delete cascade,
  university text,
  academic_year text,
  language text not null default 'English',
  theme text not null default 'Light' check (theme in ('Light', 'Dark', 'System')),
  notification_preference text not null default 'PushAndSms' check (notification_preference in ('PushAndSms', 'PushOnly', 'SmsOnly', 'None')),
  wallet_label text,
  avatar_seed text not null,
  avatar_style text not null default 'Geometric' check (avatar_style in ('Initials', 'Geometric', 'Orbital')),
  avatar_palette text not null default 'blue',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_announcements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public."EqubGroup" ("Group_ID") on delete cascade,
  group_request_id uuid references public.group_requests (id) on delete cascade,
  created_by uuid not null references public."User" ("User_ID") on delete cascade,
  title text not null,
  body text not null,
  priority text not null default 'Normal' check (priority in ('Normal', 'High', 'Critical')),
  pinned boolean not null default false,
  target_scope text not null check (target_scope in ('ApprovedGroup', 'FormingGroup')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_announcements_exactly_one_target check (
    (group_id is not null and group_request_id is null and target_scope = 'ApprovedGroup')
    or (group_id is null and group_request_id is not null and target_scope = 'FormingGroup')
  )
);

create index if not exists group_announcements_group_id_idx on public.group_announcements (group_id) where archived_at is null;
create index if not exists group_announcements_group_request_id_idx on public.group_announcements (group_request_id) where archived_at is null;

create table if not exists public.simulation_clock (
  id boolean primary key default true,
  enabled boolean not null default false,
  paused boolean not null default false,
  time_scale numeric not null default 1 check (time_scale > 0),
  offset_seconds integer not null default 0,
  updated_by uuid references public."User" ("User_ID") on delete set null,
  updated_at timestamptz not null default now(),
  constraint simulation_clock_singleton check (id)
);

create table if not exists public.simulation_events (
  id uuid primary key default gen_random_uuid(),
  command_id text not null,
  command_type text not null,
  actor_user_id uuid references public."User" ("User_ID") on delete set null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists simulation_events_created_at_idx on public.simulation_events (created_at desc);
