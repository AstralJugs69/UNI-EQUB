import React from 'react';
import { AppScreen, EmptyState, ListRow, Pill, PrimaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useMemberActions, useNotificationsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { MemberNav } from './shared';

export function NotificationsScreen() {
  const { data = [] } = useNotificationsQuery();
  const { markNotificationsRead } = useMemberActions();
  const unreadCount = data.filter(item => item.unread).length;

  return (
    <AppScreen footer={<MemberNav active={routes.notifications} />}>
      <TopAppBar title="Notifications" subtitle="Inbox" rightLabel={`${unreadCount} unread`} />
      {!data.length ? (
        <EmptyState icon="notifications-none" title="No notifications yet" subtitle="Round reminders, winner announcements, and approvals will show up here once activity starts." />
      ) : data.map(item => (
        <SectionCard key={item.id} variant={item.unread ? 'raised' : 'default'}>
          <ListRow
            title={item.title}
            subtitle={item.body}
            right={<Pill label={item.unread ? 'Unread' : 'Read'} tone={item.unread ? 'active' : 'neutral'} />}
            leadingIcon={item.unread ? 'notifications-active' : 'notifications'}
          />
        </SectionCard>
      ))}
      <PrimaryCTA label="Mark All As Read" onPress={() => markNotificationsRead.mutate()} loading={markNotificationsRead.isPending} disabled={markNotificationsRead.isPending || !data.length} />
    </AppScreen>
  );
}
