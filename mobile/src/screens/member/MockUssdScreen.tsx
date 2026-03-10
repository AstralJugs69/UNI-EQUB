import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, InputField, LoadingState, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useGroupQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { launchNativeUssd, sendOneShotNativeUssd } from '../../services/native/ussdLauncher';
import { memberStyles } from './styles';

export function MockUssdScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data: group } = useGroupQuery(route.params.groupId);
  const { payContribution } = useMemberActions();
  const mountedRef = useRef(true);
  const [launching, setLaunching] = useState(false);
  const [recording, setRecording] = useState(false);
  const [launchMode, setLaunchMode] = useState<'call' | 'dial' | null>(null);
  const [carrierResponse, setCarrierResponse] = useState('');
  const [ussdCode, setUssdCode] = useState('*127#');
  const [error, setError] = useState('');

  const runOneShot = useCallback(async (code: string) => {
    try {
      setLaunching(true);
      setError('');
      setCarrierResponse('');
      setLaunchMode(null);
      const result = await sendOneShotNativeUssd(code);
      if (!mountedRef.current) {
        return;
      }
      setCarrierResponse(result.response);
      setRecording(true);
      const completedResult = await payContribution.mutateAsync({ groupId: route.params.groupId, method: 'MockUSSD' });
      if (!mountedRef.current) {
        return;
      }
      navigation.replace(routes.paymentSuccess, {
        autoDrawTriggered: completedResult.autoDrawTriggered,
        payoutAmount: completedResult.payoutAmount,
        receiptRef: completedResult.receiptRef,
        amount: completedResult.amount,
        method: completedResult.method,
        nativeUssdResponse: result.response,
      });
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to complete the one-shot USSD request.');
      }
    } finally {
      if (mountedRef.current) {
        setLaunching(false);
        setRecording(false);
      }
    }
  }, [navigation, payContribution, route.params.groupId]);

  const handleRetryOneShot = useCallback(async () => {
    await runOneShot(ussdCode);
  }, [runOneShot, ussdCode]);

  useEffect(() => {
    mountedRef.current = true;
    runOneShot('*127#').catch(() => undefined);
    return () => {
      mountedRef.current = false;
    };
  }, [runOneShot]);

  if (!group || !session) {
    return <LoadingState title="Loading USSD payment" subtitle="Preparing the Android-native experiment and payment context." />;
  }

  async function handleLaunchAgain() {
    try {
      setLaunching(true);
      setError('');
      const mode = await launchNativeUssd(ussdCode);
      setLaunchMode(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reopen the native USSD code.');
    } finally {
      setLaunching(false);
    }
  }

  const stateLabel = launching
    ? 'Sending one-shot request'
    : recording
      ? 'Recording contribution'
      : carrierResponse
        ? 'Carrier response received'
        : launchMode
          ? 'Dialer fallback ready'
          : 'Preparing one-shot flow';

  return (
    <ScreenScroll>
      <TopAppBar title="Experimental USSD Lab" onBack={() => navigation.goBack()} rightLabel="Android only" />
      <SectionCard style={memberStyles.experimentalCard}>
        <Pill label={stateLabel} tone="active" />
        <Text style={memberStyles.experimentalTitle}>One-shot USSD experiment</Text>
        <Text style={memberStyles.experimentalBody}>
          {carrierResponse
            ? carrierResponse
            : launchMode === 'call'
              ? 'The dialer fallback used a direct call. Complete it there if the one-shot API is not supported by the carrier.'
              : launchMode === 'dial'
                ? 'The dialer fallback is ready. Tap Call in the phone app if the one-shot API is rejected.'
                : 'UniEqub is sending the code directly through TelephonyManager.sendUssdRequest().'}
        </Text>
      </SectionCard>
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Payment context</Text>
        <View style={memberStyles.listGroup}>
          <Text style={memberStyles.strongText}>{group.Group_Name}</Text>
          <Text style={memberStyles.mutedText}>Reference {group.Virtual_Acc_Ref}</Text>
          <Text style={memberStyles.mutedText}>Contribution amount {group.Amount} ETB</Text>
        </View>
      </SectionCard>
      <SectionCard variant="soft">
        <InputField label="One-shot USSD code" value={ussdCode} onChangeText={setUssdCode} helper="Use this to test the Android one-shot USSD API path on your current carrier." />
      </SectionCard>
      <InlineError message={error} />
      <PrimaryCTA label="Retry One-Shot Request" onPress={handleRetryOneShot} loading={launching} disabled={launching || recording} />
      <SecondaryCTA label="Open Dialer Fallback" onPress={handleLaunchAgain} disabled={launching || recording} />
      <SecondaryCTA label="Cancel And Go Back" onPress={() => navigation.goBack()} disabled={launching || recording} />
    </ScreenScroll>
  );
}
