import React, { PropsWithChildren, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from './ServicesProvider';
import { AuthProvider } from './AuthProvider';
import { SimulationBridgeProvider } from './SimulationBridgeProvider';
import { PreferencesProvider } from './PreferencesProvider';
import { NotificationPopupProvider } from './NotificationPopupProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 5_000,
          },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ServicesProvider>
            <AuthProvider>
              <PreferencesProvider>
                <NotificationPopupProvider>
                  <SimulationBridgeProvider>{children}</SimulationBridgeProvider>
                </NotificationPopupProvider>
              </PreferencesProvider>
            </AuthProvider>
          </ServicesProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
