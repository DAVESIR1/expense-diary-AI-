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
    .filter((t) => t.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
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
      {/* Pending AI Transaction Approval Banner or Smart AI Insight */}
      {pendingAiMessages.length > 0 ? (
        <div id="ai-pending-notifications" className="space-y-3">
          {pendingAiMessages.map((msg) => {
            const isInc = msg.parsedData.type === 'income';
            return (
              <div
                key={msg.id}
                id={`ai-pending-card-${msg.id}`}
                className="relative overflow-hidden rounded-[24px] border border-[#BBDEFB] bg-[#E3F2FD] p-5 sm:p-6 shadow-xs transition-all animate-in slide-in-from-top-2 duration-200"
              >
                {/* Glow bubble from Bold Typography theme */}
                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/30 rounded-full blur-3xl pointer-events-none" />

                <div className="flex gap-4 sm:gap-6 items-start relative z-10">
                  <div className="p-3 rounded-2xl bg-white text-[#1976D2] shadow-xs shrink-0">
                    <Sparkles className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[#0D47A1] font-bold text-base sm:text-lg flex items-center gap-2">
                        <span>{t.aiConfirmationTitle}</span>
                        <span className="text-[10px] bg-[#1976D2] text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          Smart
                        </span>
                      </h3>
                      <span className="text-xs text-[#1976D2]/80 font-mono font-medium">
                        {new Date(msg.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm font-medium text-[#1565C0] leading-relaxed">
                      {msg.parsedData.confirmationQuestion}
                    </p>

                    {/* Detected details pill */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-bold px-2.5 py-1 rounded-lg ${
                          isInc
                            ? 'bg-[#D1F7D9] text-[#1B4332]'
                            : 'bg-[#FEE2E2] text-[#742A2A]'
                        }`}
                      >
                        {isInc ? t.income : t.expense}: {currency}{msg.parsedData.amount.toLocaleString()}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white text-[#2D3436] font-semibold border border-[#BBDEFB]">
                        {msg.parsedData.title}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white/80 text-[#1565C0] font-medium border border-[#BBDEFB]/60">
                        {msg.parsedData.category}
                      </span>
                      {msg.parsedData.paymentMode && (
                        <span className="px-2.5 py-1 rounded-lg bg-white/80 text-[#1565C0] font-medium border border-[#BBDEFB]/60">
                          {msg.parsedData.paymentMode}
                        </span>
                      )}
                    </div>

                    {/* Category change selector dropdown (if toggled) */}
                    {editingCategoryMsgId === msg.id && (
                      <div className="mt-3 p-3 rounded-2xl bg-white border border-[#BBDEFB] flex flex-wrap items-center gap-2 shadow-xs">
                        <span className="text-xs text-[#2D3436] font-semibold">{t.category}:</span>
                        <select
                          id={`change-category-select-${msg.id}`}
                          value={tempCategory || msg.parsedData.category}
                          onChange={(e) => setTempCategory(e.target.value)}
                          className="text-xs px-3 py-1.5 rounded-xl border border-[#E1E8ED] outline-none bg-[#F9FBFC] text-[#2D3436] font-medium"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.nameGu ? `${cat.nameGu} (${cat.name})` : cat.name}
                            </option>
                          ))}
                        </select>
                        <button
                          id={`confirm-category-btn-${msg.id}`}
                          onClick={() => {
                            onConfirmAiMessage(msg.id, tempCategory || msg.parsedData.category);
                            setEditingCategoryMsgId(null);
                          }}
                          className="text-xs px-3.5 py-1.5 rounded-xl bg-[#1976D2] text-white font-semibold hover:bg-[#1565C0] transition"
                        >
                          {t.confirmAdd}
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        id={`ai-confirm-btn-${msg.id}`}
                        onClick={() => onConfirmAiMessage(msg.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] active:scale-98 transition shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                        <span>હા, ઉમેરો ({t.confirmAdd})</span>
                      </button>
                      <button
                        id={`ai-change-cat-btn-${msg.id}`}
                        onClick={() => {
                          setEditingCategoryMsgId(
                            editingCategoryMsgId === msg.id ? null : msg.id
                          );
                          setTempCategory(msg.parsedData.category);
                        }}
                        className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#1976D2] bg-white border border-[#1976D2] hover:bg-[#E3F2FD] transition shadow-xs"
                      >
                        {t.changeCategory}
                      </button>
                      <button
                        id={`ai-dismiss-btn-${msg.id}`}
                        onClick={() => onDismissAiMessage(msg.id)}
                        className="px-3 py-2 text-xs sm:text-sm font-medium text-[#1565C0] hover:text-[#0D47A1] transition"
                      >
                        ના, પછી પૂછજો ({t.ignore})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Bold Typography Default AI Smart Insight Section */
        <section
          id="bold-theme-ai-insight-banner"
          className="bg-[#E3F2FD] rounded-[24px] p-5 sm:p-6 border border-[#BBDEFB] relative overflow-hidden shadow-xs"
        >
          <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/25 rounded-full blur-3xl pointer-events-none" />
          <div className="flex gap-4 sm:gap-6 items-start relative z-10">
            <div className="bg-white p-3 rounded-2xl shadow-xs text-[#1976D2] shrink-0">
              <Sparkles className="w-7 h-7 stroke-[1.75]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[#0D47A1] font-bold text-base sm:text-lg flex items-center gap-2">
                <span>AI સૂચન (AI Insight)</span>
                <span className="text-[10px] bg-[#1976D2] text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                  Smart
                </span>
              </h3>
              <p className="text-[#1565C0] mt-1.5 leading-relaxed text-sm">
                તમે આ મહિને નિયમિત હિસાબ રાખી રહ્યા છો. વર્તમાન આવક <span className="font-bold">{currency}{totalIncome.toLocaleString()}</span> સામે કુલ ખર્ચ <span className="font-bold">{currency}{totalExpense.toLocaleString()}</span> છે. શું કોઈ રોકડ કે ઑફલાઇન વ્યવહાર બાકી છે?
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => onOpenAddModal('expense')}
                  className="bg-[#1976D2] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-[#1565C0] transition shadow-xs"
                >
                  ખર્ચ ઉમેરો
                </button>
                <button
                  onClick={() => onOpenAddModal('income')}
                  className="bg-white text-[#1976D2] border border-[#1976D2] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-[#E3F2FD] transition shadow-xs"
                >
                  આવક ઉમેરો
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TOP CARDS: Bold Typography Income and Expense Cards */}
      <section id="income-expense-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        {/* Income Card (આવક) - #EBFBEE, #D1F7D9, #1B4332, #2D6A4F */}
        <div
          id="home-income-card"
          className="bg-[#EBFBEE] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 border border-[#D1F7D9] flex flex-col justify-between min-h-[190px] sm:h-[200px] shadow-xs transition-all hover:shadow-sm"
        >
          <div>
            <p className="text-[#2D6A4F] text-base sm:text-lg font-medium mb-1">
              {t.income} (Income)
            </p>
            <h1
              id="home-total-income-value"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1B4332] tracking-tight font-mono"
            >
              {currency}{totalIncome.toLocaleString()}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 text-[#40916C] text-xs sm:text-sm font-medium mt-2">
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>{t.totalIncome} • {transactions.filter((x) => x.type === 'income').length} વ્યવહારો</span>
          </div>
        </div>

        {/* Expense Card (ખર્ચ) - #FFF0F0, #FEE2E2, #742A2A, #C53030 */}
        <div
          id="home-expense-card"
          className="bg-[#FFF0F0] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 border border-[#FEE2E2] flex flex-col justify-between min-h-[190px] sm:h-[200px] shadow-xs transition-all hover:shadow-sm"
        >
          <div>
            <p className="text-[#C53030] text-base sm:text-lg font-medium mb-1">
              {t.expense} (Expense)
            </p>
            <h1
              id="home-total-expense-value"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#742A2A] tracking-tight font-mono"
            >
              {currency}{totalExpense.toLocaleString()}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-[#C53030] text-xs sm:text-sm font-medium mt-2">
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>બજેટ લિમિટમાં છે • {transactions.filter((x) => x.type === 'expense').length} વ્યવહારો</span>
          </div>
        </div>
      </section>

      {/* Net Balance Banner in Bold Typography Style */}
      <div
        id="home-balance-banner"
        className="flex items-center justify-between px-6 py-4 rounded-2xl bg-white border border-[#E1E8ED] shadow-xs"
      >
        <div className="flex items-center gap-2.5 text-[#636E72]">
          <Wallet className="w-4 h-4 text-[#B2BEC3] stroke-[2]" />
          <span className="text-xs uppercase tracking-widest font-semibold">{t.balance} (Net Balance)</span>
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

      {/* ACTION BUTTONS: Bold Typography Theme Dashed Buttons with Round Hover Icons */}
      <section id="action-buttons-section" className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center">
        {/* Add Income Button ('આવક ઉમેરો') */}
        <button
          id="home-add-income-btn"
          onClick={() => onOpenAddModal('income')}
          className="flex-1 w-full bg-white border-2 border-dashed border-[#B2BEC3] rounded-2xl py-5 sm:py-6 flex items-center justify-center gap-4 hover:bg-[#F1F2F6] hover:border-[#2D6A4F] transition-colors group shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#EBFBEE] flex items-center justify-center text-[#2D6A4F] group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-lg sm:text-xl font-semibold text-[#2D3436]">
            {t.addIncome}
          </span>
        </button>

        {/* Add Expense Button ('ખર્ચ ઉમેરો') */}
        <button
          id="home-add-expense-btn"
          onClick={() => onOpenAddModal('expense')}
          className="flex-1 w-full bg-white border-2 border-dashed border-[#B2BEC3] rounded-2xl py-5 sm:py-6 flex items-center justify-center gap-4 hover:bg-[#F1F2F6] hover:border-[#C53030] transition-colors group shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#FFF0F0] flex items-center justify-center text-[#C53030] group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-lg sm:text-xl font-semibold text-[#2D3436]">
            {t.addExpense}
          </span>
        </button>
      </section>

      {/* TRANSACTIONS LIST SECTION */}
      <div id="home-transactions-section" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold text-[#2D3436]">
              {t.recentTransactions}
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F1F2F6] text-[#636E72] font-semibold font-mono">
              {filteredTransactions.length}
            </span>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              id="filter-all-btn"
              onClick={() => setSelectedFilterType('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                selectedFilterType === 'all'
                  ? 'bg-[#2D3436] text-white shadow-xs'
                  : 'bg-white text-[#636E72] border border-[#E1E8ED] hover:bg-[#F1F2F6]'
              }`}
            >
              બધા
            </button>
            <button
              id="filter-income-btn"
              onClick={() => setSelectedFilterType('income')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                selectedFilterType === 'income'
                  ? 'bg-[#1B4332] text-white shadow-xs'
                  : 'bg-white text-[#2D6A4F] border border-[#D1F7D9] hover:bg-[#EBFBEE]'
              }`}
            >
              {t.income}
            </button>
            <button
              id="filter-expense-btn"
              onClick={() => setSelectedFilterType('expense')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B2BEC3]" />
          <input
            id="search-transactions-input"
            type="text"
            placeholder="શોધો (શીર્ષક, કેટેગરી, વ્યક્તિ અથવા રકમ...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl border border-[#E1E8ED] bg-white hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none text-[#2D3436] transition shadow-xs"
          />
        </div>

        {/* List items */}
        {filteredTransactions.length === 0 ? (
          <div
            id="empty-transactions-state"
            className="text-center py-12 px-4 rounded-[24px] border-2 border-dashed border-[#B2BEC3]/60 bg-white/70"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-[#F1F2F6] flex items-center justify-center text-[#B2BEC3] mb-3">
              <Search className="w-5 h-5 stroke-[1.75]" />
            </div>
            <p className="text-base font-semibold text-[#2D3436]">{t.noTransactions}</p>
            <p className="text-xs text-[#636E72] mt-1">
              ઉપર આપેલા 'આવક ઉમેરો' અથવા 'ખર્ચ ઉમેરો' બટનથી નવી નોંધ દાખલ કરો.
            </p>
          </div>
        ) : (
          <div id="transactions-list" className="space-y-3">
            {filteredTransactions.map((item) => {
              const isInc = item.type === 'income';
              return (
                <div
                  key={item.id}
                  id={`transaction-item-${item.id}`}
                  className="group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-white border border-[#E1E8ED] hover:border-[#B2BEC3] hover:shadow-xs transition-all duration-150"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Bold Typography round icon badge */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isInc
                          ? 'bg-[#EBFBEE] text-[#2D6A4F] border border-[#D1F7D9]'
                          : 'bg-[#FFF0F0] text-[#C53030] border border-[#FEE2E2]'
                      }`}
                    >
                      {isInc ? (
                        <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-[#2D3436] truncate">
                          {item.title}
                        </h4>
                        {item.isAiGenerated && (
                          <span
                            title="AI સ્વતઃ ઉમેરેલ"
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3F2FD] text-[#0D47A1] border border-[#BBDEFB] shrink-0"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            AI
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#636E72]">
                        <span className="px-2 py-0.5 rounded-md bg-[#F1F2F6] text-[#2D3436] font-semibold text-[11px]">
                          {item.category}
                        </span>
                        <span>{item.date}</span>
                        {item.vendorOrPerson && (
                          <span className="flex items-center gap-1 text-[#2D3436] font-medium truncate max-w-[140px]">
                            <Building2 className="w-3 h-3 text-[#B2BEC3] shrink-0" />
                            {item.vendorOrPerson}
                          </span>
                        )}
                        {item.mobileNumber && (
                          <span className="flex items-center gap-1 text-[#636E72] font-mono text-[11px]">
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            {item.mobileNumber}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-[#B2BEC3] mt-1 italic line-clamp-1">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount and delete button */}
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <div
                        className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
                          isInc ? 'text-[#1B4332]' : 'text-[#742A2A]'
                        }`}
                      >
                        {isInc ? '+' : '-'} {currency}{item.amount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-[#B2BEC3] font-medium">
                        {item.paymentMode}
                      </div>
                    </div>

                    <button
                      id={`delete-tx-btn-${item.id}`}
                      onClick={() => onDeleteTransaction(item.id)}
                      title="કાઢી નાખો"
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-[#B2BEC3] hover:text-[#C53030] hover:bg-[#FFF0F0] transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
