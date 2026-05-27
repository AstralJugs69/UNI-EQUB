alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_purpose_ck;

alter table public.email_verification_codes
  add constraint email_verification_codes_purpose_ck
  check (purpose in ('Signup', 'ProfileChange', 'PasswordReset'));
