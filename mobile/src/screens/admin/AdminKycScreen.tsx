import React from 'react';
import { View } from 'react-native';
import { AppScreen, EmptyState, ListRow, Pill, PrimaryCTA, SecondaryCTA, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, usePendingKycQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { AdminNav } from './shared';
import { adminStyles } from './styles';

export function AdminKycScreen() {
  const { data = [] } = usePendingKycQuery();
  const { approveKyc, requestKycResubmission, banUser } = useAdminActions();
  const busy = approveKyc.isPending || requestKycResubmission.isPending || banUser.isPending;

  return (
    <AppScreen footer={<AdminNav active={routes.adminKyc} />} footerFlush>
      <TopAppBar title="KYC Review" subtitle="Admin Queue" rightLabel={`${data.length} pending`} />
      {data.length ? (
        <>
          {data.map(item => (
            <SectionCard key={item.user.User_ID}>
              <View style={adminStyles.rowWrap}>
                <Pill label={item.user.KYC_Status} tone="warn" />
                <Pill label="Student ID" tone="neutral" />
              </View>
              <TitleBlock title={item.user.Full_Name} subtitle={item.user.Phone_Number} />
              <ListRow
                title="Documents"
                subtitle={item.documents?.length ? item.documents.map(document => document.kind.replace(/_/g, ' ')).join(', ') : item.user.Student_ID_Img}
                leadingIcon="image-search"
              />
              <ListRow title="Review note" subtitle={item.note} leadingIcon="rate-review" />
              <View style={adminStyles.twoCol}>
                <PrimaryCTA label="Approve" onPress={() => approveKyc.mutate(item.user.User_ID)} loading={approveKyc.isPending} disabled={busy} />
                <SecondaryCTA
                  label="Resubmit"
                  onPress={() => requestKycResubmission.mutate(item.user.User_ID)}
                  loading={requestKycResubmission.isPending}
                  disabled={busy}
                />
                <SecondaryCTA label="Ban" onPress={() => banUser.mutate(item.user.User_ID)} loading={banUser.isPending} disabled={busy} />
              </View>
            </SectionCard>
          ))}
        </>
      ) : (
        <EmptyState icon="fact-check" title="No pending KYC requests" subtitle="The verification queue is currently clear." />
      )}
    </AppScreen>
  );
}
