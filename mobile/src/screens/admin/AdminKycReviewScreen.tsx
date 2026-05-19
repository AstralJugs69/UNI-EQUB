import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, ListRow, LoadingState, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, TopAppBar, TitleBlock } from '../../components/ui';
import { useAdminActions, usePendingKycQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { adminStyles } from './styles';

export function AdminKycReviewScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const userId = route.params?.userId ?? '';
  const { data = [] } = usePendingKycQuery();
  const item = data.find(row => row.user.User_ID === userId);
  const { approveKyc, requestKycResubmission, banUser } = useAdminActions();
  const [error, setError] = useState('');
  const busy = approveKyc.isPending || requestKycResubmission.isPending || banUser.isPending;

  if (!item) {
    return <LoadingState title="Loading KYC review" subtitle="Finding the selected queue item." />;
  }
  const reviewItem = item;

  function returnToQueue(flash: string) {
    navigation.navigate(routes.adminTabs, { screen: routes.adminKyc, params: { flash } });
  }

  function runDecision(label: string, action: () => void) {
    setError('');
    action();
  }

  function confirmBan() {
    Alert.alert('Ban account', `Ban ${reviewItem.user.Full_Name} and reject the current KYC submission?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: () => runDecision('ban', () => banUser.mutate(reviewItem.user.User_ID, {
          onSuccess: () => returnToQueue('Account banned.'),
          onError: err => setError(err instanceof Error ? err.message : 'Unable to ban this account.'),
        })),
      },
    ]);
  }

  return (
    <ScreenScroll>
      <TopAppBar title="KYC Review" subtitle="Admin Detail" onBack={() => navigation.goBack()} rightLabel={item.submission?.status ?? item.user.KYC_Status} />
      <SectionCard>
        <TitleBlock title={item.user.Full_Name} subtitle={item.user.Phone_Number} />
        <View style={adminStyles.rowWrap}>
          <Pill label={item.user.KYC_Status} tone="warn" />
          {item.submission ? <Pill label={item.submission.status} tone="active" /> : null}
        </View>
        <ListRow title="Review note" subtitle={item.note} leadingIcon="rate-review" />
        {item.submission ? (
          <ListRow title="Submitted" subtitle={item.submission.submitted_at} leadingIcon="schedule" />
        ) : null}
      </SectionCard>
      <SectionCard variant="soft">
        <TitleBlock title="Documents" subtitle="Review the submitted KYC references before making a decision." />
        {item.documents?.length ? item.documents.map(document => (
          <ListRow
            key={document.id}
            title={document.kind.replace(/_/g, ' ')}
            subtitle={document.file_name ?? document.storage_ref}
            leadingIcon="image-search"
          />
        )) : (
          <ListRow title="Legacy document" subtitle={item.user.Student_ID_Img} leadingIcon="image-search" />
        )}
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA
        label="Approve KYC"
        onPress={() => runDecision('approve', () => approveKyc.mutate(item.user.User_ID, {
          onSuccess: () => returnToQueue('KYC approved.'),
          onError: err => setError(err instanceof Error ? err.message : 'Unable to approve KYC.'),
        }))}
        loading={approveKyc.isPending}
        disabled={busy}
      />
      <SecondaryCTA
        label="Request Resubmission"
        onPress={() => runDecision('resubmit', () => requestKycResubmission.mutate(item.user.User_ID, {
          onSuccess: () => returnToQueue('KYC resubmission requested.'),
          onError: err => setError(err instanceof Error ? err.message : 'Unable to request resubmission.'),
        }))}
        loading={requestKycResubmission.isPending}
        disabled={busy}
      />
      <SecondaryCTA label="Ban Account" onPress={confirmBan} loading={banUser.isPending} disabled={busy} />
    </ScreenScroll>
  );
}
