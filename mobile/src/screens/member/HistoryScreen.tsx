import React from 'react';
import { AppScreen, EmptyState, ListRow, Pill, SectionCard, TopAppBar } from '../../components/ui';
import { useTransactionsQuery } from '../../hooks/useAppQueries';
import { routes } from '../../navigation/routes';
import { MemberNav, formatCurrency, paymentMethodLabel } from './shared';

export function HistoryScreen() {
  const { data: rows = [] } = useTransactionsQuery();

  return (
    <AppScreen footer={<MemberNav active={routes.history} />}>
      <TopAppBar title="Transaction Ledger" subtitle="History" />
      {!rows.length ? (
        <EmptyState icon="receipt-long" title="No transactions yet" subtitle="Contributions and payouts will appear here as soon as the first cycle activity is recorded." />
      ) : rows.map(item => (
        <SectionCard key={item.Trans_ID}>
          <ListRow
            title={`${item.Type} • ${item.Status}`}
            subtitle={`${paymentMethodLabel(item.Payment_Method)} • ${item.Date.slice(0, 10)}`}
            right={<Pill label={item.Type} tone={item.Type === 'Payout' ? 'good' : 'warn'} />}
            leadingIcon={item.Type === 'Payout' ? 'payments' : 'account-balance'}
          />
          <ListRow title={formatCurrency(item.Amount)} subtitle={item.Gateway_Ref} />
        </SectionCard>
      ))}
    </AppScreen>
  );
}
