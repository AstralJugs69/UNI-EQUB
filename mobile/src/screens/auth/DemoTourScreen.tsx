import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, HeroCard, ListRow, PrimaryCTA, SecondaryCTA, SectionCard, StatusBanner, TitleBlock, TopAppBar } from '../../components/ui';
import { useAuth } from '../../providers/AuthProvider';
import { authStyles } from './styles';

type DemoRole = 'Member' | 'Admin';

export function DemoTourScreen() {
  const navigation = useNavigation<any>();
  const { startDemo } = useAuth();
  const [launching, setLaunching] = useState<DemoRole | null>(null);
  const [error, setError] = useState('');

  async function launch(role: DemoRole) {
    try {
      setError('');
      setLaunching(role);
      await startDemo(role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Demo mode could not be started.');
      setLaunching(null);
    }
  }

  return (
    <AppScreen>
      <TopAppBar title="Demo Tour" subtitle="Phone-ready showcase" onBack={() => navigation.goBack()} />
      <HeroCard>
        <Text style={authStyles.demoHeroEyebrow}>Seeded sandbox</Text>
        <Text style={authStyles.demoHeroTitle}>Show the completed flows directly in the app.</Text>
        <Text style={authStyles.demoHeroBody}>
          Launch a prepared member or admin session with local demo data, simulated payments, final draw behavior, and Phase 2 formation queues.
        </Text>
      </HeroCard>
      {error ? <StatusBanner tone="danger" title="Demo launch failed" body={error} /> : null}
      <SectionCard>
        <TitleBlock title="Member showcase" subtitle="Starts as Dawit with a savings cycle ready for the final contribution." />
        <View style={authStyles.demoList}>
          <ListRow title="Pay the current round" subtitle="Use direct mock payment or the USSD simulator to finish the open round." leadingIcon="payments" />
          <ListRow title="See payout readiness" subtitle="Wallet, history, notifications, and success screens update from the same mock state." leadingIcon="account-balance-wallet" />
          <ListRow title="Browse Phase 2 formation" subtitle="Public forming requests and creator setup screens remain available from Explore." leadingIcon="groups" />
        </View>
        <PrimaryCTA label="Launch Member Demo" onPress={() => launch('Member')} loading={launching === 'Member'} disabled={launching !== null} />
      </SectionCard>
      <SectionCard>
        <TitleBlock title="Admin showcase" subtitle="Starts as Saba Admin with pending KYC, legacy group review, and Phase 2 approval data." />
        <View style={authStyles.demoList}>
          <ListRow title="Review approvals" subtitle="Admin Groups includes the preserved MVP queue and Phase 2 group_requests queue." leadingIcon="fact-check" />
          <ListRow title="Check operations" subtitle="Dashboard metrics, reminder logs, report export, freeze, and KYC actions are ready to tap through." leadingIcon="admin-panel-settings" />
          <ListRow title="Keep claims clean" subtitle="Provider and payout behavior remains mock/sandbox for the capstone demo." leadingIcon="verified-user" />
        </View>
        <SecondaryCTA label="Launch Admin Demo" onPress={() => launch('Admin')} loading={launching === 'Admin'} disabled={launching !== null} />
      </SectionCard>
    </AppScreen>
  );
}
