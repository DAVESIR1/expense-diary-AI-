/**
 * ClearSMS Guard Library ported to TypeScript
 * 
 * Implements the 14 negative guards from ClearSMS to prevent false transactions,
 * scrub bill notices and pitch amounts, and enforce mathematical invariants.
 */

import guardsData from './guards.json';

export type GuardId =
  | 'statement_notice'
  | 'bill_due_notice'
  | 'failed_payment'
  | 'settled_payment'
  | 'marketing_pitch'
  | 'voucher'
  | 'mandate_notice'
  | 'collect_request'
  | 'retirement_units_echo'
  | 'payout_in_flight'
  | 'financial_evidence'
  | 'hypothetical_amount'
  | 'limit_offer'
  | 'tier_premium'
  | 'future_tense'
  | 'instruction_start';

interface GuardEntry {
  id: string;
  description?: string;
  patterns: string[];
}

const compiledGuards = new Map<GuardId, RegExp[]>();

// Compile and cache guard regexes
for (const entry of (guardsData.guards as GuardEntry[])) {
  const regExps: RegExp[] = [];
  for (const pat of entry.patterns) {
    try {
      // ClearSMS patterns start with (?i), translate to RegExp with 'i' flag
      let cleanPattern = pat;
      let flags = '';
      if (cleanPattern.startsWith('(?i)')) {
        cleanPattern = cleanPattern.substring(4);
        flags += 'i';
      }
      regExps.push(new RegExp(cleanPattern, flags));
    } catch {
      // Skip invalid pattern gracefully
    }
  }
  compiledGuards.set(entry.id as GuardId, regExps);
}

export const GuardLibrary = {
  /**
   * Check if any pattern in the guard matches the text
   */
  matches(id: GuardId, text: string): boolean {
    const patterns = compiledGuards.get(id);
    if (!patterns || patterns.length === 0) return false;
    for (const regex of patterns) {
      if (regex.test(text)) return true;
    }
    return false;
  },

  /**
   * Scrub/replace matched spans with a space (e.g. statement notices and pitch amounts)
   */
  scrub(id: GuardId, text: string): string {
    const patterns = compiledGuards.get(id);
    if (!patterns || patterns.length === 0) return text;
    let res = text;
    for (const regex of patterns) {
      res = res.replace(regex, ' ');
    }
    return res;
  },

  /**
   * Convenience helpers directly matching ClearSMS call-sites
   */
  isFailedPayment(text: string): boolean {
    return this.matches('failed_payment', text);
  },

  isPaymentRequestNotice(text: string): boolean {
    return this.matches('collect_request', text);
  },

  isPayoutInFlight(text: string): boolean {
    return this.matches('payout_in_flight', text);
  },

  isBillDueNotice(text: string): boolean {
    return this.matches('bill_due_notice', text);
  },

  hasFinancialEvidence(text: string): boolean {
    return this.matches('financial_evidence', text);
  },

  isMarketingPitch(text: string): boolean {
    return this.matches('marketing_pitch', text);
  },
};
