/**
 * ClearSMS-Compatible Dynamic Category Rule Engine
 * Ported from ClearSMS (RuleEngine.kt, RuleModels.kt, merchant_categories.json).
 * 
 * Provides:
 * 1. Built-in merchant-keyword to category rules.
 * 2. User-learned dynamic rules when categories are assigned/changed.
 * 3. Bulk recategorization of past transactions when a new rule is learned.
 * 4. Priority-based evaluation chain (User Rules > Built-in Rules > Fallback).
 */

import { Transaction } from '../types';
import { uid } from '../utils/uid';

export interface RuleMatch {
  senderPattern?: string;
  bodyPattern?: string;
  bodyMustContain?: string[];
  bodyMustNotContain?: string[];
  guardsNone?: string[];
}

export interface RuleAction {
  category: string;
  subCategory?: string;
  extractTypes?: Record<string, string>;
}

export interface RuleDefinition {
  id: string;
  name: string;
  priority: number; // User rules: 500+, Builtin rules: 100-300
  match: RuleMatch;
  action: RuleAction;
  contributedBy: 'builtin' | 'user';
  createdAt: string;
}

const USER_RULES_STORAGE_KEY = 'expense_diary_user_category_rules';

/**
 * Built-in merchant category rules derived from ClearSMS merchant_categories.json & default_rules.json
 */
export const BUILTIN_CATEGORY_RULES: RuleDefinition[] = [
  // 1. Food & Dining
  {
    id: 'builtin-food-01',
    name: 'Food & Dining (Swiggy / Zomato / Restaurants)',
    priority: 200,
    match: { bodyPattern: '\\b(?:swiggy|zomato|mcdonald|domino|starbucks|subway|pizza|burger|eats|cafe|restaurant|bakers)\\b' },
    action: { category: 'Food & Dining', subCategory: 'food' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 2. Shopping
  {
    id: 'builtin-shopping-01',
    name: 'Shopping & E-Commerce (Amazon / Flipkart / Meesho / Myntra)',
    priority: 200,
    match: { bodyPattern: '\\b(?:amazon|flipkart|myntra|meesho|nykaa|ajio|tata\\s*cliq|croma|reliance\\s*digital|d-?mart|jiomart|decathlon|zara|h&m)\\b' },
    action: { category: 'Shopping', subCategory: 'shopping' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 3. Groceries
  {
    id: 'builtin-grocery-01',
    name: 'Groceries & Quick Commerce (Blinkit / Zepto / Instamart / BigBasket)',
    priority: 210,
    match: { bodyPattern: '\\b(?:blinkit|zepto|instamart|bigbasket|bb\\s*daily|grofers|supermarket|kirana|vegetable)\\b' },
    action: { category: 'Groceries', subCategory: 'groceries' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 4. Transportation & Travel
  {
    id: 'builtin-transport-01',
    name: 'Travel & Transportation (Uber / Ola / Rapido / IRCTC / Airlines)',
    priority: 200,
    match: { bodyPattern: '\\b(?:uber|ola|rapido|irctc|redbus|makemytrip|goibibo|indigo|air\\s*india|spicejet|fuel|petrol|iocl|hpcl|bpcl|shell)\\b' },
    action: { category: 'Travel & Fuel', subCategory: 'transport' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 5. Entertainment & OTT
  {
    id: 'builtin-entertainment-01',
    name: 'Entertainment (Netflix / BookMyShow / Spotify / PVR)',
    priority: 200,
    match: { bodyPattern: '\\b(?:netflix|bookmyshow|spotify|prime\\s*video|hotstar|pvr|inox|cinepolis|apple\\s*music|youtube\\s*premium)\\b' },
    action: { category: 'Entertainment', subCategory: 'entertainment' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 6. Health & Medical
  {
    id: 'builtin-health-01',
    name: 'Health & Medical (Hospital / Pharmacy / Apollo / Netmeds)',
    priority: 200,
    match: { bodyPattern: '\\b(?:hospital|pharmacy|chemist|apollo|netmeds|1mg|pharmeasy|medplus|clinic|doctor|diagnostic|pathology)\\b' },
    action: { category: 'Health & Medicines', subCategory: 'health' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 7. Bills & Utilities
  {
    id: 'builtin-bills-01',
    name: 'Bills & Utilities (Electricity / Gas / Broadband / Mobile)',
    priority: 200,
    match: { bodyPattern: '\\b(?:electricity|gas\\s*bill|broadband|wifi|water\\s*bill|dth|recharge|airtel|jio|vi|ugvcl|dgvcl|mgvcl|pgvcl|torrent\\s*power|adani\\s*gas|gujarat\\s*gas)\\b' },
    action: { category: 'Bills & Utilities', subCategory: 'bills' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 8. Investment (NPS, MF, SIP, PPF, Demat)
  {
    id: 'builtin-investment-01',
    name: 'Investment (NPS / PRAN / SIP / Mutual Fund / Zerodha / Groww)',
    priority: 220,
    match: { bodyPattern: '\\b(?:nps|pran|cra-nsdl|protean|pfrda|tier-i|tier-ii|sip|mutual\\s*fund|zerodha|groww|angelone|upstox|camsonline|kfintech|ppf|fixed\\s*deposit|rd\\s*instal?lment)\\b' },
    action: { category: 'Investment', subCategory: 'investment' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 9. Insurance
  {
    id: 'builtin-insurance-01',
    name: 'Insurance (LIC / Star Health / HDFC Life / Max Life)',
    priority: 210,
    match: { bodyPattern: '\\b(?:lic\\s+of\\s+india|lic\\s+premium|star\\s*health|hdfc\\s*life|icici\\s*prudential|icici\\s*lombard|sbi\\s*life|max\\s*life|tata\\s*aia|bajaj\\s*allianz|niva\\s*bupa|policybazaar)\\b' },
    action: { category: 'Insurance', subCategory: 'insurance' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // 10. Salary
  {
    id: 'builtin-salary-01',
    name: 'Salary & Payroll (By Salary / Sal Cr / Payroll)',
    priority: 220,
    match: { bodyPattern: '\\b(?:by\\s+salary|salary\\s+credited|has\\s+credit\\s+for\\s+by\\s+salary|sal\\s*cr|payroll|monthly\\s+stipend|salary-sbi)\\b' },
    action: { category: 'Salary', subCategory: 'salary' },
    contributedBy: 'builtin',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const CategoryRuleEngine = {
  /**
   * Load user-defined rules from persistent storage
   */
  getUserRules(): RuleDefinition[] {
    try {
      const raw = localStorage.getItem(USER_RULES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Save user-defined rules
   */
  saveUserRules(rules: RuleDefinition[]): void {
    try {
      localStorage.setItem(USER_RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // Ignored
    }
  },

  /**
   * Get all active rules sorted by priority (Descending)
   */
  getAllRules(): RuleDefinition[] {
    const userRules = this.getUserRules();
    const all = [...userRules, ...BUILTIN_CATEGORY_RULES];
    return all.sort((a, b) => b.priority - a.priority);
  },

  /**
   * Evaluates text and sender against the rule chain (ClearSMS RuleEngine algorithm)
   */
  evaluate(sender: string = '', text: string = ''): { category: string; subCategory?: string; matchedRuleId?: string } | null {
    if (!text && !sender) return null;
    const rules = this.getAllRules();

    for (const rule of rules) {
      const match = rule.match;

      // 1. Sender check
      if (match.senderPattern) {
        try {
          const cleanPat = match.senderPattern.replace(/^\(\?i\)/, '');
          const regex = new RegExp(cleanPat, 'i');
          if (!regex.test(sender)) continue;
        } catch {
          continue;
        }
      }

      // 2. Body pattern check
      if (match.bodyPattern) {
        try {
          const cleanPat = match.bodyPattern.replace(/^\(\?i\)/, '');
          const regex = new RegExp(cleanPat, 'i');
          if (!regex.test(text)) continue;
        } catch {
          continue;
        }
      }

      // 3. Body must contain all words
      if (match.bodyMustContain && match.bodyMustContain.length > 0) {
        const lower = text.toLowerCase();
        const allPresent = match.bodyMustContain.every((word) => lower.includes(word.toLowerCase()));
        if (!allPresent) continue;
      }

      // 4. Body must not contain any forbidden words
      if (match.bodyMustNotContain && match.bodyMustNotContain.length > 0) {
        const lower = text.toLowerCase();
        const anyForbidden = match.bodyMustNotContain.some((word) => lower.includes(word.toLowerCase()));
        if (anyForbidden) continue;
      }

      // Match found!
      return {
        category: rule.action.category,
        subCategory: rule.action.subCategory,
        matchedRuleId: rule.id,
      };
    }

    return null;
  },

  /**
   * Learns a dynamic category rule when a user assigns/edits a category.
   * Creates a high-priority user rule (Priority 500).
   */
  learnCategoryRule(
    merchantOrKeyword: string,
    targetCategory: string,
    options?: { sender?: string; isSenderOnly?: boolean }
  ): RuleDefinition {
    const cleanKeyword = merchantOrKeyword.trim();
    const userRules = this.getUserRules();

    // Check if an existing user rule exists for this keyword
    const existingIndex = userRules.findIndex((r) => {
      if (options?.isSenderOnly && options.sender) {
        return r.match.senderPattern === options.sender;
      }
      return r.name.toLowerCase() === `user: ${cleanKeyword.toLowerCase()}`;
    });

    const ruleId = existingIndex >= 0 ? userRules[existingIndex].id : uid('user-rule', 10);
    
    // Escape regex special chars for safe pattern matching
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const newRule: RuleDefinition = {
      id: ruleId,
      name: `User: ${cleanKeyword}`,
      priority: 500, // Higher than all builtin rules
      match: {
        ...(options?.sender ? { senderPattern: options.sender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } : {}),
        ...(!options?.isSenderOnly && cleanKeyword ? { bodyPattern: `\\b${escaped}\\b` } : {}),
      },
      action: {
        category: targetCategory,
      },
      contributedBy: 'user',
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      userRules[existingIndex] = newRule;
    } else {
      userRules.unshift(newRule);
    }

    this.saveUserRules(userRules);
    return newRule;
  },

  /**
   * Recategorizes all matching transactions in the database using the newly learned rule.
   * Updates past transactions instantly!
   */
  recategorizePastTransactions(
    transactions: Transaction[],
    rule: RuleDefinition
  ): { updatedTransactions: Transaction[]; updatedCount: number } {
    let updatedCount = 0;
    const targetCategory = rule.action.category;

    const updatedTransactions = transactions.map((t) => {
      if (t.category === targetCategory) return t;

      const haystack = `${t.title} ${t.vendorOrPerson || ''} ${t.notes || ''} ${t.evidence || ''}`.trim();
      const sender = t.evidenceSender || '';

      let matches = false;
      if (rule.match.senderPattern) {
        try {
          const cleanPat = rule.match.senderPattern.replace(/^\(\?i\)/, '');
          const rx = new RegExp(cleanPat, 'i');
          if (rx.test(sender)) matches = true;
        } catch {
          // Ignored
        }
      }

      if (!matches && rule.match.bodyPattern) {
        try {
          const cleanPat = rule.match.bodyPattern.replace(/^\(\?i\)/, '');
          const rx = new RegExp(cleanPat, 'i');
          if (rx.test(haystack)) matches = true;
        } catch {
          // Ignored
        }
      }

      if (matches) {
        updatedCount++;
        return {
          ...t,
          category: targetCategory,
          updatedAt: new Date().toISOString(),
        };
      }

      return t;
    });

    return { updatedTransactions, updatedCount };
  },

  /**
   * Delete a user rule by id
   */
  deleteUserRule(ruleId: string): void {
    const userRules = this.getUserRules().filter((r) => r.id !== ruleId);
    this.saveUserRules(userRules);
  },

  /**
   * Reset user rules
   */
  clearUserRules(): void {
    localStorage.removeItem(USER_RULES_STORAGE_KEY);
  },
};
