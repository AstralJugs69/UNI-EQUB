alter table public."User"
  add column if not exists "Email" text,
  add column if not exists "Email_Verified_At" timestamp with time zone;

create unique index if not exists idx_user_email_lower
  on public."User" (lower("Email"))
  where "Email" is not null;

comment on column public."User"."Email" is
  'Primary email used for password login and account recovery. Existing phone-first accounts may be null until updated.';

comment on column public."User"."Email_Verified_At" is
  'Timestamp set after email ownership verification. Null means the email is syntactically saved but not verified.';
