import { StyleSheet } from 'react-native';
import { palette, radii, spacing } from '../../theme/tokens';

export const authStyles = StyleSheet.create({
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },
  heroImageWrap: {
    height: 204,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  brandMark: {
    width: 60,
    height: 60,
    borderRadius: radii.xl,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: palette.primaryDark,
    fontSize: 24,
    fontWeight: '800',
  },
  centered: {
    alignItems: 'center',
  },
  mutedText: {
    color: palette.textMuted,
  },
  strongText: {
    color: palette.text,
    fontWeight: '700',
  },
  helperBlock: {
    gap: spacing.xs,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  buttonGroup: {
    gap: spacing.sm,
  },
  kycCard: {
    gap: spacing.sm,
  },
  kycDocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kycActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  progressTrack: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: '#DFE7F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
  },
  heroActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  segmentedWrap: {
    gap: spacing.xs,
  },
  footerActions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
