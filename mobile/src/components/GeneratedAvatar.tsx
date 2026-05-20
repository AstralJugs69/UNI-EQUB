import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AvatarDescriptor } from '../types/domain';
import { palette } from '../theme/tokens';

const palettes = [
  ['#EAF2FF', '#0B63E5', '#9AC2FF'],
  ['#EAF8F0', '#0F9F64', '#9BE0BF'],
  ['#FFF4D8', '#B77900', '#FFD67A'],
  ['#F1ECFF', '#6D4FD8', '#C5B6FF'],
];

function hashSeed(seed: string) {
  return seed.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function initialsFor(seed: string) {
  const cleaned = seed.trim().replace(/[^a-z0-9 ]/gi, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? 'U'}${parts[1]?.[0] ?? parts[0]?.[1] ?? 'E'}`.toUpperCase();
}

export function GeneratedAvatar({
  descriptor,
  labelSeed,
  size = 88,
  verified,
}: {
  descriptor?: AvatarDescriptor | null;
  labelSeed: string;
  size?: number;
  verified?: boolean;
}) {
  const seed = descriptor?.seed ?? labelSeed;
  const hash = Math.abs(hashSeed(seed));
  const [background, foreground, accent] = palettes[hash % palettes.length];
  const dotSize = Math.max(size * 0.18, 12);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <View style={[styles.shape, { width: size * 0.48, height: size * 0.48, borderRadius: size * 0.16, backgroundColor: accent, transform: [{ rotate: `${hash % 42}deg` }] }]} />
      <Text style={[styles.initials, { color: foreground, fontSize: Math.max(size * 0.28, 20) }]}>{initialsFor(labelSeed)}</Text>
      {verified ? (
        <View style={[styles.verified, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]}>
          <Text style={styles.check}>✓</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: palette.primary,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  shape: {
    position: 'absolute',
    opacity: 0.8,
  },
  initials: {
    fontWeight: '900',
  },
  verified: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: palette.white,
  },
  check: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '900',
  },
});
