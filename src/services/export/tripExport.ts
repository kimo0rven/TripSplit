import { Expense, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { computeBalances, categoryLabel, countsTowardBalance } from '@/utils/balance';
import { formatDay, formatMoney, formatTime } from '@/utils/money';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface ExportData {
  tripName: string;
  currency: string;
  members: TripMember[];
  expenses: Expense[];
  settlements: Settlement[];
}

const nameOf = (members: TripMember[], id: string) =>
  members.find((member) => member.id === id)?.fullname ?? 'Former member';

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

const csvCell = (value: string | number): string => {
  let text = String(value ?? '');
  // Spreadsheet apps run text that starts with these as a formula.
  if (/^[=+\-@]/.test(text) && Number.isNaN(Number(text))) text = "'" + text;
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

const row = (cells: (string | number)[]) => cells.map(csvCell).join(',');

const paymentStatus = (settlement: Settlement) =>
  settlement.status === 'pending'
    ? 'Waiting for confirmation'
    : settlement.status === 'declined'
      ? 'Declined'
      : 'Confirmed';

export const buildCsv = (data: ExportData): string => {
  const { members, expenses, settlements, currency } = data;
  const lines: string[] = [];

  lines.push(row(['Trip', data.tripName]), row(['Currency', currency]), '');
  lines.push('Expenses');
  lines.push(row(['Date', 'Time', 'Title', 'Category', 'Amount', 'Paid by', 'Split between', 'Notes']));
  expenses.forEach((expense) => {
    lines.push(
      row([
        expense.spentOn,
        expense.spentTime ?? '',
        expense.title,
        categoryLabel(expense.category),
        money(expense.amount),
        Object.entries(expense.paidBy ?? {})
          .map(([id, amount]) => nameOf(members, id) + ' ' + money(amount))
          .join('; '),
        Object.entries(expense.shares ?? {})
          .map(([id, amount]) => nameOf(members, id) + ' ' + money(amount))
          .join('; '),
        expense.notes ?? '',
      ]),
    );
  });

  lines.push('', 'Payments');
  lines.push(row(['Date', 'From', 'To', 'Amount', 'Type', 'Method', 'Status', 'Note']));
  settlements.forEach((settlement) => {
    lines.push(
      row([
        settlement.settledOn,
        nameOf(members, settlement.from),
        nameOf(members, settlement.to),
        money(settlement.amount),
        settlement.isCash === true ? 'Cash' : settlement.isCash === false ? 'Not cash' : '',
        settlement.method ?? '',
        paymentStatus(settlement),
        settlement.note ?? '',
      ]),
    );
  });

  const balances = computeBalances(
    members.map((member) => member.id),
    expenses,
    settlements,
  );
  lines.push('', 'Balances');
  lines.push(row(['Member', 'Paid', 'Share', 'Net (positive = is owed)']));
  balances.forEach((balance) => {
    lines.push(
      row([nameOf(members, balance.memberId), money(balance.paid), money(balance.owed), money(balance.net)]),
    );
  });

  return lines.join('\n');
};

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const buildHtml = (data: ExportData): string => {
  const { members, expenses, settlements, currency } = data;
  const fmt = (value: number) => esc(formatMoney(value, currency));
  const counted = settlements.filter(countsTowardBalance);
  const balances = computeBalances(
    members.map((member) => member.id),
    expenses,
    settlements,
  );
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const expenseRows = expenses
    .map(
      (expense) =>
        '<tr><td>' +
        esc(formatDay(expense.spentOn)) +
        (expense.spentTime ? ' ' + esc(formatTime(expense.spentTime)) : '') +
        '</td><td>' +
        esc(expense.title) +
        '</td><td>' +
        esc(categoryLabel(expense.category)) +
        '</td><td>' +
        esc(
          Object.keys(expense.paidBy ?? {})
            .map((id) => nameOf(members, id))
            .join(', '),
        ) +
        '</td><td class="r">' +
        fmt(expense.amount) +
        '</td></tr>',
    )
    .join('');

  const paymentRows = settlements
    .map(
      (settlement) =>
        '<tr><td>' +
        esc(formatDay(settlement.settledOn)) +
        '</td><td>' +
        esc(nameOf(members, settlement.from)) +
        ' → ' +
        esc(nameOf(members, settlement.to)) +
        '</td><td>' +
        esc(
          (settlement.isCash === true ? 'Cash' : settlement.method || 'Not cash') +
            ' · ' +
            paymentStatus(settlement),
        ) +
        '</td><td class="r">' +
        fmt(settlement.amount) +
        '</td></tr>',
    )
    .join('');

  const balanceRows = balances
    .map(
      (balance) =>
        '<tr><td>' +
        esc(nameOf(members, balance.memberId)) +
        '</td><td class="r">' +
        fmt(balance.paid) +
        '</td><td class="r">' +
        fmt(balance.owed) +
        '</td><td class="r">' +
        (balance.net >= 0 ? 'is owed ' : 'owes ') +
        fmt(Math.abs(balance.net)) +
        '</td></tr>',
    )
    .join('');

  return (
    '<html><head><meta charset="utf-8"/><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;color:#222;padding:24px}' +
    'h1{margin:0 0 4px}h2{margin:24px 0 8px;font-size:16px}' +
    'table{width:100%;border-collapse:collapse;font-size:12px}' +
    'th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}' +
    '.r{text-align:right}.muted{color:#777;font-size:12px}' +
    '</style></head><body>' +
    '<h1>' +
    esc(data.tripName) +
    '</h1><div class="muted">' +
    members.length +
    ' members · ' +
    expenses.length +
    ' expenses · total ' +
    fmt(total) +
    ' · ' +
    counted.length +
    ' payments counted</div>' +
    '<h2>Balances</h2><table><tr><th>Member</th><th class="r">Paid</th><th class="r">Share</th><th class="r">Net</th></tr>' +
    balanceRows +
    '</table><h2>Expenses</h2><table><tr><th>Date</th><th>Title</th><th>Category</th><th>Paid by</th><th class="r">Amount</th></tr>' +
    expenseRows +
    '</table><h2>Payments</h2><table><tr><th>Date</th><th>Who</th><th>How</th><th class="r">Amount</th></tr>' +
    (paymentRows || '<tr><td colspan="4">No payments recorded.</td></tr>') +
    '</table></body></html>'
  );
};

const safeName = (value: string) => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'trip';

export const exportTripCsv = async (data: ExportData): Promise<void> => {
  const csv = buildCsv(data);
  const fileName = safeName(data.tripName) + '_expenses.csv';

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export trip' });
};

export const exportTripPdf = async (data: ExportData): Promise<void> => {
  const html = buildHtml(data);

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export trip' });
};
