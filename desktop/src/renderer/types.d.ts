export {};

declare global {
  interface Window {
    uniequbController: {
      listDevices: () => Promise<SimulationDevice[]>;
      launchApp: (deviceId: string) => Promise<boolean>;
      sendCommand: (deviceId: string, command: SimulationCommand) => Promise<{ signature: string; issuedAt: string; command: SimulationCommand }>;
      loginAdmin: (credentials: { phoneNumber: string; password: string }) => Promise<{ token: string; user: { fullName: string; phoneNumber: string; role: string } }>;
      getSnapshot: (token: string) => Promise<{ snapshot: SimulationSnapshot }>;
      runBackendCommand: (token: string, command: SimulationCommand) => Promise<{ result: SimulationCommandResult }>;
    };
  }
}

export interface SimulationDevice {
  id: string;
  transport: string;
  model?: string | null;
  product?: string | null;
  authorized: boolean;
  appInstalled: boolean;
  appRunning: boolean;
}

export interface SimulationCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  issuedAt: string;
}

export interface GroupRecord {
  Group_ID: string;
  Group_Name: string;
  Amount: number;
  Max_Members: number;
  Frequency: string;
  Status: string;
  Start_Date: string | null;
}

export interface RoundRecord {
  Round_ID: string;
  Group_ID: string;
  Round_Number: number;
  Winner_ID: string | null;
  Status: string;
  Draw_Date: string | null;
}

export interface MembershipRecord {
  Membership_ID: string;
  Group_ID: string;
  User_ID: string;
  Status: string;
  Joined_At: string;
}

export interface UserRecord {
  User_ID: string;
  Full_Name: string;
  Phone_Number: string;
  KYC_Status: string;
}

export interface ContributionObligationRecord {
  id: string;
  round_id: string;
  group_id: string;
  user_id: string;
  amount_due: number;
  due_at: string | null;
  grace_ends_at: string | null;
  status: string;
}

export interface SimulationSnapshot {
  generatedAt: string;
  groups: GroupRecord[];
  rounds: RoundRecord[];
  memberships: MembershipRecord[];
  users: UserRecord[];
  obligations: ContributionObligationRecord[];
  transactions: Array<Record<string, unknown>>;
  events: Array<{ id: string; commandType: string; createdAt: string; metadata: Record<string, unknown> }>;
}

export interface SimulationCommandResult {
  ok: boolean;
  commandId: string;
  message: string;
  snapshot?: SimulationSnapshot;
}
