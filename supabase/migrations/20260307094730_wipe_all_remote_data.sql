-- Wipes all remote app data across the fixed schema tables.
-- This removes all users, groups, memberships, rounds, and transactions.

truncate table public."Transaction" restart identity cascade;
truncate table public."Round" restart identity cascade;
truncate table public."GroupMembers" restart identity cascade;
truncate table public."EqubGroup" restart identity cascade;
truncate table public."User" restart identity cascade;