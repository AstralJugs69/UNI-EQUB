import React from 'react';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { palette } from '../theme/tokens';

export function Icon({
  name,
  size = 22,
  color = palette.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <MaterialIcons name={name as any} size={size} color={color} />;
}
