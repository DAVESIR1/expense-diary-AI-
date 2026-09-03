import React, { useState } from 'react';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Building2,
  Phone,
  Wallet
} from 'lucide-react';
import { Transaction, TransactionType, PendingAIMessage, Category } from '../types';
import { TranslationStrings } from '../data/languages';

interface HomeScreenProps {
  transactions: Transaction[];
  onOpenAddModal: (type: TransactionType) => void;
  onDeleteTransaction: (id: string) => void;
  pendingAiMessages: PendingAIMessage[];
  onConfirmAiMessage: (messageId: string, customCategory?: string) => void;
  onDismissAiMessage: (messageId: string) => void;
  categories: Category[];
  t: TranslationStrings;
  currency: string;
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterType, setSelectedFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [editingCategoryMsgId, setEditingCategoryMsgId] = useState<string | null>(null);
  const [tempCategory, setTempCategory] = useState<string>('');

  // Calculate totals
  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Filter transactions
  const filteredTransactions = transactions.filter((item) => {
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

  return (
    <div id="home-screen-container" className="space-y-6 pb-28">
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
                    <Sparkles className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-indigo-950 font-bold text-base sm:text-lg flex items-center gap-2">
                        <span>{t.aiConfirmationTitle}</span>
                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          AI
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
                                  {c.name}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => setEditingCategoryMsgId(null)}
                            className="text-indigo-600 text-xs font-bold px-1.5 hover:underline"
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

      {/* TOP CARDS: Income & Expense (Soft Green & Soft Red with Large Numbers) */}
      <section id="income-expense-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Income Card (Soft Green) */}
        <div
          id="home-income-card"
          className="bg-[#EBFBEE] rounded-3xl p-6 sm:p-7 border border-[#D1F7D9] flex flex-col justify-between min-h-[175px] shadow-xs hover:shadow-sm transition-all"
        >
          <div>
            <p className="text-[#2D6A4F] text-base sm:text-lg font-bold tracking-tight mb-1">
              {t.income}
            </p>
            <h1
              id="home-total-income-value"
              className="text-4xl sm:text-5xl font-bold text-[#1B4332] tracking-tight font-mono"
            >
              {currency}{totalIncome.toLocaleString()}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 text-[#40916C] text-xs font-semibold mt-3">
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>
              {transactions.filter((x) => x.type === 'income').length} {t.income}
            </span>
          </div>
        </div>

        {/* Expense Card (Soft Red) */}
        <div
          id="home-expense-card"
          className="bg-[#FFF0F0] rounded-3xl p-6 sm:p-7 border border-[#FEE2E2] flex flex-col justify-between min-h-[175px] shadow-xs hover:shadow-sm transition-all"
        >
          <div>
            <p className="text-[#C53030] text-base sm:text-lg font-bold tracking-tight mb-1">
              {t.expense}
            </p>
            <h1
              id="home-total-expense-value"
              className="text-4xl sm:text-5xl font-bold text-[#742A2A] tracking-tight font-mono"
            >
              {currency}{totalExpense.toLocaleString()}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-[#C53030] text-xs font-semibold mt-3">
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>
              {transactions.filter((x) => x.type === 'expense').length} {t.expense}
            </span>
          </div>
        </div>
      </section>

      {/* Net Balance Banner */}
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

      {/* ACTION BUTTONS: '+' Buttons for Add Income & Add Expense */}
      <section id="action-buttons-section" className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Add Income Button */}
        <button
          id="home-add-income-btn"
          onClick={() => onOpenAddModal('income')}
          className="w-full bg-white border-2 border-dashed border-stone-300 rounded-2xl py-4 sm:py-5 flex items-center justify-center gap-3.5 hover:bg-[#EBFBEE]/50 hover:border-[#2D6A4F] transition-all group shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-[#EBFBEE] flex items-center justify-center text-[#2D6A4F] group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-sm sm:text-base font-bold text-stone-800 group-hover:text-[#2D6A4F] transition-colors">
            {t.addIncome}
          </span>
        </button>

        {/* Add Expense Button */}
        <button
          id="home-add-expense-btn"
          onClick={() => onOpenAddModal('expense')}
          className="w-full bg-white border-2 border-dashed border-stone-300 rounded-2xl py-4 sm:py-5 flex items-center justify-center gap-3.5 hover:bg-[#FFF0F0]/50 hover:border-[#C53030] transition-all group shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-[#FFF0F0] flex items-center justify-center text-[#C53030] group-hover:scale-110 transition-transform">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-sm sm:text-base font-bold text-stone-800 group-hover:text-[#C53030] transition-colors">
            {t.addExpense}
          </span>
        </button>
      </section>

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
                  className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-xs transition-all duration-150"
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

                  {/* Right side: Amount and Delete */}
                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <span
                      className={`text-sm sm:text-base font-bold font-mono ${
                        isInc ? 'text-[#1B4332]' : 'text-[#742A2A]'
                      }`}
                    >
                      {isInc ? '+' : '-'}{currency}{item.amount.toLocaleString()}
                    </span>

                    <button
                      onClick={() => onDeleteTransaction(item.id)}
                      title={t.delete}
                      className="opacity-0 group-hover:opacity-100 sm:transition-opacity p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  function handleConfirm(id: string, category: string) {
    onConfirmAiMessage(id, category);
  }
};
