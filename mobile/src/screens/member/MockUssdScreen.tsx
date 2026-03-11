import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { InlineError, LoadingState, MiniULoader, Pill, ScreenScroll, SecondaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useGroupQuery, useMemberActions } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { launchNativeUssd } from '../../services/native/ussdLauncher';
import type { PaymentMethod } from '../../types/domain';
import { paymentMethodLabel } from './shared';
import { memberStyles } from './styles';

export function MockUssdScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const groupId = route.params.groupId as string;
  const { data: group } = useGroupQuery(groupId);
  const { payContribution } = useMemberActions();
  const method = (route.params?.method ?? 'MockUSSD') as PaymentMethod;

  const mountedRef = useRef(true);
  const awaitingReturnRef = useRef(false);
  const leftAppRef = useRef(false);
  const handledReturnRef = useRef(false);
  const launchInFlightRef = useRef(false);
  const recordInFlightRef = useRef(false);
  const launchedOnMountRef = useRef(false);
  const payContributionRef = useRef(payContribution.mutateAsync);

  const [launching, setLaunching] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'opening' | 'waiting' | 'recording'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    payContributionRef.current = payContribution.mutateAsync;
  }, [payContribution.mutateAsync]);

  const recordContribution = useCallback(async () => {
    if (recordInFlightRef.current) {
      return;
    }

    try {
      recordInFlightRef.current = true;
      setRecording(true);
      setStatus('recording');
      setError('');
      const completedResult = await payContributionRef.current({ groupId, method });
      if (!mountedRef.current) {
        return;
      }
      navigation.replace(routes.paymentSuccess, {
        autoDrawTriggered: completedResult.autoDrawTriggered,
        payoutAmount: completedResult.payoutAmount,
        receiptRef: completedResult.receiptRef,
        amount: completedResult.amount,
        method: completedResult.method,
      });
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to record the USSD contribution.');
        setStatus('idle');
      }
    } finally {
      recordInFlightRef.current = false;
      if (mountedRef.current) {
        setRecording(false);
      }
    }
  }, [groupId, method, navigation]);

  const openNativeDialup = useCallback(async () => {
    if (launchInFlightRef.current || awaitingReturnRef.current || recordInFlightRef.current) {
      return;
    }

    try {
      launchInFlightRef.current = true;
      awaitingReturnRef.current = true;
      leftAppRef.current = false;
      handledReturnRef.current = false;
      setLaunching(true);
      setStatus('opening');
      setError('');
      await launchNativeUssd('*127#');
      if (!mountedRef.current) {
        return;
      }
      setStatus('waiting');
    } catch (err) {
      awaitingReturnRef.current = false;
      leftAppRef.current = false;
      handledReturnRef.current = false;
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to open the native *127# flow.');
        setStatus('idle');
      }
    } finally {
      launchInFlightRef.current = false;
      if (mountedRef.current) {
        setLaunching(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (!awaitingReturnRef.current || handledReturnRef.current) {
        return;
      }

      if (nextState === 'background' || nextState === 'inactive') {
        leftAppRef.current = true;
        return;
      }

      if (nextState === 'active' && leftAppRef.current) {
        handledReturnRef.current = true;
        awaitingReturnRef.current = false;
        recordContribution().catch(() => undefined);
      }
    });

    if (!launchedOnMountRef.current) {
      launchedOnMountRef.current = true;
      openNativeDialup().catch(() => undefined);
    }

    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [openNativeDialup, recordContribution]);

  if (!group || !session) {
    return <LoadingState title="Loading USSD payment" subtitle="Preparing the native testing dialup and contribution context." />;
  }

  const statusLabel = status === 'opening'
    ? 'Opening native dialup'
    : status === 'waiting'
      ? 'Waiting for app return'
      : status === 'recording'
        ? 'Recording contribution'
        : 'Ready';

  return (
    <ScreenScroll>
      <TopAppBar title="Native *127# Test" onBack={() => navigation.goBack()} rightLabel="Testing only" />
      <SectionCard style={memberStyles.experimentalCard}>
        <Pill label={statusLabel} tone="active" />
        <Text style={memberStyles.experimentalTitle}>{paymentMethodLabel(method)} native shortcut</Text>
        <Text style={memberStyles.experimentalBody}>
          UniEqub opens *127# once and waits for you to leave the native dialup. As soon as you close it and return to the app, this test build records the contribution as successful.
        </Text>
      </SectionCard>
      <SectionCard>
        <Text style={memberStyles.sectionTitle}>Payment context</Text>
        <View style={memberStyles.listGroup}>
          <Text style={memberStyles.strongText}>{group.Group_Name}</Text>
          <Text style={memberStyles.mutedText}>Reference {group.Virtual_Acc_Ref}</Text>
          <Text style={memberStyles.mutedText}>Contribution amount {group.Amount} ETB</Text>
          <Text style={memberStyles.mutedText}>Close the native dialup immediately and return here to complete the test payment.</Text>
        </View>
      </SectionCard>
      {(launching || recording) ? (
        <SectionCard variant="soft">
          <View style={memberStyles.rowWrap}>
            <MiniULoader size={22} />
            <Text style={memberStyles.strongText}>{status === 'recording' ? 'Recording the contribution now...' : 'Opening the native *127# shortcut...'}</Text>
          </View>
        </SectionCard>
      ) : null}
      <InlineError message={error} />
      <SecondaryCTA label="Open *127# Again" onPress={() => { openNativeDialup().catch(() => undefined); }} disabled={launching || recording || status === 'waiting'} />
      <SecondaryCTA label="Cancel And Go Back" onPress={() => navigation.goBack()} disabled={launching || recording} />
    </ScreenScroll>
  );
}
