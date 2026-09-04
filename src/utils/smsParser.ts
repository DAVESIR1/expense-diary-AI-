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
  bankOrSource?: string;
  evidence: string;
  evidenceSource: 'sms' | 'notification';
  confidence: number;
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
  // Default from metadata timestamp if provided, else current date
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
    confidence: 0.95,
  };
}
