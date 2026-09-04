import { TransactionType, Category } from '../types';

export interface ParsedExpenseMessage {
  type: TransactionType;
  amount: number;
  title: string;
  category: string;
  vendorOrPerson?: string;
  paymentMode: string;
  referenceNumber?: string;
  accountInfo?: string;
  date: string;
  time: string;
  evidence: string;
  evidenceSource: 'sms' | 'notification';
  confidence: number;
}

export function parseTransactionMessage(
  text: string,
  categories: Category[] = [],
  source: 'sms' | 'notification' = 'sms'
): ParsedExpenseMessage | null {
  if (!text || text.trim().length < 10) return null;

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Determine Type (Debit / Credit)
  const debitPatterns = [
    /debited/i,
    /debited with/i,
    /debited by/i,
    /paid rs/i,
    /paid inr/i,
    /spent/i,
    /sent to/i,
    /transferred to/i,
    /purchase of/i,
    /withdrawn/i,
    /charged/i,
    /\bdr\b/i,
    /payment of/i,
    /txn of/i,
  ];

  const creditPatterns = [
    /credited/i,
    /credited with/i,
    /credited by/i,
    /received from/i,
    /refund of/i,
    /deposited/i,
    /salary credited/i,
    /\bcr\b/i,
    /money received/i,
  ];

  let type: TransactionType | null = null;

  if (debitPatterns.some((p) => p.test(lower))) {
    type = 'expense';
  } else if (creditPatterns.some((p) => p.test(lower))) {
    type = 'income';
  }

  // If message doesn't indicate money flow, skip
  if (!type) return null;

  // 2. Extract Amount
  // Matches Rs. 500, Rs 500.00, INR 1,200.50, ₹450, $25.00, 500.00 INR
  const amountRegex = /(?:rs\.?|inr|₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr)/i;
  const matchAmount = clean.match(amountRegex);

  let amount = 0;
  if (matchAmount) {
    const rawAmt = matchAmount[1] || matchAmount[2];
    amount = parseFloat(rawAmt.replace(/,/g, ''));
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return null;
  }

  // 3. Extract Payment Mode (UPI, Card, NetBanking, ATM)
  let paymentMode = 'UPI';
  if (/upi|gpay|phonepe|paytm|bhim/i.test(lower)) {
    paymentMode = 'UPI';
  } else if (/card|credit card|debit card|visa|mastercard|rupay/i.test(lower)) {
    paymentMode = 'Card';
  } else if (/atm|cash/i.test(lower)) {
    paymentMode = 'ATM / Cash';
  } else if (/net banking|neft|rtgs|imps/i.test(lower)) {
    paymentMode = 'Bank Transfer';
  }

  // 4. Extract Merchant / Vendor / Recipient
  let vendorOrPerson = '';
  // Match "to [Merchant]", "at [Merchant]", "towards [Merchant]", "from [Sender]"
  const merchantMatch = clean.match(
    /(?:to|at|towards|info|vpa|from)\s+([A-Za-z0-9\s.&'-]{2,30}?)(?:\s+(?:on|ref|utr|via|bal|avl|avail|a\/c|dated|\.|\n)|$)/i
  );
  if (merchantMatch && merchantMatch[1]) {
    const candidate = merchantMatch[1].trim();
    if (!/^(the|a|an|account|your|bank|rs|inr)$/i.test(candidate)) {
      vendorOrPerson = candidate;
    }
  }

  // 5. Extract Reference / UTR Number
  let referenceNumber: string | undefined;
  const refMatch = clean.match(/(?:ref|utr|txn|rrn|txn id|ref no)[\s.:#]*([A-Za-z0-9]{6,16})/i);
  if (refMatch && refMatch[1]) {
    referenceNumber = refMatch[1];
  }

  // 6. Extract Account Information (e.g. A/c XX1234 or Card ending 5678)
  let accountInfo: string | undefined;
  const accMatch = clean.match(/(?:a\/c|account|card)[\s*xX-]*(\d{4})/i);
  if (accMatch && accMatch[1]) {
    accountInfo = `A/c *${accMatch[1]}`;
  }

  // 7. Title & Category Guessing
  const title = vendorOrPerson ? `${vendorOrPerson}` : type === 'income' ? 'Income Received' : 'Expense Payment';

  let category = type === 'income' ? 'Salary' : 'Shopping';
  const foodKeywords = ['swiggy', 'zomato', 'restaurant', 'cafe', 'mcdonald', 'domino', 'food', 'bakery', 'tea'];
  const groceryKeywords = ['blinkit', 'zepto', 'instamart', 'supermarket', 'grocery', 'mart', 'dmart', 'kirana'];
  const fuelKeywords = ['petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'cng', 'diesel'];
  const travelKeywords = ['uber', 'ola', 'rapido', 'irctc', 'flight', 'metro', 'bus'];
  const utilityKeywords = ['electricity', 'water', 'broadband', 'airtel', 'jio', 'recharge', 'bill'];

  if (foodKeywords.some((k) => lower.includes(k))) category = 'Food & Dining';
  else if (groceryKeywords.some((k) => lower.includes(k))) category = 'Groceries';
  else if (fuelKeywords.some((k) => lower.includes(k))) category = 'Fuel & Transport';
  else if (travelKeywords.some((k) => lower.includes(k))) category = 'Travel';
  else if (utilityKeywords.some((k) => lower.includes(k))) category = 'Bills & Utilities';

  // Match with existing categories if provided
  if (categories.length > 0) {
    const exact = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
    if (exact) category = exact.name;
  }

  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().substring(0, 5);

  return {
    type,
    amount,
    title,
    category,
    vendorOrPerson: vendorOrPerson || undefined,
    paymentMode,
    referenceNumber,
    accountInfo,
    date,
    time,
    evidence: clean,
    evidenceSource: source,
    confidence: 0.95,
  };
}
