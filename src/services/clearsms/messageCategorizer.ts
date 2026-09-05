/**
 * ClearSMS Message Categorizer & Invariant Pipeline
 * 
 * Orchestrates the full priority chain:
 * 1. User Rules (highest priority, dynamically learned)
 * 2. 465 Bundled Indian Bank/Investment Rules
 * 3. ClearSMS Transaction Parser with Negative Guards & State Exclusion
 * 4. Mathematical Invariants (Anchored OTP veto, financial evidence protection)
 */

import { BundledRulesEngine, RuleEvaluationResult } from './bundledRules';
import { TransactionParser, ParsedTransactionResult } from './transactionParser';
import { GuardLibrary } from './guards';
import { OtpParser } from './otpParser';
import { CategoryRuleEngine } from '../categoryRuleEngine';
import { Transaction } from '../../types';

export interface FinalExtractionResult {
  isTransaction: boolean;
  amount?: number;
  type?: 'credit' | 'debit';
  title?: string;
  category?: string;
  subCategory?: string;
  merchantName?: string;
  accountLast4?: string;
  bankName?: string;
  balance?: number;
  availableLimit?: number;
  referenceNumber?: string;
  ruleMatched?: string;
  isOtp?: boolean;
  otpCode?: string;
}

export const MessageCategorizer = {
  /**
   * Process incoming SMS or notification through ClearSMS pipeline
   */
  process(sender: string, body: string, existingTransactions: Transaction[] = []): FinalExtractionResult {
    // Invariant 1: Anchored OTP Check
    const otp = OtpParser.parseAnchored(body);
    if (otp) {
      return {
        isTransaction: false,
        isOtp: true,
        otpCode: otp.code,
      };
    }

    // Invariant 2: Negative Guards Veto
    if (GuardLibrary.isFailedPayment(body) || GuardLibrary.isPaymentRequestNotice(body) || GuardLibrary.isPayoutInFlight(body)) {
      return { isTransaction: false };
    }

    // Stage 1: User Dynamic Rules (Learned from user modifications)
    const userCategoryResult = CategoryRuleEngine.evaluate(body, sender);
    const hasUserRule =
      userCategoryResult !== null &&
      userCategoryResult.category !== 'Other' &&
      userCategoryResult.category.trim().length > 0;

    // Stage 2: 465 Bundled ClearSMS Indian Bank & Investment Rules
    const ruleResult: RuleEvaluationResult | null = BundledRulesEngine.evaluate(sender, body);

    if (ruleResult && ruleResult.amount) {
      let mappedCat = ruleResult.category;
      if (ruleResult.subCategory) {
        const sub = ruleResult.subCategory.toLowerCase();
        if (sub.includes('insuran')) mappedCat = 'Insurance';
        else if (sub.includes('invest') || sub.includes('mutual') || sub.includes('nps') || sub.includes('sip')) mappedCat = 'Investment';
        else if (sub.includes('salar') || sub.includes('payroll')) mappedCat = 'Salary';
        else if (sub.includes('bill') || sub.includes('util') || sub.includes('recharg')) mappedCat = 'Bills & Utilities';
        else if (sub.includes('food')) mappedCat = 'Food & Dining';
        else if (sub.includes('shop')) mappedCat = 'Shopping';
        else if (sub.includes('travel') || sub.includes('transport')) mappedCat = 'Travel & Fuel';
      }
      if (mappedCat === 'important' || mappedCat === 'Other' || !mappedCat) {
        mappedCat = ruleResult.isInvestment ? 'Investment' : 'Other';
      }

      const finalCategory = hasUserRule ? userCategoryResult.category : mappedCat;
      const title = ruleResult.merchant || ruleResult.bank || ruleResult.ruleName;

      return {
        isTransaction: true,
        amount: ruleResult.amount,
        type: ruleResult.type || 'debit',
        title,
        category: finalCategory,
        subCategory: ruleResult.subCategory,
        merchantName: ruleResult.merchant,
        accountLast4: ruleResult.accountLast4,
        bankName: ruleResult.bank,
        balance: ruleResult.balance,
        referenceNumber: ruleResult.referenceNumber,
        ruleMatched: ruleResult.ruleName,
      };
    }

    // Stage 3: ClearSMS Transaction Parser with State Exclusion (Limits/Balances)
    const parsedTxn: ParsedTransactionResult | null = TransactionParser.parse(sender, body);

    if (parsedTxn && parsedTxn.amount) {
      const finalCategory = hasUserRule ? userCategoryResult.category : parsedTxn.category;
      const title = parsedTxn.merchantName || parsedTxn.bankName || (parsedTxn.type === 'credit' ? 'Money Received' : 'Expense');

      return {
        isTransaction: true,
        amount: parsedTxn.amount,
        type: parsedTxn.type,
        title,
        category: finalCategory,
        merchantName: parsedTxn.merchantName,
        accountLast4: parsedTxn.accountLast4,
        bankName: parsedTxn.bankName,
        balance: parsedTxn.balance,
        availableLimit: parsedTxn.availableLimit,
        referenceNumber: parsedTxn.referenceNumber,
        ruleMatched: 'ClearSMS Transaction Parser',
      };
    }

    // If financial evidence exists (e.g. statement balance or folio) but no money moved:
    return { isTransaction: false };
  },
};
