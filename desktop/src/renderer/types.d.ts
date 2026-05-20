export {};

declare global {
  interface Window {
    uniequbController: {
      listDevices: () => Promise<SimulationDevice[]>;
      launchApp: (deviceId: string) => Promise<boolean>;
      sendCommand: (deviceId: string, command: SimulationCommand) => Promise<{ signature: string; issuedAt: string; command: SimulationCommand }>;
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
