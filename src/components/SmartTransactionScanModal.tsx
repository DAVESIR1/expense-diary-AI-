import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Sparkles, 
  X, 
  Check, 
  Clock, 
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Transaction, Category, TransactionType } from '../types';
import { ParsedExpenseMessage } from '../utils/smsParser';
import { TranslationStrings } from '../data/languages';

export interface ScannedCandidate {
  id: string;
  selected: boolean;
  type: TransactionType;
  amount: number;
  title: string;
  category: string;
  vendorOrPerson?: string;
  paymentMode: string;
  date: string;
  time: string;
  bankOrSource?: string;
  evidence: string;
  confidence: number;
}

interface SmartTransactionScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: ScannedCandidate[];
  categories: Category[];
  currency: string;
  currentLang: string;
  t: TranslationStrings;
  onConfirmImport: (approved: Transaction[]) => void;
}

export const SmartTransactionScanModal: React.FC<SmartTransactionScanModalProps> = ({
  isOpen,
  onClose,
  candidates: initialCandidates,
  categories,
  currency,
  currentLang,
  t,
  onConfirmImport,
}) => {
  const [items, setItems] = useState<ScannedCandidate[]>(initialCandidates);
  const isGu = currentLang === 'gu';

  // Sync state when initialCandidates change
  React.useEffect(() => {
    setItems(initialCandidates);
  }, [initialCandidates]);

  if (!isOpen || items.length === 0) return null;

  const selectedCount = items.filter((i) => i.selected).length;
  const isAllSelected = selectedCount === items.length;

  const toggleSelectAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: !isAllSelected })));
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemCategory = (id: string, newCat: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category: newCat } : item))
    );
  };

  const handleSaveApproved = () => {
    const approvedTxs: Transaction[] = items
      .filter((item) => item.selected)
      .map((item) => ({
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
        type: item.type,
        amount: item.amount,
        title: item.title,
        category: item.category,
        date: item.date,
        time: item.time,
        paymentMode: item.paymentMode,
        vendorOrPerson: item.vendorOrPerson,
        evidence: item.evidence,
        evidenceSource: 'sms',
        isAiGenerated: true,
      }));

    onConfirmImport(approvedTxs);
    onClose();
  };

  const incomeCount = items.filter((i) => i.type === 'income').length;
  const expenseCount = items.filter((i) => i.type === 'expense').length;

  return (
    <div
      id="smart-scan-verification-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="smart-scan-verification-card"
        className="w-full max-w-xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                {isGu
                  ? `તમારા ફોનમાંથી ${items.length} વ્યવહારો મળ્યા છે`
                  : `Found ${items.length} Transactions from Your Phone`}
              </h3>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {isGu
                ? `${expenseCount} ખર્ચ • ${incomeCount} આવકના મેસેજિસ શોધાયા`
                : `${expenseCount} Expenses • ${incomeCount} Incomes detected`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanatory Message as requested in Task 2 */}
        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3 my-3 text-xs text-indigo-950 leading-relaxed space-y-1">
          <p className="font-semibold text-indigo-900">
            {isGu
              ? '💡 તમારા ફોનમાં મને આટલી રકમ અને તારીખ સાથેના વ્યવહારો મળ્યા છે:'
              : '💡 We found these financial transactions with amounts and dates:'}
          </p>
          <p className="text-[11px] text-indigo-900/90">
            {isGu
              ? 'તેમાંથી જો કોઈ ખોટી કે દૂર કરવા જેવી રકમ હોય તો તેને અન-ટિક (un-tick) કરો, પછી નીચે આપેલું "ઉમેરો" બટન દબાવો.'
              : 'If any entry is incorrect or should not be added, simply uncheck it before confirming.'}
          </p>
        </div>

        {/* Select All Toggle Bar */}
        <div className="flex items-center justify-between px-1 pb-2 text-xs">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 font-bold text-stone-700 hover:text-stone-950 cursor-pointer select-none"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-stone-400" />
            )}
            <span>
              {isAllSelected
                ? isGu
                  ? 'બધા અન-સિલેક્ટ કરો'
                  : 'Deselect All'
                : isGu
                ? 'બધા પસંદ કરો'
                : 'Select All'}
            </span>
          </button>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            {selectedCount} / {items.length} {isGu ? 'પસંદ કરેલ' : 'selected'}
          </span>
        </div>

        {/* Scrollable list of transaction candidates */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
          {items.map((candidate) => {
            const isInc = candidate.type === 'income';
            return (
              <div
                key={candidate.id}
                onClick={() => toggleItem(candidate.id)}
                className={`p-3 rounded-2xl border transition cursor-pointer select-none flex items-start gap-3 ${
                  candidate.selected
                    ? 'bg-stone-50/80 border-stone-300 shadow-xs'
                    : 'bg-white border-stone-200/70 opacity-60'
                }`}
              >
                {/* Checkbox */}
                <div className="pt-0.5 shrink-0">
                  {candidate.selected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className="w-4 h-4 text-stone-300" />
                  )}
                </div>

                {/* Main details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {candidate.title || candidate.vendorOrPerson || (isInc ? t.income : t.expense)}
                    </span>
                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md shrink-0 ${
                        isInc ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {isInc ? '+' : '-'}
                      {currency}
                      {candidate.amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-stone-500">
                    {candidate.bankOrSource && (
                      <span className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        <Building2 className="w-3 h-3 text-emerald-700" />
                        {candidate.bankOrSource}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      {candidate.date}
                    </span>
                    {candidate.time && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {candidate.time}
                      </span>
                    )}
                    {candidate.paymentMode && (
                      <span className="bg-stone-200/70 text-stone-700 px-1.5 py-0.2 rounded">
                        {candidate.paymentMode}
                      </span>
                    )}
                  </div>

                  {/* Evidence snippet */}
                  {candidate.evidence && (
                    <p className="mt-1 text-[10px] text-stone-400 truncate max-w-sm italic">
                      "{candidate.evidence}"
                    </p>
                  )}
                </div>

                {/* Category Dropdown */}
                <div
                  className="shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <select
                    value={candidate.category}
                    onChange={(e) => updateItemCategory(candidate.id, e.target.value)}
                    className="text-[11px] font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[110px] truncate"
                  >
                    {categories
                      .filter((c) => c.type === 'both' || c.type === candidate.type)
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {isGu && c.nameGu ? c.nameGu : c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-stone-100 flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold transition cursor-pointer"
          >
            {isGu ? 'રદ કરો' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSaveApproved}
            disabled={selectedCount === 0}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              {isGu
                ? `ઉમેરો (${selectedCount} પસંદ કરેલ)`
                : `Add (${selectedCount} Selected)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
