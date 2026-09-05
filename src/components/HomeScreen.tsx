import React, { useState } from 'react';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Building2,
  Phone,
  Wallet,
  RefreshCw,
  X,
  ShieldCheck,
  Image as ImageIcon,
  Edit3,
  Calendar,
  ChevronDown,
  PiggyBank,
  ShoppingBag,
  Receipt,
  ArrowLeftRight,
  Banknote,
  Sparkles
} from 'lucide-react';
import { Transaction, TransactionType, PendingAIMessage, Category, UserProfile } from '../types';
import { TranslationStrings } from '../data/languages';

interface HomeScreenProps {
  transactions: Transaction[];
  onOpenAddModal: (type: TransactionType) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  pendingAiMessages: PendingAIMessage[];
  onConfirmAiMessage: (messageId: string, customCategory?: string) => void;
  onDismissAiMessage: (messageId: string) => void;
  categories: Category[];
  t: TranslationStrings;
  currency: string;
  currentLang?: string;
  profile?: UserProfile;
  onTriggerScan?: () => Promise<number>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  transactions,
  onOpenAddModal,
  onDeleteTransaction,
  pendingAiMessages,
  onConfirmAiMessage,
  onDismissAiMessage,
  categories,
  t,
  currency,
  currentLang = 'en',
  profile,
  onTriggerScan,
  onEditTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterType, setSelectedFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [editingCategoryMsgId, setEditingCategoryMsgId] = useState<string | null>(null);
  const [tempCategory, setTempCategory] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNoTxModal, setShowNoTxModal] = useState(false);
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [previewEvidenceTx, setPreviewEvidenceTx] = useState<Transaction | null>(null);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);

  // Time Period Filter: 'today' | 'month' (default) | 'year' | 'all'
  const [timePeriod, setTimePeriod] = useState<'today' | 'month' | 'year' | 'all'>('month');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'investment' | 'shopping' | 'bills' | 'transfer' | 'offline'>('all');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const isGu = currentLang === 'gu';

  const todayDateStr = new Date().toISOString().split('T')[0];

  const handlePullRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    setShowNoTxModal(false);
    try {
      if (onTriggerScan) {
        const found = await onTriggerScan();
        if (found === 0) {
          setShowNoTxModal(true);
        }
      } else {
        setTimeout(() => setShowNoTxModal(true), 600);
      }
    } catch {
      setShowNoTxModal(true);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  // Transactions filtered by selected time period (today, month, year, all)
  const periodTransactions = transactions.filter((tx) => {
    if (timePeriod === 'today') {
      return tx.date === todayDateStr;
    }
    if (timePeriod === 'month') {
      return tx.date.startsWith(filterMonth);
    }
    if (timePeriod === 'year') {
      return tx.date.startsWith(filterYear);
    }
    return true; // 'all'
  });

  // Helper to match category filter
  const matchesCategoryFilter = (item: Transaction, filter: string) => {
    if (filter === 'all') return true;
    const c = item.category.toLowerCase();
    if (filter === 'investment') {
      return c.includes('investment') || c.includes('રોકાણ') || c.includes('nps') || c.includes('sip') || c.includes('mutual');
    }
    if (filter === 'shopping') {
      return c.includes('shopping') || c.includes('ખરીદી');
    }
    if (filter === 'bills') {
      return c.includes('bill') || c.includes('બિલ') || c.includes('utilit') || c.includes('recharge') || c.includes('fastag') || c.includes('insurance') || c.includes('વીમો');
    }
    if (filter === 'transfer') {
      return c.includes('transfer') || c.includes('ટ્રાન્સફર') || item.paymentMode === 'UPI';
    }
    if (filter === 'offline') {
      return item.paymentMode === 'Cash' || item.paymentMode === 'ATM / Cash' || c.includes('other');
    }
    return true;
  };

  // Transactions matching active category filter within the selected time period
  const categoryPeriodTransactions = periodTransactions.filter((tx) => matchesCategoryFilter(tx, categoryFilter));

  // Calculate totals dynamically based on selected period AND active category filter (Requirement 4)
  // CRITICAL REQUIREMENT: Investments (NPS, SIP, etc.) are NOT income!
  const totalIncome = categoryPeriodTransactions
    .filter((tx) => {
      if (tx.type !== 'income') return false;
      const lowerCat = tx.category.toLowerCase();
      // Exclude investment contributions if recorded with type 'income'
      if (lowerCat.includes('investment') && !lowerCat.includes('return') && !lowerCat.includes('વળતર') && !lowerCat.includes('redemption')) {
        return false;
      }
      return true;
    })
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpense = categoryPeriodTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  // Total investment tracked in selected period & category
  const totalInvestment = categoryPeriodTransactions
    .filter((tx) => {
      const lowerCat = tx.category.toLowerCase();
      return lowerCat.includes('investment') || lowerCat.includes('રોકાણ') || lowerCat.includes('nps') || lowerCat.includes('sip');
    })
    .reduce((sum, item) => sum + item.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Filter transactions for list (combines period + search + income/expense filter + category tabs)
  const filteredTransactions = categoryPeriodTransactions.filter((item) => {
    if (selectedFilterType !== 'all' && item.type !== selectedFilterType) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchVendor = item.vendorOrPerson?.toLowerCase().includes(q);
      const matchMobile = item.mobileNumber?.includes(q);
      const matchAmount = item.amount.toString().includes(q);
      return matchTitle || matchCategory || matchVendor || matchMobile || matchAmount;
    }
    return true;
  });

  // Current month expense for budget tracker
  const currentMonthPrefix = new Date().toISOString().substring(0, 7);
  const currentMonthExpense = transactions
    .filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthPrefix))
    .reduce((sum, item) => sum + item.amount, 0);
  const monthlyBudgetGoal = profile?.monthlyBudget || 0;
  const budgetPercentage = monthlyBudgetGoal > 0 ? Math.min(100, Math.round((currentMonthExpense / monthlyBudgetGoal) * 100)) : 0;

  return (
    <div 
      id="home-screen-container" 
      className="space-y-5 pb-28 select-none transition-all"
      onTouchStart={(e) => {
        if (window.scrollY <= 5) {
          setTouchStartY(e.touches[0].clientY);
        }
      }}
      onTouchMove={(e) => {
        if (touchStartY > 0 && window.scrollY <= 5) {
          const currentY = e.touches[0].clientY;
          const diff = currentY - touchStartY;
          if (diff > 0) {
            setPullDistance(Math.min(95, Math.round(diff * 0.45)));
          }
        }
      }}
      onTouchEnd={() => {
        if (pullDistance >= 60 && !isRefreshing) {
          handlePullRefresh();
        } else {
          setPullDistance(0);
        }
        setTouchStartY(0);
      }}
    >
      {/* 1. TOP PULL-DOWN MINIMAL ARROW & GESTURE REVEAL */}
      <div className="flex flex-col items-center justify-center -mt-2 mb-1">
        {/* Blinking Pull-Down Indicator (Only icon, no static cluttered text) */}
        {!isRefreshing && pullDistance === 0 && (
          <button
            type="button"
            onClick={handlePullRefresh}
            className="flex flex-col items-center justify-center py-1 opacity-70 hover:opacity-100 transition cursor-pointer group"
            title={isGu ? 'નીચે ખેંચો અથવા ટેપ કરી સ્કેન કરો' : 'Pull down or tap to scan'}
          >
            <ChevronDown className="w-5 h-5 text-emerald-600 animate-bounce group-hover:scale-110 transition" />
          </button>
        )}

        {/* Dynamic Pull Gesture Reveal (Visible only while user is actively dragging down) */}
        {pullDistance > 0 && !isRefreshing && (
          <div 
            style={{ height: `${pullDistance}px` }} 
            className="w-full flex items-center justify-center bg-gradient-to-b from-emerald-100/90 to-emerald-50/50 rounded-2xl border border-emerald-200 shadow-2xs transition-all overflow-hidden px-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ChevronDown className={`w-4 h-4 text-emerald-700 transition-transform duration-200 ${
                pullDistance >= 60 ? 'rotate-180 text-emerald-900' : ''
              }`} />
              <span>
                {pullDistance >= 60 
                  ? (isGu ? 'સ્કેનિંગ શરૂ કરવા છોડી દો!' : 'Release to start scanning!') 
                  : (isGu ? 'નવા SMS, નોટિફિકેશન અને UPI વ્યવહારો સ્કેન કરવા નીચે ખેંચો...' : 'Pull down to scan new transactions...')}
              </span>
            </div>
          </div>
        )}

        {/* Active Scanning Minimal State */}
        {isRefreshing && (
          <div className="w-full py-3 px-4 rounded-2xl bg-emerald-950 text-white flex items-center justify-center gap-3 shadow-md animate-pulse">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            <span className="text-xs font-bold tracking-wide">
              {isGu ? 'નવા SMS, નોટિફિકેશન અને UPI વ્યવહારો સ્કેન થઈ રહ્યા છે...' : 'Scanning SMS, notifications & UPI expenses...'}
            </span>
          </div>
        )}
      </div>

      {/* Fullscreen Interactive Modal when NO new transactions detected */}
      {showNoTxModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-stone-900">
                {isGu ? 'કોઈ નવો SMS કે વ્યવહાર મળ્યો નથી' : 'No New Transactions Found'}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                {isGu 
                  ? 'તમારા તાજેતરના SMS કે નોટિફિકેશનમાં કોઈ નવો વ્યવહાર મળ્યો નથી. શું તમે જાતે ખર્ચ કે આવક ઉમેરવા માંગો છો?' 
                  : 'No new bank or UPI transactions were detected in recent messages. Would you like to add one manually?'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoTxModal(false);
                  onOpenAddModal('expense');
                }}
                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isGu ? 'ખર્ચ ઉમેરો (-)' : 'Add Expense'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNoTxModal(false);
                  onOpenAddModal('income');
                }}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isGu ? 'આવક ઉમેરો (+)' : 'Add Income'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowNoTxModal(false)}
              className="w-full py-2.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition cursor-pointer"
            >
              {isGu ? 'બંધ કરો' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Pending AI Transaction Approval Banner - ONLY renders when there are real pending items */}
      {pendingAiMessages.length > 0 && (
        <div id="ai-pending-notifications" className="space-y-3">
          {pendingAiMessages.map((msg) => {
            const isInc = msg.parsedData.type === 'income';
            return (
              <div
                key={msg.id}
                id={`ai-pending-card-${msg.id}`}
                className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-indigo-50/70 p-5 sm:p-6 shadow-sm transition-all"
              >
                <div className="flex gap-4 sm:gap-5 items-start relative z-10">
                  <div className="p-3 rounded-2xl bg-white text-indigo-600 shadow-xs shrink-0">
                    <CheckCircle2 className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-indigo-950 font-bold text-base sm:text-lg flex items-center gap-2">
                        <span>{t.aiConfirmationTitle}</span>
                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          Smart
                        </span>
                      </h3>
                      <span className="text-xs text-indigo-600/80 font-mono font-medium">
                        {new Date(msg.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-medium text-indigo-900 leading-relaxed">
                      {msg.parsedData.confirmationQuestion}
                    </p>

                    {/* Detected details pill */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-bold px-2.5 py-1 rounded-lg ${
                          isInc
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isInc ? `+${currency}` : `-${currency}`}
                        {msg.parsedData.amount.toLocaleString()}
                      </span>

                      {/* Category selector / badge */}
                      {editingCategoryMsgId === msg.id ? (
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-indigo-200 px-2 py-0.5">
                          <select
                            value={tempCategory || msg.parsedData.category}
                            onChange={(e) => setTempCategory(e.target.value)}
                            className="text-xs font-semibold text-stone-700 bg-transparent outline-none cursor-pointer"
                          >
                            {categories
                              .filter((c) => c.type === 'both' || c.type === msg.parsedData.type)
                              .map((c) => (
                                <option key={c.id} value={c.name}>
                                  {isGu && c.nameGu ? c.nameGu : c.name}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => setEditingCategoryMsgId(null)}
                            className="text-indigo-600 text-xs font-bold px-1.5 hover:underline cursor-pointer"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCategoryMsgId(msg.id);
                            setTempCategory(msg.parsedData.category);
                          }}
                          className="bg-white/80 hover:bg-white text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
                        >
                          {t.category}: {tempCategory || msg.parsedData.category} ✎
                        </button>
                      )}

                      {msg.parsedData.vendorOrPerson && (
                        <span className="bg-white/80 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg">
                          {msg.parsedData.vendorOrPerson}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => handleConfirm(msg.id, tempCategory || msg.parsedData.category)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.confirmAdd}</span>
                      </button>

                      <button
                        onClick={() => onDismissAiMessage(msg.id)}
                        className="bg-white/80 hover:bg-white text-stone-600 border border-stone-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
                      >
                        {t.ignore}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PERIOD & CATEGORY FILTER BAR */}
      <div className="space-y-2">
        <div
          id="home-period-filter-bar"
          className="bg-white rounded-2xl p-2.5 sm:p-3.5 border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5"
        >
          {/* Time Period Tabs: Today (Day), Month, Year, All */}
          <div className="flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTimePeriod('today')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timePeriod === 'today'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {isGu ? 'આજે (દિવસ)' : 'Today'}
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('month')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timePeriod === 'month'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {isGu ? 'મહિનો' : 'Month'}
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('year')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timePeriod === 'year'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {isGu ? 'વર્ષ' : 'Year'}
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('all')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                timePeriod === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {isGu ? 'બધા' : 'All'}
            </button>
          </div>

          {/* Dynamic Selector or Net Balance indicator */}
          <div className="flex items-center gap-2">
            {timePeriod === 'month' && (
              <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl text-xs font-semibold text-stone-700">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => {
                    if (e.target.value) setFilterMonth(e.target.value);
                  }}
                  className="bg-transparent border-none outline-none text-xs text-stone-800 font-medium cursor-pointer"
                />
              </div>
            )}

            {timePeriod === 'year' && (
              <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-xl text-xs font-semibold text-stone-700">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-stone-800 font-medium cursor-pointer"
                >
                  {[0, 1, 2, 3, 4].map((offset) => {
                    const y = (new Date().getFullYear() - offset).toString();
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Net Balance badge for selected period */}
            <div className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border ${
              netBalance >= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span>{isGu ? 'બચત: ' : 'Net: '}</span>
              <span>{currency}{netBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 2. CATEGORY QUICK-FILTER TABS (Requirement 4: Investment, Shopping, Bills, Transfer, Offline) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-stone-800 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span>{isGu ? 'બધા વ્યવહાર' : 'All'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('investment')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              categoryFilter === 'investment'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>{isGu ? 'રોકાણ (NPS/SIP)' : 'Investment'}</span>
            {totalInvestment > 0 && (
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-md font-mono">
                {currency}{totalInvestment.toLocaleString()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('shopping')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              categoryFilter === 'shopping'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{isGu ? 'શોપિંગ' : 'Shopping'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('bills')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              categoryFilter === 'bills'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isGu ? 'બિલ પેમેન્ટ' : 'Bills & Recharge'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('transfer')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              categoryFilter === 'transfer'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{isGu ? 'UPI ટ્રાન્સફર' : 'Transfers'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('offline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              categoryFilter === 'offline'
                ? 'bg-stone-700 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>{isGu ? 'રોકડ / ઓફલાઇન' : 'Cash / Offline'}</span>
          </button>
        </div>
      </div>


      {/* TOP CARDS: Minimal Income & Expense with Inline Quick Add Buttons */}
      <section id="income-expense-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Income Card (Soft Green) */}
        <div
          id="home-income-card"
          className="bg-[#EBFBEE] rounded-3xl p-6 sm:p-7 border border-[#D1F7D9] flex flex-col justify-between min-h-[160px] shadow-xs hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#2D6A4F] text-sm sm:text-base font-bold tracking-tight mb-1 flex items-center gap-1.5">
                <span>{t.income}</span>
                {categoryFilter !== 'all' && (
                  <span className="text-[10px] bg-[#D1F7D9] text-[#1B4332] px-2 py-0.5 rounded-full font-bold">
                    {categoryFilter === 'investment' ? (isGu ? 'રોકાણ' : 'Investment') :
                     categoryFilter === 'shopping' ? (isGu ? 'શોપિંગ' : 'Shopping') :
                     categoryFilter === 'bills' ? (isGu ? 'બિલ' : 'Bills') :
                     categoryFilter === 'transfer' ? (isGu ? 'ટ્રાન્સફર' : 'Transfer') :
                     categoryFilter === 'offline' ? (isGu ? 'રોકડ' : 'Cash') : categoryFilter}
                  </span>
                )}
              </p>
              <h1
                id="home-total-income-value"
                className="text-4xl sm:text-5xl font-bold text-[#1B4332] tracking-tight font-mono"
              >
                {currency}{totalIncome.toLocaleString()}
              </h1>
            </div>
            {/* Inline Quick Add Button */}
            <button
              id="home-inline-add-income-btn"
              onClick={() => onOpenAddModal('income')}
              className="px-3 py-1.5 rounded-xl bg-[#2D6A4F] text-white text-xs font-bold shadow-xs hover:bg-[#1B4332] transition flex items-center gap-1 cursor-pointer active:scale-95"
              title={t.addIncome}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{isGu ? 'આવક ઉમેરો' : 'Add'}</span>
            </button>
          </div>
          
          <div className="flex items-center gap-2 text-[#40916C] text-xs font-semibold mt-3">
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>
              {categoryPeriodTransactions.filter((x) => x.type === 'income').length} {t.income}
            </span>
          </div>
        </div>

        {/* Expense Card (Soft Red) */}
        <div
          id="home-expense-card"
          className="bg-[#FFF0F0] rounded-3xl p-6 sm:p-7 border border-[#FEE2E2] flex flex-col justify-between min-h-[160px] shadow-xs hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#C53030] text-sm sm:text-base font-bold tracking-tight mb-1 flex items-center gap-1.5">
                <span>{t.expense}</span>
                {categoryFilter !== 'all' && (
                  <span className="text-[10px] bg-[#FEE2E2] text-[#742A2A] px-2 py-0.5 rounded-full font-bold">
                    {categoryFilter === 'investment' ? (isGu ? 'રોકાણ' : 'Investment') :
                     categoryFilter === 'shopping' ? (isGu ? 'શોપિંગ' : 'Shopping') :
                     categoryFilter === 'bills' ? (isGu ? 'બિલ' : 'Bills') :
                     categoryFilter === 'transfer' ? (isGu ? 'ટ્રાન્સફર' : 'Transfer') :
                     categoryFilter === 'offline' ? (isGu ? 'રોકડ' : 'Cash') : categoryFilter}
                  </span>
                )}
              </p>
              <h1
                id="home-total-expense-value"
                className="text-4xl sm:text-5xl font-bold text-[#742A2A] tracking-tight font-mono"
              >
                {currency}{totalExpense.toLocaleString()}
              </h1>
            </div>
            {/* Inline Quick Add Button */}
            <button
              id="home-inline-add-expense-btn"
              onClick={() => onOpenAddModal('expense')}
              className="px-3 py-1.5 rounded-xl bg-[#C53030] text-white text-xs font-bold shadow-xs hover:bg-[#742A2A] transition flex items-center gap-1 cursor-pointer active:scale-95"
              title={t.addExpense}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{isGu ? 'ખર્ચ ઉમેરો' : 'Add'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[#C53030] text-xs font-semibold mt-3">
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>
              {categoryPeriodTransactions.filter((x) => x.type === 'expense').length} {t.expense}
            </span>
          </div>
        </div>
      </section>

      {/* Net Balance & Monthly Budget Utilization Card */}
      <div className="space-y-2">
        <div
          id="home-balance-banner"
          className="flex items-center justify-between px-5 sm:px-6 py-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs"
        >
          <div className="flex items-center gap-2.5 text-stone-500">
            <Wallet className="w-4 h-4 text-stone-400 stroke-[2]" />
            <span className="text-xs uppercase tracking-wider font-semibold">{t.balance}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              id="home-net-balance-value"
              className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${
                netBalance >= 0 ? 'text-[#1B4332]' : 'text-[#742A2A]'
              }`}
            >
              {currency}{netBalance.toLocaleString()}
            </span>
          </div>
        </div>

        {monthlyBudgetGoal > 0 && (
          <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-600">
                {isGu ? 'આ મહિનાનું બજેટ લક્ષ્ય:' : 'Monthly Budget Progress:'}
              </span>
              <span className="font-mono font-bold text-stone-800">
                {currency}{currentMonthExpense.toLocaleString()} / {currency}{monthlyBudgetGoal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPercentage > 90
                    ? 'bg-rose-500'
                    : budgetPercentage > 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TRANSACTIONS SECTION */}
      <section id="recent-transactions-section" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-stone-800 tracking-tight">
              {t.recentTransactions}
            </h2>
            <span className="text-xs bg-stone-100 text-stone-600 font-mono font-bold px-2 py-0.5 rounded-full">
              {filteredTransactions.length}
            </span>
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setSelectedFilterType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                selectedFilterType === 'all'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {t.allCategories}
            </button>
            <button
              onClick={() => setSelectedFilterType('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                selectedFilterType === 'income'
                  ? 'bg-[#1B4332] text-white shadow-xs'
                  : 'bg-white text-[#2D6A4F] border border-[#D1F7D9] hover:bg-[#EBFBEE]'
              }`}
            >
              {t.income}
            </button>
            <button
              onClick={() => setSelectedFilterType('expense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                selectedFilterType === 'expense'
                  ? 'bg-[#742A2A] text-white shadow-xs'
                  : 'bg-white text-[#C53030] border border-[#FEE2E2] hover:bg-[#FFF0F0]'
              }`}
            >
              {t.expense}
            </button>
          </div>
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            id="search-transactions-input"
            type="text"
            placeholder={`${t.title}, ${t.category}, ${t.personOrMobile}, ${t.amount}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white hover:border-stone-300 focus:border-indigo-500 outline-none text-stone-800 transition shadow-xs"
          />
        </div>

        {/* List items */}
        {filteredTransactions.length === 0 ? (
          <div
            id="empty-transactions-state"
            className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-stone-200 bg-white/70"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
              <Search className="w-5 h-5 stroke-[1.75]" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-stone-700">{t.noTransactions}</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Tap "{t.addIncome}" or "{t.addExpense}" above to record your first transaction.
            </p>
          </div>
        ) : (
          <div id="transactions-list" className="space-y-2.5">
            {filteredTransactions.map((item) => {
              const isInc = item.type === 'income';
              return (
                <div
                  key={item.id}
                  id={`transaction-item-${item.id}`}
                  onClick={() => setSelectedTxForDetail(item)}
                  className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200 hover:border-emerald-300 hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Icon badge */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isInc
                          ? 'bg-[#EBFBEE] text-[#2D6A4F] border border-[#D1F7D9]'
                          : 'bg-[#FFF0F0] text-[#C53030] border border-[#FEE2E2]'
                      }`}
                    >
                      {isInc ? (
                        <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-stone-800 truncate">
                          {item.title}
                        </h4>
                        {item.isAiGenerated && (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase">
                            AI
                          </span>
                        )}
                        {(item.evidence || item.evidenceImage || item.referenceNumber) && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded"
                            title={isGu ? 'પુરાવો / રસીદ ઉપલબ્ધ છે' : 'Proof / Evidence Available'}
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>{item.evidenceImage ? (isGu ? 'રસીદ' : 'Receipt') : (isGu ? 'પુરાવો' : 'Proof')}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-stone-400 mt-0.5 font-medium">
                        <span className="text-stone-600 font-semibold">{item.category}</span>
                        <span>•</span>
                        <span>{item.date}</span>
                        {item.time && <span>{item.time}</span>}
                        {item.paymentMode && (
                          <>
                            <span>•</span>
                            <span className="bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded text-[10px]">
                              {item.paymentMode}
                            </span>
                          </>
                        )}
                        {item.vendorOrPerson && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{item.vendorOrPerson}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Amount and Action Buttons */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 pl-2">
                    <span
                      className={`text-sm sm:text-base font-bold font-mono ${
                        isInc ? 'text-[#1B4332]' : 'text-[#742A2A]'
                      }`}
                    >
                      {isInc ? '+' : '-'}{currency}{item.amount.toLocaleString()}
                    </span>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTransaction?.(item);
                      }}
                      title={isGu ? 'ફેરફાર કરો' : 'Edit'}
                      className="p-1.5 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTransaction(item.id);
                      }}
                      title={t.delete}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* TRANSACTION DETAILS & EVIDENCE MODAL (On Tap) */}
      {selectedTxForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedTxForDetail(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 text-stone-800 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    selectedTxForDetail.type === 'income'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedTxForDetail.type === 'income' ? (
                    <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                    {selectedTxForDetail.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                    <span className="font-bold text-stone-700">{selectedTxForDetail.category}</span>
                    <span>•</span>
                    <span>{selectedTxForDetail.date}</span>
                    {selectedTxForDetail.time && <span>{selectedTxForDetail.time}</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTxForDetail(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Banner & Type */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              selectedTxForDetail.type === 'income'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                  {selectedTxForDetail.type === 'income' ? (isGu ? 'જમા થયેલી રકમ (આવક)' : 'Received Amount (Income)') : (isGu ? 'ચૂકવેલી રકમ (જાવક/ખર્ચ)' : 'Spent Amount (Expense)')}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight">
                  {selectedTxForDetail.type === 'income' ? '+' : '-'}{currency}{selectedTxForDetail.amount.toLocaleString()}
                </span>
              </div>

              <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                selectedTxForDetail.type === 'income' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {selectedTxForDetail.type === 'income' ? t.income : t.expense}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
                  {t.paymentMode}
                </span>
                <span className="font-bold text-stone-800">
                  {selectedTxForDetail.paymentMode || 'UPI'}
                </span>
              </div>

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
                  {isGu ? 'વેન્ડર / વ્યક્તિ' : 'Vendor / Person'}
                </span>
                <span className="font-bold text-stone-800 truncate block">
                  {selectedTxForDetail.vendorOrPerson || (isGu ? 'સામાન્ય' : 'General')}
                </span>
              </div>
            </div>

            {/* Notes */}
            {selectedTxForDetail.notes && (
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
                  {t.notes}
                </span>
                <p className="text-xs text-stone-700 whitespace-pre-wrap">
                  {selectedTxForDetail.notes}
                </p>
              </div>
            )}

            {/* Banking / SMS Evidence Section */}
            {(selectedTxForDetail.evidence || selectedTxForDetail.evidenceSender || selectedTxForDetail.referenceNumber) && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isGu ? 'ઓરિજિનલ બેંકિંગ પુરાવો (Banking Proof / SMS)' : 'Verified Banking Evidence'}</span>
                </div>

                {selectedTxForDetail.evidenceSender && (
                  <div className="text-xs text-emerald-900 flex items-center gap-1.5">
                    <span className="font-semibold">{isGu ? 'મોકલનાર બેંક:' : 'Sender:'}</span>
                    <span className="bg-white px-2 py-0.5 rounded-lg border border-emerald-200 font-mono font-bold text-[11px]">
                      {selectedTxForDetail.evidenceSender}
                    </span>
                  </div>
                )}

                {selectedTxForDetail.referenceNumber && (
                  <div className="text-xs text-emerald-900 flex items-center gap-1.5">
                    <span className="font-semibold">{isGu ? 'રેફરન્સ / UTR:' : 'Ref/UTR:'}</span>
                    <span className="bg-white px-2 py-0.5 rounded-lg border border-emerald-200 font-mono font-bold text-[11px]">
                      {selectedTxForDetail.referenceNumber}
                    </span>
                  </div>
                )}

                {selectedTxForDetail.evidence && (
                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      {isGu ? 'ઓરિજિનલ SMS ટેક્સ્ટ:' : 'Raw SMS Text:'}
                    </span>
                    <p className="text-[11px] font-mono text-stone-700 bg-white p-2.5 rounded-xl border border-emerald-100 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedTxForDetail.evidence}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Receipt Image / Screenshot */}
            {selectedTxForDetail.evidenceImage && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                  {isGu ? 'જોડેલી રસીદ / સ્ક્રીનશોટ પુરાવો' : 'Attached Receipt / Screenshot Proof'}
                </span>
                <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 flex items-center justify-center max-h-72">
                  <img
                    src={selectedTxForDetail.evidenceImage}
                    alt="Receipt Proof"
                    className="w-full h-auto max-h-72 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons: Edit, Delete, Close */}
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  const tx = selectedTxForDetail;
                  setSelectedTxForDetail(null);
                  onEditTransaction?.(tx);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>{isGu ? 'ફેરફાર કરો (Edit)' : 'Edit Transaction'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const id = selectedTxForDetail.id;
                  setSelectedTxForDetail(null);
                  onDeleteTransaction(id);
                }}
                className="py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                title={t.delete}
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.delete}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition cursor-pointer"
              >
                {isGu ? 'બંધ કરો' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleConfirm(id: string, category: string) {
    onConfirmAiMessage(id, category);
  }
};
