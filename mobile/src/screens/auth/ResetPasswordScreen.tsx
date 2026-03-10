import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { PrimaryCTA, ScreenScroll, SecondaryCTA, StatusBanner, SplitPhoneField, TitleBlock, TopAppBar } from '../../components/ui';
import { routes } from '../../navigation/routes';
import { authStyles } from './styles';

export function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const [phoneNumber, setPhoneNumber] = useState('');

  return (
    <ScreenScroll contentStyle={authStyles.centeredContent}>
      <TopAppBar title="Reset Password" onBack={() => navigation.goBack()} />
      <TitleBlock title="Recover your account securely" subtitle="Enter the phone number attached to your account and receive a recovery code." />
      <SplitPhoneField value={phoneNumber} onChangeText={setPhoneNumber} />
      <StatusBanner tone="info" title="Recovery is still OTP-based." body="This returns you to the sign-in flow after the recovery code step." />
      <PrimaryCTA label="Send Recovery Code" onPress={() => navigation.navigate(routes.login)} disabled={!phoneNumber} />
      <SecondaryCTA label="Return To Login" onPress={() => navigation.navigate(routes.login)} />
    </ScreenScroll>
  );
}
