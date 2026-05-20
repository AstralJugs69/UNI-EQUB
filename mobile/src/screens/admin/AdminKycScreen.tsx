import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AppScreen, EmptyState, Pill, StatusBanner } from '../../components/ui';
import { usePendingKycQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { KycReviewItem, KycStatus, KycSubmissionStatus } from '../../types/domain';
import { adminStyles } from './styles';

type KycQueueFilter = 'All' | 'PendingReview' | 'NeedsResubmission' | 'Approved';

const filters: Array<{ key: KycQueueFilter; label: string }> = [
  { key: 'All', label: 'All' },
  { key: 'PendingReview', label: 'Pending' },
  { key: 'NeedsResubmission', label: 'Needs resubmission' },
  { key: 'Approved', label: 'Approved' },
];

function itemStatus(item: KycReviewItem): KycSubmissionStatus | KycStatus {
  return item.submission?.status ?? item.user.KYC_Status;
}

function filterCount(data: KycReviewItem[], filter: KycQueueFilter) {
  if (filter === 'All') {
    return data.length;
  }
  return data.filter(item => itemStatus(item) === filter).length;
}

function QueueTab({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[adminStyles.kycQueueTab, selected && adminStyles.kycQueueTabActive]}>
      <Text style={[adminStyles.kycQueueTabLabel, selected && adminStyles.kycQueueTabLabelActive]} numberOfLines={1}>{label}</Text>
      <Text style={[adminStyles.kycQueueTabCount, selected && adminStyles.kycQueueTabCountActive]}>{count}</Text>
    </Pressable>
  );
}

function QueueCard({
  item,
  onPress,
}: {
  item: KycReviewItem;
  onPress: () => void;
}) {
  const status = itemStatus(item);
  const docKind = item.documents?.[0]?.kind?.replace(/_/g, ' ') ?? 'Front ID';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: '#E2EBF8' }} style={adminStyles.kycQueueCard}>
      <View style={adminStyles.kycQueueAvatar}>
        <Icon name="badge" size={iconSize.lg} color={palette.primary} />
      </View>
      <View style={adminStyles.kycQueueCardText}>
        <Text style={adminStyles.kycQueueName}>{item.user.Full_Name}</Text>
        <Text style={adminStyles.kycQueueMeta}>{item.user.Phone_Number} · {docKind}</Text>
        <View style={adminStyles.kycQueueNoteRow}>
          <View style={adminStyles.kycQueueNoteDot} />
          <Text style={adminStyles.kycQueueNote} numberOfLines={1}>{item.note}</Text>
        </View>
      </View>
      <Pill label={status} tone={status === 'Approved' ? 'good' : status === 'NeedsResubmission' ? 'active' : 'warn'} />
      <Icon name="chevron-right" size={iconSize.md} color={palette.textSoft} />
    </Pressable>
  );
}

export function AdminKycScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { data = [] } = usePendingKycQuery();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<KycQueueFilter>('All');

  const filteredData = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.filter(item => {
      const status = itemStatus(item);
      const matchesFilter = filter === 'All' || status === filter;
      const matchesQuery = !normalized
        || item.user.Full_Name.toLowerCase().includes(normalized)
        || item.user.Phone_Number.toLowerCase().includes(normalized)
        || item.user.User_ID.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  return (
    <AppScreen>
      <View style={adminStyles.kycQueueHeader}>
        <View style={adminStyles.kycQueueHeaderText}>
          <Text style={adminStyles.adminEyebrow}>ADMIN HUB</Text>
          <Text style={adminStyles.kycQueueTitle}>KYC Queue</Text>
          <Text style={adminStyles.kycQueueSubtitle}>Review student KYC submissions before approving, requesting resubmission, or banning an account.</Text>
        </View>
        <View style={adminStyles.kycQueuePendingPill}>
          <Text style={adminStyles.kycQueuePendingText}>{data.length} pending</Text>
        </View>
      </View>

      {route?.params?.flash ? <StatusBanner tone="success" title={route.params.flash} /> : null}

      <View style={adminStyles.kycSearchRow}>
        <View style={adminStyles.kycSearchBox}>
          <Icon name="search" size={iconSize.sm} color={palette.textSoft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or ID..."
            placeholderTextColor={palette.textSoft}
            style={adminStyles.kycSearchInput}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setFilter(current => current === 'All' ? 'PendingReview' : 'All')} style={adminStyles.kycFilterButton}>
          <Icon name="filter-list" size={iconSize.md} color={palette.textMuted} />
          <Text style={adminStyles.kycFilterText}>Filter</Text>
        </Pressable>
      </View>

      <View style={adminStyles.kycQueueTabs}>
        {filters.map(item => (
          <QueueTab
            key={item.key}
            label={item.label}
            count={filterCount(data, item.key)}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>

      {filteredData.length ? (
        <View style={adminStyles.kycQueueList}>
          {filteredData.map(item => (
            <QueueCard
              key={item.user.User_ID}
              item={item}
              onPress={() => navigation.navigate(routes.adminKycReview, { userId: item.user.User_ID })}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="fact-check" title="No matching KYC requests" subtitle="The current queue filter has no student submissions to review." />
      )}
    </AppScreen>
  );
}
