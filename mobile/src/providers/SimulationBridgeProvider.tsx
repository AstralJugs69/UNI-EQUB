import React, { PropsWithChildren, useEffect } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { routes } from '../navigation/routes';
import { navigateFromOutside } from '../navigation/rootNavigation';

interface SignedSimulationEnvelope {
  signature?: string;
  issuedAt?: string;
  command?: {
    id: string;
    type: string;
    payload?: Record<string, unknown>;
  };
}

function decodePayload(payload: string): SignedSimulationEnvelope | null {
  const candidates = [payload];
  const atob = (globalThis as typeof globalThis & { atob?: (value: string) => string }).atob;
  if (typeof atob === 'function') {
    try {
      candidates.push(atob(payload));
    } catch {
      // payload may already be plain JSON
    }
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as SignedSimulationEnvelope;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function isAcceptedEnvelope(envelope: SignedSimulationEnvelope | null): envelope is Required<Pick<SignedSimulationEnvelope, 'signature' | 'command'>> & SignedSimulationEnvelope {
  return !!envelope?.signature && !!envelope.command?.id && !!envelope.command.type;
}

export function SimulationBridgeProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const nativeModule = NativeModules.SimulationCommand;
    if (!__DEV__ || !nativeModule) {
      return undefined;
    }

    nativeModule.setEnabled(true).catch(() => undefined);
    const emitter = new NativeEventEmitter(nativeModule);
    const subscription = emitter.addListener('UniEqubSimulationCommand', (event: { payload?: string }) => {
      const envelope = decodePayload(event.payload ?? '');
      if (!isAcceptedEnvelope(envelope)) {
        return;
      }

      const { command } = envelope;
      const payload = command.payload ?? {};
      switch (command.type) {
        case 'Navigate':
          if (typeof payload.routeName === 'string') {
            navigateFromOutside(payload.routeName, typeof payload.params === 'object' && payload.params ? payload.params as Record<string, unknown> : undefined);
          }
          break;
        case 'SelectActiveGroup':
          if (typeof payload.groupId === 'string') {
            navigateFromOutside(routes.groupStatus, { groupId: payload.groupId, flash: 'Simulation selected this group.' });
          }
          break;
        case 'PaymentReturn':
          if (typeof payload.groupId === 'string') {
            navigateFromOutside(routes.paymentSuccess, { groupId: payload.groupId, receiptRef: payload.receiptRef, amount: payload.amount, method: payload.method });
          }
          break;
        case 'Refresh':
          queryClient.invalidateQueries();
          break;
        case 'SpeedTime':
        case 'ShowBanner':
        case 'BackendLifecycle':
          queryClient.invalidateQueries();
          break;
        default:
          queryClient.invalidateQueries();
      }
    });

    return () => {
      subscription.remove();
      nativeModule.setEnabled(false).catch(() => undefined);
    };
  }, [queryClient]);

  return <>{children}</>;
}
