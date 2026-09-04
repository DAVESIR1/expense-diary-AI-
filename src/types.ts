export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  title: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  vendorOrPerson?: string;
  mobileNumber?: string;
  paymentMode: string; // Cash, UPI, Bank Transfer, Card, etc.
  notes?: string;
  isAiGenerated?: boolean;
  needsConfirmation?: boolean;
  evidence?: string;
  evidenceSource?: 'sms' | 'notification' | 'manual';
  evidenceImage?: string; // base64 encoded photo or receipt image
  evidenceSender?: string; // SMS sender address (e.g. AX-HDFCBK, VM-SBIINB)
  referenceNumber?: string;
  updatedAt?: string;
}

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  content: string;
  mood?: 'happy' | 'neutral' | 'sad' | 'excited' | 'stressed' | 'peaceful';
  tags?: string[];
  linkedExpenseIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type BorrowLendDirection = 'borrowed' | 'lent';
export type BorrowLendStatus = 'pending' | 'partial' | 'settled';

export interface BorrowedLentRecord {
  id: string;
  direction: BorrowLendDirection;
  amount: number;
  partialAmountReturned?: number;
  personName: string;
  contactNumber?: string;
  date: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  note?: string;
  status: BorrowLendStatus;
  settledDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityConfig {
  hasCompletedSetup: boolean;
  isLocked: boolean;
  pinHash?: string;
  pinSalt?: string;
  biometricsEnabled: boolean;
  autoLockMinutes: number; // 0 for immediate, 1, 5, 15, -1 for disabled
  recoveryWordsHash?: string;
  recoveryWordsSalt?: string;
  diaryPinHash?: string;
  diaryPinSalt?: string;
  diaryLockEnabled: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameGu: string;
  icon: string;
  type: 'income' | 'expense' | 'both';
  color: string;
}

export type ReportPeriod =
  | 'today'
  | 'date'
  | 'month'
  | 'quarter'
  | 'six_months'
  | 'year'
  | 'custom_range'
  | 'custom_days';

export interface ReportFilter {
  period: ReportPeriod;
  selectedDate?: string;
  selectedMonth?: string; // YYYY-MM
  selectedYear?: number;
  customStartDate?: string;
  customEndDate?: string;
  customDaysCount?: number;
  category?: string;
  personQuery?: string;
  typeFilter?: 'all' | 'income' | 'expense';
  selectedCategories?: string[];
  includeEvidence?: boolean;
}

export type PageTheme = 'paper' | 'mint' | 'lavender' | 'amber' | 'slate' | 'white';
export type LayoutStyle = 'box' | 'minimal';

export interface ReportDesign {
  pageTheme: PageTheme;
  layoutStyle: LayoutStyle;
  selectedColumns: string[];
}

export interface UserProfile {
  name: string;
  email: string;
  mobile: string;
  avatarUrl: string;
  monthlyBudget: number;
  currency: string;
  dailyReminderTime: string;
  enableDailyReminder: boolean;
}

export interface AIAnalysisResult {
  topSpendingCategory: string;
  topSpendingInsight: string;
  hiddenChargesWarning: string | null;
  savingAdvice: string[];
  healthScore: number;
}

export interface PendingAIMessage {
  id: string;
  rawText: string;
  parsedData: {
    type: TransactionType;
    amount: number;
    title: string;
    category: string;
    vendorOrPerson?: string;
    paymentMode: string;
    notes?: string;
    confirmationQuestion: string;
  };
  detectedAt: string;
}

export interface AppActivityAlert {
  id: string;
  appName: string;
  timeString: string;
  question: string;
}
