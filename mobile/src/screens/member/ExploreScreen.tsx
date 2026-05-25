import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AppScreen, InlineError, SectionCard, StatusBanner } from '../../components/ui';
import { useFormationGroupsQuery, useGroupsQuery, useMyFormationGroupsQuery, useRefreshMemberData } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { GroupRecord } from '../../types/domain';
import { ExploreSmallPill, FormingRequestCard } from './FormingRequestCard';
import { formatCurrency } from './shared';
import { memberStyles } from './styles';
import { browseableJoinWindowGroups } from './uxState';

function ExploreHero({ onJoinCode, onCreate, onBrowse }: { onJoinCode: () => void; onCreate: () => void; onBrowse: () => void }) {
  return (
    <View style={memberStyles.exploreHeroCard}>
      <View pointerEvents="none" style={memberStyles.exploreHeroArt}>
        <View style={memberStyles.exploreVaultBody}>
          <View style={memberStyles.exploreVaultDoor}>
            <View style={memberStyles.exploreVaultDial} />
          </View>
        </View>
        <View style={memberStyles.exploreCoinStack}>
          <View style={memberStyles.exploreCoin} />
          <View style={[memberStyles.exploreCoin, memberStyles.exploreCoinOffset]} />
          <View style={[memberStyles.exploreCoin, memberStyles.exploreCoinLower]} />
        </View>
      </View>
      <View style={memberStyles.exploreHeroIcon}>
        <Icon name="group-add" size={iconSize.md} color={palette.primary} />
      </View>
      <Text style={memberStyles.exploreHeroTitle}>Form or join an Equb</Text>
      <Text style={memberStyles.exploreHeroBody}>Create a request, use a private invite, or join an approved group before its first cycle starts.</Text>
      <View style={memberStyles.exploreHeroActions}>
        <Pressable accessibilityRole="button" onPress={onJoinCode} style={memberStyles.explorePrimaryAction}>
          <Icon name="key" size={iconSize.md} color={palette.white} />
          <Text style={memberStyles.explorePrimaryActionText}>Join With Code</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCreate} style={memberStyles.exploreSecondaryAction}>
          <Icon name="add-circle" size={iconSize.md} color={palette.primary} />
          <Text style={memberStyles.exploreSecondaryActionText}>Create Equb</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBrowse} style={memberStyles.exploreSecondaryAction}>
          <Icon name="travel-explore" size={iconSize.md} color={palette.primary} />
          <Text style={memberStyles.exploreSecondaryActionText}>Browse Join Windows</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ApprovedGroupCard({
  group,
  onPress,
}: {
  group: GroupRecord;
  onPress: () => void;
}) {
  const joinOpen = group.Status === 'Pending';
  const isOpen = group.Status !== 'Completed';

  return (
    <View style={memberStyles.approvedGroupCard}>
      <View style={memberStyles.rowWrap}>
        <ExploreSmallPill label={joinOpen ? 'Join window' : group.Status === 'Active' ? 'Cycle started' : isOpen ? 'Open' : 'Closed'} tone={joinOpen ? 'success' : group.Status === 'Active' ? 'info' : isOpen ? 'success' : 'info'} />
        <ExploreSmallPill icon="calendar-month" label={group.Frequency} />
      </View>
      <Text style={memberStyles.approvedGroupTitle}>{group.Group_Name}</Text>
      <Text style={memberStyles.approvedGroupDescription} numberOfLines={3}>{group.Description}</Text>
      <View style={memberStyles.approvedStatsBox}>
        <View style={memberStyles.approvedStatItem}>
          <View style={memberStyles.approvedStatIcon}>
            <Icon name="account-balance-wallet" size={iconSize.md} color={palette.primary} />
          </View>
          <View>
            <Text style={memberStyles.approvedStatLabel}>Contribution</Text>
            <Text style={memberStyles.approvedStatValue}>{formatCurrency(group.Amount)}</Text>
          </View>
        </View>
        <View style={memberStyles.approvedStatDivider} />
        <View style={memberStyles.approvedStatItem}>
          <View style={memberStyles.approvedStatIcon}>
            <Icon name="groups" size={iconSize.md} color={palette.primary} />
          </View>
          <View>
            <Text style={memberStyles.approvedStatLabel}>Slots</Text>
            <Text style={memberStyles.approvedStatValue}>{group.Max_Members}</Text>
            <Text style={memberStyles.approvedStatHelper}>{joinOpen ? 'Join before cycle starts' : 'Locked cycle size'}</Text>
          </View>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={memberStyles.approvedGroupButton}>
        <Text style={memberStyles.approvedGroupButtonText}>{joinOpen ? 'Preview & Join' : 'View Cycle'}</Text>
        <Icon name="arrow-forward" size={iconSize.md} color={palette.white} />
      </Pressable>
    </View>
  );
}

export function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { data = [] } = useGroupsQuery();
  const { data: formingGroups = [], error: formingError } = useFormationGroupsQuery();
  const { data: myRequests = [], error: myRequestsError } = useMyFormationGroupsQuery();
  const { refreshing, refreshMemberData } = useRefreshMemberData();
  const [browseHintVisible, setBrowseHintVisible] = React.useState(false);
  const joinWindowGroups = browseableJoinWindowGroups(data);

  return (
    <AppScreen refreshing={refreshing} onRefresh={refreshMemberData}>
      <Text style={memberStyles.exploreTitle}>Explore</Text>
      <ExploreHero
        onJoinCode={() => navigation.navigate(routes.formationJoinCode)}
        onCreate={() => navigation.navigate(routes.createBasics)}
        onBrowse={() => setBrowseHintVisible(true)}
      />
      {browseHintVisible ? (
        <StatusBanner tone="info" title="Browse join windows below" body="Only groups that have not started contributions appear in this section." />
      ) : null}
      <SectionCard style={memberStyles.exploreFormingPanel}>
        <Text style={memberStyles.exploreSectionTitle}>My requests</Text>
        <InlineError message={myRequestsError instanceof Error ? myRequestsError.message : ''} />
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate(routes.myRequests)} style={memberStyles.exploreRequestsCard}>
          <View style={memberStyles.exploreRequestsIcon}>
            <Icon name="playlist-add-check" size={iconSize.md} color={palette.primary} />
          </View>
          <View style={memberStyles.exploreRequestsText}>
            <Text style={memberStyles.exploreRequestsTitle}>{myRequests.length ? `${myRequests.length} forming request${myRequests.length === 1 ? '' : 's'}` : 'No forming requests'}</Text>
            <Text style={memberStyles.exploreRequestsBody}>{myRequests.length ? 'Open your request page to review status and manage accepted participants.' : 'Create a forming group to gather accepted members before it starts.'}</Text>
          </View>
          <Icon name="chevron-right" size={iconSize.md} color={palette.textSoft} />
        </Pressable>
      </SectionCard>
      <SectionCard style={memberStyles.exploreFormingPanel}>
        <Text style={memberStyles.exploreSectionTitle}>Forming groups</Text>
        <InlineError message={formingError instanceof Error ? formingError.message : ''} />
        {formingGroups.length ? (
          <View style={memberStyles.exploreCardList}>
            {formingGroups.map(request => (
              <FormingRequestCard
                key={request.id}
                request={request}
                onPress={() => navigation.navigate(routes.formationDetail, { requestId: request.id })}
              />
            ))}
          </View>
        ) : (
          <View style={memberStyles.exploreEmptyState}>
            <View style={memberStyles.exploreEmptyIcon}>
              <Icon name="group-add" size={32} color={palette.primary} />
            </View>
            <Text style={memberStyles.exploreEmptyTitle}>No forming groups yet</Text>
            <Text style={memberStyles.exploreEmptyBody}>Public group requests will appear here while creators gather enough accepted members.</Text>
          </View>
        )}
      </SectionCard>
      <Text style={memberStyles.exploreSectionHeading}>Join windows</Text>
      {!joinWindowGroups.length ? (
        <View style={memberStyles.exploreEmptyCard}>
          <View style={memberStyles.exploreEmptyIcon}>
            <Icon name="travel-explore" size={32} color={palette.primary} />
          </View>
          <Text style={memberStyles.exploreEmptyTitle}>No join windows open</Text>
          <Text style={memberStyles.exploreEmptyBody}>Approved groups appear here only before their contribution cycle starts. Active cycles stay locked to their current members.</Text>
        </View>
      ) : (
        <View style={memberStyles.exploreCardList}>
          {joinWindowGroups.map(group => (
            <ApprovedGroupCard
              key={group.Group_ID}
              group={group}
              onPress={() => navigation.navigate(routes.groupDetail, { groupId: group.Group_ID })}
            />
          ))}
        </View>
      )}
    </AppScreen>
  );
}
