-- Bootstraps a default admin user after a full data wipe.
-- Dev credentials:
-- Phone: 0999000000
-- Password: admin1234

create extension if not exists pgcrypto;

insert into public."User" (
  "Full_Name",
  "Phone_Number",
  "Password_Hash",
  "Student_ID_Img",
  "KYC_Status",
  "Role"
)
values (
  'Saba Admin',
  '0999000000',
  extensions.crypt('admin1234', extensions.gen_salt('bf')),
  'storage://students/admin-id.png',
  'Verified',
  'Admin'
)
on conflict ("Phone_Number") do update set
  "Full_Name" = excluded."Full_Name",
  "Password_Hash" = excluded."Password_Hash",
  "Student_ID_Img" = excluded."Student_ID_Img",
  "KYC_Status" = excluded."KYC_Status",
  "Role" = excluded."Role";