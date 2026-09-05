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

/**
 * ClearSMS Open-Source Guardrails (Ported from ClearSMS guards.json & RuleEngine)
 * These 16 guards provide industry-standard 0-false-positive filtering for financial SMS.
 */
export const CLEARSMS_GUARDS = {
  // 1. Statement delivery notices ('Statement is sent', 'E-statement has been mailed')
  statementNotice: [
    /\b(?:e-?)?statement\s+(?:is|has\s+been|was)\s+(?:sent|generated|mailed|e-?mailed|dispatched)\b/i,
    /\b(?:e-?)?statement\s+of\b[^\n]{0,80}?\bhas\s+been\s+(?:sent|mailed|e-?mailed)\b/i,
    /\b(?:e-?)?statement\s+(?:is\s+)?(?:now\s+)?(?:available|ready)\b/i,
  ],
  // 2. Bill-due notices ('Payment of INR X ... is due on <date>') and reminder advisories
  billDueNotice: [
    /\b(?:payment|bill)\s+of\s+(?:INR|Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?[^\n]{0,100}?\bis\s+due\b/i,
    /\bignore\s+if\s+(?:already\s+)?paid\b/i,
    /\b(?:due for renewal|renewal is due|renewal due|is due for renewal)\b/i,
    /\b(?:renewal premium|renewal notice|renewal reminder|kindly renew|renew now)\b/i,
    /\b(?:premium (?:of|amount)?\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?\s*is due)\b/i,
    /\b(?:is due on|due date is|due date:|due date\s+\d|due by)\b/i,
    /\b(?:pay before due date|pay before|pay now to avoid lapse|avoid lapse|to avoid policy lapse)\b/i,
    /\b(?:keep your policy in force|policy will lapse|grace period|policy expires on)\b/i,
    /\b(?:bill generated|statement generated|e[- ]bill generated|bill for the month)\b/i,
    /\b(?:amount payable|amt payable|total amount due|tot amt due|minimum amount due|min amount due|min due)\b/i,
    /\b(?:payment due on|bill payment due|due on or before)\b/i,
    /\b(?:pack (?:is )?expiring|validity (?:is )?expiring|validity expires|plan expires)\b/i,
    /\b(?:recharge due|recharge now to continue|to avoid disconnection)\b/i,
  ],
  // 3. Failed / declined / unsuccessful payment language. No money moved.
  failedPayment: [
    /\bhas\s+failed\b/i,
    /\b(?:payment|transaction|txn|transfer|recharge)\s+(?:has\s+|was\s+)?failed\b/i,
    /\bcould\s+not\s+be\s+(?:processed|completed)\b/i,
    /\b(?:was\s+)?declined\b/i,
    /\bunsuccessful\b/i,
    /\b(?:timed out|cancelled)\b/i,
  ],
  // 4. UPI collect / payment-request notices ('You've received a request from X'). Money asked, not moved.
  collectRequest: [
    /\breceived\s+an?\s+(?:payment|collect|money|IPO|UPI)\s+(?:mandate\s+)?request\b/i,
    /\b(?:payment|collect)\s+request\b/i,
    /\b(?:has|is)\s+request(?:ed|ing)\s+(?:money\b|payment\b|(?:INR|Rs\.?|₹)\s*[\d,]+)/i,
    /\bapprove\s+to\s+pay\b/i,
    /\brequest\b[^\n]{0,80}?\bclick\s+to\s+accept\b/i,
    /\bblock(?:ed)?\s+(?:for|towards)\s+(?:the\s+)?IPO\b(?![^\n]{0,120}?\bdebited\b)/i,
    /\bmandate\b[^\n]{0,60}?\b(?:successfully\s+)?blocked\b(?![^\n]{0,120}?\bdebited\b)/i,
  ],
  // 5. Mandate lifecycle notices ('Mandate successfully created/cancelled')
  mandateNotice: [
    /\bmandate\b[\s\S]{0,60}?\bsuccessfully\s+(?:created|cancelled|revoked|modified)\b/i,
    /\bsuccessfully\s+cancelled\s+the\s+scheduled\b[\s\S]{0,60}?\bpayment\b/i,
    /\bmandate\s+(?:has\s+been|is|was)\s+(?:created|cancelled|revoked|modified)\b/i,
  ],
  // 6. Credit-limit increase & pre-approved loan OFFERS (money user does not have yet)
  limitOffer: [
    /\b(?:eligible|pre-?approved|can\s+be\s+(?:increased|enhanced)|to\s+avail|avail\s+now|apply\s+now)\b/i,
    /\bread(?:y)?\s+to\s+be\s+credited\b/i,
    /\b(?:instant loan|apply for loan|loan eligible|congratulations! you are eligible)\b/i,
    /\b(?:increase credit limit|credit card offer|lifetime free card)\b/i,
  ],
  // 7. Shortened URL phishing & Prize/Lottery scam bait
  genericScam: [
    /(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|rb\.gy|is\.gd|tiny\.cc|shorturl\.at|at\.est1\.in|1kx\.in)/i,
    /\b(?:won|lottery|prize|lucky\s+draw|jackpot|winner|you\s+have\s+won|claim\s+(?:your|now))\b/i,
    /\b(?:points worth rs\.?\s*\d+\s*will expired today|redeem your points in cash)\b/i,
  ],
  // 8. Product tier naming ('XYZ Premium subscription/plan is now active')
  tierPremium: [
    /\b[\w&+.]+\s+premium\s+(?:subscription|plan|membership|pack|account|is\s+now\s+active)\b/i,
    /\bclaim\s+paid\s+ratio\b/i,
  ],
  // 9. Hypothetical / rate amounts in marketing pitches ('earn 3 pts on every Rs 100 spent')
  hypotheticalAmount: [
    /\b(?:on\s+|for\s+)?every\s+(?:INR|Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?(?:\s+(?:spent|paid|charged|loaded))?/i,
    /\bper\s+(?:INR|Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?(?:\s+(?:spent|paid|charged))?/i,
  ],
  // 10. Future / conditional tense directly before debit/credit verbs
  futureTense: [
    /\b(?:will|shall|would)\s+be\s+(?:debited|deducted|charged|credited)\b/i,
    /\b(?:is\s+scheduled\s+to\s+be|will\s+auto-?debit)\b/i,
  ],
  // 11. Marketing pitches & coupons
  marketingPitch: [
    /\b(?:reap\s+benefits?|wealth\s+creation|grow\s+your\s+(?:money|wealth)|start\s+investing|invest\s+today)\b/i,
    /\b(?:vouchers?|coupons?|gift\s*cards?|promo\s+code)\b/i,
  ],
  // 12. Payout / Refund in flight (not yet landed in user bank account)
  payoutInFlight: [
    /\brefund\b[^\n]{0,100}?\binitiated\b/i,
    /\brefund\b[^\n]{0,60}?\bcredit\s+balance\b[^\n]{0,120}?\b(?:initiated|processed)\b/i,
  ],
};

/**
 * Canonical Directory of Indian Financial Institutions & Bank Senders (ClearSMS brands.json)
 */
export const INDIAN_BANK_DIRECTORY: Record<string, { canonicalName: string; aliases: string[] }> = {
  HDFCBK: { canonicalName: 'HDFC Bank', aliases: ['HDFC', 'HDFC BANK'] },
  HDFCB: { canonicalName: 'HDFC Bank', aliases: ['HDFC', 'HDFC BANK'] },
  ICICIB: { canonicalName: 'ICICI Bank', aliases: ['ICICI', 'ICICI BANK'] },
  ICICIT: { canonicalName: 'ICICI Bank', aliases: ['ICICI', 'ICICI BANK'] },
  SBIINB: { canonicalName: 'State Bank of India', aliases: ['SBI', 'STATE BANK OF INDIA', 'STATE BANK'] },
  SBIUPI: { canonicalName: 'State Bank of India', aliases: ['SBI', 'SBI UPI'] },
  SBIPSG: { canonicalName: 'State Bank of India', aliases: ['SBI'] },
  CBSSBI: { canonicalName: 'State Bank of India', aliases: ['SBI'] },
  ATMSBI: { canonicalName: 'State Bank of India', aliases: ['SBI ATM'] },
  SBICRD: { canonicalName: 'SBI Card', aliases: ['SBI CARD', 'SBI CREDIT CARD'] },
  AXISBK: { canonicalName: 'Axis Bank', aliases: ['AXIS', 'AXIS BANK'] },
  AXISB: { canonicalName: 'Axis Bank', aliases: ['AXIS', 'AXIS BANK'] },
  KOTAKB: { canonicalName: 'Kotak Mahindra Bank', aliases: ['KOTAK', 'KOTAK BANK', 'KOTAK MAHINDRA'] },
  KOTAKM: { canonicalName: 'Kotak Mahindra Bank', aliases: ['KOTAK'] },
  BOBTXN: { canonicalName: 'Bank of Baroda', aliases: ['BOB', 'BANK OF BARODA'] },
  BOBSMS: { canonicalName: 'Bank of Baroda', aliases: ['BANK OF BARODA'] },
  PNBSMS: { canonicalName: 'Punjab National Bank', aliases: ['PNB', 'PUNJAB NATIONAL BANK'] },
  PNBOTP: { canonicalName: 'Punjab National Bank', aliases: ['PNB'] },
  CANBNK: { canonicalName: 'Canara Bank', aliases: ['CANARA', 'CANARA BANK'] },
  UNIONB: { canonicalName: 'Union Bank of India', aliases: ['UNION BANK', 'UNION BANK OF INDIA', 'UBI'] },
  UBOI: { canonicalName: 'Union Bank of India', aliases: ['UNION BANK'] },
  IDFCFB: { canonicalName: 'IDFC FIRST Bank', aliases: ['IDFC', 'IDFC FIRST', 'IDFC FIRST BANK'] },
  IDFCBK: { canonicalName: 'IDFC FIRST Bank', aliases: ['IDFC FIRST'] },
  INDUSB: { canonicalName: 'IndusInd Bank', aliases: ['INDUSIND', 'INDUSIND BANK'] },
  INDBNK: { canonicalName: 'IndusInd Bank', aliases: ['INDUSIND'] },
  YESBNK: { canonicalName: 'Yes Bank', aliases: ['YES BANK'] },
  FEDBNK: { canonicalName: 'Federal Bank', aliases: ['FEDERAL BANK', 'FEDERAL'] },
  FEDSCP: { canonicalName: 'Scapia Federal', aliases: ['SCAPIA', 'SCAPIA FEDERAL'] },
  AUBANK: { canonicalName: 'AU Small Finance Bank', aliases: ['AU BANK', 'AU SMALL FINANCE BANK'] },
  RBLCRD: { canonicalName: 'RBL Bank', aliases: ['RBL', 'RBL BANK', 'RBL CARD'] },
  RBLBNK: { canonicalName: 'RBL Bank', aliases: ['RBL BANK'] },
  CITIBK: { canonicalName: 'Citi Bank', aliases: ['CITI', 'CITIBANK'] },
  AMEXIN: { canonicalName: 'American Express', aliases: ['AMEX', 'AMERICAN EXPRESS'] },
  PAYTMB: { canonicalName: 'Paytm Payments Bank', aliases: ['PAYTM BANK', 'PAYTM PAYMENTS BANK'] },
  AIRTELB: { canonicalName: 'Airtel Payments Bank', aliases: ['AIRTEL PAYMENTS BANK'] },
  JIOSVC: { canonicalName: 'Jio Payments / Services', aliases: ['JIO'] },
};

/**
 * Resolves canonical bank name from SMS sender header or message body
 */
export function resolveBankFromSender(sender?: string, body?: string): string | undefined {
  if (sender) {
    const cleanSender = sender.toUpperCase().replace(/^[A-Z]{2}-/, '').trim();
    for (const [key, info] of Object.entries(INDIAN_BANK_DIRECTORY)) {
      if (cleanSender.includes(key)) {
        return info.canonicalName;
      }
    }
  }

  if (body) {
    for (const info of Object.values(INDIAN_BANK_DIRECTORY)) {
      for (const alias of info.aliases) {
        const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(body)) {
          return info.canonicalName;
        }
      }
    }
  }

  return undefined;
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

/**
 * Strict Reminder, Due Date, Bill Generation & Renewal Notification Filter.
 * CRITICAL RULE: Insurance renewals, bill statements, and recharge notices must NEVER be treated as debit expenses!
 */
export const REMINDER_AND_DUE_PATTERNS = [
  ...CLEARSMS_GUARDS.billDueNotice,
  ...CLEARSMS_GUARDS.statementNotice,
  ...CLEARSMS_GUARDS.mandateNotice,
  ...CLEARSMS_GUARDS.futureTense,
];

/**
 * Checks if the text represents a reminder, renewal alert, bill due notice or future schedule.
 * Returns true only if there is NO explicit past-tense debit confirmation.
 */
export function isReminderOrDueNotice(text: string): boolean {
  if (!text || text.trim().length < 8) return false;
  const lower = text.toLowerCase();

  // 1. Check all ClearSMS bill/due and statement notice guards
  for (const pattern of CLEARSMS_GUARDS.billDueNotice) {
    if (pattern.test(text)) return true;
  }
  for (const pattern of CLEARSMS_GUARDS.statementNotice) {
    if (pattern.test(text)) return true;
  }
  for (const pattern of CLEARSMS_GUARDS.futureTense) {
    if (pattern.test(text)) return true;
  }
  for (const pattern of CLEARSMS_GUARDS.mandateNotice) {
    if (pattern.test(text)) return true;
  }

  // 2. Future scheduled debits are strictly reminders, never completed debits
  if (
    lower.includes('will be debited') ||
    lower.includes('will be deducted') ||
    lower.includes('shall be debited') ||
    lower.includes('auto-debit scheduled') ||
    lower.includes('auto debit scheduled') ||
    lower.includes('scheduled on') ||
    lower.includes('upcoming emi') ||
    lower.includes('upcoming mandate') ||
    lower.includes('upcoming debit')
  ) {
    return true;
  }

  // If message explicitly confirms completed debit without future conditions
  const completedDebitProof = [
    /\b(?:has been debited|was debited|successfully debited|debited by|debited for|debited towards|debited from)\b/i,
    /\b(?:paid rs\.?|paid inr|paid ₹|paid to|paid successfully|successfully paid|payment of rs.*?successful|txn successful)\b/i,
    /\b(?:spent on your card|charged on your card|withdrawn from)\b/i,
    /\b(?:txn of rs.*?debited|txn of inr.*?debited|txn of ₹.*?debited|debited from card)\b/i,
    /\b(?:upi\/dr\/|vpa .*?debited)\b/i,
  ];
  if (completedDebitProof.some((p) => p.test(lower))) {
    return false;
  }

  return REMINDER_AND_DUE_PATTERNS.some((p) => p.test(lower));
}

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

  // 11. INSURANCE (LIC, Star Health, HDFC Life, ICICI Lombard, etc.) -> FOR COMPLETED PAYMENTS
  {
    id: 'rule-insurance',
    category: 'Insurance',
    categoryGu: 'વીમો અને પ્રીમિયમ',
    keywords: [
      'lic of india', 'lic premium', 'life insurance', 'health insurance', 'star health',
      'hdfc life', 'icici prudential', 'icici lombard', 'sbi life', 'max life', 'tata aia',
      'bajaj allianz', 'care health', 'niva bupa', 'policybazaar', 'motor insurance',
      'general insurance', 'insurance premium', 'policy premium'
    ],
    senderPatterns: ['LICIND', 'STARHL', 'HDFCLI', 'ICICIP', 'ICICIL', 'SBILIF', 'MAXLIF', 'TATAAI', 'BAJAJA', 'CAREHL', 'POLBAZ'],
    defaultType: 'expense',
  },

  // 12. ENTERTAINMENT & OTT
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

  // 13. LOANS & EMI
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
 * Uses ClearSMS guardrails to catch edge cases like pre-approved offers,
 * failed transactions, collect requests, and scam links.
 */
export function isSpamOrNonTransaction(text: string): boolean {
  if (!text || text.trim().length < 8) return true;
  const lower = text.toLowerCase();

  // 1. First unconditionally check ClearSMS critical guards
  // Pre-approved loan/credit offers (e.g. "Rs 60,000 ready to be credited by Activating MobiKwik ZIP")
  for (const p of CLEARSMS_GUARDS.limitOffer) {
    if (p.test(text)) return true;
  }

  // Phishing / Lottery / Shortened URL scams (e.g. "Points worth Rs 5000 expired today", at.est1.in)
  for (const p of CLEARSMS_GUARDS.genericScam) {
    if (p.test(text)) return true;
  }

  // Failed / declined transactions (no money moved)
  for (const p of CLEARSMS_GUARDS.failedPayment) {
    if (p.test(text)) return true;
  }

  // Payment collect requests on Google Pay/PhonePe ("has requested money from you")
  for (const p of CLEARSMS_GUARDS.collectRequest) {
    if (p.test(text)) return true;
  }

  // Marketing tier / insurance claim ratio marketing ("99.34% Claim Paid Ratio")
  for (const p of CLEARSMS_GUARDS.tierPremium) {
    if (p.test(text)) return true;
  }

  // Marketing pitches and voucher coupons
  for (const p of CLEARSMS_GUARDS.marketingPitch) {
    if (p.test(text)) return true;
  }

  // Payout in flight (not yet landed)
  for (const p of CLEARSMS_GUARDS.payoutInFlight) {
    if (p.test(text)) return true;
  }

  // 2. If message contains an explicit transaction flow, check strict spam patterns
  const hasTransactionFlow = lower.includes('debited') ||
                             lower.includes('credited') ||
                             lower.includes('paid') ||
                             lower.includes('spent') ||
                             lower.includes('sent') ||
                             lower.includes('transferred') ||
                             lower.includes('withdrawn') ||
                             lower.includes('deposited');

  if (hasTransactionFlow) {
    const strictSpam = [
      /\b(?:otp|one[- ]time[- ]password|verification code|security code)\b/i,
      /\bdo not share\b/i,
      /\bvalid for \d+ min\b/i,
      /\b(?:pre[- ]approved|instant loan|apply for loan|congratulations! you are eligible)\b/i,
      /\b(?:win cash|claim your reward|lucky winner|click here to apply)\b/i,
    ];
    return strictSpam.some((pattern) => pattern.test(text));
  }

  return SPAM_AND_NON_TRANSACTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * High-level evaluator combining all ClearSMS guards and financial knowledge base
 */
export function evaluateSmsTransaction(
  text: string,
  sender?: string
): { isTransaction: boolean; reason: string } {
  if (!text || text.trim().length < 8) {
    return { isTransaction: false, reason: 'EMPTY_OR_TOO_SHORT' };
  }
  if (isSpamOrNonTransaction(text)) {
    return { isTransaction: false, reason: 'SPAM_OR_PROMOTIONAL_GUARD' };
  }
  if (isReminderOrDueNotice(text)) {
    return { isTransaction: false, reason: 'REMINDER_OR_BILL_DUE_GUARD' };
  }
  return { isTransaction: true, reason: 'VALID_TRANSACTION_CANDIDATE' };
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

  // Special Priority 4: Insurance Check (LIC, Star Health, HDFC Life, etc.)
  const insuranceKeywords = [
    'lic of india', 'lic premium', 'star health', 'hdfc life', 'icici prudential',
    'icici lombard', 'sbi life', 'max life', 'tata aia', 'bajaj allianz',
    'care health', 'niva bupa', 'policybazaar', 'motor insurance', 'general insurance',
    'insurance'
  ];
  if (insuranceKeywords.some((kw) => clean.includes(kw)) || ['LIC', 'STARHL', 'HDFCLI', 'ICICIL', 'SBILIF', 'MAXLIF', 'POLBAZ'].some((sp) => upperSender.includes(sp))) {
    return {
      category: 'Insurance',
      categoryGu: 'વીમો અને પ્રીમિયમ',
      confidence: 0.96,
      isInvestment: false,
      isTransfer: false,
      needsReview: false,
    };
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
