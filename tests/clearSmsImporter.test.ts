import { describe, it, expect } from 'vitest';
import { parseClearSmsBackup } from '../src/services/clearSmsImporter';
import type { Transaction } from '../src/types';

const DEBIT_SMS =
  'Rs.350.00 debited from A/C **4978 on 05-09-2026 at SWIGGY. UPI:912345678901. Avl Bal: Rs.4,500.00';
const CREDIT_SMS =
  'HDFC Bank: Rs.57,973.00 credited to A/c **2807 on 05-09-2026 via NEFT from ABC Corp. Ref: NEFT123456789.';
const OTP_SMS = 'G-455587 is your Google verification code. Do not share it with anyone.';

function backup(messages: Array<{ sender: string; body: string }>): string {
  return JSON.stringify({
    formatVersion: 1,
    accounts: [{ bankName: 'SBI', accountNumber: '1234' }],
    messages: messages.map((m, i) => ({
      id: i + 1,
      threadId: i + 1,
      sender: m.sender,
      normalizedSender: m.sender,
      body: m.body,
      timestamp: Date.parse('2026-09-05T10:00:00Z'),
      isRead: true,
      category: 'UNKNOWN',
    })),
  });
}

describe('parseClearSmsBackup', () => {
  it('parses a valid backup with debit + credit and skips OTPs', () => {
    const json = backup([
      { sender: 'VM-SBIUPI', body: DEBIT_SMS },
      { sender: 'VM-HDFCBK', body: CREDIT_SMS },
      { sender: 'AD-GOOGLE', body: OTP_SMS },
    ]);

    const result = parseClearSmsBackup(json);
    expect(result.success).toBe(true);
    expect(result.totalMessagesScanned).toBe(3);
    expect(result.newTransactions).toHaveLength(2);
    expect(result.totalDebitAmount).toBe(350);
    expect(result.totalCreditAmount).toBe(57973);
    expect(result.identifiedBanks).toContain('SBI');

    const debit = result.newTransactions.find((t) => t.type === 'expense');
    const credit = result.newTransactions.find((t) => t.type === 'income');
    expect(debit?.amount).toBe(350);
    expect(debit?.evidenceSource).toBe('sms');
    expect(credit?.amount).toBe(57973);
  });

  it('returns a friendly error for invalid JSON', () => {
    const result = parseClearSmsBackup('not json at all');
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeTruthy();
    expect(result.newTransactions).toHaveLength(0);
  });

  it('detects duplicates against an existing transaction list', () => {
    const json = backup([{ sender: 'VM-SBIUPI', body: DEBIT_SMS }]);
    const first = parseClearSmsBackup(json);

    const existing: Transaction[] = first.newTransactions.map((t) => ({
      ...t,
      paymentMode: t.paymentMode,
    }));

    const second = parseClearSmsBackup(json, existing);
    expect(second.success).toBe(true);
    expect(second.newTransactions).toHaveLength(0);
    expect(second.duplicatesSkipped).toBe(1);
  });

  it('handles a backup with zero messages gracefully', () => {
    const result = parseClearSmsBackup(backup([]));
    expect(result.success).toBe(true);
    expect(result.totalMessagesScanned).toBe(0);
    expect(result.newTransactions).toHaveLength(0);
  });
});