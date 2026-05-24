import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppScreen, EmptyState, Pill, PrimaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMemberActions, useNotificationsQuery } from '../../hooks/useAppQueries';
import { resolveNotificationRoute } from '../../navigation/notificationRoutes';
import { useAuth } from '../../providers/AuthProvider';
import { requestNotificationPermission } from '../../services/native/notificationPermission';
import { iconSize, palette } from '../../theme/tokens';
import type { AppNotification } from '../../types/domain';
import { memberStyles } from './styles';
import { notificationCategory } from './uxState';

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data = [] } = useNotificationsQuery();
  const { markNotificationsRead } = useMemberActions();
  const unreadCount = data.filter(item => item.unread).length;
  const groupedNotifications = useMemo(() => data.reduce<Record<string, AppNotification[]>>((groups, item) => {
    const group = notificationCategory(item);
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {}), [data]);
  const groupOrder = ['KYC', 'Payments', 'Voting', 'Groups', 'Announcements', 'Account'];
  const visibleGroups = groupOrder.filter(group => groupedNotifications[group]?.length);
  const [selectedGroup, setSelectedGroup] = useState('');
  const activeGroup = selectedGroup && groupedNotifications[selectedGroup]?.length ? selectedGroup : visibleGroups[0];
  const activeNotifications = activeGroup ? groupedNotifications[activeGroup] ?? [] : [];

  useEffect(() => {
    if (!activeGroup && selectedGroup) {
      setSelectedGroup('');
    }
  }, [activeGroup, selectedGroup]);

  useEffect(() => {
    requestNotificationPermission().catch(() => undefined);
  }, []);

  return (
    <AppScreen>
      <TopAppBar title="Notifications" subtitle="Inbox" onBack={() => navigation.goBack()} rightLabel={`${unreadCount} unread`} />
      {!data.length ? (
        <EmptyState icon="notifications-none" title="No notifications yet" subtitle="Round reminders, winner announcements, and approvals will show up here once activity starts." />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={memberStyles.notificationCategoryScroller} contentContainerStyle={memberStyles.notificationCategoryRail}>
            {visibleGroups.map(group => {
              const groupUnread = groupedNotifications[group].filter(item => item.unread).length;
              const selected = group === activeGroup;
              return (
                <Pressable
                  key={group}
                  accessibilityRole="button"
                  onPress={() => setSelectedGroup(group)}
                  style={[memberStyles.notificationCategoryChip, selected && memberStyles.notificationCategoryChipActive]}
                >
                  <Text style={[memberStyles.notificationCategoryTitle, selected && memberStyles.notificationCategoryTitleActive]}>{group}</Text>
                  <Text style={[memberStyles.notificationCategoryMeta, selected && memberStyles.notificationCategoryMetaActive]}>
                    {groupUnread} unread
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <SectionCard variant={activeNotifications.some(item => item.unread) ? 'raised' : 'default'} style={memberStyles.notificationsPanel}>
            <View style={memberStyles.notificationsGroupHeader}>
              <Text style={memberStyles.sectionTitle}>{activeGroup}</Text>
              <Pill label={`${activeNotifications.length} alert${activeNotifications.length === 1 ? '' : 's'}`} tone="neutral" />
            </View>
            <View style={memberStyles.notificationTileList}>
              {activeNotifications.map(item => {
                const resolved = resolveNotificationRoute(item, session?.user.role ?? 'Member');
                const actionLabel = resolved ? item.unread ? 'Open' : 'View' : item.unread ? 'Unread' : 'Read';
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole={resolved ? 'button' : undefined}
                    disabled={!resolved}
                    onPress={resolved ? () => navigation.navigate(resolved.name, resolved.params) : undefined}
                    style={[memberStyles.notificationTile, item.unread && memberStyles.notificationTileUnread]}
                  >
                    <View style={[memberStyles.notificationTileIcon, item.unread && memberStyles.notificationTileIconUnread]}>
                      <Icon name={item.unread ? 'notifications-active' : resolved ? 'open-in-new' : 'notifications'} size={iconSize.sm} color={item.unread ? palette.primary : palette.textSoft} />
                    </View>
                    <View style={memberStyles.notificationTileText}>
                      <Text style={memberStyles.notificationTileTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={memberStyles.notificationTileBody} numberOfLines={2}>{item.body}</Text>
                    </View>
                    <Pill label={actionLabel} tone={item.unread ? 'active' : 'neutral'} />
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        </>
      )}
      <PrimaryCTA label="Mark All As Read" onPress={() => markNotificationsRead.mutate()} loading={markNotificationsRead.isPending} disabled={markNotificationsRead.isPending || !data.length} />
    </AppScreen>
  );
}
