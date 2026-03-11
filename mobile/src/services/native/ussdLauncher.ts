import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

interface NativeUssdModuleShape {
  launch(code: string): Promise<void>;
}

const nativeUssd = NativeModules.NativeUssd as NativeUssdModuleShape | undefined;

async function requestDirectCallPermission() {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
    title: 'Allow USSD dialing',
    message: 'UniEqub needs phone-call permission to open the native testing shortcode.',
    buttonPositive: 'Allow',
    buttonNegative: 'Cancel',
    buttonNeutral: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function launchNativeUssd(code: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Native USSD launch is only available on Android devices.');
  }

  const directCall = await requestDirectCallPermission();
  if (!directCall) {
    throw new Error('CALL_PHONE permission is required to open the test USSD flow.');
  }
  if (!nativeUssd?.launch) {
    throw new Error('Native USSD launch is not available in this Android build.');
  }

  await nativeUssd.launch(code);
}
