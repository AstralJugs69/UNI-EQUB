import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, ListRow, Pill, SectionCard, StatusBanner, TopAppBar, TitleBlock } from '../../components/ui';
import { usePendingKycQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';

export function AdminKycScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data = [] } = usePendingKycQuery();

  return (
    <AppScreen>
      <TopAppBar title="KYC Queue" subtitle="Admin Hub" rightLabel={`${data.length} pending`} />
      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}
      <TitleBlock title="Student reviews" subtitle="Open a full review page before approving, requesting resubmission, or banning an account." />
      {data.length ? (
        data.map(item => (
          <SectionCard key={item.user.User_ID}>
            <ListRow
              title={item.user.Full_Name}
              subtitle={`${item.user.Phone_Number} - ${item.note}`}
              right={<Pill label={item.submission?.status ?? item.user.KYC_Status} tone="warn" />}
              leadingIcon="badge"
              onPress={() => navigation.navigate(routes.adminKycReview, { userId: item.user.User_ID })}
            />
          </SectionCard>
        ))
      ) : (
        <EmptyState icon="fact-check" title="No pending KYC requests" subtitle="The verification queue is currently clear." />
      )}
    </AppScreen>
  );
}
