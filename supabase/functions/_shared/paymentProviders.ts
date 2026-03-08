import { normalizePhone } from './phone.ts';
import type { GroupRecord, UserRecord } from './types.ts';

export interface SimulatedProviderResult {
  gatewayRef: string;
  senderPhone: string;
  providerLabel: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox';
}

function makeGatewayRef(prefix: string) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function initiateSimulatedProvider(method: 'Telebirr' | 'MockUSSD' | 'ChapaSandbox', actor: UserRecord, _group: GroupRecord): SimulatedProviderResult {
  switch (method) {
    case 'Telebirr':
      return {
        gatewayRef: makeGatewayRef('TB'),
        senderPhone: normalizePhone(actor.Phone_Number),
        providerLabel: 'Telebirr',
      };
    case 'ChapaSandbox':
      return {
        gatewayRef: makeGatewayRef('CHAPA'),
        senderPhone: normalizePhone(actor.Phone_Number),
        providerLabel: 'ChapaSandbox',
      };
    case 'MockUSSD':
    default:
      return {
        gatewayRef: makeGatewayRef('USSD'),
        senderPhone: normalizePhone(actor.Phone_Number),
        providerLabel: 'MockUSSD',
      };
  }
}
