import React from 'react';
import { StatusBanner } from './ui';
import { useDemoMode } from '../providers/ServicesProvider';

export function DemoModeBanner() {
  const { demoMode } = useDemoMode();

  if (!demoMode) {
    return null;
  }

  return (
    <StatusBanner
      tone="info"
      title="Demo mode"
      body="Seeded data, same screens."
    />
  );
}
