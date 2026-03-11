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
  const { data: group } = useGroupQuery(route.params.groupId);
  const { payContribution } = useMemberActions();
  const mountedRef = useRef(true);
  const awaitingReturnRef = useRef(false);
  const leftAppRef = useRef(false);
  const handledReturnRef = useRef(false);
  const method = (route.params?.method ?? 'MockUSSD') as PaymentMethod;

  const [launching, setLaunching] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'opening' | 'waiting' | 'recording'>('idle');
  const [error, setError] = useState('');

  const recordContribution = useCallback(async () => {
    try {
      setRecording(true);
      setStatus('recording');
      setError('');
      const completedResult = await payContribution.mutateAsync({ groupId: route.params.groupId, method });
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
        setStatus('waiting');
      }
    } finally {
      if (mountedRef.current) {
        setRecording(false);
      }
    }
  }, [method, navigation, payContribution, route.params.groupId]);

  const openNativeDialup = useCallback(async () => {
    try {
      setLaunching(true);
      setStatus('opening');
      setError('');
      awaitingReturnRef.current = false;
      leftAppRef.current = false;
      handledReturnRef.current = false;
      await launchNativeUssd('*127#');
      if (!mountedRef.current) {
        return;
      }
      awaitingReturnRef.current = true;
      setStatus('waiting');
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to open the native *127# flow.');
        setStatus('idle');
      }
    } finally {
      if (mountedRef.current) {
        setLaunching(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    openNativeDialup().catch(() => undefined);

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
          UniEqub opens *127# and waits for you to leave the native dialup. As soon as you close it and return to the app, this test build records the contribution as successful.
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
      <SecondaryCTA label="Open *127# Again" onPress={() => openNativeDialup()} disabled={launching || recording} />
      <SecondaryCTA label="Cancel And Go Back" onPress={() => navigation.goBack()} disabled={launching || recording} />
    </ScreenScroll>
  );
}
