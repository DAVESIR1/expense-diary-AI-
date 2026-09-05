import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryRuleEngine } from '../src/services/categoryRuleEngine';
import { parseFinancialEmail } from '../src/utils/emailParser';
import type { Transaction } from '../src/types';
import { installLocalStorageStub, clearStorage } from './helpers/localStorageStub';

beforeEach(() => {
  installLocalStorageStub();
  clearStorage();
});

describe('CategoryRuleEngine built-in rules', () => {
  it('categorizes Swiggy as Food & Dining', () => {
    const match = CategoryRuleEngine.evaluate('HDFC-Bank', 'Paid Rs. 350 to Swiggy on 05-09-2026');
    expect(match?.category).toBe('Food & Dining');
  });

  it('categorizes Amazon Pay as Shopping', () => {
    const match = CategoryRuleEngine.evaluate('SBI-UPI', 'Sent Rs. 1499 to Amazon Pay India on 05-09-2026');
    expect(match?.category).toBe('Shopping');
  });

  it('categorizes NPS contribution as Investment', () => {
    const match = CategoryRuleEngine.evaluate('JD-CBSSBI-S', 'A/C 1234 debited for NPS TIER-I contribution of Rs 10000.00');
    expect(match?.category).toBe('Investment');
  });
});

describe('CategoryRuleEngine dynamic learning & recategorization', () => {
  it('learns a user rule and recategorizes matching past transactions', () => {
    const sampleTransactions: Transaction[] = [
      {
        id: 'tx-1',
        title: 'Payment to Chai Tapri',
        amount: 50,
        category: 'Other',
        type: 'expense',
        date: '2026-09-01',
        time: '10:30',
        paymentMode: 'UPI',
        vendorOrPerson: 'Chai Tapri',
      },
      {
        id: 'tx-2',
        title: 'Payment to Chai Tapri',
        amount: 80,
        category: 'Other',
        type: 'expense',
        date: '2026-09-02',
        time: '16:45',
        paymentMode: 'UPI',
        vendorOrPerson: 'Chai Tapri',
      },
      {
        id: 'tx-3',
        title: 'Uber ride',
        amount: 190,
        category: 'Travel & Fuel',
        type: 'expense',
        date: '2026-09-03',
        time: '08:15',
        paymentMode: 'UPI',
        vendorOrPerson: 'Uber',
      },
    ];

    const rule = CategoryRuleEngine.learnCategoryRule('Chai Tapri', 'Food & Dining');
    expect(rule.action.category).toBe('Food & Dining');

    const { updatedTransactions, updatedCount } =
      CategoryRuleEngine.recategorizePastTransactions(sampleTransactions, rule);

    expect(updatedCount).toBe(2);
    expect(updatedTransactions[0].category).toBe('Food & Dining');
    expect(updatedTransactions[1].category).toBe('Food & Dining');
    expect(updatedTransactions[2].category).toBe('Travel & Fuel');
  });
});

describe('parseFinancialEmail', () => {
  it('extracts Protean/CRA-NSDL NPS contribution email', () => {
    const parsed = parseFinancialEmail(
      'Receipt for Contribution under National Pension System (NPS)',
      'Dear Subscriber,\nWe acknowledge receipt of your contribution of Rs. 50,000.00 under PRAN 110022334455.\nAcknowledgement No: ACK987654321\nDate of Transaction: 02/09/2026\nRegards,\nProtean eGov Technologies Limited\nCRA for National Pension System',
      'cra@proteantech.in',
      Date.now()
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(50000);
    expect(parsed!.category).toBe('Investment');
    expect(parsed!.type).toBe('expense');
  });

  it('extracts salary credit advice as income', () => {
    const parsed = parseFinancialEmail(
      'Salary Slip / Credit Advice for Month of August 2026',
      'Dear Employee,\nYour salary for the month of August 2026 has been processed.\nNet Salary Amount: Rs. 57,973.00\nAccount Credited: A/C ending in 2807 (State Bank of India)\nTransaction Ref / UTR: SBIN8899771122\n',
      'payroll@company.org',
      Date.now()
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(57973);
    expect(parsed!.type).toBe('income');
    expect(parsed!.category).toBe('Salary');
  });

  it('rejects newsletters / OTP emails', () => {
    const parsed = parseFinancialEmail(
      'Your verification code is 123456',
      'Use code 123456 to verify your email. Do not share it.',
      'no-reply@example.com',
      Date.now()
    );
    expect(parsed).toBeNull();
  });
});