/**
 * Comprehensive Indian Financial Knowledge Base & Categorization Engine
 * Covers:
 * - NPS (National Pension System), CRA-NSDL, Protean, PRAN, Tier-I, Tier-II
 * - Mutual Funds, SIP, Stocks (Zerodha, Groww, AngelOne, Upstox, Coin, CAMS, KFintech)
 * - Fixed Deposits, PPF, Sukanya, Gold
 * - UPI P2P Transfers vs UPI Merchant Outlets
 * - Indian Public & Private Banks (SBI, HDFC, ICICI, Axis, Kotak, BOB, PNB, Canara, Union, etc.)
 * - Bills & Utilities (Electricity, Gas, Fastag, DTH, Mobile Recharge, Broadband)
 * - Food & Dining (Swiggy, Zomato, McDonald's, Domino's, etc.)
 * - Groceries (Blinkit, Zepto, Instamart, BigBasket, DMart, etc.)
 * - Shopping (Amazon, Flipkart, Myntra, Meesho, Nykaa, Ajio, etc.)
 * - Travel & Fuel (IOCL, HPCL, BPCL, Shell, Uber, Ola, Rapido, IRCTC)
 * - Spam, Promotional Loan Offers & OTP Filtering
 */

export interface FinancialRule {
  id: string;
  category: string;
  categoryGu: string;
  isInvestment?: boolean;
  isTransfer?: boolean;
  isSalary?: boolean;
  keywords: string[];
  senderPatterns?: string[];
  defaultType?: 'expense' | 'income';
}

export const SPAM_AND_NON_TRANSACTION_PATTERNS = [
  // OTP and 2FA
  /\b(?:otp|one[- ]time[- ]password|verification code|security code|secret code)\b/i,
  /\bdo not share\b/i,
  /\bvalid for \d+ min\b/i,
  
  // Promotional loans and marketing
  /\b(?:pre[- ]approved|instant loan|apply for loan|loan eligible|congratulations! you are eligible)\b/i,
  /\b(?:get up to|flat \d+% off|cashback offer|use code|download the app now)\b/i,
  /\b(?:win cash|claim your reward|lucky winner|click here to apply|bit\.ly|t\.co)\b/i,
  /\b(?:increase credit limit|credit card offer|lifetime free)\b/i,

  // Balance enquiry alerts (not actual spend/income)
  /\b(?:available balance is|clear balance|bal in a\/c|avl bal|a\/c bal is)\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:only)?\b/i,
  /\b(?:mini statement|balance enquiry)\b/i,

  // Failed, reversed or declined transactions
  /\b(?:failed|declined|unsuccessful|cancelled|timed out)\b/i,
  /\b(?:transaction reversed due to failure|insufficient balance|exceeded limit)\b/i,
];

export const INVESTMENT_PATTERNS = {
  nps: [
    /\bnps\b/i,
    /\bpran\b/i,
    /\bcra[- ]nsdl\b/i,
    /\bprotean\b/i,
    /\btier[- ]?[i|1|ii|2]\b/i,
    /\bnational pension\b/i,
    /\bpension fund\b/i,
    /\bpfrda\b/i,
  ],
  mutualFunds: [
    /\bsip\b/i,
    /\bmutual fund\b/i,
    /\bcamsonline\b/i,
    /\bkfintech\b/i,
    /\bfoli(?:o)?\b/i,
    /\bnav\b/i,
    /\bunits allotted\b/i,
    /\bzerodha\b/i,
    /\bgroww\b/i,
    /\bangelone\b/i,
    /\bupstox\b/i,
    /\bkuvera\b/i,
    /\bcoin by zerodha\b/i,
    /\bmf investment\b/i,
  ],
  fixedDeposits: [
    /\bfixed deposit\b/i,
    /\bterm deposit\b/i,
    /\bfd a\/c\b/i,
    /\brecurring deposit\b/i,
    /\brd a\/c\b/i,
    /\bppf\b/i,
    /\bpublic provident fund\b/i,
    /\bsukanya samriddhi\b/i,
    /\bsovereign gold\b/i,
  ]
};

export const SALARY_PATTERNS = [
  /\bsalary\b/i,
  /\bpayroll\b/i,
  /\bsal cr\b/i,
  /\bstipend\b/i,
  /\bmonthly stipend\b/i,
  /\bwages\b/i,
];

export const UPI_TRANSFER_PATTERNS = [
  /\bupi\b/i,
  /\bvpa\b/i,
  /\bgpay\b/i,
  /\bphonepe\b/i,
  /\bpaytm\b/i,
  /\bbhim\b/i,
  /\bcred\b/i,
  /\bneft\b/i,
  /\bimps\b/i,
  /\brtgs\b/i,
  /\btransferred to\b/i,
  /\bsent to\b/i,
  /\breceived from\b/i,
];

export const FINANCIAL_CATEGORIES_RULES: FinancialRule[] = [
  // 1. INVESTMENT (NPS, MF, SIP, PPF, FD) -> OUTFLOW / INVESTMENT (NOT INCOME!)
  {
    id: 'rule-investment',
    category: 'Investment',
    categoryGu: 'રોકાણ (NPS/SIP)',
    isInvestment: true,
    keywords: [
      'nps', 'pran', 'cra-nsdl', 'protean', 'pfrda', 'tier-i', 'tier-ii', 'national pension',
      'mutual fund', 'sip', 'zerodha', 'groww', 'angelone', 'upstox', 'coin', 'cams', 'kfintech',
      'nav', 'units allotted', 'ppf', 'fixed deposit', 'term deposit', 'recurring deposit', 'gold bond',
      'demat', 'cdsl', 'nsdl', 'bse', 'nse', 'stock', 'shares'
    ],
    senderPatterns: ['NPS', 'PRAN', 'NSDL', 'PROTEAN', 'CAMSON', 'KFIN', 'ZERODH', 'GROWW', 'ANGEL'],
    defaultType: 'expense',
  },

  // 2. INVESTMENT RETURNS (Redemption, Dividends, Maturity) -> INCOME
  {
    id: 'rule-investment-returns',
    category: 'Investment Returns',
    categoryGu: 'રોકાણ પર વળતર / રીડીમ્પશન',
    isInvestment: true,
    keywords: [
      'dividend', 'redemption payout', 'mutual fund redemption', 'fd maturity proceeds',
      'maturity credited', 'interest credited', 'fd interest', 'savings interest', 'sweep in credit'
    ],
    defaultType: 'income',
  },

  // 3. SALARY -> ONLY GENUINE PAYROLL
  {
    id: 'rule-salary',
    category: 'Salary',
    categoryGu: 'પગાર (Salary)',
    isSalary: true,
    keywords: ['salary', 'payroll', 'sal cr', 'monthly salary', 'stipend', 'wages credited'],
    senderPatterns: ['SALARY', 'PAYROL'],
    defaultType: 'income',
  },

  // 4. UPI & BANK TRANSFERS -> TRANSFER (Not Salary, Not Shopping!)
  {
    id: 'rule-transfer',
    category: 'Transfer',
    categoryGu: 'ટ્રાન્સફર (UPI / ખાતામાં)',
    isTransfer: true,
    keywords: [
      'transferred to', 'sent to', 'received from', 'upi/cr', 'upi/dr', 'vpa',
      'fund transfer', 'imps', 'neft', 'rtgs', 'p2p', 'peer to peer'
    ],
    senderPatterns: ['UPI', 'BHIM', 'GPAY', 'PHONPE', 'PAYTM'],
  },

  // 5. BILLS & UTILITIES
  {
    id: 'rule-bills',
    category: 'Bills & Utilities',
    categoryGu: 'બિલ અને રિચાર્જ',
    keywords: [
      'electricity', 'ugvcl', 'dgvcl', 'mgvcl', 'pgvcl', 'torrent power', 'bescom', 'tneb', 'bses',
      'gas bill', 'adani gas', 'gujarat gas', 'indane', 'bharat gas', 'hp gas', 'lpg',
      'water bill', 'property tax', 'broadband', 'airtel broadband', 'jiofiber', 'act fibernet',
      'mobile recharge', 'prepaid recharge', 'postpaid bill', 'jio', 'airtel', 'vi', 'vodafone', 'bsnl',
      'fastag', 'netc fastag', 'toll', 'dth recharge', 'tata play', 'dish tv', 'airtel dth', 'sun direct'
    ],
    senderPatterns: ['BILL', 'RECHG', 'AIRTEL', 'JIO', 'BESCOM', 'FASTAG', 'POWER'],
    defaultType: 'expense',
  },

  // 6. FOOD & DINING
  {
    id: 'rule-food',
    category: 'Food & Dining',
    categoryGu: 'ખોરાક અને નાસ્તો',
    keywords: [
      'swiggy', 'zomato', 'restaurant', 'cafe', 'mcdonald', 'domino', 'pizza', 'burger',
      'starbucks', 'chai', 'tea point', 'bakery', 'hotel', 'dhaba', 'eats', 'food',
      'kfc', 'subway', 'haldiram', 'bbq', 'bhojanalay', 'dining', 'canteen'
    ],
    senderPatterns: ['SWIGGY', 'ZOMATO', 'DOMINO'],
    defaultType: 'expense',
  },

  // 7. GROCERIES
  {
    id: 'rule-groceries',
    category: 'Groceries',
    categoryGu: 'કરિયાણું અને શાકભાજી',
    keywords: [
      'blinkit', 'zepto', 'instamart', 'bigbasket', 'bbnow', 'dmart', 'supermarket',
      'kirana', 'grocery', 'vegetables', 'fruits', 'dairy', 'milk', 'amul', 'mother dairy',
      'nature basket', 'reliance fresh', 'spencer', 'star bazaar', 'provisions'
    ],
    senderPatterns: ['BLINKT', 'ZEPTO', 'BIGBSK', 'DMART'],
    defaultType: 'expense',
  },

  // 8. SHOPPING
  {
    id: 'rule-shopping',
    category: 'Shopping',
    categoryGu: 'શોપિંગ અને ખરીદી',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'ajio', 'tata cliq', 'reliance digital',
      'croma', 'ikea', 'decathlon', 'shoppers stop', 'lifestyle', 'westside', 'zara', 'h&m',
      'clothing', 'footwear', 'electronics', 'jewellers', 'retail store', 'mall', 'bazaar'
    ],
    senderPatterns: ['AMAZON', 'FLIPKT', 'MYNTRA', 'MEESHO', 'NYKAA', 'AJIO'],
    defaultType: 'expense',
  },

  // 9. TRAVEL & FUEL
  {
    id: 'rule-travel',
    category: 'Travel & Fuel',
    categoryGu: 'મુસાફરી અને પેટ્રોલ',
    keywords: [
      'petrol', 'diesel', 'cng', 'fuel', 'hpcl', 'bpcl', 'iocl', 'indian oil', 'shell', 'nayara',
      'uber', 'ola', 'rapido', 'irctc', 'railway', 'train', 'flight', 'indigo', 'air india',
      'cleartrip', 'makemytrip', 'easemytrip', 'redbus', 'metro', 'toll plaza', 'parking'
    ],
    senderPatterns: ['IRCTC', 'UBER', 'OLACAB', 'RAPIDO', 'INDIGO', 'MAKEMY'],
    defaultType: 'expense',
  },

  // 10. HEALTH & MEDICINES
  {
    id: 'rule-health',
    category: 'Health & Medicines',
    categoryGu: 'દવાઓ અને આરોગ્ય',
    keywords: [
      'apollo', 'netmeds', '1mg', 'pharmeasy', 'medplus', 'pharmacy', 'chemist', 'medical store',
      'hospital', 'clinic', 'dr.', 'doctor', 'pathology', 'lab', 'diagnostic', 'health insurance',
      'dental', 'opticals', 'lenskart'
    ],
    senderPatterns: ['APOLLO', 'NETMED', 'PHARME', 'LENSKT'],
    defaultType: 'expense',
  },

  // 11. ENTERTAINMENT & OTT
  {
    id: 'rule-entertainment',
    category: 'Entertainment',
    categoryGu: 'મનોરંજન અને OTT',
    keywords: [
      'netflix', 'hotstar', 'prime video', 'spotify', 'youtube premium', 'apple music',
      'bookmyshow', 'pvr', 'inox', 'cinepolis', 'cinema', 'movie ticket', 'gaming', 'playstation'
    ],
    senderPatterns: ['BOOKMY', 'PVR', 'INOX', 'NETFLX'],
    defaultType: 'expense',
  },

  // 12. LOANS & EMI
  {
    id: 'rule-loans',
    category: 'Bills & Utilities',
    categoryGu: 'EMI અને લોન હપ્તો',
    keywords: [
      'emi', 'loan repayment', 'bajaj finance', 'hdfc credila', 'home loan emi',
      'auto loan emi', 'car loan emi', 'personal loan emi', 'credit card payment', 'card bill'
    ],
    senderPatterns: ['BAJAJF', 'CREDL', 'HDFCBK'],
    defaultType: 'expense',
  }
];

/**
 * Checks if raw message is a promotional, OTP or non-financial message.
 */
export function isSpamOrNonTransaction(text: string): boolean {
  if (!text || text.trim().length < 8) return true;
  return SPAM_AND_NON_TRANSACTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Categorize a financial message accurately using rules and knowledge base.
 */
export function categorizeFinancialText(
  text: string,
  sender: string = '',
  detectedType: 'income' | 'expense' = 'expense'
): {
  category: string;
  categoryGu: string;
  confidence: number;
  isInvestment: boolean;
  isTransfer: boolean;
  needsReview: boolean;
} {
  const clean = text.toLowerCase();
  const upperSender = (sender || '').toUpperCase();

  // Special Priority 1: NPS Check (Crucial requirement from user)
  for (const pattern of INVESTMENT_PATTERNS.nps) {
    if (pattern.test(clean) || pattern.test(upperSender)) {
      return {
        category: 'Investment',
        categoryGu: 'રોકાણ (NPS)',
        confidence: 0.98,
        isInvestment: true,
        isTransfer: false,
        needsReview: false,
      };
    }
  }

  // Special Priority 2: Mutual Funds & SIP & FDs
  for (const pattern of INVESTMENT_PATTERNS.mutualFunds) {
    if (pattern.test(clean) || pattern.test(upperSender)) {
      return {
        category: 'Investment',
        categoryGu: 'રોકાણ (Mutual Fund/SIP)',
        confidence: 0.95,
        isInvestment: true,
        isTransfer: false,
        needsReview: false,
      };
    }
  }

  for (const pattern of INVESTMENT_PATTERNS.fixedDeposits) {
    if (pattern.test(clean) || pattern.test(upperSender)) {
      return {
        category: 'Investment',
        categoryGu: 'રોકાણ (FD/PPF)',
        confidence: 0.95,
        isInvestment: true,
        isTransfer: false,
        needsReview: false,
      };
    }
  }

  // Special Priority 3: Genuine Salary check
  if (detectedType === 'income') {
    const isSalary = SALARY_PATTERNS.some((p) => p.test(clean));
    if (isSalary) {
      return {
        category: 'Salary',
        categoryGu: 'પગાર (Salary)',
        confidence: 0.96,
        isInvestment: false,
        isTransfer: false,
        needsReview: false,
      };
    }

    // If money received via UPI from a person, it is Transfer, NOT Salary!
    const isUpiReceived = UPI_TRANSFER_PATTERNS.some((p) => p.test(clean));
    if (isUpiReceived) {
      return {
        category: 'Transfer',
        categoryGu: 'ટ્રાન્સફર (UPI મળ્યા)',
        confidence: 0.90,
        isInvestment: false,
        isTransfer: true,
        needsReview: false,
      };
    }
  }

  // Check Rules Database
  for (const rule of FINANCIAL_CATEGORIES_RULES) {
    // Check sender match
    if (rule.senderPatterns && rule.senderPatterns.some((sp) => upperSender.includes(sp))) {
      return {
        category: rule.category,
        categoryGu: rule.categoryGu,
        confidence: 0.92,
        isInvestment: !!rule.isInvestment,
        isTransfer: !!rule.isTransfer,
        needsReview: false,
      };
    }

    // Check keyword matches in text
    const matchedKeywords = rule.keywords.filter((kw) => clean.includes(kw));
    if (matchedKeywords.length > 0) {
      const confidence = matchedKeywords.length > 1 ? 0.94 : 0.88;
      return {
        category: rule.category,
        categoryGu: rule.categoryGu,
        confidence,
        isInvestment: !!rule.isInvestment,
        isTransfer: !!rule.isTransfer,
        needsReview: false,
      };
    }
  }

  // If detectedType is income and no rule matched -> Other Income
  if (detectedType === 'income') {
    return {
      category: 'Other Income',
      categoryGu: 'અન્ય આવક',
      confidence: 0.65,
      isInvestment: false,
      isTransfer: false,
      needsReview: true, // Needs confirmation pop-up
    };
  }

  // If detectedType is expense and UPI transfer to a person / account
  if (UPI_TRANSFER_PATTERNS.some((p) => p.test(clean))) {
    return {
      category: 'Transfer',
      categoryGu: 'ટ્રાન્સફર (UPI મોકલ્યા)',
      confidence: 0.85,
      isInvestment: false,
      isTransfer: true,
      needsReview: false,
    };
  }

  // Fallback expense -> Other Expense with review flag
  return {
    category: 'Other Expense',
    categoryGu: 'અન્ય ખર્ચ',
    confidence: 0.50,
    isInvestment: false,
    isTransfer: false,
    needsReview: true, // Needs confirmation pop-up
  };
}
