import React, { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import type { AppServices } from '../services/contracts';
import { liveAuthService } from '../services/live/liveAuthService';
import { liveAnnouncementsService } from '../services/live/liveAnnouncementsService';
import { liveGroupFormationService } from '../services/live/liveGroupFormationService';
import { liveGroupsService } from '../services/live/liveGroupsService';
import { liveKycService } from '../services/live/liveKycService';
import { liveNotificationsService } from '../services/live/liveNotificationsService';
import { livePaymentsService } from '../services/live/livePaymentsService';
import { liveProfileService } from '../services/live/liveProfileService';
import { liveReportsService } from '../services/live/liveReportsService';
import { liveSimulationService } from '../services/live/liveSimulationService';
import { localAccountService } from '../services/localAccountService';

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ children }: PropsWithChildren) {
  const liveServices = useMemo(
    () => ({
      auth: liveAuthService,
      kyc: liveKycService,
      groups: liveGroupsService,
      formation: liveGroupFormationService,
      payments: livePaymentsService,
      notifications: liveNotificationsService,
      reports: liveReportsService,
      profile: liveProfileService,
      accounts: localAccountService,
      announcements: liveAnnouncementsService,
      simulation: liveSimulationService,
    }) as AppServices,
    [],
  );

  return <ServicesContext.Provider value={liveServices}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within ServicesProvider');
  }
  return context;
}
