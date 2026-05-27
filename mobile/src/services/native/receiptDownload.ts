import { NativeModules, Platform } from 'react-native';

interface ReceiptDownloadModule {
  savePdfToDownloads(sourcePath: string, displayName: string): Promise<string>;
}

const module = NativeModules.UniEqubReceiptDownload as ReceiptDownloadModule | undefined;

export async function savePdfToDownloads(sourcePath: string, displayName: string) {
  if (Platform.OS !== 'android') {
    return sourcePath;
  }
  if (!module?.savePdfToDownloads) {
    throw new Error('Receipt download is not available in this build. Rebuild the Android app and try again.');
  }
  return module.savePdfToDownloads(sourcePath, displayName);
}
