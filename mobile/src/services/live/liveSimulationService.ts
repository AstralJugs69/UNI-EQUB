import { supabase } from '../supabaseClient';
import { loadSessionToken } from '../storage';
import type { SimulationService } from '../contracts';
import type { SimulationCommand, SimulationCommandResult, SimulationSnapshot } from '../../types/domain';
import { assertLiveEnvelope, readLiveFunctionError } from './liveFunctionError';

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const token = await loadSessionToken();
  if (!token) {
    throw new Error('No active session token was found.');
  }
  const { data, error } = await supabase.functions.invoke<Envelope<T>>('simulation-controller', {
    body: { ...body, token },
  });
  if (error) {
    throw new Error(await readLiveFunctionError(error, 'Simulation controller invocation failed.'));
  }
  return assertLiveEnvelope(data, 'Simulation controller invocation failed.');
}

export const liveSimulationService: SimulationService = {
  async getSnapshot(): Promise<SimulationSnapshot> {
    const response = await invoke<{ snapshot: SimulationSnapshot }>({ action: 'getSnapshot' });
    return response.snapshot;
  },

  async runCommand(command: SimulationCommand): Promise<SimulationCommandResult> {
    const response = await invoke<{ result: SimulationCommandResult }>({ action: 'runCommand', command });
    return response.result;
  },
};
