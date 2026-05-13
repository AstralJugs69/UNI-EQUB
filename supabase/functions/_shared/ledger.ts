import { supabaseAdmin } from './supabaseAdmin.ts';
import type { LedgerDirection, LedgerEntryRecord, LedgerEntryType } from './types.ts';

export interface LedgerEntryInput {
  userId?: string;
  groupId?: string;
  roundId?: string;
  transactionId?: string;
  payoutRequestId?: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount?: number;
  currency?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordLedgerEntry(input: LedgerEntryInput) {
  const { data, error } = await supabaseAdmin
    .from('ledger_entries')
    .insert({
      user_id: input.userId ?? null,
      group_id: input.groupId ?? null,
      round_id: input.roundId ?? null,
      transaction_id: input.transactionId ?? null,
      payout_request_id: input.payoutRequestId ?? null,
      entry_type: input.entryType,
      direction: input.direction,
      amount: input.amount ?? 0,
      currency: input.currency ?? 'ETB',
      description: input.description ?? null,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data as LedgerEntryRecord;
}

export async function listLedgerEntriesForReference(referenceType: string, referenceId: string) {
  const { data, error } = await supabaseAdmin
    .from('ledger_entries')
    .select('*')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as LedgerEntryRecord[];
}

export function ledgerMemo(input: Omit<LedgerEntryInput, 'direction' | 'amount'> & { amount?: number }): LedgerEntryInput {
  return {
    ...input,
    direction: 'Memo',
    amount: input.amount ?? 0,
  };
}
