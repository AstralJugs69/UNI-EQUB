import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, ListRow, Pill, PrimaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useMemberActions, useNotificationsQuery } from '../../hooks/useAppQueries';
import { resolveNotificationRoute } from '../../navigation/notificationRoutes';
import { useAuth } from '../../providers/AuthProvider';

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data = [] } = useNotificationsQuery();
  const { markNotificationsRead } = useMemberActions();
  const unreadCount = data.filter(item => item.unread).length;

  return (
    <AppScreen>
      <TopAppBar title="Notifications" subtitle="Inbox" onBack={() => navigation.goBack()} rightLabel={`${unreadCount} unread`} />
      {!data.length ? (
        <EmptyState icon="notifications-none" title="No notifications yet" subtitle="Round reminders, winner announcements, and approvals will show up here once activity starts." />
      ) : data.map(item => {
        const resolved = resolveNotificationRoute(item, session?.user.role ?? 'Member');
        return (
          <SectionCard key={item.id} variant={item.unread ? 'raised' : 'default'}>
            <ListRow
              title={item.title}
              subtitle={item.body}
              right={<Pill label={resolved ? item.unread ? 'Open' : 'View' : item.unread ? 'Unread' : 'Read'} tone={item.unread ? 'active' : 'neutral'} />}
              leadingIcon={item.unread ? 'notifications-active' : 'notifications'}
              onPress={resolved ? () => navigation.navigate(resolved.name, resolved.params) : undefined}
            />
          </SectionCard>
        );
      })}
      <PrimaryCTA label="Mark All As Read" onPress={() => markNotificationsRead.mutate()} loading={markNotificationsRead.isPending} disabled={markNotificationsRead.isPending || !data.length} />
    </AppScreen>
  );
}
