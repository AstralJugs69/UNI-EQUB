import { browseableJoinWindowGroups, groupMembershipBuckets, notificationCategory } from './uxState';
import type { AppNotification, GroupRecord } from '../../types/domain';

function group(id: string, status: GroupRecord['Status']): GroupRecord {
  return {
    Group_ID: id,
    Creator_ID: `creator-${id}`,
    Group_Name: `Group ${id}`,
    Amount: 650,
    Max_Members: 5,
    Frequency: 'Weekly',
    Virtual_Acc_Ref: `UEQ-${id}`,
    Status: status,
    Start_Date: '2026-03-17',
    Description: 'Test group',
  };
}

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'n-1',
    title: 'Notice',
    body: 'Body',
    createdAt: '2026-03-17',
    unread: true,
    ...overrides,
  };
}

describe('member UX state helpers', () => {
  it('keeps active locked cycles out of Explore join windows', () => {
    const result = browseableJoinWindowGroups([
      group('pending', 'Pending'),
      group('active', 'Active'),
      group('frozen', 'Frozen'),
      group('completed', 'Completed'),
    ]);

    expect(result.map(item => item.Group_ID)).toEqual(['pending']);
  });

  it('buckets memberships by user-facing group state', () => {
    const buckets = groupMembershipBuckets([
      group('join', 'Pending'),
      group('cycle', 'Active'),
      group('recovery', 'Frozen'),
    ], [group('past', 'Completed')]);

    expect(buckets.joinWindowGroups.map(item => item.Group_ID)).toEqual(['join']);
    expect(buckets.cycleGroups.map(item => item.Group_ID)).toEqual(['cycle']);
    expect(buckets.frozenGroups.map(item => item.Group_ID)).toEqual(['recovery']);
    expect(buckets.completedGroups.map(item => item.Group_ID)).toEqual(['past']);
  });

  it('groups notifications by supported member event surfaces', () => {
    expect(notificationCategory(notification({ actionRoute: 'member/payment' }))).toBe('Payments');
    expect(notificationCategory(notification({ type: 'group_resolution_poll_opened' }))).toBe('Voting');
    expect(notificationCategory(notification({ type: 'kyc_approved' }))).toBe('KYC');
    expect(notificationCategory(notification({ type: 'group_announcement_created' }))).toBe('Announcements');
    expect(notificationCategory(notification({ type: 'unknown' }))).toBe('Account');
  });
});
