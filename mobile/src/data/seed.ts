import type {
  AppNotification,
  GroupRecord,
  MembershipRecord,
  RoundRecord,
  TransactionRecord,
  UserRecord,
} from '../types/domain';

const now = '2026-03-07T09:00:00.000Z';

export const seedUsers: UserRecord[] = [
  {
    User_ID: 'user-dawit',
    Full_Name: 'Dawit Abebe',
    Phone_Number: '0911000000',
    Password_Hash: 'hash:demo1234',
    Student_ID_Img: 'storage://students/dawit-id.png',
    KYC_Status: 'Verified',
    Role: 'Member',
    Created_At: now,
  },
  {
    User_ID: 'user-admin',
    Full_Name: 'Saba Admin',
    Phone_Number: '0999000000',
    Password_Hash: 'hash:admin1234',
    Student_ID_Img: 'storage://students/admin-id.png',
    KYC_Status: 'Verified',
    Role: 'Admin',
    Created_At: now,
  },
  {
    User_ID: 'user-meron',
    Full_Name: 'Meron Alemu',
    Phone_Number: '0911000001',
    Password_Hash: 'hash:pending123',
    Student_ID_Img: 'storage://students/meron-id.png',
    KYC_Status: 'Unverified',
    Role: 'Member',
    Created_At: now,
  },
  {
    User_ID: 'user-miki',
    Full_Name: 'Miki Tesfaye',
    Phone_Number: '0911000002',
    Password_Hash: 'hash:miki1234',
    Student_ID_Img: 'storage://students/miki-id.png',
    KYC_Status: 'Verified',
    Role: 'Member',
    Created_At: now,
  },
  {
    User_ID: 'user-ruth',
    Full_Name: 'Ruth Assefa',
    Phone_Number: '0911000003',
    Password_Hash: 'hash:ruth1234',
    Student_ID_Img: 'storage://students/ruth-id.png',
    KYC_Status: 'Verified',
    Role: 'Member',
    Created_At: now,
  },
  {
    User_ID: 'user-saba',
    Full_Name: 'Saba Tadesse',
    Phone_Number: '0911000004',
    Password_Hash: 'hash:saba1234',
    Student_ID_Img: 'storage://students/saba-id.png',
    KYC_Status: 'Verified',
    Role: 'Member',
    Created_At: now,
  },
];

export const seedGroups: GroupRecord[] = [
  {
    Group_ID: 'group-dorm',
    Creator_ID: 'user-miki',
    Group_Name: 'Dorm A Savings Group',
    Amount: 500,
    Max_Members: 10,
    Frequency: 'Weekly',
    Virtual_Acc_Ref: 'UEQ-0832',
    Status: 'Active',
    Start_Date: '2026-03-01',
    Description: 'Weekly savings circle for off-campus students who need verified mobile money collection.',
  },
  {
    Group_ID: 'group-coders',
    Creator_ID: 'user-ruth',
    Group_Name: 'AAU Coders Circle',
    Amount: 300,
    Max_Members: 8,
    Frequency: 'Monthly',
    Virtual_Acc_Ref: 'UEQ-1043',
    Status: 'Active',
    Start_Date: '2026-03-15',
    Description: 'Monthly rotation for software engineering classmates with fixed equal contributions.',
  },
  {
    Group_ID: 'group-book',
    Creator_ID: 'user-saba',
    Group_Name: 'Book Club Equb',
    Amount: 200,
    Max_Members: 10,
    Frequency: 'Monthly',
    Virtual_Acc_Ref: 'UEQ-1120',
    Status: 'Completed',
    Start_Date: '2026-01-01',
    Description: 'A smaller social savings circle that has already completed a cycle.',
  },
  {
    Group_ID: 'group-night-study',
    Creator_ID: 'user-dawit',
    Group_Name: 'AAU Night Study Circle',
    Amount: 450,
    Max_Members: 9,
    Frequency: 'Weekly',
    Virtual_Acc_Ref: '',
    Status: 'Pending',
    Start_Date: '2026-03-20',
    Description: 'Structured study-group savings cycle awaiting admin approval.',
  },
];

export const seedMemberships: MembershipRecord[] = [
  { Membership_ID: 'm-1', Group_ID: 'group-dorm', User_ID: 'user-dawit', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-2', Group_ID: 'group-dorm', User_ID: 'user-miki', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-3', Group_ID: 'group-dorm', User_ID: 'user-ruth', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-4', Group_ID: 'group-dorm', User_ID: 'user-saba', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-5', Group_ID: 'group-dorm', User_ID: 'member-5', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-6', Group_ID: 'group-dorm', User_ID: 'member-6', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-7', Group_ID: 'group-dorm', User_ID: 'member-7', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-8', Group_ID: 'group-dorm', User_ID: 'member-8', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-9', Group_ID: 'group-dorm', User_ID: 'member-9', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-10', Group_ID: 'group-dorm', User_ID: 'member-10', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-11', Group_ID: 'group-coders', User_ID: 'user-ruth', Joined_At: now, Status: 'Active' },
  { Membership_ID: 'm-12', Group_ID: 'group-book', User_ID: 'user-saba', Joined_At: now, Status: 'Active' },
];

export const seedRounds: RoundRecord[] = [
  { Round_ID: 'round-dorm-1', Group_ID: 'group-dorm', Round_Number: 1, Winner_ID: 'user-miki', Draw_Date: '2026-03-02T12:00:00.000Z', Status: 'Completed' },
  { Round_ID: 'round-dorm-2', Group_ID: 'group-dorm', Round_Number: 2, Winner_ID: 'user-ruth', Draw_Date: '2026-03-05T12:00:00.000Z', Status: 'Completed' },
  { Round_ID: 'round-dorm-3', Group_ID: 'group-dorm', Round_Number: 3, Winner_ID: null, Draw_Date: null, Status: 'Open' },
  { Round_ID: 'round-coders-1', Group_ID: 'group-coders', Round_Number: 1, Winner_ID: null, Draw_Date: null, Status: 'Open' },
  { Round_ID: 'round-book-1', Group_ID: 'group-book', Round_Number: 1, Winner_ID: 'user-saba', Draw_Date: '2026-02-10T12:00:00.000Z', Status: 'Completed' },
];

export const seedTransactions: TransactionRecord[] = [
  { Trans_ID: 't-1', User_ID: 'user-miki', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'Telebirr', Gateway_Ref: 'GW-001', Status: 'Successful', Date: now },
  { Trans_ID: 't-2', User_ID: 'user-ruth', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'Telebirr', Gateway_Ref: 'GW-002', Status: 'Successful', Date: now },
  { Trans_ID: 't-3', User_ID: 'user-saba', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'Telebirr', Gateway_Ref: 'GW-003', Status: 'Successful', Date: now },
  { Trans_ID: 't-4', User_ID: 'member-5', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'MockUSSD', Gateway_Ref: 'GW-004', Status: 'Successful', Date: now },
  { Trans_ID: 't-5', User_ID: 'member-6', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'MockUSSD', Gateway_Ref: 'GW-005', Status: 'Successful', Date: now },
  { Trans_ID: 't-6', User_ID: 'member-7', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'MockUSSD', Gateway_Ref: 'GW-006', Status: 'Successful', Date: now },
  { Trans_ID: 't-7', User_ID: 'member-8', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'MockUSSD', Gateway_Ref: 'GW-007', Status: 'Successful', Date: now },
  { Trans_ID: 't-8', User_ID: 'member-9', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'MockUSSD', Gateway_Ref: 'GW-008', Status: 'Successful', Date: now },
  { Trans_ID: 't-9', User_ID: 'member-10', Round_ID: 'round-dorm-3', Amount: 500, Type: 'Contribution', Payment_Method: 'MockUSSD', Gateway_Ref: 'GW-009', Status: 'Successful', Date: now },
  { Trans_ID: 't-10', User_ID: 'user-dawit', Round_ID: 'round-book-1', Amount: 200, Type: 'Contribution', Payment_Method: 'Telebirr', Gateway_Ref: 'GW-010', Status: 'Successful', Date: '2026-02-01T10:00:00.000Z' },
];

export const seedNotifications: Record<string, AppNotification[]> = {
  'user-dawit': [
    { id: 'n-1', title: 'Contribution due in 2 days', body: 'Dorm A Savings Group needs one more verified payment before the round closes.', createdAt: now, unread: true },
    { id: 'n-2', title: 'KYC approved', body: 'Your account is fully verified for group creation and payout withdrawal.', createdAt: now, unread: false },
  ],
  'user-admin': [
    { id: 'n-3', title: 'Pending KYC review', body: 'Meron Alemu is still waiting for ID review.', createdAt: now, unread: true },
  ],
};
