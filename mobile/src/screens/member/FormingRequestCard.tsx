import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { iconSize, palette } from '../../theme/tokens';
import type { GroupFormationRequestSummary } from '../../types/domain';
import { formatCurrency, formatTimeLeft } from './shared';
import { memberStyles } from './styles';

export function ExploreSmallPill({
  icon,
  label,
  tone = 'info',
}: {
  icon?: string;
  label: string;
  tone?: 'info' | 'success';
}) {
  return (
    <View style={[memberStyles.exploreSmallPill, tone === 'success' && memberStyles.exploreSmallPillSuccess]}>
      {icon ? <Icon name={icon} size={13} color={tone === 'success' ? palette.success : palette.primary} /> : null}
      <Text style={[memberStyles.exploreSmallPillText, tone === 'success' && memberStyles.exploreSmallPillTextSuccess]}>{label}</Text>
    </View>
  );
}

export function FormingRequestCard({
  request,
  onPress,
}: {
  request: GroupFormationRequestSummary;
  onPress: () => void;
}) {
  const actionLabel = request.status === 'Approved'
    ? request.activated_at ? 'Open Cycle' : 'Open Join Window'
    : request.status === 'PendingApproval'
      ? 'Track Review'
      : 'Manage Request';

  return (
    <View style={memberStyles.formingRequestCard}>
      <View style={memberStyles.rowWrap}>
        <ExploreSmallPill label={request.status} tone={request.status === 'Forming' ? 'success' : 'info'} />
        <ExploreSmallPill icon="calendar-month" label={request.frequency} />
      </View>
      <Text style={memberStyles.approvedGroupTitle}>{request.proposed_group_name}</Text>
      <Text style={memberStyles.approvedGroupDescription} numberOfLines={2}>
        {request.description ?? 'Public forming group request.'}
      </Text>
      <View style={memberStyles.approvedStatsBox}>
        <View style={memberStyles.approvedStatItem}>
          <View style={memberStyles.approvedStatIcon}>
            <Icon name="account-balance-wallet" size={iconSize.md} color={palette.primary} />
          </View>
          <View>
            <Text style={memberStyles.approvedStatLabel}>Contribution</Text>
            <Text style={memberStyles.approvedStatValue}>{formatCurrency(request.contribution_amount)}</Text>
          </View>
        </View>
        <View style={memberStyles.approvedStatDivider} />
        <View style={memberStyles.approvedStatItem}>
          <View style={memberStyles.approvedStatIcon}>
            <Icon name="groups" size={iconSize.md} color={palette.primary} />
          </View>
          <View>
            <Text style={memberStyles.approvedStatLabel}>{request.status === 'Approved' ? 'Joined' : 'Accepted'}</Text>
            <Text style={memberStyles.approvedStatValue}>{request.accepted_participant_count}/{request.max_members}</Text>
            <Text style={memberStyles.approvedStatHelper}>
              {request.status === 'Approved'
                ? request.activated_at ? 'Cycle started' : formatTimeLeft(request.join_window_ends_at)
                : `${Math.max(request.min_members - request.accepted_participant_count, 0)} until submit`}
            </Text>
          </View>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={memberStyles.approvedGroupButton}>
        <Text style={memberStyles.approvedGroupButtonText}>{actionLabel}</Text>
        <Icon name="arrow-forward" size={iconSize.md} color={palette.white} />
      </Pressable>
    </View>
  );
}
