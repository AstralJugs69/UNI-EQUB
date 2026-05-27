import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomNav, LoadingState } from '../components/ui';
import { useNotificationsQuery } from '../hooks/useAppQueries';
import { useAuth } from '../providers/AuthProvider';
import { requestNotificationPermission } from '../services/native/notificationPermission';
import { routes } from './routes';
import { navigationRef } from './rootNavigation';
import { EmailVerificationScreen, KycScreen, LoginScreen, OtpScreen, ResetPasswordScreen, SignupScreen, SplashScreen } from '../screens/auth';
import {
  ActiveGroupsScreen,
  CreateGroupBasicsScreen,
  CreateGroupRulesScreen,
  DashboardScreen,
  ExploreScreen,
  FormationCreatorScreen,
  FormationDetailScreen,
  FormationJoinCodeScreen,
  GroupDetailScreen,
  GroupStatusScreen,
  HistoryScreen,
  MockUssdScreen,
  MyRequestsScreen,
  NotificationsScreen,
  PaymentScreen,
  PaymentSuccessScreen,
  ProfileEmailScreen,
  ProfileScreen,
  ResolutionVoteScreen,
  TransactionDetailScreen,
  WalletScreen,
  WithdrawScreen,
} from '../screens/member';
import { memberTabs } from '../screens/member/shared';
import { AdminDashboardScreen, AdminGroupReviewScreen, AdminGroupsScreen, AdminKycReviewScreen, AdminKycScreen, AdminProfileScreen, AdminReportsScreen } from '../screens/admin';
import { adminTabs } from '../screens/admin/shared';

const Stack = createNativeStackNavigator();
const MemberTab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();

const linking = {
  prefixes: ['uniequb://'],
  config: {
    screens: {
      [routes.formationDetail]: 'formation/:requestId',
      [routes.formationJoinCode]: {
        path: 'join-code/:inviteCode?',
        parse: {
          inviteCode: (value: string) => value?.trim().toUpperCase(),
        },
      },
      [routes.groupDetail]: 'group/:groupId',
      [routes.emailVerify]: 'verify-email',
      [routes.memberTabs]: {
        screens: {
          [routes.dashboard]: 'home',
          [routes.explore]: 'explore',
        },
      },
    },
  },
};

function LoadingScreen() {
  return <LoadingState title="Loading UniEqub..." subtitle="Restoring session state and preparing the current workspace." />;
}

function RoleTabBar({ state, navigation, items }: any) {
  const activeKey = state.routes[state.index]?.name ?? state.routeNames[state.index];
  const { session } = useAuth();
  const { data: notifications = [] } = useNotificationsQuery();
  const unreadCount = notifications.filter(item => item.unread).length;
  const tabItems = session?.user.role === 'Member'
    ? items.map((item: any) => item.key === routes.notifications ? { ...item, badgeCount: unreadCount } : item)
    : items;
  return <BottomNav items={tabItems} activeKey={activeKey} onPress={(key: string) => navigation.navigate(key)} />;
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={routes.splash}>
      <Stack.Screen name={routes.splash} component={SplashScreen} />
      <Stack.Screen name={routes.login} component={LoginScreen} />
      <Stack.Screen name={routes.signup} component={SignupScreen} />
      <Stack.Screen name={routes.emailVerify} component={EmailVerificationScreen} />
      <Stack.Screen name={routes.otp} component={OtpScreen} />
      <Stack.Screen name={routes.kyc} component={KycScreen} />
      <Stack.Screen name={routes.reset} component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function MemberTabs() {
  return (
    <MemberTab.Navigator screenOptions={{ headerShown: false }} tabBar={props => <RoleTabBar {...props} items={memberTabs} />}>
      <MemberTab.Screen name={routes.dashboard} component={DashboardScreen} />
      <MemberTab.Screen name={routes.explore} component={ExploreScreen} />
      <MemberTab.Screen name={routes.history} component={HistoryScreen} />
      <MemberTab.Screen name={routes.wallet} component={WalletScreen} />
      <MemberTab.Screen name={routes.notifications} component={NotificationsScreen} />
      <MemberTab.Screen name={routes.profile} component={ProfileScreen} />
    </MemberTab.Navigator>
  );
}

function MemberStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={routes.memberTabs}>
      <Stack.Screen name={routes.memberTabs} component={MemberTabs} />
      <Stack.Screen name={routes.activeGroups} component={ActiveGroupsScreen} />
      <Stack.Screen name={routes.myRequests} component={MyRequestsScreen} />
      <Stack.Screen name={routes.groupDetail} component={GroupDetailScreen} />
      <Stack.Screen name={routes.formationDetail} component={FormationDetailScreen} />
      <Stack.Screen name={routes.formationCreator} component={FormationCreatorScreen} />
      <Stack.Screen name={routes.formationJoinCode} component={FormationJoinCodeScreen} />
      <Stack.Screen name={routes.createBasics} component={CreateGroupBasicsScreen} />
      <Stack.Screen name={routes.createRules} component={CreateGroupRulesScreen} />
      <Stack.Screen name={routes.groupStatus} component={GroupStatusScreen} />
      <Stack.Screen name={routes.resolutionVote} component={ResolutionVoteScreen} />
      <Stack.Screen name={routes.payment} component={PaymentScreen} />
      <Stack.Screen name={routes.mockUssd} component={MockUssdScreen} />
      <Stack.Screen name={routes.paymentSuccess} component={PaymentSuccessScreen} />
      <Stack.Screen name={routes.transactionDetail} component={TransactionDetailScreen} />
      <Stack.Screen name={routes.withdraw} component={WithdrawScreen} />
      <Stack.Screen name={routes.profileEmail} component={ProfileEmailScreen} />
      <Stack.Screen name={routes.emailVerify} component={EmailVerificationScreen} />
      <Stack.Screen name={routes.kyc} component={KycScreen} />
      <Stack.Screen name={routes.reset} component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function AdminTabs() {
  return (
    <AdminTab.Navigator screenOptions={{ headerShown: false }} tabBar={props => <RoleTabBar {...props} items={adminTabs} />}>
      <AdminTab.Screen name={routes.adminDashboard} component={AdminDashboardScreen} />
      <AdminTab.Screen name={routes.adminKyc} component={AdminKycScreen} />
      <AdminTab.Screen name={routes.adminGroups} component={AdminGroupsScreen} />
      <AdminTab.Screen name={routes.adminReports} component={AdminReportsScreen} />
      <AdminTab.Screen name={routes.adminProfile} component={AdminProfileScreen} />
    </AdminTab.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={routes.adminTabs}>
      <Stack.Screen name={routes.adminTabs} component={AdminTabs} />
      <Stack.Screen name={routes.adminKycReview} component={AdminKycReviewScreen} />
      <Stack.Screen name={routes.adminGroupReview} component={AdminGroupReviewScreen} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { authReady, session } = useAuth();
  const navigationKey = session ? `${session.user.role}:${session.user.userId}` : 'signed-out';

  React.useEffect(() => {
    if (session?.user.role === 'Member') {
      requestNotificationPermission().catch(() => undefined);
    }
  }, [session?.user.role]);

  if (!authReady) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer key={navigationKey} ref={navigationRef} linking={linking}>
      {!session ? <AuthStack /> : session.user.role === 'Admin' ? <AdminStack /> : <MemberStack />}
    </NavigationContainer>
  );
}
