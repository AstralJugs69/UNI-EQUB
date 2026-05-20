import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigateFromOutside(name: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
