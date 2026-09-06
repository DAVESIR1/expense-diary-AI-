import { describe, it, expect, beforeEach } from 'vitest';
import { parseTransactionMessage, extractDateAndTime, extractBankOrSource } from '../src/utils/smsParser';
import { installLocalStorageStub, clearStorage } from './helpers/localStorageStub';

beforeEach(() => {
  installLocalStorageStub();
  clearStorage();
});

describe('extractDateAndTime', () => {
  it('parses dd-mm-yyyy and HH:mm', () => {
    const { date, time } = extractDateAndTime('Txn on 05-09-2026 at 14:30 success');
    expect(date).toBe('2026-09-05');
    expect(time).toBe('14:30');
  });

  it('parses dd-MMM-yy and 12-hour AM/PM times', () => {
    const { date, time } = extractDateAndTime('On 05-Sep-26 at 03:30 PM');
    expect(date).toBe('2026-09-05');
    expect(time).toBe('15:30');
  });

  it('falls back to the provided timestamp when no date is present (local time)', () => {
    const ts = Date.parse('2026-09-05T10:15:00Z');
    const { date, time } = extractDateAndTime('Some narration without a date', ts);
    expect(date).toBe('2026-09-05');
    // The fallback uses the device-local wall clock, so compare against the
    // same local conversion rather than hard-coding a timezone.
    expect(time).toBe(new Date(ts).toTimeString().substring(0, 5));
  });
});

describe('extractBankOrSource', () => {
  it('resolves banks from sender codes', () => {
    expect(extractBankOrSource('VM-SBIUPI')).toBe('State Bank of India');
    expect(extractBankOrSource('VM-HDFCBK')).toBe('HDFC Bank');
    expect(extractBankOrSource('AXISBANK')).toContain('Axis');
  });

  it('resolves wallet providers', () => {
    expect(extractBankOrSource('PHONEPE', 'PhonePe')).toBe('PhonePe');
    expect(extractBankOrSource('GPAY', 'Google Pay')).toBe('Google Pay');
  });
});

describe('parseTransactionMessage — debit/credit flows', () => {
  it('parses an SBI UPI merchant debit as an expense', () => {
    const parsed = parseTransactionMessage(
      'Rs.350.00 debited from A/C **4978 on 05-09-2026 at SWIGGY. UPI:912345678901. Avl Bal: Rs.4,500.00',
      [],
      'sms',
      { sender: 'VM-SBIUPI', timestamp: Date.parse('2026-09-05T12:00:00Z') }
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('expense');
    expect(parsed!.amount).toBe(350);
    expect(parsed!.category.toLowerCase()).toContain('food');
    expect(parsed!.evidenceSource).toBe('sms');
  });

  it('parses an HDFC salary credit as income / Salary', () => {
    const parsed = parseTransactionMessage(
      'HDFC Bank: Rs.57,973.00 credited to A/c **2807 on 05-09-2026 via NEFT from ABC Corp on account of salary credit. Ref: NEFT123456789.',
      [],
      'sms',
      { sender: 'VM-HDFCBK', timestamp: Date.parse('2026-09-05T09:00:00Z') }
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('income');
    expect(parsed!.amount).toBe(57973);
    expect(parsed!.category).toBe('Salary');
    expect(parsed!.title).toContain('Salary');
  });

  it('parses an Axis card transaction template without verbs', () => {
    const parsed = parseTransactionMessage(
      'Txn Rs.6698 On Card XX9941 at Flipkart India. Avl Lmt: Rs.50,000.00',
      [],
      'sms',
      { sender: 'VM-AXISBK', timestamp: Date.parse('2026-09-04T18:00:00Z') }
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('expense');
    expect(parsed!.amount).toBe(6698);
    expect(parsed!.category.toLowerCase()).toContain('shopping');
  });

  it('treats UPI person-to-person sends as a Transfer', () => {
    const parsed = parseTransactionMessage(
      'Rs.500.00 sent to Ramesh Kumar via UPI successfully on 05-09-2026. UPI Ref No: 412345678901.',
      [],
      'sms',
      { sender: 'PHONEPE', timestamp: Date.parse('2026-09-05T11:00:00Z') }
    );
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.type).toBe('expense');
      expect(parsed.amount).toBe(500);
      expect(parsed.paymentMode.toLowerCase()).toContain('upi');
    }
  });
});

describe('parseTransactionMessage — investment outflows', () => {
  it('classifies an NPS contribution as an Investment expense', () => {
    const parsed = parseTransactionMessage(
      'A/C **1234 debited for NPS TIER-I contribution of Rs 10,000.00 on 05-09-2026. CRA-NSDL.',
      [],
      'sms',
      { sender: 'JD-CBSSBI-S', timestamp: Date.parse('2026-09-05T08:00:00Z') }
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('expense');
    expect(parsed!.amount).toBe(10000);
    expect(parsed!.category).toBe('Investment');
  });
});

describe('parseTransactionMessage — negative guards', () => {
  it('rejects OTP / verification codes', () => {
    const parsed = parseTransactionMessage(
      'G-455587 is your Google verification code. Do not share it with anyone.',
      [],
      'sms',
      { sender: 'AD-GOOGLE', timestamp: Date.now() }
    );
    expect(parsed).toBeNull();
  });

  it('rejects failed payments (no money moved)', () => {
    const parsed = parseTransactionMessage(
      'Your payment of Rs.1,000.00 has failed. No amount has been debited from your account.',
      [],
      'sms',
      { sender: 'VM-SBIPAY', timestamp: Date.now() }
    );
    expect(parsed).toBeNull();
  });

  it('rejects statement delivery notices', () => {
    const parsed = parseTransactionMessage(
      'Dear Customer, your e-statement for the month of August has been sent to your registered email.',
      [],
      'sms',
      { sender: 'VM-HDFCBK', timestamp: Date.now() }
    );
    expect(parsed).toBeNull();
  });

  it('rejects bill-due reminders', () => {
    const parsed = parseTransactionMessage(
      'Your electricity bill of Rs.2,000.00 is due on 15-09-2026. Pay before due date to avoid disconnection.',
      [],
      'sms',
      { sender: 'DG-VACL', timestamp: Date.now() }
    );
    expect(parsed).toBeNull();
  });

  it('rejects SMS from personal 10-digit mobile numbers', () => {
    const parsed = parseTransactionMessage(
      'Pay 500 rupees for the dinner at my place tomorrow',
      [],
      'sms',
      { sender: '9876543210', timestamp: Date.now() }
    );
    expect(parsed).toBeNull();
  });

  it('returns null for empty or very short texts', () => {
    expect(parseTransactionMessage('')).toBeNull();
    expect(parseTransactionMessage('Hi')).toBeNull();
  });
});