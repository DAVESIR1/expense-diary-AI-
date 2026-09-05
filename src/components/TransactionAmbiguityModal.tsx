import React, { useState } from 'react';
import { 
  CheckCircle2, 
  HelpCircle, 
  SkipForward, 
  Calendar, 
  Clock, 
  CreditCard, 
  Building2, 
  Tag, 
  X,
  FileText
} from 'lucide-react';
import { Category } from '../types';
import { ParsedExpenseMessage } from '../utils/smsParser';

interface TransactionAmbiguityModalProps {
  queue: ParsedExpenseMessage[];
  currentIndex: number;
  categories: Category[];
  currency: string;
  currentLang?: string;
  onConfirm: (confirmed: ParsedExpenseMessage) => void;
  onSkip: () => void;
  onDismissQueue: () => void;
}

export const TransactionAmbiguityModal: React.FC<TransactionAmbiguityModalProps> = ({
  queue,
  currentIndex,
  categories,
  currency,
  currentLang = 'gu',
  onConfirm,
  onSkip,
  onDismissQueue,
}) => {
  const isGu = currentLang === 'gu';
  const item = queue[currentIndex];

  const [selectedCategory, setSelectedCategory] = useState<string>(item?.category || 'Other Expense');
  const [customTitle, setCustomTitle] = useState<string>(item?.title || '');
  const [selectedType, setSelectedType] = useState<'expense' | 'income'>(item?.type || 'expense');

  // Keep state updated if current item changes
  React.useEffect(() => {
    if (item) {
      setSelectedCategory(item.category);
      setCustomTitle(item.title);
      setSelectedType(item.type);
    }
  }, [item]);

  if (!item || currentIndex >= queue.length) return null;

  const totalItems = queue.length;
  const currentStep = currentIndex + 1;

  const handleConfirmClick = () => {
    onConfirm({
      ...item,
      title: customTitle.trim() || item.title,
      category: selectedCategory,
      type: selectedType,
      confidence: 1.0,
      needsReview: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Queue Indicator */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <HelpCircle className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {isGu ? 'વ્યવહાર ચકાસણી' : 'Verify Transaction'}
              </h2>
              <p className="text-xs text-emerald-200 font-medium">
                {isGu 
                  ? `કન્ફ્યુઝન વાળા વ્યવહાર (${currentStep} / ${totalItems})` 
                  : `Needs Confirmation (${currentStep} of ${totalItems})`}
              </p>
            </div>
          </div>

          <button
            onClick={onDismissQueue}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white/80 hover:text-white"
            title={isGu ? 'પછી પૂછો' : 'Ask later'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Transaction Summary Card */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                {item.bankOrSource || (isGu ? 'બેંક / UPI વ્યવહાર' : 'Bank / UPI')}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedType('expense')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedType === 'expense'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {isGu ? 'ખર્ચ (-)' : 'Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('income')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedType === 'income'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {isGu ? 'આવક (+)' : 'Income'}
                </button>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-black ${
                selectedType === 'income' ? 'text-emerald-600' : 'text-stone-900'
              }`}>
                {selectedType === 'income' ? '+' : '-'}{currency}{item.amount.toLocaleString()}
              </span>
            </div>

            {/* Metadata Pills */}
            <div className="flex flex-wrap gap-2 text-xs text-stone-600 pt-1">
              <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 font-medium">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                {item.date}
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 font-medium">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                {item.time}
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-stone-400" />
                {item.paymentMode}
              </span>
              {item.accountInfo && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-stone-200 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-stone-400" />
                  {item.accountInfo}
                </span>
              )}
            </div>

            {/* Raw Evidence SMS / Notification */}
            {item.evidence && (
              <div className="bg-white rounded-xl p-2.5 border border-stone-200 text-stone-500 text-xs font-mono break-words">
                <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400 mb-1">
                  <FileText className="w-3 h-3" />
                  <span>{isGu ? 'મૂળ SMS / નોટિફિકેશન:' : 'Raw message:'}</span>
                </div>
                "{item.evidence}"
              </div>
            )}
          </div>

          {/* Editable Title */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              {isGu ? 'વ્યવહારનું શીર્ષક / નામ:' : 'Transaction Title:'}
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={isGu ? 'દા.ત. NPS રોકાણ, રમેશભાઈને UPI...' : 'e.g. NPS Investment, UPI to Ramesh...'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 outline-none text-sm font-semibold text-stone-800 transition"
            />
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isGu ? 'સાચી કેટેગરી પસંદ કરો:' : 'Select Correct Category:'}</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {categories.map((c) => {
                const isSelected = selectedCategory.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.name)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium'
                    }`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: c.color || '#10B981' }} 
                    />
                    <span className="truncate text-xs">
                      {isGu && c.nameGu ? c.nameGu : c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 bg-white border border-stone-200 hover:bg-stone-100 transition cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>{isGu ? 'આ સ્કીપ કરો' : 'Skip'}</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmClick}
            className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {currentStep < totalItems 
                ? (isGu ? 'કન્ફર્મ કરો અને આગળ વધો' : 'Confirm & Next') 
                : (isGu ? 'કન્ફર્મ કરી ઉમેરો' : 'Confirm & Finish')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
