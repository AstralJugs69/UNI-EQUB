import { StyleSheet } from 'react-native';
import { palette, radii, spacing } from '../../theme/tokens';

export const memberStyles = StyleSheet.create({
  sectionGap: {
    gap: spacing.sm,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  twoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageHeroWrap: {
    height: 164,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  imageHero: {
    width: '100%',
    height: '100%',
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 18,
  },
  mutedText: {
    color: palette.textMuted,
    lineHeight: 20,
  },
  strongText: {
    color: palette.text,
    fontWeight: '700',
  },
  heroValue: {
    color: palette.white,
    fontSize: 30,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  heroBody: {
    color: 'rgba(255,255,255,0.84)',
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  actionGroup: {
    gap: spacing.xs,
  },
  listGroup: {
    gap: spacing.xs,
  },
  amountPositive: {
    color: palette.success,
    fontWeight: '800',
    fontSize: 20,
  },
  amountNegative: {
    color: palette.danger,
    fontWeight: '800',
    fontSize: 20,
  },
  detailLabel: {
    color: palette.textMuted,
    fontWeight: '700',
  },
  experimentalCard: {
    backgroundColor: '#101C30',
    borderColor: '#23314D',
  },
  experimentalTitle: {
    color: palette.white,
    fontWeight: '800',
    fontSize: 18,
  },
  experimentalBody: {
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 21,
  },
});
