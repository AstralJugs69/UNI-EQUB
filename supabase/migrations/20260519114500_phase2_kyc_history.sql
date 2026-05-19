-- Phase 2 additive KYC history tables.
-- The canonical MVP User table and User.Student_ID_Img column remain preserved for compatibility.

create table if not exists public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."User"("User_ID"),
  status text not null default 'PendingReview',
  submitted_at timestamp with time zone not null default now(),
  reviewed_by uuid references public."User"("User_ID"),
  reviewed_at timestamp with time zone,
  decision_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint kyc_submissions_status_ck check (status in ('PendingReview', 'Approved', 'Rejected', 'NeedsResubmission', 'Superseded')),
  constraint kyc_submissions_review_ck check (
    (status = 'PendingReview' and reviewed_at is null)
    or (status <> 'PendingReview' and reviewed_at is not null and reviewed_by is not null)
  )
);

comment on table public.kyc_submissions is
  'This Phase 2 companion table preserves the MVP User.Student_ID_Img field while adding durable KYC submission history.';

create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.kyc_submissions(id) on delete cascade,
  user_id uuid not null references public."User"("User_ID"),
  kind text not null,
  storage_ref text not null,
  bucket text,
  object_path text,
  file_name text,
  content_type text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamp with time zone not null default now(),
  constraint kyc_documents_kind_ck check (kind in ('front_id', 'back_id', 'selfie', 'legacy_student_id')),
  constraint kyc_documents_storage_ref_ck check (length(trim(storage_ref)) > 0)
);

comment on table public.kyc_documents is
  'Phase 2 companion table for KYC document references. Documents are stored by reference only; binary files remain in Supabase Storage.';

drop trigger if exists kyc_submissions_set_updated_at on public.kyc_submissions;
create trigger kyc_submissions_set_updated_at
before update on public.kyc_submissions
for each row
execute function public.set_phase2_updated_at();

create unique index if not exists idx_kyc_submissions_one_pending_per_user
  on public.kyc_submissions (user_id)
  where status = 'PendingReview';

create index if not exists idx_kyc_submissions_pending_queue
  on public.kyc_submissions (submitted_at desc)
  where status = 'PendingReview';

create index if not exists idx_kyc_submissions_status_submitted
  on public.kyc_submissions (status, submitted_at desc);

create index if not exists idx_kyc_submissions_user_status_time
  on public.kyc_submissions (user_id, status, submitted_at desc);

create index if not exists idx_kyc_documents_submission
  on public.kyc_documents (submission_id, uploaded_at desc);

create index if not exists idx_kyc_documents_user_kind
  on public.kyc_documents (user_id, kind, uploaded_at desc);

alter table public.kyc_submissions enable row level security;
alter table public.kyc_documents enable row level security;

with legacy_submissions as (
  insert into public.kyc_submissions (
    user_id,
    status,
    submitted_at,
    metadata
  )
  select
    u."User_ID",
    'PendingReview',
    u."Created_At"::timestamp with time zone,
    jsonb_build_object(
      'legacy_backfill', true,
      'legacy_student_id_img', u."Student_ID_Img"
    )
  from public."User" u
  where u."Role" = 'Member'
    and u."KYC_Status" = 'Unverified'
    and length(trim(u."Student_ID_Img")) > 0
    and not exists (
      select 1
      from public.kyc_submissions existing
      where existing.user_id = u."User_ID"
        and existing.status = 'PendingReview'
    )
  returning id, user_id
)
insert into public.kyc_documents (
  submission_id,
  user_id,
  kind,
  storage_ref,
  metadata
)
select
  legacy_submissions.id,
  legacy_submissions.user_id,
  'legacy_student_id',
  u."Student_ID_Img",
  jsonb_build_object('legacy_backfill', true)
from legacy_submissions
join public."User" u on u."User_ID" = legacy_submissions.user_id;
