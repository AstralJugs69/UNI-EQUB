import type { AccountService } from './contracts';
import type { AccountSlot, AuthSession } from '../types/domain';
import { loadAccountSlots, loadAccountToken, removeAccountSlot, saveAccountSlot } from './storage';

export const localAccountService: AccountService = {
  async listSlots(): Promise<AccountSlot[]> {
    return loadAccountSlots();
  },

  async saveCurrent(session: AuthSession): Promise<AccountSlot> {
    return saveAccountSlot(session, session.user.userId);
  },

  async switchTo(userId: string): Promise<{ token: string | null; slot: AccountSlot | null }> {
    const [slots, token] = await Promise.all([loadAccountSlots(), loadAccountToken(userId)]);
    const slot = slots.find(item => item.userId === userId) ?? null;
    if (!slot) {
      return { token: null, slot: null };
    }
    return {
      token,
      slot: { ...slot, tokenState: token ? 'Available' : 'Missing' },
    };
  },

  async removeSlot(userId: string): Promise<void> {
    await removeAccountSlot(userId);
  },
};
