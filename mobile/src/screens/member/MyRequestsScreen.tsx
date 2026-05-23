import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { InlineError, ScreenScroll, TopAppBar } from '../../components/ui';
import { useMyFormationGroupsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { palette } from '../../theme/tokens';
import { FormingRequestCard } from './FormingRequestCard';
import { memberStyles } from './styles';

export function MyRequestsScreen() {
  const navigation = useNavigation<any>();
  const { data: myRequests = [], error } = useMyFormationGroupsQuery();

  return (
    <ScreenScroll>
      <TopAppBar title="My Requests" subtitle="Forming groups" onBack={() => navigation.goBack()} rightLabel={`${myRequests.length}`} />
      <InlineError message={error instanceof Error ? error.message : ''} />
      {myRequests.length ? (
        <View style={memberStyles.exploreCardList}>
          {myRequests.map(request => (
            <FormingRequestCard
              key={request.id}
              request={request}
              onPress={() => {
                if (request.status === 'Approved' && request.approved_group_id && request.activated_at) {
                  navigation.navigate(routes.groupStatus, { groupId: request.approved_group_id });
                  return;
                }
                if (request.status === 'Approved' && request.approved_group_id) {
                  navigation.navigate(routes.groupDetail, { groupId: request.approved_group_id });
                  return;
                }
                navigation.navigate(routes.formationCreator, { requestId: request.id });
              }}
            />
          ))}
        </View>
      ) : (
        <View style={memberStyles.exploreEmptyCard}>
          <View style={memberStyles.exploreEmptyIcon}>
            <Icon name="playlist-add-check" size={32} color={palette.primary} />
          </View>
          <Text style={memberStyles.exploreEmptyTitle}>No forming requests</Text>
          <Text style={memberStyles.exploreEmptyBody}>Create a forming group to gather accepted members before it starts.</Text>
        </View>
      )}
    </ScreenScroll>
  );
}
