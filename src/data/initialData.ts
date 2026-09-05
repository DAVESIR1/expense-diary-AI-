import { Category, Transaction, UserProfile } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', nameGu: 'ખોરાક અને નાસ્તો', icon: 'UtensilsCrossed', type: 'expense', color: '#EA580C' },
  { id: 'cat-groceries', name: 'Groceries', nameGu: 'કરિયાણું અને શાકભાજી', icon: 'ShoppingBag', type: 'expense', color: '#16A34A' },
  { id: 'cat-shopping', name: 'Shopping', nameGu: 'શોપિંગ અને ખરીદી', icon: 'ShoppingBag', type: 'expense', color: '#2563EB' },
  { id: 'cat-bills', name: 'Bills & Utilities', nameGu: 'બિલ અને રિચાર્જ', icon: 'Receipt', type: 'expense', color: '#D97706' },
  { id: 'cat-travel', name: 'Travel & Fuel', nameGu: 'મુસાફરી અને પેટ્રોલ', icon: 'Car', type: 'expense', color: '#0891B2' },
  { id: 'cat-health', name: 'Health & Medicines', nameGu: 'દવાઓ અને આરોગ્ય', icon: 'HeartPulse', type: 'expense', color: '#DC2626' },
  { id: 'cat-entertainment', name: 'Entertainment', nameGu: 'મનોરંજન અને OTT', icon: 'Tv', type: 'expense', color: '#9333EA' },
  { id: 'cat-salary', name: 'Salary', nameGu: 'પગાર (Salary)', icon: 'Briefcase', type: 'income', color: '#059669' },
  { id: 'cat-business', name: 'Business & Freelance', nameGu: 'વેપાર અને ફ્રીલાન્સ', icon: 'TrendingUp', type: 'income', color: '#0D9488' },
  { id: 'cat-investment-outflow', name: 'Investment', nameGu: 'રોકાણ (NPS/SIP)', icon: 'PiggyBank', type: 'expense', color: '#4F46E5' },
  { id: 'cat-transfer', name: 'Transfer', nameGu: 'ટ્રાન્સફર (UPI / ખાતામાં)', icon: 'ArrowLeftRight', type: 'both', color: '#0284C7' },
  { id: 'cat-investment', name: 'Investment Returns', nameGu: 'રોકાણ પર વળતર / રીડીમ્પશન', icon: 'TrendingUp', type: 'income', color: '#6366F1' },
  { id: 'cat-other-income', name: 'Other Income', nameGu: 'અન્ય આવક', icon: 'ArrowDownLeft', type: 'income', color: '#10B981' },
  { id: 'cat-other-expense', name: 'Other Expense', nameGu: 'અન્ય પરચુરણ ખર્ચ', icon: 'ArrowUpRight', type: 'expense', color: '#64748B' },
];

export const INITIAL_USER_PROFILE: UserProfile = {
  name: '',
  email: '',
  mobile: '',
  avatarUrl: '',
  monthlyBudget: 0,
  currency: '₹',
  dailyReminderTime: '20:30',
  enableDailyReminder: true,
};

// Start with zero fake transactions - a clean personal diary
export const INITIAL_TRANSACTIONS: Transaction[] = [];

// Optional sample transactions for testing via Settings Screen
export const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-sample-1',
    type: 'income',
    amount: 50000,
    title: 'Monthly Salary',
    category: 'Salary',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    vendorOrPerson: 'Employer Direct Deposit',
    paymentMode: 'Bank Transfer',
    notes: 'Salary credit',
    isAiGenerated: false,
  },
  {
    id: 'tx-sample-2',
    type: 'expense',
    amount: 1200,
    title: 'Weekly Groceries',
    category: 'Groceries',
    date: new Date().toISOString().split('T')[0],
    time: '12:30',
    vendorOrPerson: 'Fresh Mart Store',
    paymentMode: 'UPI',
    notes: 'Vegetables and dairy',
    isAiGenerated: false,
  },
  {
    id: 'tx-sample-3',
    type: 'expense',
    amount: 450,
    title: 'Restaurant Lunch',
    category: 'Food & Dining',
    date: new Date().toISOString().split('T')[0],
    time: '13:45',
    vendorOrPerson: 'City Cafe',
    paymentMode: 'Cash',
    notes: 'Lunch with colleagues',
    isAiGenerated: false,
  },
];
