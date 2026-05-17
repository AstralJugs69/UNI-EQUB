import React, { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import type { AppServices } from '../services/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { mockBackend } from '../services/mock/mockBackend';
import { liveAuthService } from '../services/live/liveAuthService';
import { liveGroupFormationService } from '../services/live/liveGroupFormationService';
import { liveGroupsService } from '../services/live/liveGroupsService';
import { liveKycService } from '../services/live/liveKycService';
import { liveNotificationsService } from '../services/live/liveNotificationsService';
import { livePaymentsService } from '../services/live/livePaymentsService';
import { liveReportsService } from '../services/live/liveReportsService';

const ServicesContext = createContext<AppServices | null>(null);

interface DemoModeValue {
  demoMode: boolean;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
}

const DemoModeContext = createContext<DemoModeValue | null>(null);

export function ServicesProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [demoMode, setDemoMode] = React.useState(false);
  const liveServices = useMemo(
    () => ({
      ...mockBackend,
      auth: liveAuthService,
      kyc: liveKycService,
      groups: liveGroupsService,
      formation: liveGroupFormationService,
      payments: livePaymentsService,
      notifications: liveNotificationsService,
      reports: liveReportsService,
    }) as AppServices,
    [],
  );
  const value = useMemo(() => (demoMode ? mockBackend : liveServices), [demoMode, liveServices]);
  const enableDemoMode = React.useCallback(() => {
    queryClient.clear();
    setDemoMode(true);
  }, [queryClient]);
  const disableDemoMode = React.useCallback(() => {
    queryClient.clear();
    setDemoMode(false);
  }, [queryClient]);
  const demoValue = useMemo(() => ({ demoMode, enableDemoMode, disableDemoMode }), [demoMode, disableDemoMode, enableDemoMode]);

  return (
    <DemoModeContext.Provider value={demoValue}>
      <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>
    </DemoModeContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within ServicesProvider');
  }
  return context;
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error('useDemoMode must be used within ServicesProvider');
  }
  return context;
}

