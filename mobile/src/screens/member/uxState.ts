import type { AppNotification, GroupRecord } from '../../types/domain';

export function browseableJoinWindowGroups(groups: GroupRecord[]) {
  return groups.filter(group => group.Status === 'Pending');
}

export function groupMembershipBuckets(activeGroups: GroupRecord[], completedGroups: GroupRecord[] = []) {
  return {
    joinWindowGroups: activeGroups.filter(group => group.Status === 'Pending'),
    cycleGroups: activeGroups.filter(group => group.Status === 'Active'),
    frozenGroups: activeGroups.filter(group => group.Status === 'Frozen'),
    otherGroups: activeGroups.filter(group => !['Pending', 'Active', 'Frozen'].includes(group.Status)),
    completedGroups,
  };
}

export function notificationCategory(item: AppNotification) {
  const key = `${item.type ?? ''} ${item.actionRoute ?? ''} ${item.relatedEntityType ?? ''}`.toLowerCase();
  if (key.includes('kyc')) {
    return 'KYC';
  }
  if (key.includes('payment') || key.includes('transaction') || key.includes('wallet') || key.includes('payout')) {
    return 'Payments';
  }
  if (key.includes('resolution') || key.includes('vote')) {
    return 'Voting';
  }
  if (key.includes('announcement')) {
    return 'Announcements';
  }
  if (key.includes('group')) {
    return 'Groups';
  }
  return 'Account';
}
