/**
 * ClearSMS Bundled Rules Engine (465 Indian Bank, Investment & Wallet Rules)
 * 
 * Provides deterministic, bank-grade pattern matching with prioritized evaluation.
 */

import rulesData from './rulesIndia.json';
import { GuardLibrary } from './guards';
import { SenderNameResolver } from './senderResolver';

export interface BundledRule {
  id: string;
  name: string;
  priority: number;
  category: string;
  subCategory: string;
  senderPattern: string | null;
  bodyPattern: string | null;
  bodyMustNotContain: string[];
  extract: Record<string, string>;
  sourceFile?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  category: string;
  subCategory: string;
  amount?: number;
  type?: 'credit' | 'debit';
  merchant?: string;
  accountLast4?: string;
  bank?: string;
  balance?: number;
  referenceNumber?: string;
  isInvestment?: boolean;
}

interface CompiledRule {
  rule: BundledRule;
  senderRegex: RegExp | null;
  bodyRegex: RegExp | null;
  mustNotContainLower: string[];
}

function compileRegex(pattern: string | null): RegExp | null {
  if (!pattern) return null;
  try {
    let pat = pattern;
    let flags = '';
    if (pat.startsWith('(?i)')) {
      pat = pat.substring(4);
      flags += 'i';
    }
    return new RegExp(pat, flags);
  } catch {
    return null;
  }
}

const COMPILED_RULES: CompiledRule[] = (rulesData as BundledRule[]).map((rule) => ({
  rule,
  senderRegex: compileRegex(rule.senderPattern),
  bodyRegex: compileRegex(rule.bodyPattern),
  mustNotContainLower: (rule.bodyMustNotContain || []).map((t) => t.toLowerCase()),
}));

export const BundledRulesEngine = {
  /**
   * Evaluate message against the 465 curated Indian rules in priority order
   */
  evaluate(sender: string, body: string): RuleEvaluationResult | null {
    // Stage 1: Negative Guards Veto
    if (GuardLibrary.isFailedPayment(body)) return null;
    if (GuardLibrary.isPaymentRequestNotice(body)) return null;
    if (GuardLibrary.isPayoutInFlight(body)) return null;

    const bodyLower = body.toLowerCase();

    for (const item of COMPILED_RULES) {
      const { rule, senderRegex, bodyRegex, mustNotContainLower } = item;

      // Sender check
      if (senderRegex && !senderRegex.test(sender)) {
        continue;
      }

      // Negative keywords check
      if (mustNotContainLower.some((neg) => bodyLower.includes(neg))) {
        continue;
      }

      // Body regex check & capture groups
      let match: RegExpExecArray | null = null;
      if (bodyRegex) {
        match = bodyRegex.exec(body);
        if (!match) continue;
      }

      // Resolve extracts
      const extracts = rule.extract || {};
      const resolveToken = (val?: string): string => {
        if (!val) return '';
        if (val.startsWith('$') && match) {
          const groupIdx = parseInt(val.substring(1), 10);
          return (match[groupIdx] || '').trim();
        }
        return val.trim();
      };

      const rawAmount = resolveToken(extracts.amount);
      const parsedAmount = rawAmount ? parseFloat(rawAmount.replace(/,/g, '')) : undefined;

      const rawBalance = resolveToken(extracts.balance);
      const parsedBalance = rawBalance ? parseFloat(rawBalance.replace(/,/g, '')) : undefined;

      let extractedType = (resolveToken(extracts.type) || '').toLowerCase();
      let type: 'credit' | 'debit' | undefined = undefined;
      if (extractedType === 'credit' || extractedType === 'debit') {
        type = extractedType;
      }

      let merchant = resolveToken(extracts.merchant) || undefined;
      let accountLast4 = resolveToken(extracts.account_last4) || undefined;
      let bank = resolveToken(extracts.bank) || undefined;

      // Clean accountLast4
      if (accountLast4) {
        const digits = accountLast4.replace(/\D/g, '');
        if (digits.length >= 3) {
          accountLast4 = digits.slice(-4);
        }
      }

      const isInvestment =
        rule.subCategory === 'investment' ||
        rule.subCategory === 'mutual_fund' ||
        rule.sourceFile?.includes('nps') ||
        rule.sourceFile?.includes('mutual');

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        category: isInvestment ? 'Investment' : rule.category,
        subCategory: rule.subCategory,
        amount: parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined,
        type: type || (isInvestment ? 'credit' : undefined),
        merchant: merchant || (isInvestment ? 'NPS' : undefined),
        accountLast4,
        bank: bank ? SenderNameResolver.canonicalize(bank) || bank : undefined,
        balance: parsedBalance && !isNaN(parsedBalance) ? parsedBalance : undefined,
        isInvestment,
      };
    }

    return null;
  },
};
