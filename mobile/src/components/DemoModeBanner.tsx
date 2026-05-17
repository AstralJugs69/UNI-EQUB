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
      title="Demo mode is running."
      body="This phone is using seeded local data and mock payment rails so the completed member and admin flows can be shown safely."
    />
  );
}
