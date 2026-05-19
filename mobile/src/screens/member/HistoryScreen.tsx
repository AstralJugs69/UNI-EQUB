import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { AppScreen, EmptyState, Pill, SegmentedTabs, SectionCard, TopAppBar } from '../../components/ui';
import { useTransactionsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { iconSize, palette } from '../../theme/tokens';
import type { TransactionRecord, TransactionType } from '../../types/domain';
import { formatCurrency, paymentMethodLabel } from './shared';
import { memberStyles } from './styles';

type LedgerFilter = 'All' | TransactionType;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function LedgerSummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: 'blue' | 'green';
}) {
  return (
    <View style={memberStyles.ledgerSummaryTile}>
      <View style={[memberStyles.ledgerSummaryIcon, tone === 'green' && memberStyles.ledgerSummaryIconGreen]}>
        <Icon name={icon} size={iconSize.md} color={tone === 'green' ? palette.success : palette.primary} />
      </View>
      <View style={memberStyles.ledgerSummaryText}>
        <Text style={memberStyles.ledgerSummaryLabel}>{label}</Text>
        <Text style={memberStyles.ledgerSummaryValue}>{value}</Text>
        <Text style={memberStyles.ledgerSummaryHelper}>This month</Text>
      </View>
    </View>
  );
}

function TransactionCard({
  item,
  onPress,
}: {
  item: TransactionRecord;
  onPress: () => void;
}) {
  const isPayout = item.Type === 'Payout';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: '#E2EBF8' }}
      style={memberStyles.ledgerCard}
    >
      <View style={memberStyles.ledgerCardTopRow}>
        <View style={[memberStyles.ledgerCardIcon, isPayout && memberStyles.ledgerCardIconPayout]}>
          <Icon name={isPayout ? 'payments' : 'account-balance'} size={iconSize.md} color={isPayout ? palette.primary : palette.warning} />
        </View>
        <View style={memberStyles.ledgerCardTitleWrap}>
          <Text style={memberStyles.ledgerCardTitle}>{item.Type} · {item.Status}</Text>
          <Text style={memberStyles.ledgerCardSubtitle}>{paymentMethodLabel(item.Payment_Method)} · {formatDate(item.Date)}</Text>
        </View>
        <Pill label={item.Type} tone={isPayout ? 'good' : 'warn'} />
      </View>
      <View style={memberStyles.ledgerCardBottomRow}>
        <View>
          <Text style={memberStyles.ledgerCardAmount}>{formatCurrency(item.Amount)}</Text>
          <Text style={memberStyles.ledgerCardReference}>{item.Gateway_Ref}</Text>
        </View>
        <Icon name="chevron-right" size={iconSize.md} color={palette.textSoft} />
      </View>
    </Pressable>
  );
}

export function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { data: rows = [] } = useTransactionsQuery();
  const [filter, setFilter] = useState<LedgerFilter>('All');

  const totals = useMemo(() => ({
    contributions: rows.filter(item => item.Type === 'Contribution' && item.Status === 'Successful').reduce((sum, item) => sum + item.Amount, 0),
    payouts: rows.filter(item => item.Type === 'Payout' && item.Status === 'Successful').reduce((sum, item) => sum + item.Amount, 0),
  }), [rows]);

  const filteredRows = useMemo(() => (
    filter === 'All' ? rows : rows.filter(item => item.Type === filter)
  ), [filter, rows]);

  return (
    <AppScreen>
      <TopAppBar title="Transaction Ledger" subtitle="History" />
      <SegmentedTabs
        options={[
          { key: 'All', label: 'All' },
          { key: 'Contribution', label: 'Contributions' },
          { key: 'Payout', label: 'Payouts' },
        ]}
        selectedKey={filter}
        onSelect={key => setFilter(key as LedgerFilter)}
      />
      <SectionCard style={memberStyles.ledgerSummaryCard}>
        <LedgerSummaryTile icon="account-balance" label="Total Contributions" value={formatCurrency(totals.contributions)} tone="blue" />
        <View style={memberStyles.ledgerSummaryDivider} />
        <LedgerSummaryTile icon="account-balance-wallet" label="Total Payouts" value={formatCurrency(totals.payouts)} tone="green" />
      </SectionCard>
      {!filteredRows.length ? (
        <EmptyState icon="receipt-long" title="No transactions yet" subtitle="Contributions and payouts will appear here as soon as the first cycle activity is recorded." />
      ) : (
        <View style={memberStyles.ledgerList}>
          {filteredRows.map(item => (
            <TransactionCard
              key={item.Trans_ID}
              item={item}
              onPress={() => navigation.navigate(routes.transactionDetail, { transactionId: item.Trans_ID })}
            />
          ))}
        </View>
      )}
      <Text style={memberStyles.ledgerFootnote}>Showing your latest transactions. Pull down to refresh.</Text>
    </AppScreen>
  );
}
