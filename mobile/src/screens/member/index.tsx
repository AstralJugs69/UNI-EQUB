import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { BottomNav, HeroPanel, InfoRow, InputField, KeyValue, Panel, Pill, PrimaryButton, ScreenScroll, TitleBlock, TopBar, uiStyles } from '../../components/ui';
import { useDashboardQuery, useGroupQuery, useGroupStatusQuery, useGroupsQuery, useMemberActions, useNotificationsQuery, useTransactionsQuery, useWalletQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { launchNativeUssd } from '../../services/native/ussdLauncher';
import { palette, spacing } from '../../theme/tokens';
import type { PaymentMethod } from '../../types/domain';

function paymentMethodLabel(method: PaymentMethod) {
  return method === 'MockUSSD' ? 'Telebirr USSD' : method;
}

const groupStudents = require('../../assets/students-group.jpg');

const memberTabs = [
  { key: routes.dashboard, label: 'Home' },
  { key: routes.explore, label: 'Explore' },
  { key: routes.history, label: 'History' },
  { key: routes.wallet, label: 'Wallet' },
  { key: routes.profile, label: 'Profile' },
];

function MemberNav({ active }: { active: string }) {
  const navigation = useNavigation<any>();
  return <BottomNav items={memberTabs} activeKey={active} onPress={key => navigation.navigate(key)} />;
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data } = useDashboardQuery();
  const group = data?.currentGroup;
  const recent = data?.recentTransactions?.[0];

  if (!session || !data) {
    return <ScreenScroll><TitleBlock title="Loading dashboard" subtitle="Pulling current group status and savings activity." /></ScreenScroll>;
  }

  if (!group) {
    return (
      <ScreenScroll>
        {session.user.kycStatus !== 'Verified' ? <View style={{ padding: 12, borderRadius: 16, backgroundColor: '#fff4dc', borderWidth: 1, borderColor: '#ecd7ad' }}><Text style={{ color: palette.warning, fontWeight: '800' }}>KYC review is pending. Group creation and payout withdrawal stay locked until approval.</Text></View> : null}
        <TopBar title={session.user.fullName.split(' ')[0]} subtitle="Welcome to UniEqub" rightLabel="New member" />
        <HeroPanel>
          <Pill label="No active groups yet" tone="active" />
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 10 }}>Start your first cycle</Text>
          <Text style={{ color: 'rgba(255,255,255,0.84)', marginTop: 6 }}>Create a new Equb request or browse open groups to join an existing savings circle.</Text>
          <View style={{ marginTop: 16, gap: spacing.md }}>
            <PrimaryButton label="Browse Groups" variant="secondary" onPress={() => navigation.navigate(routes.explore)} />
            <PrimaryButton label="Create Equb" variant="secondary" onPress={() => navigation.navigate(routes.createBasics)} />
          </View>
        </HeroPanel>
        <View style={uiStyles.twoCol}>
          <KeyValue label="KYC Status" value={session.user.kycStatus} />
          <KeyValue label="Saved So Far" value={`${data.totalSaved.toLocaleString()} ETB`} />
        </View>
        <Panel>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>What happens next</Text>
          <View style={{ marginTop: 10, gap: 10 }}>
            <InfoRow title="Join an active Equb" subtitle="Browse currently approved groups and take an open slot." />
            <InfoRow title="Create your own request" subtitle="Submit a verified group for admin approval and publication." />
            <InfoRow title="Track every contribution" subtitle="Your history, reminders, and payout state will appear here once you start participating." />
          </View>
        </Panel>
        <MemberNav active={routes.dashboard} />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      {session.user.kycStatus !== 'Verified' ? <View style={{ padding: 12, borderRadius: 16, backgroundColor: '#fff4dc', borderWidth: 1, borderColor: '#ecd7ad' }}><Text style={{ color: palette.warning, fontWeight: '800' }}>KYC review is pending. Group creation and payout withdrawal stay locked until approval.</Text></View> : null}
      <TopBar title={session.user.fullName.split(' ')[0]} subtitle="Good evening" rightLabel="Alerts" />
      <View style={[uiStyles.twoCol, { alignItems: 'stretch' }]}>
        <HeroPanel>
          <Pill label="Last payment needed" tone="active" />
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 10 }}>{group.Amount} ETB</Text>
          <Text style={{ color: 'rgba(255,255,255,0.84)', marginTop: 6 }}>{group.Group_Name} is at {data.paidCount}/{data.totalMembers} paid. Your contribution closes the round.</Text>
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="Pay This Round" variant="secondary" onPress={() => navigation.navigate(routes.payment, { groupId: group.Group_ID })} />
          </View>
        </HeroPanel>
        <Panel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: 18 }}>Cycle health</Text>
            <Pill label="Auto-draw" tone="active" />
          </View>
          <View style={{ marginTop: 12, gap: 10 }}>
            <InfoRow title={`Current round • ${data.paidCount}/${data.totalMembers} verified`} />
            <InfoRow title="Winner selection • automatic on full payment" />
            <InfoRow title={`Next event • ${data.paidCount === data.totalMembers ? 'payout creation' : 'round lock and payout creation'}`} />
          </View>
        </Panel>
      </View>
      <View style={uiStyles.twoCol}>
        <KeyValue label="Total Saved" value={`${data.totalSaved.toLocaleString()} ETB`} />
        <KeyValue label="Ready Payout" value={`${data.readyPayout.toLocaleString()} ETB`} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        {[
          ['Create', routes.createBasics],
          ['Join', routes.explore],
          ['History', routes.history],
          ['Alerts', routes.notifications],
        ].map(([label, target]) => (
          <PrimaryButton key={label} label={label} variant="secondary" onPress={() => navigation.navigate(target)} />
        ))}
      </View>
      <View style={uiStyles.twoCol}>
        <Panel style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontWeight: '800', fontSize: 18 }}>{group.Group_Name}</Text>
              <Text style={{ color: palette.muted }}>{group.Frequency} • {group.Max_Members} members</Text>
            </View>
            <Pill label={`Round ${data.currentRound?.Round_Number ?? 0}`} tone="active" />
          </View>
          <Text style={{ marginTop: 10, color: palette.muted }}>{data.paidCount} of {data.totalMembers} paid</Text>
          <View style={{ height: 10, borderRadius: 999, backgroundColor: '#e5ebf3', overflow: 'hidden', marginTop: 8 }}>
            <View style={{ width: `${(data.paidCount / Math.max(data.totalMembers, 1)) * 100}%`, height: '100%', backgroundColor: palette.primary }} />
          </View>
          <View style={{ marginTop: 14 }}>
            <PrimaryButton label="Open Group" variant="secondary" onPress={() => navigation.navigate(routes.groupStatus, { groupId: group.Group_ID })} />
          </View>
        </Panel>
        <Panel style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>Recent Activity</Text>
          {recent ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontWeight: '700', color: palette.text }}>{recent.Type} {recent.Status.toLowerCase()}</Text>
              <Text style={{ color: palette.muted, marginTop: 4 }}>{dayjs(recent.Date).format('MMM D')} • {recent.Payment_Method}</Text>
              <Text style={{ marginTop: 12, fontSize: 20, fontWeight: '800', color: recent.Type === 'Payout' ? palette.success : palette.danger }}>
                {recent.Type === 'Payout' ? '+' : '-'}{recent.Amount} ETB
              </Text>
            </View>
          ) : (
            <Text style={{ marginTop: 14, color: palette.muted }}>No activity yet.</Text>
          )}
        </Panel>
      </View>
      <MemberNav active={routes.dashboard} />
    </ScreenScroll>
  );
}

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { data } = useGroupsQuery();
  return (
    <ScreenScroll>
      <TopBar title="Available Equbs" subtitle="Explore" />
      <Panel><Text style={{ color: palette.muted }}>Search group name, creator, or contribution amount.</Text></Panel>
      {data?.map(group => (
        <Panel key={group.Group_ID}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 18 }}>{group.Group_Name}</Text>
              <Text style={{ color: palette.muted, marginTop: 4 }}>{group.Description}</Text>
            </View>
            <Pill label={group.Status === 'Completed' ? 'closed' : 'open'} tone={group.Status === 'Completed' ? 'bad' : 'active'} />
          </View>
          <View style={[uiStyles.twoCol, { marginTop: 12 }]}>
            <KeyValue label="Contribution" value={`${group.Amount} ETB`} />
            <KeyValue label="Frequency" value={group.Frequency} />
          </View>
          <View style={{ marginTop: 14 }}>
            <PrimaryButton label="View Group" variant="secondary" onPress={() => navigation.navigate(routes.groupDetail, { groupId: group.Group_ID })} />
          </View>
        </Panel>
      ))}
      <MemberNav active={routes.explore} />
    </ScreenScroll>
  );
}

export function GroupDetailScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data } = useGroupQuery(route.params?.groupId ?? '');
  const { joinGroup } = useMemberActions();

  if (!data) {
    return <ScreenScroll><TitleBlock title="Loading group" subtitle="Pulling membership, amount, and cycle state." /></ScreenScroll>;
  }

  return (
    <ScreenScroll>
      <TopBar title="Group Details" onBack={() => navigation.goBack()} />
      <View style={{ height: 160, borderRadius: 22, overflow: 'hidden' }}>
        <Image source={groupStudents} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
      <TitleBlock title={data.Group_Name} subtitle={data.Description} />
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Pill label={data.Status} tone={data.Status === 'Active' ? 'good' : data.Status === 'Pending' ? 'warn' : 'bad'} />
        <Pill label={data.Frequency} tone="active" />
        <Pill label={`${data.Max_Members} members`} />
      </View>
      <View style={uiStyles.twoCol}>
        <KeyValue label="Contribution" value={`${data.Amount} ETB`} />
        <KeyValue label="Virtual Ref" value={data.Virtual_Acc_Ref || 'Pending approval'} />
      </View>
      <Panel>
        <Text style={{ fontWeight: '800', color: palette.text }}>Cycle rules</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          <InfoRow title="Verified payment required every round" subtitle="Only paid members are eligible for the draw." />
          <InfoRow title="Winner cannot win twice in the same cycle" subtitle="Eligibility excludes previous winners until cycle reset." />
        </View>
      </Panel>
      <PrimaryButton label="Join Group" onPress={() => joinGroup.mutate(data.Group_ID, { onSuccess: () => navigation.navigate(routes.groupStatus, { groupId: data.Group_ID }) })} />
    </ScreenScroll>
  );
}

export function CreateGroupBasicsScreen() {
  const navigation = useNavigation<any>();
  const [groupName, setGroupName] = useState('Dorm A Savings Group');
  const [amount, setAmount] = useState('500');
  const [frequency, setFrequency] = useState<'Weekly' | 'Bi-weekly' | 'Monthly'>('Weekly');
  const [maxMembers, setMaxMembers] = useState('10');

  return (
    <ScreenScroll>
      <TopBar title="Create New Equb" subtitle="Step 1 of 2" onBack={() => navigation.goBack()} />
      <InputField label="Group Name" value={groupName} onChangeText={setGroupName} />
      <InputField label="Contribution Amount (ETB)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <InputField label="Frequency" value={frequency} onChangeText={value => setFrequency(value as typeof frequency)} />
      <InputField label="Max Members" value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" />
      <Panel>
        <Text style={{ color: palette.muted }}>Estimated total pot</Text>
        <Text style={{ fontSize: 32, fontWeight: '900', color: palette.text, marginTop: 6 }}>{(Number(amount || 0) * Number(maxMembers || 0)).toLocaleString()} ETB</Text>
      </Panel>
      <PrimaryButton
        label="Continue To Rules"
        onPress={() => navigation.navigate(routes.createRules, { groupName, amount: Number(amount), frequency, maxMembers: Number(maxMembers) })}
      />
    </ScreenScroll>
  );
}

export function CreateGroupRulesScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { createGroup } = useMemberActions();
  const [description, setDescription] = useState('Weekly savings circle for off-campus AAU students with verified mobile money reconciliation.');
  return (
    <ScreenScroll>
      <TopBar title="Create New Equb" subtitle="Step 2 of 2" onBack={() => navigation.goBack()} />
      <InputField label="Short Description" value={description} onChangeText={setDescription} multiline />
      <Panel>
        <Text style={{ fontWeight: '800', color: palette.text }}>Automation rules</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 10 }}>
          <Pill label="Auto draw" tone="active" />
          <Pill label="Reminder 24h before" tone="active" />
          <Pill label="Immutable ledger" />
        </View>
      </Panel>
      <PrimaryButton
        label="Submit For Approval"
        onPress={() =>
          createGroup.mutate(
            {
              groupName: route.params.groupName,
              amount: route.params.amount,
              frequency: route.params.frequency,
              maxMembers: route.params.maxMembers,
              description,
            },
            { onSuccess: () => navigation.navigate(routes.dashboard) },
          )
        }
      />
    </ScreenScroll>
  );
}

export function GroupStatusScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: dashboard } = useDashboardQuery();
  const groupId = route.params?.groupId ?? dashboard?.currentGroup?.Group_ID ?? '';
  const { data: status } = useGroupStatusQuery(groupId);
  if (!status) {
    return <ScreenScroll><TitleBlock title="Loading group" subtitle="Pulling round progress and winner history." /></ScreenScroll>;
  }
  return (
    <ScreenScroll>
      <TopBar title={status.group.Group_Name} onBack={() => navigation.goBack()} rightLabel={status.group.Status} />
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>Round {status.currentRound?.Round_Number ?? '-'}</Text>
            <Text style={{ color: palette.muted }}>{status.paidCount} of {status.totalMembers} members paid</Text>
          </View>
          <Pill label={status.paidCount === status.totalMembers ? 'auto-drawing' : status.isFrozen ? 'frozen' : 'waiting'} tone={status.paidCount === status.totalMembers ? 'good' : status.isFrozen ? 'bad' : 'warn'} />
        </View>
        <View style={{ height: 10, borderRadius: 999, backgroundColor: '#e5ebf3', overflow: 'hidden', marginTop: 12 }}>
          <View style={{ width: `${(status.paidCount / Math.max(status.totalMembers, 1)) * 100}%`, height: '100%', backgroundColor: palette.primary }} />
        </View>
      </Panel>
      <Panel>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Round logic</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          <InfoRow title="All verified contributions lock the round" />
          <InfoRow title="Winner selection is automatic" />
          <InfoRow title="Payout record is created immediately after draw" />
        </View>
      </Panel>
      <PrimaryButton label="Pay Contribution" onPress={() => navigation.navigate(routes.payment, { groupId: status.group.Group_ID })} />
    </ScreenScroll>
  );
}

export function PaymentScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data: group } = useGroupQuery(route.params.groupId);
  const { payContribution } = useMemberActions();
  const [method, setMethod] = useState<PaymentMethod>('Telebirr');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!group) {
    return <ScreenScroll><TitleBlock title="Loading payment" subtitle="Preparing contribution details." /></ScreenScroll>;
  }
  const safeGroup = group;

  async function handleConfirm() {
    try {
      setError('');
      if (method === 'MockUSSD') {
        navigation.navigate(routes.mockUssd, { groupId: safeGroup.Group_ID });
        return;
      }
      setSubmitting(true);
      const result = await payContribution.mutateAsync({ groupId: safeGroup.Group_ID, method });
      navigation.navigate(routes.paymentSuccess, {
        autoDrawTriggered: result.autoDrawTriggered,
        payoutAmount: result.payoutAmount,
        receiptRef: result.receiptRef,
        amount: result.amount,
        method: result.method,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contribution payment failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopBar title="Pay Contribution" onBack={() => navigation.goBack()} rightLabel={`Round ${3}`} />
      <Panel>
        <Text style={{ color: palette.muted }}>Amount due now</Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: palette.text, marginTop: 6 }}>{safeGroup.Amount} ETB</Text>
        <Text style={{ color: palette.muted, marginTop: 6 }}>{safeGroup.Group_Name} • Virtual ref {safeGroup.Virtual_Acc_Ref}</Text>
      </Panel>
      <Panel>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Choose payment method</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 12 }}>
          {(['Telebirr', 'MockUSSD', 'ChapaSandbox'] as PaymentMethod[]).map(option => (
            <PrimaryButton key={option} label={option} variant={method === option ? 'primary' : 'secondary'} onPress={() => setMethod(option)} />
          ))}
        </View>
      </Panel>
      {method === 'MockUSSD' ? (
        <Panel>
          <Text style={{ fontWeight: '800', color: palette.text }}>Native Telebirr USSD</Text>
          <Text style={{ color: palette.muted, marginTop: 6 }}>
            This path launches the phone's real USSD shortcode. You complete the carrier flow natively, then come back and confirm the contribution inside UniEqub.
          </Text>
        </Panel>
      ) : null}
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <PrimaryButton
        label={method === 'MockUSSD' ? 'Open Native USSD' : `Confirm ${method} Payment`}
        onPress={handleConfirm}
        loading={submitting}
        disabled={submitting}
      />
    </ScreenScroll>
  );
}

export function MockUssdScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data: group } = useGroupQuery(route.params.groupId);
  const { payContribution } = useMemberActions();
  const [launching, setLaunching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [launchMode, setLaunchMode] = useState<'call' | 'dial' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function openNativePrompt() {
      try {
        setLaunching(true);
        setError('');
        const mode = await launchNativeUssd('*127#');
        if (mounted) {
          setLaunchMode(mode);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to open the native USSD code.');
        }
      } finally {
        if (mounted) {
          setLaunching(false);
        }
      }
    }

    openNativePrompt();
    return () => {
      mounted = false;
    };
  }, []);

  if (!group || !session) {
    return <ScreenScroll><TitleBlock title="Loading USSD payment" subtitle="Preparing the native carrier flow." /></ScreenScroll>;
  }
  const safeGroup = group;

  async function handleConfirmPayment() {
    try {
      setConfirming(true);
      setError('');
      const completedResult = await payContribution.mutateAsync({ groupId: safeGroup.Group_ID, method: 'MockUSSD' });
      navigation.navigate(routes.paymentSuccess, {
        autoDrawTriggered: completedResult.autoDrawTriggered,
        payoutAmount: completedResult.payoutAmount,
        receiptRef: completedResult.receiptRef,
        amount: completedResult.amount,
        method: completedResult.method,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record the USSD contribution.');
    } finally {
      setConfirming(false);
    }
  }

  async function handleLaunchAgain() {
    try {
      setLaunching(true);
      setError('');
      const mode = await launchNativeUssd('*127#');
      setLaunchMode(mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reopen the native USSD code.');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <ScreenScroll>
      <TopBar title="Native USSD Payment" onBack={() => navigation.goBack()} rightLabel="Telebirr" />
      <Panel>
        <Text style={{ color: palette.muted }}>Dialed code</Text>
        <Text style={{ fontSize: 28, fontWeight: '900', color: palette.text, marginTop: 6 }}>*127#</Text>
        <Text style={{ color: palette.muted, marginTop: 6 }}>
          UniEqub now launches the phone's real USSD shortcode instead of simulating the numbered prompt inside the app.
        </Text>
      </Panel>
      <Panel>
        <Text style={{ fontWeight: '800', color: palette.text }}>Payment context</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          <InfoRow title={safeGroup.Group_Name} subtitle={`Approved ref ${safeGroup.Virtual_Acc_Ref}`} right={`${safeGroup.Amount} ETB`} />
          <InfoRow title="Carrier steps" subtitle="Choose Pay merchant, enter the group reference, confirm the exact amount, then authorize with your Telebirr PIN." />
          <InfoRow title="Contribution verification only" subtitle="Because Telebirr callbacks are not integrated yet, only confirm here after the phone screen says the payment succeeded." />
        </View>
      </Panel>
      <HeroPanel>
        <Pill label={launchMode === 'call' ? 'Direct call started' : launchMode === 'dial' ? 'Dialer opened' : 'Preparing phone flow'} tone="active" />
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 10 }}>Finish the payment on your phone</Text>
        <Text style={{ color: 'rgba(255,255,255,0.84)', marginTop: 6 }}>
          {launchMode === 'call'
            ? 'The shortcode was sent directly. Complete the native carrier prompts, then come back here.'
            : 'If direct-call permission was denied, the dialer opened with the shortcode prefilled. Tap Call, complete the native prompts, then come back here.'}
        </Text>
      </HeroPanel>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <Panel>
        <Text style={{ fontWeight: '800', color: palette.text }}>Before you confirm here</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          <InfoRow title="Shortcode" subtitle="Dial *127# from the phone app if the native launch does not open correctly." />
          <InfoRow title="Merchant reference" subtitle={safeGroup.Virtual_Acc_Ref} />
          <InfoRow title="Exact amount" subtitle={`${safeGroup.Amount} ETB`} />
        </View>
      </Panel>
      <PrimaryButton label="Open Native USSD Again" onPress={handleLaunchAgain} loading={launching} disabled={launching || confirming} />
      <PrimaryButton label="I Completed The USSD Payment" onPress={handleConfirmPayment} loading={confirming} disabled={launching || confirming} />
      <PrimaryButton label="Cancel And Go Back" variant="secondary" onPress={() => navigation.goBack()} disabled={launching || confirming} />
    </ScreenScroll>
  );
}

export function PaymentSuccessScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const payoutAmount = route.params?.payoutAmount ?? 0;
  const amount = route.params?.amount ?? 0;
  const method: PaymentMethod = route.params?.method ?? 'Telebirr';
  const receiptRef = route.params?.receiptRef ?? 'TXN-882913';
  return (
    <ScreenScroll>
      <TitleBlock title="Payment Received" subtitle="Your contribution is now recorded and visible to the rest of the group." align="center" />
      <Panel>
        <Text style={{ color: palette.muted }}>Successful transaction</Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: palette.text, marginTop: 6 }}>{amount} ETB</Text>
        <Text style={{ color: palette.muted, marginTop: 6 }}>Reference {receiptRef} • Provider {paymentMethodLabel(method)}</Text>
      </Panel>
      {route.params?.autoDrawTriggered ? (
        <View style={{ padding: 12, borderRadius: 16, backgroundColor: '#e8f8ee', borderWidth: 1, borderColor: '#cfead9' }}>
          <Text style={{ color: palette.success, fontWeight: '800' }}>This payment completed the round. Winner selection happened automatically and {payoutAmount} ETB is now ready for withdrawal.</Text>
        </View>
      ) : null}
      <PrimaryButton label="View Wallet" onPress={() => navigation.navigate(routes.wallet)} />
      <PrimaryButton label="Back To Group" variant="secondary" onPress={() => navigation.navigate(routes.groupStatus)} />
    </ScreenScroll>
  );
}

export function HistoryScreen() {
  const { data: rows = [] } = useTransactionsQuery();
  return (
    <ScreenScroll>
      <TopBar title="Transaction Ledger" subtitle="History" />
      {rows.length ? rows.map(item => (
        <Panel key={item.Trans_ID}>
          <Text style={{ fontWeight: '800', color: palette.text }}>{item.Type} • {item.Status}</Text>
          <Text style={{ color: palette.muted, marginTop: 4 }}>{dayjs(item.Date).format('MMM D, YYYY')} • {paymentMethodLabel(item.Payment_Method)}</Text>
          <Text style={{ marginTop: 10, fontSize: 20, fontWeight: '800', color: item.Type === 'Payout' ? palette.success : palette.danger }}>
            {item.Type === 'Payout' ? '+' : '-'}{item.Amount} ETB
          </Text>
        </Panel>
      )) : <Panel><Text style={{ color: palette.muted }}>No contributions or payouts have been recorded yet.</Text></Panel>}
      <MemberNav active={routes.history} />
    </ScreenScroll>
  );
}

export function WalletScreen() {
  const navigation = useNavigation<any>();
  const { data } = useWalletQuery();
  if (!data) {
    return <ScreenScroll><TitleBlock title="Loading wallet" subtitle="Pulling payout balance and withdrawal status." /></ScreenScroll>;
  }
  return (
    <ScreenScroll>
      <TopBar title="Payouts" subtitle="Wallet" rightLabel="Ready" />
      <HeroPanel>
        <Text style={{ color: 'rgba(255,255,255,0.82)' }}>Available balance</Text>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 6 }}>{data.balance.toLocaleString()} ETB</Text>
        <Text style={{ color: 'rgba(255,255,255,0.82)', marginTop: 6 }}>{data.readyPayout > 0 ? `${data.readyPayout.toLocaleString()} ETB is ready for wallet clearance after automatic winner selection.` : 'No pending payout right now.'}</Text>
      </HeroPanel>
      <View style={uiStyles.twoCol}>
        <KeyValue label="Ready payout" value={`${data.readyPayout.toLocaleString()} ETB`} />
        <KeyValue label="Clearance path" value={data.defaultDestination} />
      </View>
      <PrimaryButton label={data.readyPayout > 0 ? 'Withdraw Payout' : 'Nothing To Withdraw'} onPress={() => navigation.navigate(routes.withdraw)} variant={data.readyPayout > 0 ? 'primary' : 'secondary'} />
      <MemberNav active={routes.wallet} />
    </ScreenScroll>
  );
}

export function WithdrawScreen() {
  const navigation = useNavigation<any>();
  const { data } = useWalletQuery();
  const { withdrawPayout } = useMemberActions();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!data) {
    return <ScreenScroll><TitleBlock title="Loading payout" subtitle="Preparing withdrawal details." /></ScreenScroll>;
  }

  async function handleWithdraw() {
    try {
      setError('');
      setSubmitting(true);
      await withdrawPayout.mutateAsync();
      navigation.navigate(routes.wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear the wallet payout.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopBar title="Withdraw Payout" onBack={() => navigation.goBack()} rightLabel="Winner" />
      <Panel>
        <Text style={{ color: palette.muted }}>Current payout</Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: palette.text, marginTop: 6 }}>{data.readyPayout.toLocaleString()} ETB</Text>
        <Text style={{ color: palette.muted, marginTop: 6 }}>Destination • {data.defaultDestination}</Text>
      </Panel>
      <Panel>
        <Text style={{ color: palette.text, fontWeight: '800' }}>Current delivery rule</Text>
        <Text style={{ color: palette.muted, marginTop: 6 }}>
          Withdrawal does not hit an external gateway yet. This action simply clears the approved payout from the wallet ledger until Chapa withdrawal access is legally approved.
        </Text>
      </Panel>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
      <PrimaryButton label="Clear Wallet Balance" onPress={handleWithdraw} loading={submitting} disabled={submitting || data.readyPayout <= 0} />
      <PrimaryButton label="Back To Wallet" variant="secondary" onPress={() => navigation.goBack()} />
    </ScreenScroll>
  );
}

export function NotificationsScreen() {
  const { data } = useNotificationsQuery();
  const { markNotificationsRead } = useMemberActions();
  return (
    <ScreenScroll>
      <TopBar title="Notifications" subtitle="Inbox" rightLabel={`${data?.filter(item => item.unread).length ?? 0} unread`} />
      {data?.length ? data.map(item => (
        <Panel key={item.id}>
          <Text style={{ fontWeight: '800', color: palette.text }}>{item.title}</Text>
          <Text style={{ color: palette.muted, marginTop: 6 }}>{item.body}</Text>
        </Panel>
      )) : <Panel><Text style={{ color: palette.muted }}>No notifications yet.</Text></Panel>}
      <PrimaryButton label="Mark All As Read" variant="secondary" onPress={() => markNotificationsRead.mutate()} />
    </ScreenScroll>
  );
}

export function ProfileScreen() {
  const { session, logout } = useAuth();
  if (!session) {
    return null;
  }
  return (
    <ScreenScroll>
      <TopBar title="Profile And Settings" />
      <TitleBlock title={session.user.fullName} subtitle={`${session.user.role} • ${session.user.kycStatus}`} align="center" />
      <View style={uiStyles.twoCol}>
        <KeyValue label="University" value="Addis Ababa University" />
        <KeyValue label="Year" value="3rd Year" />
      </View>
      <Panel>
        <Text style={{ fontWeight: '800', color: palette.text }}>Preferences</Text>
        <View style={{ marginTop: 10, gap: 10 }}>
          <InfoRow title="Notifications" subtitle="Push and SMS reminders enabled" />
          <InfoRow title="Security" subtitle="Secure token storage enabled" />
        </View>
      </Panel>
      <PrimaryButton label="Log Out" variant="danger" onPress={logout} />
      <MemberNav active={routes.profile} />
    </ScreenScroll>
  );
}
















