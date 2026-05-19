import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { PaymentService } from '../contracts';
import type { PaymentMethod, PaymentResult, TransactionRecord, UssdSessionState, WalletSnapshot } from '../../types/domain';
import { assertLiveEnvelope, readLiveFunctionError } from './liveFunctionError';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface ContributionResponse {
  transaction?: TransactionRecord;
  paymentResult: PaymentResult;
}

interface UssdResponse {
  ussd: UssdSessionState;
  transaction?: TransactionRecord;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }

  const { data, error } = await supabase.functions.invoke<Envelope<T>>('contribution-reconcile', {
    body: { ...body, token },
  });

  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Contribution reconcile invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Contribution reconcile invocation failed.');
}

async function invokeWalletClearance<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }

  const { data, error } = await supabase.functions.invoke<Envelope<T>>('wallet-clearance', {
    body: { ...body, token },
  });

  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Wallet clearance invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Wallet clearance invocation failed.');
}

export const livePaymentsService: PaymentService = {
  async payContribution(_userId: string, groupId: string, method: PaymentMethod): Promise<PaymentResult> {
    const response = await invoke<ContributionResponse>({ action: 'payContribution', groupId, method });
    return response.paymentResult;
  },

  async startContributionUssd(_userId: string, groupId: string): Promise<UssdSessionState> {
    return invoke<UssdSessionState>({ action: 'startContributionUssd', groupId });
  },

  async submitContributionUssd(_userId: string, sessionId: string, input: string): Promise<UssdSessionState> {
    const response = await invoke<UssdResponse>({ action: 'submitContributionUssd', sessionId, input });
    return response.ussd;
  },

  async listTransactions(_userId: string) {
    const response = await invoke<{ transactions: TransactionRecord[] }>({ action: 'listTransactions' });
    return response.transactions;
  },

  async getWallet(_userId: string): Promise<WalletSnapshot> {
    return invoke<WalletSnapshot>({ action: 'getWallet' });
  },

  async withdrawPayout(_userId: string) {
    await invokeWalletClearance<{ payout: TransactionRecord }>({ action: 'withdraw' });
  },
};
