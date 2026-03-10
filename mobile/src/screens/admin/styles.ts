import { StyleSheet } from 'react-native';
import { palette, spacing } from '../../theme/tokens';

export const adminStyles = StyleSheet.create({
  twoCol: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  listGroup: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 18,
  },
  mutedText: {
    color: palette.textMuted,
  },
  actionGroup: {
    gap: spacing.sm,
  },
});
