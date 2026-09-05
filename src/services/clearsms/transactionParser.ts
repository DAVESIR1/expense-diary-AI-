/**
 * ClearSMS Transaction Parser ported to TypeScript
 * 
 * Extracts verified debit/credit transactions with mathematical precision:
 * - Negative guards: rejects failed payments, payment requests, bill notices
 * - Strips state: excludes available limits and balances from spend amount
 * - Foreign currency support (USD, EUR, GBP, etc.)
 * - Merchant candidate cleaning and normalization
 * - Guaranteed plausible issuer enforcement
 */

import { GuardLibrary } from './guards';
import { SenderNameResolver } from './senderResolver';
import { OtpParser } from './otpParser';
import merchantCategoriesData from './merchant_categories.json';

export interface ParsedTransactionResult {
  amount: number;
  type: 'debit' | 'credit';
  merchantName?: string;
  accountLast4?: string;
  bankName?: string;
  balance?: number;
  availableLimit?: number;
  referenceNumber?: string;
  category: string;
  accountType: 'SAVINGS' | 'CREDIT_CARD' | 'WALLET';
  foreignCurrency?: string;
}

// Regex definitions identical to ClearSMS TransactionParser.kt
const AMOUNT_REGEX = /(?:INR|Rs\.?|\u20b9)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const FOREIGN_AMOUNT_REGEX = /\b(?:spent|paid|debited)\s+(USD|EUR|GBP|AED|SGD|AUD|CAD|CHF|JPY|NZD|HKD)\s*([\d,]+(?:\.\d{1,2})?)/i;
const AVAILABLE_LIMIT_REGEX = /av(?:l|bl|ailable)?\.?\s*(?:credit\s+)?(?:lmt|limit)\s*:?\s*(?:is\s+)?(?:INR|Rs\.?|\u20b9)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const BALANCE_REGEX = /(?:avl|avbl|avail(?:able)?)\.?\s*bal(?:ance)?\.?(?:\s+(?:in|for)\s+(?:your\s+)?a\/c\s*(?:no\.?)?\s*[Xx*]*\d+)?\s*(?:is|:|=)?\s*(?:INR|Rs\.?|\u20b9)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const REFERENCE_REGEX = /\bref(?:erence)?\s*(?:no|num|number|id)?\.?\s*[:.]?\s*((?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,22})|\b(?:txn|utr|upi)\s*(?:id|no|ref)?\.?\s*[:.]?\s*((?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,22})/i;
const DEBIT_KEYWORDS = /\b(?:debited|spent|paid|withdrawn|deducted|purchase(?:d)?|sent)\b/gi;
const CREDIT_KEYWORDS = /\b(?:credited|received|deposited|refund(?:ed)?)\b/gi;
const FUTURE_TENSE = /\b(?:will|shall|would)\s+be\s*$/i;

const ACCOUNT_REGEX = /(?:a\/c|a\\c|acct|account|card)\s*(?:no\.?|number)?\s*(?:ending\s*)?(?:in\s+|with\s+)?[Xx*]*(\d{3,4})(?!\d)/i;
const GROUPED_CARD_REGEX = /(?<!\d)\d{4}[- ][\dXx*]{2,4}[- ][\dXx*]{2,4}[- ][Xx*]*(\d{4})(?!\d)/;
const BANK_MASKED_REGEX = /\bbank\s+[Xx*]{2,}(\d{3,4})(?!\d)/i;

const MERCHANT_REGEX = /\b(?:to|at|towards)\s+((?:[A-Za-z][A-Za-z0-9@._&'*-]*)(?:\s+[A-Za-z0-9@._&'*-]+){0,3})/gi;
const URL_START_REGEX = /^(?:https?|www\.)/i;
const MERCHANT_STOP_REGEX = /\s+(?:on|via|using|from|by|ref|refno|txn|utr|avl|avbl|info|not\b|dt|is|was)\b.*/i;
const NON_MERCHANT_START_REGEX = /^(?:your|ur|the|a\/c|ac\b|acct|account|bank|no\b)/i;
const PRECEDING_URL_REGEX = /(?:https?:\/\/\S+|www\.\S+|\b[a-z0-9][a-z0-9.-]*\.[a-z]{2,6}\/\S*)\s*$/i;

const INFO_REGEX = /\bInfo\s*[:.]\s*([^.\n]{2,80})/i;
const LEADING_REFERENCE_REGEX = /^[Xx*]*\d+\s*-\s*/;
const TRAILING_MONTH_YEAR_REGEX = /[-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]{0,6}\.?\s*\d{2,4}\s*$/i;
const LONG_DIGIT_RUN_REGEX = /\d{5,}/;

const CREDIT_CARD_REGEX = /credit\s*card|\bcard\s+(?:no\.?|number|ending|[Xx*]*\d{3,4})/i;
const WALLET_REGEX = /\bwallet\b/i;
const WALLET_SOURCE_REGEX = /\bfrom\b[^.\n]{0,40}?\bwallet\b|\bwallet\s+linked\b/i;

const CARD_TXN_HEADER_REGEX = /(?:^|\n)\s*txn\s+(?:INR|Rs\.?|\u20b9)\s*[\d,]/i;
const TXN_AT_MERCHANT_REGEX = /\bat\s+\S/i;
const PAYMENT_DONE_REGEX = /\bpayment\s+of\s+(?:INR|Rs\.?|\u20b9)\s*[\d,]+(?:\.\d{1,2})?[^.\n]{0,80}?\b(?:successful|completed|done)\b/i;

interface CategoryRule {
  pattern: string;
  category: string;
  regex: RegExp;
}

const CATEGORY_RULES: CategoryRule[] = (merchantCategoriesData.categories || []).map((c: any) => {
  let pat = c.pattern;
  let flags = 'i';
  if (pat.startsWith('(?i)')) {
    pat = pat.substring(4);
  }
  return {
    pattern: c.pattern,
    category: c.category,
    regex: new RegExp(pat, flags),
  };
});

function toAmount(str?: string): number | undefined {
  if (!str) return undefined;
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? undefined : num;
}

export const TransactionParser = {
  /**
   * Main entry point parsing raw SMS into verified transaction
   */
  parse(sender: string, body: string): ParsedTransactionResult | null {
    // 1. Negative Guards
    if (GuardLibrary.isFailedPayment(body)) return null;
    if (GuardLibrary.isPaymentRequestNotice(body)) return null;
    if (GuardLibrary.isPayoutInFlight(body)) return null;

    // 2. Scrub statement notices and hypothetical rates
    const effectiveBody = GuardLibrary.scrub(
      'hypothetical_amount',
      GuardLibrary.scrub('statement_notice', body)
    );

    if (GuardLibrary.isBillDueNotice(effectiveBody)) return null;

    // 3. Anchored OTP Invariant
    if (OtpParser.parseAnchored(effectiveBody)) {
      return null;
    }

    // 4. Detect Transaction Type
    const type = this.detectType(effectiveBody);
    if (!type) return null;

    // 5. Extract Balance and Available Limit
    BALANCE_REGEX.lastIndex = 0;
    const balanceMatch = BALANCE_REGEX.exec(effectiveBody);
    const balance = balanceMatch ? toAmount(balanceMatch[1]) : undefined;
    const balanceRange = balanceMatch
      ? { start: balanceMatch.index, end: balanceMatch.index + balanceMatch[0].length }
      : null;

    AVAILABLE_LIMIT_REGEX.lastIndex = 0;
    const limitRanges: { start: number; end: number }[] = [];
    let limitMatch: RegExpExecArray | null;
    let availableLimit: number | undefined;

    while ((limitMatch = AVAILABLE_LIMIT_REGEX.exec(effectiveBody)) !== null) {
      if (availableLimit === undefined) {
        availableLimit = toAmount(limitMatch[1]);
      }
      limitRanges.push({
        start: limitMatch.index,
        end: limitMatch.index + limitMatch[0].length,
      });
    }

    const excludedRanges = [...(balanceRange ? [balanceRange] : []), ...limitRanges];

    // 6. Domestic Amount (strictly excluding balance and limit spans)
    AMOUNT_REGEX.lastIndex = 0;
    let domesticAmount: number | undefined;
    let amountMatch: RegExpExecArray | null;

    while ((amountMatch = AMOUNT_REGEX.exec(effectiveBody)) !== null) {
      const matchStart = amountMatch.index;
      const isInsideExcluded = excludedRanges.some(
        (r) => matchStart >= r.start && matchStart < r.end
      );
      if (!isInsideExcluded) {
        domesticAmount = toAmount(amountMatch[1]);
        break;
      }
    }

    let foreignCurrency: string | undefined;
    let amount = domesticAmount;

    if (!amount) {
      const foreignMatch = FOREIGN_AMOUNT_REGEX.exec(effectiveBody);
      if (foreignMatch) {
        foreignCurrency = foreignMatch[1].toUpperCase();
        amount = toAmount(foreignMatch[2]);
      }
    }

    if (!amount) return null;

    // 7. Merchant & Bank Resolution
    const merchant = this.extractMerchant(effectiveBody);
    const resolvedBank = SenderNameResolver.bankNameFor(sender, body);
    const bankIsIssuer = resolvedBank ? SenderNameResolver.isPlausibleIssuer(resolvedBank, body) : false;
    const title = merchant || (resolvedBank && !bankIsIssuer ? resolvedBank : undefined);

    // 8. Account Last 4 & Reference
    const accountLast4 = this.extractAccountLast4(effectiveBody);
    REFERENCE_REGEX.lastIndex = 0;
    const refMatch = REFERENCE_REGEX.exec(effectiveBody);
    const referenceNumber = refMatch ? refMatch[1] || refMatch[2] : undefined;

    // 9. Account Type & Category
    const accountType = this.detectAccountType(effectiveBody);
    const category = this.categorize(title, effectiveBody);

    return {
      amount,
      type,
      merchantName: title,
      accountLast4,
      bankName: bankIsIssuer ? resolvedBank || undefined : undefined,
      balance,
      availableLimit,
      referenceNumber,
      category,
      accountType,
      foreignCurrency,
    };
  },

  detectType(body: string): 'debit' | 'credit' | null {
    const debitAt = this.firstCompletedMatch(body, DEBIT_KEYWORDS);
    const creditAt = this.firstCompletedMatch(body, CREDIT_KEYWORDS);

    if (debitAt === null && creditAt === null) {
      return this.verblessDebit(body);
    }
    if (debitAt === null) return 'credit';
    if (creditAt === null) return 'debit';
    return debitAt <= creditAt ? 'debit' : 'credit';
  },

  verblessDebit(body: string): 'debit' | null {
    if (
      CARD_TXN_HEADER_REGEX.test(body) &&
      CREDIT_CARD_REGEX.test(body) &&
      TXN_AT_MERCHANT_REGEX.test(body)
    ) {
      return 'debit';
    }
    if (PAYMENT_DONE_REGEX.test(body)) {
      return 'debit';
    }
    return null;
  },

  firstCompletedMatch(body: string, keywords: RegExp): number | null {
    keywords.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = keywords.exec(body)) !== null) {
      const start = Math.max(0, match.index - 20);
      const preceding = body.substring(start, match.index);
      if (!FUTURE_TENSE.test(preceding)) {
        return match.index;
      }
    }
    return null;
  },

  detectAccountType(body: string): 'SAVINGS' | 'CREDIT_CARD' | 'WALLET' {
    if (WALLET_SOURCE_REGEX.test(body)) return 'WALLET';
    if (CREDIT_CARD_REGEX.test(body)) return 'CREDIT_CARD';
    if (WALLET_REGEX.test(body)) return 'WALLET';
    return 'SAVINGS';
  },

  extractAccountLast4(body: string): string | undefined {
    const grouped = GROUPED_CARD_REGEX.exec(body);
    if (grouped && grouped[1]) return grouped[1];

    const acct = ACCOUNT_REGEX.exec(body);
    if (acct && acct[1]) return acct[1];

    const bankMasked = BANK_MASKED_REGEX.exec(body);
    if (bankMasked && bankMasked[1]) return bankMasked[1];

    return undefined;
  },

  extractMerchant(body: string): string | undefined {
    MERCHANT_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MERCHANT_REGEX.exec(body)) !== null) {
      let candidate = match[1].trim();

      if (URL_START_REGEX.test(candidate)) continue;

      const preceding = body.substring(Math.max(0, match.index - 80), match.index);
      if (PRECEDING_URL_REGEX.test(preceding)) continue;
      if (GuardLibrary.matches('instruction_start', candidate)) continue;

      candidate = candidate.replace(/^VPA\s+/i, '').trim();
      candidate = candidate.split(MERCHANT_STOP_REGEX)[0].trim().replace(/[.,:;-]+$/, '');

      if (!candidate || NON_MERCHANT_START_REGEX.test(candidate)) continue;

      return candidate;
    }

    return this.infoDescriptor(body);
  },

  infoDescriptor(body: string): string | undefined {
    const match = INFO_REGEX.exec(body);
    if (!match || !match[1]) return undefined;
    return this.normalizeMerchantCandidate(match[1].trim());
  },

  normalizeMerchantCandidate(raw: string): string | undefined {
    let descriptor = raw.trim().replace(LEADING_REFERENCE_REGEX, '').trim();
    descriptor = descriptor.replace(TRAILING_MONTH_YEAR_REGEX, '').trim().replace(/[-.,:;]+$/, '').trim();

    if (descriptor.length < 2 || !/^[A-Za-z]/.test(descriptor)) return undefined;
    if (LONG_DIGIT_RUN_REGEX.test(descriptor)) return undefined;

    return descriptor;
  },

  categorize(merchant?: string, body: string = ''): string {
    const haystack = `${merchant || ''} ${body}`.toLowerCase();

    // Check ClearSMS table categories
    for (const rule of CATEGORY_RULES) {
      if (rule.regex.test(haystack)) {
        switch (rule.category) {
          case 'FOOD':
            return 'Food';
          case 'SHOPPING':
            return 'Shopping';
          case 'TRANSPORTATION':
            return 'Transport';
          case 'TRAVEL_HOTEL':
            return 'Travel';
          case 'ENTERTAINMENT':
            return 'Entertainment';
          case 'EDUCATION':
            return 'Education';
          case 'HOSPITAL':
            return 'Healthcare';
          case 'UTILITY_BILL':
          case 'RECHARGE':
            return 'Bills';
          case 'INVESTMENT':
            return 'Investment';
          default:
            return rule.category;
        }
      }
    }

    // P2P UPI logic: if UPI ID contains '@' or mentions p2p transfer
    const looksLikeP2p = (merchant && merchant.includes('@')) || /\b(?:upi|vpa)\b/i.test(body);
    return looksLikeP2p ? 'Transfer' : 'Other';
  },
};
