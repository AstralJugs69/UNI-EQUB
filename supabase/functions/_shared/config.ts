import { supabaseAdmin } from './supabaseAdmin.ts';
import type { AppConfigRecord } from './types.ts';

export const PHASE2_DEFAULT_APP_CONFIG = {
  min_group_members: 5,
  max_group_members: 12,
  group_formation_expiry_days: 3,
  frozen_group_poll_hours: 24,
  required_perfect_groups_for_trusted_status: 3,
  new_user_active_group_limit: 1,
  low_risk_recovery_group_max_payout: null,
  default_grace_period_hours: 24,
  mock_payment_timeout_minutes: 15,
  first_cycle_payout_release_ratio: 0.8,
  minimum_immediate_payout_amount: 0,
  payout_rounding_strategy: 'floor',
  enable_private_vesting_override: true,
} as const;

export type Phase2ConfigKey = keyof typeof PHASE2_DEFAULT_APP_CONFIG;

function coerceConfigValue(record: AppConfigRecord): unknown {
  if (record.value_type === 'placeholder') {
    return undefined;
  }
  return record.value;
}

export async function loadAppConfig(keys?: Phase2ConfigKey[]) {
  let query = supabaseAdmin.from('app_config').select('*');
  if (keys?.length) {
    query = query.in('key', keys);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const config = { ...PHASE2_DEFAULT_APP_CONFIG } as Record<Phase2ConfigKey, unknown>;
  for (const record of (data ?? []) as AppConfigRecord[]) {
    const key = record.key as Phase2ConfigKey;
    if (key in PHASE2_DEFAULT_APP_CONFIG) {
      config[key] = coerceConfigValue(record) ?? PHASE2_DEFAULT_APP_CONFIG[key];
    }
  }
  return config;
}

export async function loadConfigValue<T>(key: Phase2ConfigKey, fallback?: T): Promise<T> {
  const config = await loadAppConfig([key]);
  const value = config[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing Phase 2 app_config value: ${key}`);
  }
  return value as T;
}

export function readPositiveIntegerConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Invalid positive integer app_config value for ${key}`);
  }
  return Number(value);
}
