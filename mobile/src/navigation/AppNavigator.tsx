import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingState } from '../components/ui';
import { useAuth } from '../providers/AuthProvider';
import { routes } from './routes';
import { KycScreen, LoginScreen, OtpScreen, ResetPasswordScreen, SignupScreen, SplashScreen } from '../screens/auth';
import {
  CreateGroupBasicsScreen,
  CreateGroupRulesScreen,
  DashboardScreen,
  ExploreScreen,
  GroupDetailScreen,
  GroupStatusScreen,
  HistoryScreen,
  MockUssdScreen,
  NotificationsScreen,
  PaymentScreen,
  PaymentSuccessScreen,
  ProfileScreen,
  WalletScreen,
  WithdrawScreen,
} from '../screens/member';
import { AdminDashboardScreen, AdminGroupsScreen, AdminKycScreen, AdminReportsScreen } from '../screens/admin';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return <LoadingState title="Loading UniEqub..." subtitle="Restoring session state and preparing the current workspace." />;
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={routes.splash}>
      <Stack.Screen name={routes.splash} component={SplashScreen} />
      <Stack.Screen name={routes.login} component={LoginScreen} />
      <Stack.Screen name={routes.signup} component={SignupScreen} />
      <Stack.Screen name={routes.otp} component={OtpScreen} />
      <Stack.Screen name={routes.kyc} component={KycScreen} />
      <Stack.Screen name={routes.reset} component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function MemberStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={routes.dashboard}>
      <Stack.Screen name={routes.dashboard} component={DashboardScreen} />
      <Stack.Screen name={routes.explore} component={ExploreScreen} />
      <Stack.Screen name={routes.groupDetail} component={GroupDetailScreen} />
      <Stack.Screen name={routes.createBasics} component={CreateGroupBasicsScreen} />
      <Stack.Screen name={routes.createRules} component={CreateGroupRulesScreen} />
      <Stack.Screen name={routes.groupStatus} component={GroupStatusScreen} />
      <Stack.Screen name={routes.payment} component={PaymentScreen} />
      <Stack.Screen name={routes.mockUssd} component={MockUssdScreen} />
      <Stack.Screen name={routes.paymentSuccess} component={PaymentSuccessScreen} />
      <Stack.Screen name={routes.history} component={HistoryScreen} />
      <Stack.Screen name={routes.wallet} component={WalletScreen} />
      <Stack.Screen name={routes.withdraw} component={WithdrawScreen} />
      <Stack.Screen name={routes.notifications} component={NotificationsScreen} />
      <Stack.Screen name={routes.profile} component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={routes.adminDashboard}>
      <Stack.Screen name={routes.adminDashboard} component={AdminDashboardScreen} />
      <Stack.Screen name={routes.adminKyc} component={AdminKycScreen} />
      <Stack.Screen name={routes.adminGroups} component={AdminGroupsScreen} />
      <Stack.Screen name={routes.adminReports} component={AdminReportsScreen} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { authReady, session } = useAuth();

  if (!authReady) {
    return <LoadingScreen />;
  }

  return <NavigationContainer>{!session ? <AuthStack /> : session.user.role === 'Admin' ? <AdminStack /> : <MemberStack />}</NavigationContainer>;
}
