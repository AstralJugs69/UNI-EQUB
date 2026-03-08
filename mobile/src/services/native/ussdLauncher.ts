import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';

interface NativeUssdModuleShape {
  launch(code: string, directCall: boolean): Promise<'call' | 'dial'>;
}

const nativeUssd = NativeModules.NativeUssd as NativeUssdModuleShape | undefined;

function buildDialUrl(code: string) {
  return `tel:${encodeURIComponent(code)}`;
}

async function requestDirectCallPermission() {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
    title: 'Allow direct USSD dialing',
    message: 'UniEqub needs phone-call permission to launch the carrier USSD code directly.',
    buttonPositive: 'Allow',
    buttonNegative: 'Use dialer',
    buttonNeutral: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function launchNativeUssd(code: string): Promise<'call' | 'dial'> {
  if (Platform.OS !== 'android') {
    throw new Error('Native USSD launch is only available on Android devices.');
  }

  const directCall = await requestDirectCallPermission();
  if (nativeUssd?.launch) {
    try {
      return await nativeUssd.launch(code, directCall);
    } catch (error) {
      if (directCall) {
        await Linking.openURL(buildDialUrl(code));
        return 'dial';
      }
      throw error;
    }
  }

  await Linking.openURL(buildDialUrl(code));
  return 'dial';
}
