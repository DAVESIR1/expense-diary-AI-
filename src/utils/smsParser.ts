import { TransactionType, Category } from '../types';
import {
  isSpamOrNonTransaction,
  isReminderOrDueNotice,
  categorizeFinancialText,
  INVESTMENT_PATTERNS
} from './financialKnowledgeBase';

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
  bankOrSource?: string;
  evidence: string;
  evidenceSource: 'sms' | 'notification';
  confidence: number;
  needsReview?: boolean;
}

export interface ParseOptions {
  timestamp?: number;
  sender?: string;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

export function extractDateAndTime(text: string, timestamp?: number): { date: string; time: string } {
  const fallbackDate = timestamp ? new Date(timestamp) : new Date();
  let date = fallbackDate.toISOString().split('T')[0];
  let time = fallbackDate.toTimeString().substring(0, 5);

  // 1. Check for named month: e.g. "04-Sep-2026", "4 Sep 26", "04-Sep-24", "dated 04Sep24"
  const namedMonthMatch = text.match(
    /(?:on|dated)?\s*(\d{1,2})[- ](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ](\d{2,4})/i
  );
  if (namedMonthMatch) {
    const day = namedMonthMatch[1].padStart(2, '0');
    const month = MONTH_MAP[namedMonthMatch[2].toLowerCase().substring(0, 3)];
    let year = namedMonthMatch[3];
    if (year.length === 2) year = `20${year}`;
    if (month) {
      date = `${year}-${month}-${day}`;
    }
  } else {
    // 2. Numeric date: e.g. "04/09/2026", "04-09-26", "04.09.2026"
    const numericDateMatch = text.match(
      /(?:on|dated)?\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/i
    );
    if (numericDateMatch) {
      const p1 = parseInt(numericDateMatch[1], 10);
      const p2 = parseInt(numericDateMatch[2], 10);
      let year = numericDateMatch[3];
      if (year.length === 2) year = `20${year}`;

      // In Indian banks, DD/MM/YYYY is standard format
      if (p1 <= 31 && p2 <= 12) {
        const day = String(p1).padStart(2, '0');
        const month = String(p2).padStart(2, '0');
        date = `${year}-${month}-${day}`;
      }
    }
  }

  // 3. Time extraction: e.g. "at 14:35", "14:35:10", "at 02:30 PM", "10:15am"
  const timeMatch = text.match(
    /(?:at|time)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const meridiem = timeMatch[4] ? timeMatch[4].toLowerCase() : null;

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    if (hours >= 0 && hours <= 23) {
      time = `${String(hours).padStart(2, '0')}:${minutes}`;
    }
  }

  return { date, time };
}

export function extractBankOrSource(sender?: string, body?: string): string | undefined {
  const cleanSender = (sender || '').toUpperCase();
  const cleanBody = (body || '').toUpperCase();

  // Government & Pension bodies
  if (cleanSender.includes('NPS') || cleanBody.includes('NPS') || cleanBody.includes('CRA-NSDL') || cleanBody.includes('PROTEAN')) return 'NPS (Protean CRA)';
  if (cleanSender.includes('ZERODH') || cleanBody.includes('ZERODHA')) return 'Zerodha';
  if (cleanSender.includes('GROWW') || cleanBody.includes('GROWW')) return 'Groww';
  if (cleanSender.includes('ANGEL') || cleanBody.includes('ANGEL ONE')) return 'Angel One';

  // Insurance companies
  if (cleanSender.includes('LIC') || cleanBody.includes('LIC OF INDIA') || cleanBody.includes('LICIND')) return 'LIC of India';
  if (cleanSender.includes('STARHL') || cleanBody.includes('STAR HEALTH')) return 'Star Health';
  if (cleanSender.includes('HDFCLI') || cleanBody.includes('HDFC LIFE')) return 'HDFC Life';
  if (cleanSender.includes('ICICIP') || cleanBody.includes('ICICI PRUDENTIAL')) return 'ICICI Prudential';
  if (cleanSender.includes('ICICIL') || cleanBody.includes('ICICI LOMBARD')) return 'ICICI Lombard';
  if (cleanSender.includes('SBILIF') || cleanBody.includes('SBI LIFE')) return 'SBI Life';
  if (cleanSender.includes('MAXLIF') || cleanBody.includes('MAX LIFE')) return 'Max Life';
  if (cleanSender.includes('POLBAZ') || cleanBody.includes('POLICYBAZAAR')) return 'PolicyBazaar';

  // Banks
  if (cleanSender.includes('HDFC') || cleanBody.includes('HDFC BANK')) return 'HDFC Bank';
  if (cleanSender.includes('SBI') || cleanBody.includes('STATE BANK OF INDIA') || cleanBody.includes('SBI')) return 'SBI';
  if (cleanSender.includes('ICICI') || cleanBody.includes('ICICI BANK')) return 'ICICI Bank';
  if (cleanSender.includes('AXIS') || cleanBody.includes('AXIS BANK')) return 'Axis Bank';
  if (cleanSender.includes('KOTAK') || cleanBody.includes('KOTAK MAHINDRA') || cleanBody.includes('KOTAK')) return 'Kotak Bank';
  if (cleanSender.includes('PNB') || cleanBody.includes('PUNJAB NATIONAL BANK')) return 'PNB';
  if (cleanSender.includes('BOB') || cleanSender.includes('BARODA') || cleanBody.includes('BANK OF BARODA')) return 'Bank of Baroda';
  if (cleanSender.includes('CANARA') || cleanSender.includes('CANBNK')) return 'Canara Bank';
  if (cleanSender.includes('UNION') || cleanSender.includes('UBIN')) return 'Union Bank';
  if (cleanSender.includes('INDUS') || cleanBody.includes('INDUSIND')) return 'IndusInd Bank';
  if (cleanSender.includes('PAYTM') || cleanBody.includes('PAYTM PAYMENTS BANK')) return 'Paytm Bank';
  if (cleanSender.includes('AIRTEL') || cleanBody.includes('AIRTEL PAYMENTS BANK')) return 'Airtel Payments Bank';
  if (cleanSender.includes('GPAY') || cleanBody.includes('GOOGLE PAY')) return 'Google Pay';
  if (cleanSender.includes('PHONEPE') || cleanBody.includes('PHONEPE')) return 'PhonePe';
  if (cleanSender.includes('CREDB') || cleanBody.includes('CRED')) return 'CRED';
  if (cleanSender.includes('AMAZON') || cleanBody.includes('AMAZON PAY')) return 'Amazon Pay';

  // If sender has standard Indian alpha code like "VM-IDFCFB", extract IDFCFB
  const parts = cleanSender.split('-');
  if (parts.length > 1 && parts[1].length >= 3) {
    return parts[1];
  }

  return undefined;
}

export function parseTransactionMessage(
  text: string,
  categories: Category[] = [],
  source: 'sms' | 'notification' = 'sms',
  options?: ParseOptions
): ParsedExpenseMessage | null {
  if (!text || text.trim().length < 8) return null;

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Strict Spam, Promotional Ads & OTP Filter
  if (isSpamOrNonTransaction(clean)) {
    return null;
  }

  // 2. Strict Reminder, Bill Notice, Recharge & Insurance Renewal Filter (CRITICAL)
  // Insurance renewals, bill statements, and recharge reminders must NEVER be added as expenses!
  if (isReminderOrDueNotice(clean)) {
    return null;
  }

  // 3. Extract Amount
  // Supports:
  // a) Currency prefix/suffix: Rs. 500, Rs 500.00, INR 1,200.50, ₹450, 500.00 INR
  // b) Action keyword: "debited by 250.0", "credited by 500", "paid 150 to" (No adjacent currency)
  let amount = 0;

  const currencyAmountMatch = clean.match(/(?:rs\.?|inr|₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr)/i);
  if (currencyAmountMatch) {
    const rawAmt = currencyAmountMatch[1] || currencyAmountMatch[2];
    amount = parseFloat(rawAmt.replace(/,/g, ''));
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    const actionAmountMatch = clean.match(/(?:debited|credited|paid|spent|sent|received|transferred|withdrawn)\s+(?:by|for|of|with|sum of)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (actionAmountMatch && actionAmountMatch[1]) {
      amount = parseFloat(actionAmountMatch[1].replace(/,/g, ''));
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    const txnAmountMatch = clean.match(/(?:txn of|txn)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (txnAmountMatch && txnAmountMatch[1]) {
      amount = parseFloat(txnAmountMatch[1].replace(/,/g, ''));
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return null;
  }

  // 4. Determine Flow Type (Debit / Credit)
  const debitPatterns = [
    /\bdebited\b/i,
    /\bpaid\b/i,
    /\bspent\b/i,
    /\bsent\b/i,
    /\btransferred\b/i,
    /\bpurchase\b/i,
    /\bwithdrawn\b/i,
    /\bcharged\b/i,
    /\bdr\b/i,
    /\bpayment\b/i,
    /\btxn\b/i,
    /\bupi\/dr\b/i,
  ];

  const creditPatterns = [
    /\bcredited\b/i,
    /\breceived\b/i,
    /\brefund\b/i,
    /\bdeposited\b/i,
    /\bsalary credited\b/i,
    /\bcr\b/i,
    /\bmoney received\b/i,
    /\bupi\/cr\b/i,
  ];

  let rawType: TransactionType | null = null;
  if (debitPatterns.some((p) => p.test(lower))) {
    rawType = 'expense';
  } else if (creditPatterns.some((p) => p.test(lower))) {
    rawType = 'income';
  }

  // Special NPS & Investment Handling (Requirement 3 & 4):
  // When NPS credits contribution to PRAN account, it is an INVESTMENT OUTFLOW from the user's view, NOT income!
  const isNpsContribution = INVESTMENT_PATTERNS.nps.some((p) => p.test(lower)) && !lower.includes('redemption');
  const isSipContribution = INVESTMENT_PATTERNS.mutualFunds.some((p) => p.test(lower)) && !lower.includes('redemption') && !lower.includes('dividend');

  let type: TransactionType;
  if (isNpsContribution || isSipContribution) {
    type = 'expense'; // Investment outflow
  } else if (rawType) {
    type = rawType;
  } else {
    // If neither debit nor credit pattern matched, skip
    return null;
  }

  // 5. Extract Payment Mode (UPI, Card, NetBanking, ATM)
  let paymentMode = 'UPI';
  if (/upi|gpay|phonepe|paytm|bhim|vpa/i.test(lower)) {
    paymentMode = 'UPI';
  } else if (/credit card|debit card|visa|mastercard|rupay|card ending/i.test(lower)) {
    paymentMode = 'Card';
  } else if (/atm|cash/i.test(lower)) {
    paymentMode = 'ATM / Cash';
  } else if (/net banking|neft|rtgs|imps|fund transfer/i.test(lower)) {
    paymentMode = 'Bank Transfer';
  }

  // 6. Extract Merchant / Vendor / Recipient
  let vendorOrPerson = '';
  // Match "to [Merchant]", "at [Merchant]", "towards [Merchant]", "from [Sender]"
  const merchantMatch = clean.match(
    /(?:to|at|towards|info|vpa|from)\s+([A-Za-z0-9\s.&'-]{2,30}?)(?:\s+(?:on|ref|utr|via|bal|avl|avail|a\/c|dated|\.|\n)|$)/i
  );
  if (merchantMatch && merchantMatch[1]) {
    const candidate = merchantMatch[1].trim();
    if (!/^(the|a|an|account|your|bank|rs|inr|pran)$/i.test(candidate)) {
      vendorOrPerson = candidate;
    }
  }

  // 7. Extract Reference / UTR Number
  let referenceNumber: string | undefined;
  const refMatch = clean.match(/(?:ref|utr|txn|rrn|txn id|ref no|pran)[\s.:#]*([A-Za-z0-9]{6,16})/i);
  if (refMatch && refMatch[1]) {
    referenceNumber = refMatch[1];
  }

  // 8. Extract Account Information (e.g. A/c XX1234 or Card ending 5678)
  let accountInfo: string | undefined;
  const accMatch = clean.match(/(?:a\/c|account|card)[\s*xX-]*(\d{4})/i);
  if (accMatch && accMatch[1]) {
    accountInfo = `A/c *${accMatch[1]}`;
  }

  // 9. Categorization via Comprehensive Financial Knowledge Base
  const categoryResult = categorizeFinancialText(clean, options?.sender, type);
  let category = categoryResult.category;

  // Match with existing categories in app if provided
  if (categories.length > 0) {
    const exact = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
    if (exact) category = exact.name;
  }

  // 10. Descriptive Title
  let title = vendorOrPerson ? vendorOrPerson : type === 'income' ? 'Income Received' : 'Expense Payment';
  if (isNpsContribution) {
    title = 'NPS Contribution (રોકાણ)';
  } else if (category === 'Insurance') {
    title = vendorOrPerson ? `Insurance: ${vendorOrPerson}` : 'Insurance Premium (વીમો)';
  } else if (category === 'Transfer') {
    title = vendorOrPerson ? `UPI: ${vendorOrPerson}` : 'UPI Transfer';
  }

  // Extract transaction date and time from SMS text or metadata timestamp
  const { date, time } = extractDateAndTime(clean, options?.timestamp);

  // Extract source / bank name from sender code or message body
  const bankOrSource = extractBankOrSource(options?.sender, clean);

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
    bankOrSource,
    evidence: clean,
    evidenceSource: source,
    confidence: categoryResult.confidence,
    needsReview: categoryResult.needsReview || categoryResult.confidence < 0.85,
  };
}

/**
 * Parse an array of multiple messages (threads) and return unique valid transactions.
 */
export function parseMultipleMessages(
  messages: Array<{ body: string; address?: string; timestamp?: number }>,
  categories: Category[] = [],
  source: 'sms' | 'notification' = 'sms'
): ParsedExpenseMessage[] {
  const results: ParsedExpenseMessage[] = [];
  const seenHashes = new Set<string>();

  for (const msg of messages) {
    if (!msg.body) continue;
    const parsed = parseTransactionMessage(msg.body, categories, source, {
      sender: msg.address,
      timestamp: msg.timestamp,
    });

    if (parsed) {
      // Deduplicate by amount + date + approximate time or reference
      const hash = parsed.referenceNumber 
        ? `${parsed.amount}_${parsed.referenceNumber}`
        : `${parsed.amount}_${parsed.date}_${parsed.title}`;

      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        results.push(parsed);
      }
    }
  }

  return results;
}
