-- Minimal development seed for the UniEqub local workspace.
insert into public."User" ("User_ID", "Full_Name", "Phone_Number", "Password_Hash", "Student_ID_Img", "KYC_Status", "Role", "Created_At") values
('00000000-0000-0000-0000-000000000001', 'Dawit Abebe', '0911000000', 'hash:demo1234', 'storage://students/dawit-id.png', 'Verified', 'Member', now()),
('00000000-0000-0000-0000-000000000002', 'Saba Admin', '0999000000', 'hash:admin1234', 'storage://students/admin-id.png', 'Verified', 'Admin', now())
on conflict ("Phone_Number") do nothing;
