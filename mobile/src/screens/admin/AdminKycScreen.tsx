import React from 'react';
import { AppScreen, EmptyState, PrimaryCTA, SecondaryCTA, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, usePendingKycQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { AdminNav } from './shared';

export function AdminKycScreen() {
  const { data } = usePendingKycQuery();
  const { approveKyc, banUser } = useAdminActions();
  const item = data?.[0];

  return (
    <AppScreen footer={<AdminNav active={routes.adminKyc} />}>
      <TopAppBar title="KYC Review" subtitle="Admin Queue" rightLabel={`${data?.length ?? 0} pending`} />
      {item ? (
        <>
          <SectionCard>
            <TitleBlock title={item.user.Full_Name} subtitle={`${item.user.Phone_Number} • ${item.user.KYC_Status}`} />
            <TitleBlock title="Review note" subtitle={item.note} />
          </SectionCard>
          <PrimaryCTA label="Approve KYC" onPress={() => approveKyc.mutate(item.user.User_ID)} loading={approveKyc.isPending} disabled={approveKyc.isPending || banUser.isPending} />
          <SecondaryCTA label="Ban Account" onPress={() => banUser.mutate(item.user.User_ID)} loading={banUser.isPending} disabled={approveKyc.isPending || banUser.isPending} />
        </>
      ) : (
        <EmptyState icon="fact-check" title="No pending KYC requests" subtitle="The verification queue is currently clear." />
      )}
    </AppScreen>
  );
}
