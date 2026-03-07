export interface UserRecord {
  User_ID: string;
  Full_Name: string;
  Phone_Number: string;
  Password_Hash: string;
  Student_ID_Img: string;
  KYC_Status: 'Unverified' | 'Verified' | 'Banned';
  Role: 'Member' | 'Admin';
  Created_At: string;
}

export interface GroupRecord {
  Group_ID: string;
  Creator_ID: string;
  Group_Name: string;
  Amount: number;
  Max_Members: number;
  Frequency: 'Weekly' | 'Bi-weekly' | 'Monthly';
  Virtual_Acc_Ref: string | null;
  Status: 'Pending' | 'Active' | 'Frozen' | 'Completed';
  Start_Date: string | null;
}

export interface MembershipRecord {
  Membership_ID: string;
  Group_ID: string;
  User_ID: string;
  Joined_At: string;
  Status: 'Active' | 'Left' | 'Removed';
}

export interface RoundRecord {
  Round_ID: string;
  Group_ID: string;
  Round_Number: number;
  Winner_ID: string | null;
  Draw_Date: string | null;
  Status: 'Open' | 'Locked' | 'Completed';
}

export interface TransactionRecord {
  Trans_ID: string;
  User_ID: string;
  Round_ID: string;
  Amount: number;
  Type: 'Contribution' | 'Payout';
  Payment_Method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
  Gateway_Ref: string;
  Status: 'Pending' | 'Successful' | 'Failed';
  Date: string;
}

export interface SessionUser {
  userId: string;
  fullName: string;
  phoneNumber: string;
  role: UserRecord['Role'];
  kycStatus: UserRecord['KYC_Status'];
}

export function toSessionUser(user: UserRecord): SessionUser {
  return {
    userId: user.User_ID,
    fullName: user.Full_Name,
    phoneNumber: user.Phone_Number,
    role: user.Role,
    kycStatus: user.KYC_Status,
  };
}
