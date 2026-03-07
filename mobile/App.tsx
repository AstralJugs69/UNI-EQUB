import React from 'react';
import { StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import { AppProviders } from './src/providers/AppProviders';
import { AppNavigator } from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <AppProviders>
      <StatusBar barStyle="dark-content" backgroundColor="#fcfcfd" />
      <AppNavigator />
    </AppProviders>
  );
}

export default App;
