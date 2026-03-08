import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { PaymentService } from '../contracts';
import type { PaymentMethod, PaymentResult, TransactionRecord, UssdSessionState, WalletSnapshot } from '../../types/domain';

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
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'Contribution reconcile invocation failed.');
  }
  return data.data;
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
    throw new Error(error.message);
  }
  if (!data?.ok || !data.data) {
    throw new Error(data?.error ?? 'Wallet clearance invocation failed.');
  }
  return data.data;
}

export const livePaymentsService: PaymentService = {
  async payContribution(_userId: string, groupId: string, method: PaymentMethod): Promise<PaymentResult> {
    if (method === 'MockUSSD') {
      throw new Error('Mock USSD contributions must use the USSD session flow.');
    }
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
