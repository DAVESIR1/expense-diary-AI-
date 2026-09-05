import { TransactionType, Category } from '../types';
import {
  isSpamOrNonTransaction,
  isReminderOrDueNotice,
  categorizeFinancialText,
  resolveBankFromSender,
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

  // Match: 07-Feb-23, 07/02/2023, 07-02-23, 07.02.2023
  const dateMatch = text.match(/\b(\d{1,2})[-/.]([a-z]{3}|\d{1,2})[-/.](\d{2,4})\b/i);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    let month = dateMatch[2].toLowerCase();
    if (MONTH_MAP[month]) {
      month = MONTH_MAP[month];
    } else {
      month = month.padStart(2, '0');
    }
    let year = dateMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    date = `${year}-${month}-${day}`;
  }

  // Match time: 15:35:06, 03:30 PM, 14:20
  const timeMatch = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : null;

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    time = `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  return { date, time };
}

export function extractBankOrSource(sender?: string, body?: string): string | undefined {
  // 1. Try ClearSMS Canonical Bank Directory first
  const canonical = resolveBankFromSender(sender, body);
  if (canonical) return canonical;

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

  // Payment channels & wallets
  if (cleanSender.includes('GPAY') || cleanBody.includes('GOOGLE PAY')) return 'Google Pay';
  if (cleanSender.includes('PHONEPE') || cleanBody.includes('PHONEPE')) return 'PhonePe';
  if (cleanSender.includes('CREDB') || cleanBody.includes('CRED')) return 'CRED';
  if (cleanSender.includes('AMAZON') || cleanBody.includes('AMAZON PAY')) return 'Amazon Pay';

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

  // In India, automated bank transactional SMS NEVER come from personal 10-digit mobile numbers
  if (options?.sender) {
    const rawSender = options.sender.replace(/[\s-]/g, '');
    if (/^(?:\+?91|0)?[6-9]\d{9}$/.test(rawSender)) {
      return null;
    }
  }

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Strict Spam, Promotional Ads, Loan Offers & OTP Filter (ClearSMS Guards)
  if (isSpamOrNonTransaction(clean)) {
    return null;
  }

  // 2. Strict Reminder, Bill Notice, Statement & Insurance Renewal Filter (ClearSMS Guards)
  if (isReminderOrDueNotice(clean)) {
    return null;
  }

  // 3. ClearSMS Balance & Credit Limit Exclusion (Prevents Avl Bal or Avl Lmt from becoming transaction amount)
  const excludedSpans: Array<[number, number]> = [];
  const balRegex = /(?:avl|avbl|avail(?:able)?)\.?\s*bal(?:ance)?\.?(?:\s+(?:in|for)\s+(?:your\s+)?a\/c\s*(?:no\.?)?\s*[Xx*]*\d+)?\s*(?:is|:|=)?\s*(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = balRegex.exec(clean)) !== null) {
    excludedSpans.push([bMatch.index, bMatch.index + bMatch[0].length]);
  }

  const limitRegex = /av(?:l|bl|ailable)?\.?\s*(?:credit\s+)?(?:lmt|limit)\s*:?\s*(?:is\s+)?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let lMatch: RegExpExecArray | null;
  while ((lMatch = limitRegex.exec(clean)) !== null) {
    excludedSpans.push([lMatch.index, lMatch.index + lMatch[0].length]);
  }

  // 4. Extract Amount outside excluded spans (ClearSMS approach)
  let amount = 0;

  // 4a. Currency Prefix Match (INR 6698, Rs. 500, ₹1,200) - Standard Indian banking format
  const prefixRegex = /(?:INR|Rs\.?|₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = prefixRegex.exec(clean)) !== null) {
    const matchIndex = pMatch.index;
    const isExcluded = excludedSpans.some(([start, end]) => matchIndex >= start && matchIndex <= end);
    if (!isExcluded) {
      const parsed = parseFloat(pMatch[1].replace(/,/g, ''));
      if (parsed > 0 && !isNaN(parsed)) {
        amount = parsed;
        break;
      }
    }
  }

  // 4b. Decimal Currency Suffix Match (e.g. 500.00 INR) if no prefix matched
  if (!amount || isNaN(amount) || amount <= 0) {
    const suffixRegex = /([\d,]+\.\d{1,2})\s*(?:INR|Rs\.?|₹)/gi;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = suffixRegex.exec(clean)) !== null) {
      const matchIndex = sMatch.index;
      const isExcluded = excludedSpans.some(([start, end]) => matchIndex >= start && matchIndex <= end);
      if (!isExcluded) {
        const parsed = parseFloat(sMatch[1].replace(/,/g, ''));
        if (parsed > 0 && !isNaN(parsed)) {
          amount = parsed;
          break;
        }
      }
    }
  }

  // 4c. Fallback to action keyword amount only if not followed by card or account
  if (!amount || isNaN(amount) || amount <= 0) {
    if (!/\b(?:spent|paid|debited|sent)\s+(?:on\s+)?card/i.test(clean) && !/\b(?:debited|credited)\s+from\s+a\/c/i.test(clean)) {
      const actionAmountMatch = clean.match(/(?:debited|credited|paid|spent|sent|received|transferred|withdrawn)\s+(?:by|for|of|with|sum of)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (actionAmountMatch && actionAmountMatch[1]) {
        amount = parseFloat(actionAmountMatch[1].replace(/,/g, ''));
      }
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

  // 5. Determine Flow Type (Debit / Credit) with Future-Tense lookbehind safety
  const debitKeywords = [
    /\bdebited\b/i,
    /\bpaid\b/i,
    /\bspent\b/i,
    /\bsent\b/i,
    /\btransferred\b/i,
    /\bpurchased?\b/i,
    /\bwithdrawn\b/i,
    /\bcharged\b/i,
    /\bdr\b/i,
    /\bupi\/dr\b/i,
  ];

  const creditKeywords = [
    /\bcredited\b/i,
    /\bhas\s+credit\s+(?:for|of|with)?\b/i,
    /\bcredit\s+(?:for|of)\b/i,
    /\bby\s+salary\b/i,
    /\bsalary\s+(?:credit(?:ed)?|deposit(?:ed)?)\b/i,
    /\bcredited\s+with\s+salary\b/i,
    /\bsalary-sbi\b/i,
    /\breceived\b/i,
    /\brefund(?:ed)?\b/i,
    /\bdeposited\b/i,
    /\bsalary credited\b/i,
    /\bcr\b/i,
    /\bmoney received\b/i,
    /\bupi\/cr\b/i,
  ];

  let rawType: TransactionType | null = null;
  let firstDebitIndex = -1;
  let firstCreditIndex = -1;

  for (const dk of debitKeywords) {
    const m = dk.exec(lower);
    if (m) {
      // Lookbehind 20 characters for future tense
      const pre = lower.substring(Math.max(0, m.index - 20), m.index);
      if (!/\b(?:will|shall|would)\s+be\s*$/i.test(pre) && !/\bis\s+scheduled\s+to\s+be\s*$/i.test(pre)) {
        if (firstDebitIndex === -1 || m.index < firstDebitIndex) {
          firstDebitIndex = m.index;
        }
      }
    }
  }

  for (const ck of creditKeywords) {
    const m = ck.exec(lower);
    if (m) {
      const pre = lower.substring(Math.max(0, m.index - 20), m.index);
      if (!/\b(?:will|shall|would)\s+be\s*$/i.test(pre) && !/\bis\s+scheduled\s+to\s+be\s*$/i.test(pre)) {
        if (firstCreditIndex === -1 || m.index < firstCreditIndex) {
          firstCreditIndex = m.index;
        }
      }
    }
  }

  if (firstDebitIndex !== -1 && firstCreditIndex !== -1) {
    rawType = firstDebitIndex <= firstCreditIndex ? 'expense' : 'income';
  } else if (firstDebitIndex !== -1) {
    rawType = 'expense';
  } else if (firstCreditIndex !== -1) {
    rawType = 'income';
  } else {
    // Check ClearSMS Verbless Debit Templates:
    // 1) Card-network template: "Txn Rs.X On Card XX at Merchant"
    const isCardTxnTemplate = /(?:^|\n)\s*txn\s+(?:INR|Rs\.?|₹)\s*[\d,]/i.test(clean) && /\bat\s+\S/i.test(clean);
    // 2) Biller confirmation: "Payment of Rs.X successful/done/completed"
    const isPaymentDone = /\bpayment\s+of\s+(?:INR|Rs\.?|₹)\s*[\d,]+[^\n]{0,80}?\b(?:successful|completed|done)\b/i.test(clean);
    if (isCardTxnTemplate || isPaymentDone) {
      rawType = 'expense';
    } else {
      return null;
    }
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
    return null;
  }

  // 6. Extract Payment Mode (UPI, Card, NetBanking, ATM)
  let paymentMode = 'Bank Transfer';
  if (/upi|gpay|phonepe|paytm|bhim|vpa/i.test(lower)) {
    paymentMode = 'UPI';
  } else if (/credit card|debit card|visa|mastercard|rupay|card ending|card no/i.test(lower)) {
    paymentMode = 'Card';
  } else if (/atm|cash/i.test(lower)) {
    paymentMode = 'ATM / Cash';
  } else if (/net banking|neft|rtgs|imps|fund transfer/i.test(lower)) {
    paymentMode = 'Bank Transfer';
  } else if (/salary|payroll|by salary/i.test(lower)) {
    paymentMode = 'Direct Transfer';
  }

  // 7. ClearSMS Smart Merchant Extraction & Normalization
  let vendorOrPerson = '';

  // 7a. Multi-line Card spend template (e.g. Axis Bank "Spent / Card no. XX9941 / INR 6698 / 13-02-23 / Flipkart In / Avl Lmt...")
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length >= 3 && lines.some(l => /^spent/i.test(l)) && lines.some(l => /card\s+no/i.test(l))) {
    const cand = lines.find(line => 
      !/^spent/i.test(line) &&
      !/card\s+no/i.test(line) &&
      !/^(?:INR|Rs\.?|₹)\s*[\d,]/i.test(line) &&
      !/^\d{1,2}[-/.]\d{1,2}/.test(line) &&
      !/^(?:avl|avbl|available|bal|limit|sms\s+block|call|dial)/i.test(line) &&
      /[a-zA-Z]/.test(line)
    );
    if (cand) {
      vendorOrPerson = cand.replace(/[.,:;-]+$/, '').trim();
    }
  }

  // 7b. Preposition match ("to [Merchant]", "at [Merchant]", "towards [Merchant]")
  if (!vendorOrPerson) {
    const prepMatches = clean.matchAll(/\b(?:to|at|towards)\s+([A-Za-z][A-Za-z0-9@._&*-]*(?:\s+[A-Za-z0-9@._&*-]+){0,3})/gi);
    for (const match of prepMatches) {
      let candidate = match[1].trim();
      if (/^(https?|www\.)/i.test(candidate)) continue;
      if (/^(the|a|an|your|ur|account|a\/c|bank|no)\b/i.test(candidate)) continue;
      if (/^(know|check|view|track|see|get|dispute|call|dial|sms)\b/i.test(candidate)) continue;
      if (/^\d+$/.test(candidate) || candidate.length > 25 || /\d{5,}/.test(candidate)) continue;
      candidate = candidate.replace(/^vpa\s+/i, '').trim();
      candidate = candidate.split(/\s+(?:on|via|using|from|by|ref|refno|txn|utr|avl|avbl|info|not\b|dt|is|was)\b/i)[0].trim();
      candidate = candidate.replace(/[.,:;-]+$/, '');
      if (candidate.length >= 2 && !/^\d+$/.test(candidate)) {
        if (candidate.includes('*')) {
          const parts = candidate.split('*');
          if (parts[1] && parts[1].trim().length > 1 && !/^(PEND|POS|ECOM|AUTH)$/i.test(parts[1].trim())) {
            candidate = parts[1].trim();
          } else if (parts[0] && parts[0].trim().length > 1) {
            candidate = parts[0].trim();
          }
        }
        vendorOrPerson = candidate;
        break;
      }
    }
  }

  // 7c. Info narration check (e.g. Info: IMPS/P2A/303915808095/NITINKUM/STATEBAN/)
  if (!vendorOrPerson) {
    const infoMatch = clean.match(/\bInfo\s*[-:.]\s*([^\n.]{2,80})/i);
    if (infoMatch && infoMatch[1]) {
      const parts = infoMatch[1].split(/[\/-]/).map(p => p.trim()).filter(p => p.length >= 3 && !/^\d+$/.test(p) && !/^(IMPS|NEFT|RTGS|UPI|P2A|P2P|MOB|XX+\d*|STATEBAN|AXISBAN|HDFCBAN|ICICIBAN)$/i.test(p));
      if (parts.length > 0) {
        vendorOrPerson = parts[0];
      }
    }
  }

  // 7d. Employer extraction for NEFT/Payroll/Salary credits (e.g. by DIST INST OF EDU AND TRAINING CENTER)
  if (!vendorOrPerson) {
    const byEmployerMatch = clean.match(/\bby\s+([A-Za-z][A-Za-z0-9\s&.-]{3,60}?)(?:,\s*INFO:|\.\s*INFO:|\s+with\s+UTR|\s+UTR|\.|$)/i);
    if (byEmployerMatch && byEmployerMatch[1]) {
      const emp = byEmployerMatch[1].trim();
      if (!/^(the|a|an|your|ur|cheque|cash|transfer|imps|neft|upi)\b/i.test(emp)) {
        vendorOrPerson = emp;
      }
    }
  }

  if (!vendorOrPerson && /\bby\s+salary\b/i.test(clean)) {
    vendorOrPerson = 'Salary (પગાર)';
  }

  // 8. Extract Reference / UTR Number
  let referenceNumber: string | undefined;
  const refMatch = clean.match(/(?:ref|utr|txn|rrn|txn id|ref no|upi ref|pran)[\s.:#]*([A-Za-z0-9]{6,22})/i);
  if (refMatch && refMatch[1] && /\d/.test(refMatch[1])) {
    referenceNumber = refMatch[1].toUpperCase();
  }

  // 9. Extract Account Information (e.g. A/c XX1234 or Card ending 5678)
  let accountInfo: string | undefined;
  const accMatch = clean.match(/(?:a\/c|a\\c|acct|account|card)\s*(?:no\.?|number)?\s*(?:ending\s*)?(?:in\s+|with\s+)?[Xx*]*(\d{3,6})(?!\d)/i);
  if (accMatch && accMatch[1]) {
    // If tail has 5-6 digits like 402807, take last 4 digits for clean display
    const tail = accMatch[1].length > 4 ? accMatch[1].slice(-4) : accMatch[1];
    accountInfo = `A/c *${tail}`;
  } else {
    const cardTailMatch = clean.match(/(?:card\s+no\.?\s*|ending\s+)[Xx*]*(\d{4})/i);
    if (cardTailMatch && cardTailMatch[1]) {
      accountInfo = `Card *${cardTailMatch[1]}`;
    }
  }

  // 10. Extract Source / Bank Name (Canonical from ClearSMS Brand Table)
  const bankOrSource = extractBankOrSource(options?.sender, clean);

  // 11. Categorization via Comprehensive Financial Knowledge Base
  const categoryResult = categorizeFinancialText(clean, options?.sender, type);
  let category = categoryResult.category;

  // Match with existing categories in app if provided
  if (categories.length > 0) {
    const exact = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
    if (exact) category = exact.name;
  }

  // 12. Descriptive Title
  let title = vendorOrPerson ? vendorOrPerson : type === 'income' ? 'Income Received' : 'Expense Payment';
  if (isNpsContribution) {
    title = 'NPS Contribution (રોકાણ)';
  } else if (category === 'Salary') {
    title = vendorOrPerson && vendorOrPerson !== 'Salary (પગાર)' ? `Salary: ${vendorOrPerson}` : 'Salary Credit (પગાર જમા)';
  } else if (category === 'Insurance') {
    title = vendorOrPerson ? `Insurance: ${vendorOrPerson}` : 'Insurance Premium (વીમો)';
  } else if (category === 'Transfer') {
    title = vendorOrPerson ? `UPI: ${vendorOrPerson}` : 'UPI Transfer';
  }

  // Extract transaction date and time from SMS text or metadata timestamp
  const { date, time } = extractDateAndTime(clean, options?.timestamp);

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
