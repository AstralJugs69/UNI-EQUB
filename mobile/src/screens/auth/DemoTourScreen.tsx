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
        <Text style={authStyles.demoHeroEyebrow}>Same screens, seeded data</Text>
        <Text style={authStyles.demoHeroTitle}>Open the app exactly where the live flow would go.</Text>
        <Text style={authStyles.demoHeroBody}>
          Member and admin demos use the normal navigation, service contracts, and mock-safe payment paths.
        </Text>
      </HeroCard>
      {error ? <StatusBanner tone="danger" title="Demo launch failed" body={error} /> : null}
      <SectionCard>
        <TitleBlock title="Member demo" subtitle="Dawit with active groups, final contribution, and creator formation data." />
        <View style={authStyles.demoList}>
          <ListRow title="Pay the current round" subtitle="Use direct mock payment or the USSD simulator to finish the open round." leadingIcon="payments" />
          <ListRow title="Manage formation" subtitle="Create, invite, share invite code, accept members, and submit for approval." leadingIcon="groups" />
          <ListRow title="See payout readiness" subtitle="Wallet, history, notifications, and success screens update from mock state." leadingIcon="account-balance-wallet" />
        </View>
        <PrimaryCTA label="Launch Member Demo" onPress={() => launch('Member')} loading={launching === 'Member'} disabled={launching !== null} />
      </SectionCard>
      <SectionCard>
        <TitleBlock title="Admin demo" subtitle="Saba Admin with pending KYC, legacy group review, and Phase 2 approval data." />
        <View style={authStyles.demoList}>
          <ListRow title="Review approvals" subtitle="Admin Groups includes the preserved MVP queue and Phase 2 group_requests queue." leadingIcon="fact-check" />
          <ListRow title="Check operations" subtitle="Dashboard metrics, reminder logs, report export, freeze, and KYC actions are ready." leadingIcon="admin-panel-settings" />
          <ListRow title="Mock-safe" subtitle="Provider and payout behavior remains sandboxed for the capstone." leadingIcon="verified-user" />
        </View>
        <SecondaryCTA label="Launch Admin Demo" onPress={() => launch('Admin')} loading={launching === 'Admin'} disabled={launching !== null} />
      </SectionCard>
    </AppScreen>
  );
}
