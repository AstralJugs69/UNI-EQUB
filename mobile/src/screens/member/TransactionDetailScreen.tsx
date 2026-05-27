import React from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '../../components/Icon';
import { EmptyState, LoadingState, Pill, PrimaryCTA, ScreenScroll, SecondaryCTA, SectionCard, TopAppBar } from '../../components/ui';
import { useDashboardQuery, useTransactionsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { useAuth } from '../../providers/AuthProvider';
import { createTransactionReceiptPdf } from '../../services/receiptPdf';
import { savePdfToDownloads } from '../../services/native/receiptDownload';
import { iconSize, palette } from '../../theme/tokens';
import type { TransactionRecord } from '../../types/domain';
import { formatCurrency, paymentMethodLabel } from './shared';
import { memberStyles } from './styles';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toISOString().slice(0, 10)} - ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function DetailRow({
  icon,
  label,
  value,
  helper,
}: {
  icon: string;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <View style={memberStyles.transactionInfoRow}>
      <View style={memberStyles.transactionInfoIcon}>
        <Icon name={icon} size={iconSize.sm} color={palette.primary} />
      </View>
      <Text style={memberStyles.transactionInfoLabel}>{label}</Text>
      <View style={memberStyles.transactionInfoValueWrap}>
        <Text style={memberStyles.transactionInfoValue} numberOfLines={2}>{value}</Text>
        {helper ? <Text style={memberStyles.transactionInfoHelper} numberOfLines={1}>{helper}</Text> : null}
      </View>
    </View>
  );
}

function TimelineRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={memberStyles.transactionTimelineRow}>
      <View style={memberStyles.transactionTimelineDot}>
        <Icon name="check" size={14} color={palette.white} />
      </View>
      <View style={memberStyles.transactionTimelineText}>
        <Text style={memberStyles.transactionTimelineTitle}>{title}</Text>
        <Text style={memberStyles.transactionTimelineSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function buildReceipt(transaction: TransactionRecord, groupName: string, recipient: string) {
  return [
    'UniEqub transaction receipt',
    `${transaction.Type} - ${transaction.Status}`,
    `Amount: ${formatCurrency(transaction.Amount)}`,
    `Group: ${groupName}`,
    `Method: ${paymentMethodLabel(transaction.Payment_Method)}`,
    `Date: ${formatDate(transaction.Date)}`,
    `Reference: ${transaction.Gateway_Ref}`,
    `Recipient: ${recipient}`,
  ].join('\n');
}

export function TransactionDetailScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { data: rows = [], isLoading } = useTransactionsQuery();
  const { data: dashboard } = useDashboardQuery();
  const transactionId = route.params?.transactionId ?? '';
  const transaction = rows.find(item => item.Trans_ID === transactionId);

  if (isLoading) {
    return <LoadingState title="Loading transaction" subtitle="Preparing the receipt and wallet timeline." />;
  }

  if (!transaction || !session) {
    return (
      <ScreenScroll>
        <TopAppBar title="Transaction details" onBack={() => navigation.navigate(routes.memberTabs, { screen: routes.history })} />
        <EmptyState icon="receipt-long" title="Transaction not found" subtitle="Open a transaction from the ledger to view its receipt details." />
        <SecondaryCTA label="Back to history" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.history })} />
      </ScreenScroll>
    );
  }

  const safeTransaction = transaction;
  const safeSession = session;
  const groupName = dashboard?.currentGroup?.Group_Name ?? 'UniEqub group';
  const recipient = safeTransaction.Type === 'Payout' ? safeSession.user.fullName : 'Verified contribution pool';
  const recipientHelper = safeTransaction.Type === 'Payout' ? 'Wallet credited' : 'Round contribution recorded';
  const heroSubtitle = safeTransaction.Type === 'Payout' ? 'Wallet credited' : 'Contribution received';
  const badgeTone = safeTransaction.Status === 'Successful' ? 'good' : safeTransaction.Status === 'Failed' ? 'bad' : 'warn';

  async function downloadReceipt() {
    try {
      const displayName = `uniequb-receipt-${safeTransaction.Gateway_Ref.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
      const filePath = await createTransactionReceiptPdf({
        transaction: safeTransaction,
        groupName,
        recipient,
        methodLabel: paymentMethodLabel(safeTransaction.Payment_Method),
        accountName: safeSession.user.fullName,
      });
      const savedLocation = await savePdfToDownloads(filePath, displayName);
      Alert.alert(
        'Receipt downloaded',
        'The PDF receipt was saved to Downloads > UniEqub.',
        [
          { text: 'OK' },
          {
            text: 'Share',
            onPress: () => {
              Share.share({
                title: 'UniEqub receipt PDF',
                message: `UniEqub receipt ${safeTransaction.Gateway_Ref}`,
                url: savedLocation.startsWith('content://') ? savedLocation : `file://${savedLocation}`,
              }).catch(() => undefined);
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert(
        'Receipt download failed',
        err instanceof Error ? err.message : 'The PDF receipt could not be downloaded in this build.',
        [
          { text: 'OK' },
          {
            text: 'Share text receipt',
            onPress: () => {
              Share.share({
                title: 'UniEqub receipt',
                message: buildReceipt(safeTransaction, groupName, recipient),
              }).catch(() => undefined);
            },
          },
        ],
      );
    }
  }

  return (
    <ScreenScroll>
      <TopAppBar title="Transaction details" onBack={() => navigation.goBack()} />
      <SectionCard style={memberStyles.transactionHeroCard}>
        <View style={memberStyles.transactionHeroIconWrap}>
          <View style={memberStyles.transactionHeroIcon}>
            <Icon name={safeTransaction.Type === 'Payout' ? 'payments' : 'account-balance'} size={iconSize.lg} color={palette.primary} />
          </View>
          {safeTransaction.Status === 'Successful' ? (
            <View style={memberStyles.transactionHeroCheck}>
              <Icon name="check" size={14} color={palette.white} />
            </View>
          ) : null}
        </View>
        <Pill label={`${safeTransaction.Type} - ${safeTransaction.Status}`} tone={badgeTone} />
        <Text style={memberStyles.transactionHeroAmount}>{formatCurrency(safeTransaction.Amount)}</Text>
        <Text style={memberStyles.transactionHeroSubtitle}>{heroSubtitle}</Text>
      </SectionCard>
      <SectionCard style={memberStyles.transactionInfoCard}>
        <Text style={memberStyles.transactionSectionTitle}>Transaction information</Text>
        <DetailRow icon="groups" label="Group" value={groupName} />
        <DetailRow icon="credit-card" label="Method" value={paymentMethodLabel(safeTransaction.Payment_Method)} />
        <DetailRow icon="calendar-month" label="Date" value={formatDate(safeTransaction.Date)} />
        <DetailRow icon="badge" label="Reference ID" value={safeTransaction.Gateway_Ref} />
        <DetailRow icon="person" label="Recipient" value={recipient} helper={recipientHelper} />
      </SectionCard>
      <SectionCard style={memberStyles.transactionTimelineCard}>
        <Text style={memberStyles.transactionSectionTitle}>Status timeline</Text>
        <TimelineRow title="Processed successfully" subtitle={formatDateTime(safeTransaction.Date)} />
        <TimelineRow title="Recorded in wallet history" subtitle={formatDateTime(safeTransaction.Date)} />
      </SectionCard>
      <PrimaryCTA label="Download PDF receipt" icon="file-download" onPress={() => { downloadReceipt().catch(() => undefined); }} />
      <SecondaryCTA label="Back to history" icon="arrow-back" onPress={() => navigation.navigate(routes.memberTabs, { screen: routes.history })} />
    </ScreenScroll>
  );
}
