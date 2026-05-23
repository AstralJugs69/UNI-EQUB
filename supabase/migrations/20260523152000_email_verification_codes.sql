create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."User"("User_ID") on delete cascade,
  email text not null,
  code_hash text not null,
  purpose text not null default 'Signup',
  sent_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint email_verification_codes_purpose_ck check (purpose in ('Signup', 'ProfileChange'))
);

create index if not exists idx_email_verification_codes_user_active
  on public.email_verification_codes (user_id, email, expires_at desc)
  where consumed_at is null;

create index if not exists idx_email_verification_codes_expiry
  on public.email_verification_codes (expires_at)
  where consumed_at is null;

alter table public.email_verification_codes enable row level security;

comment on table public.email_verification_codes is
  'Short-lived one-time email verification codes sent through the backend transactional email provider.';
