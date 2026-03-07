-- UniEqub fixed schema bootstrap.
-- This schema intentionally creates only the five tables declared in the living technical spec.

create extension if not exists "pgcrypto";

create table if not exists public."User" (
  "User_ID" uuid primary key default gen_random_uuid(),
  "Full_Name" varchar(100) not null,
  "Phone_Number" varchar(15) not null unique,
  "Password_Hash" varchar(255) not null,
  "Student_ID_Img" text not null,
  "KYC_Status" varchar(20) not null default 'Unverified',
  "Role" varchar(10) not null default 'Member',
  "Created_At" timestamp not null default now()
);

create table if not exists public."EqubGroup" (
  "Group_ID" uuid primary key default gen_random_uuid(),
  "Creator_ID" uuid not null references public."User"("User_ID"),
  "Group_Name" varchar(50) not null,
  "Amount" decimal(10,2) not null,
  "Max_Members" integer not null,
  "Frequency" varchar(20) not null,
  "Virtual_Acc_Ref" varchar(50),
  "Status" varchar(20) not null default 'Pending',
  "Start_Date" date
);

create table if not exists public."GroupMembers" (
  "Membership_ID" uuid primary key default gen_random_uuid(),
  "Group_ID" uuid not null references public."EqubGroup"("Group_ID"),
  "User_ID" uuid not null references public."User"("User_ID"),
  "Joined_At" timestamp not null default now(),
  "Status" varchar(20) not null default 'Active',
  unique ("Group_ID", "User_ID")
);

create table if not exists public."Round" (
  "Round_ID" uuid primary key default gen_random_uuid(),
  "Group_ID" uuid not null references public."EqubGroup"("Group_ID"),
  "Round_Number" integer not null,
  "Winner_ID" uuid references public."User"("User_ID"),
  "Draw_Date" timestamp,
  "Status" varchar(20) not null default 'Open',
  unique ("Group_ID", "Round_Number")
);

create table if not exists public."Transaction" (
  "Trans_ID" uuid primary key default gen_random_uuid(),
  "User_ID" uuid not null references public."User"("User_ID"),
  "Round_ID" uuid not null references public."Round"("Round_ID"),
  "Amount" decimal(10,2) not null,
  "Type" varchar(20) not null,
  "Payment_Method" varchar(30) not null,
  "Gateway_Ref" varchar(100) not null,
  "Status" varchar(20) not null,
  "Date" timestamp not null default now()
);
