import React, { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import type { AppServices } from '../services/contracts';
import { mockBackend } from '../services/mock/mockBackend';
import { liveAuthService } from '../services/live/liveAuthService';
import { liveGroupsService } from '../services/live/liveGroupsService';
import { liveKycService } from '../services/live/liveKycService';
import { livePaymentsService } from '../services/live/livePaymentsService';

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ children }: PropsWithChildren) {
  const value = useMemo(() => ({ ...mockBackend, auth: liveAuthService, kyc: liveKycService, groups: liveGroupsService, payments: livePaymentsService }) as AppServices, []);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within ServicesProvider');
  }
  return context;
}


