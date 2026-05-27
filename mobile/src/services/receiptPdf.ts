import { generatePDF } from 'react-native-html-to-pdf';
import type { TransactionRecord } from '../types/domain';

function getPdfConverter() {
  if (typeof generatePDF !== 'function') {
    throw new Error('PDF converter is not available in this build. Rebuild the native app after installing react-native-html-to-pdf.');
  }
  return generatePDF as (options: { html: string; fileName?: string; directory?: string }) => Promise<{ filePath?: string }>;
}

interface ReceiptInput {
  transaction: TransactionRecord;
  groupName: string;
  recipient: string;
  methodLabel: string;
  accountName: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value: number) {
  return `${Number(value).toLocaleString()} ETB`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function row(label: string, value: string) {
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(value)}</td>
    </tr>
  `;
}

function buildReceiptHtml(input: ReceiptInput) {
  const { transaction } = input;
  const statusColor = transaction.Status === 'Successful' ? '#12805C' : transaction.Status === 'Failed' ? '#B42318' : '#B76E00';
  const documentTitle = transaction.Type === 'Payout' ? 'Payout Receipt' : 'Contribution Receipt';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 40px;
            color: #172033;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #F6F8FC;
          }
          .document {
            background: #FFFFFF;
            border: 1px solid #DDE5F0;
            border-radius: 18px;
            padding: 34px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 2px solid #E7EEF8;
            padding-bottom: 24px;
          }
          .brand {
            font-size: 26px;
            font-weight: 900;
            color: #0D5CE8;
            letter-spacing: 0;
          }
          .subtitle {
            margin-top: 6px;
            color: #667085;
            font-size: 13px;
            font-weight: 600;
          }
          .badge {
            display: inline-block;
            border-radius: 999px;
            padding: 8px 14px;
            color: ${statusColor};
            background: #EFFAF5;
            font-weight: 800;
            font-size: 12px;
          }
          .title {
            margin: 28px 0 6px;
            font-size: 18px;
            color: #667085;
            font-weight: 800;
          }
          .amount {
            font-size: 44px;
            line-height: 1.1;
            font-weight: 900;
            color: #111827;
          }
          .grid {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }
          .panel {
            border: 1px solid #E1E8F2;
            border-radius: 14px;
            padding: 18px;
            background: #FBFDFF;
          }
          .panel h2 {
            margin: 0 0 14px;
            font-size: 14px;
            color: #101828;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td {
            padding: 10px 0;
            border-bottom: 1px solid #E7EEF8;
            font-size: 12px;
            vertical-align: top;
          }
          td:first-child {
            color: #667085;
            font-weight: 700;
            width: 38%;
          }
          td:last-child {
            color: #172033;
            font-weight: 800;
            text-align: right;
          }
          .footer {
            margin-top: 30px;
            padding-top: 18px;
            border-top: 1px solid #E7EEF8;
            color: #667085;
            font-size: 11px;
            line-height: 1.55;
          }
        </style>
      </head>
      <body>
        <main class="document">
          <section class="header">
            <div>
              <div class="brand">UniEqub</div>
              <div class="subtitle">Verified student savings cycle receipt</div>
            </div>
            <div>
              <span class="badge">${escapeHtml(transaction.Status)}</span>
            </div>
          </section>
          <section>
            <div class="title">${escapeHtml(documentTitle)}</div>
            <div class="amount">${escapeHtml(formatMoney(transaction.Amount))}</div>
          </section>
          <section class="grid">
            <div class="panel">
              <h2>Transaction Information</h2>
              <table>
                ${row('Reference ID', transaction.Gateway_Ref)}
                ${row('Type', transaction.Type)}
                ${row('Payment Method', input.methodLabel)}
                ${row('Date', formatDateTime(transaction.Date))}
                ${row('Group', input.groupName)}
              </table>
            </div>
            <div class="panel">
              <h2>Account Information</h2>
              <table>
                ${row('Account', input.accountName)}
                ${row('Recipient', input.recipient)}
                ${row('Transaction ID', transaction.Trans_ID)}
                ${row('Round ID', transaction.Round_ID)}
                ${row('Currency', 'ETB')}
              </table>
            </div>
          </section>
          <section class="footer">
            This PDF is generated by UniEqub from the recorded transaction ledger. Keep it for reconciliation and member reporting. It is not a bank statement.
          </section>
        </main>
      </body>
    </html>
  `;
}

export async function createTransactionReceiptPdf(input: ReceiptInput) {
  const safeReference = input.transaction.Gateway_Ref.replace(/[^a-zA-Z0-9_-]/g, '-');
  const result = await getPdfConverter()({
    html: buildReceiptHtml(input),
    fileName: `uniequb-receipt-${safeReference}`,
    directory: 'Documents',
  });
  if (!result.filePath) {
    throw new Error('Receipt PDF could not be created.');
  }
  return result.filePath;
}
