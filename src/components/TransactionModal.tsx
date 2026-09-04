import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Calendar, Clock, Tag, User, CreditCard, FileText, ShieldCheck } from 'lucide-react';
import { Transaction, TransactionType, Category } from '../types';
import { TranslationStrings } from '../data/languages';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id'>) => void;
  type: TransactionType;
  categories: Category[];
  t: TranslationStrings;
  currency: string;
  currentLang: string;
  initialData?: Partial<Transaction>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type: initialType,
  categories,
  t,
  currency,
  currentLang,
  initialData,
}) => {
  const isGu = currentLang === 'gu';
  const amountRef = useRef<HTMLInputElement | null>(null);

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(
    new Date().toTimeString().split(' ')[0].substring(0, 5)
  );
  const [vendorOrPerson, setVendorOrPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<string | undefined>(undefined);
  const [referenceNumber, setReferenceNumber] = useState<string | undefined>(undefined);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => amountRef.current?.focus(), 50);
      const activeType = initialData?.type || initialType;
      setType(activeType);
      setAmount(initialData?.amount ? initialData.amount.toString() : '');
      setTitle(initialData?.title || '');
      setCategory(
        initialData?.category ||
          categories.find((c) => c.type === activeType || c.type === 'both')?.name ||
          'General'
      );
      setDate(initialData?.date || new Date().toISOString().split('T')[0]);
      setTime(
        initialData?.time || new Date().toTimeString().split(' ')[0].substring(0, 5)
      );
      setVendorOrPerson(initialData?.vendorOrPerson || '');
      setMobileNumber(initialData?.mobileNumber || '');
      setPaymentMode(initialData?.paymentMode || 'UPI');
      setNotes(initialData?.notes || '');
      setEvidence(initialData?.evidence);
      setReferenceNumber(initialData?.referenceNumber);
      setShowEvidenceDetails(!!initialData?.evidence);
    }
  }, [isOpen, initialData, initialType, categories]);

  if (!isOpen) return null;

  const relevantCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    onSave({
      type,
      amount: parsedAmount,
      title: title.trim() || (type === 'income' ? t.income : t.expense),
      category,
      date,
      time,
      vendorOrPerson: vendorOrPerson.trim() || undefined,
      mobileNumber: mobileNumber.trim() || undefined,
      paymentMode,
      notes: notes.trim() || undefined,
      evidence,
      evidenceSource: initialData?.evidenceSource || (evidence ? 'sms' : 'manual'),
      referenceNumber,
      isAiGenerated: false,
    });

    onClose();
  };

  const isIncome = type === 'income';

  return (
    <div
      id="transaction-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="transaction-modal-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-4 text-stone-800"
      >
        {/* Header with Type Selector */}
        <div className="flex items-center justify-between pb-1 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                !isIncome
                  ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                  : 'bg-stone-50 text-stone-500 border-stone-200'
              }`}
            >
              {t.addExpense}
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                isIncome
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                  : 'bg-stone-50 text-stone-500 border-stone-200'
              }`}
            >
              {t.addIncome}
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              {t.amount} ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-stone-400">
                {currency}
              </span>
              <input
                ref={amountRef}
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-3.5 py-3 text-xl font-bold font-mono rounded-2xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Title / Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              {t.title}
            </label>
            <input
              type="text"
              required
              placeholder={isIncome ? (isGu ? 'પગાર, વ્યાજ અથવા આવક' : 'Salary, Freelance, Dividend') : (isGu ? 'કરિયાણું, ચા-નાસ્તો, બિલ' : 'Grocery, Dinner, Fuel')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500 focus:bg-white transition font-medium"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              <Tag className="w-3.5 h-3.5 text-stone-400" />
              <span>{t.category}</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-stone-50/60 rounded-xl border border-stone-200/80">
              {relevantCategories.map((c) => {
                const isSelected = category.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? isIncome
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : 'bg-rose-600 text-white border-rose-600 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span>{isGu && c.nameGu ? c.nameGu : c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              <CreditCard className="w-3.5 h-3.5 text-stone-400" />
              <span>{t.paymentMode}</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {['UPI', 'Cash', 'Card', 'Bank Transfer'].map((m) => {
                const isSelected = paymentMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition border ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Person / Vendor & Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <User className="w-3.5 h-3.5 text-stone-400" />
                <span>{t.personOrMobile}</span>
              </label>
              <input
                type="text"
                placeholder={isGu ? 'રમેશભાઈ અથવા વેન્ડર' : 'Vendor or Person'}
                value={vendorOrPerson}
                onChange={(e) => setVendorOrPerson(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                {isGu ? 'મોબાઈલ નંબર' : 'Mobile Number'}
              </label>
              <input
                type="tel"
                placeholder="9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>{t.date}</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>{t.time}</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              <FileText className="w-3.5 h-3.5 text-stone-400" />
              <span>{t.notes}</span>
            </label>
            <textarea
              rows={2}
              placeholder={isGu ? 'વધારાની નોંધ અથવા સંદર્ભ...' : 'Remarks or reference notes...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Evidence Preservation & Verification Display */}
          {(evidence || referenceNumber) && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1.5 text-xs">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
              >
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isGu ? 'ઓરિજિનલ બેંકિંગ પુરાવો (Verified Evidence)' : 'Original Banking Evidence'}</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold underline">
                  {showEvidenceDetails ? (isGu ? 'છુપાવો' : 'Hide') : (isGu ? 'જુઓ' : 'View')}
                </span>
              </div>

              {showEvidenceDetails && (
                <div className="pt-2 text-stone-600 font-mono text-[11px] leading-relaxed bg-white p-2.5 rounded-xl border border-emerald-100">
                  {referenceNumber && (
                    <div className="mb-1 text-emerald-800 font-bold">
                      Ref/UTR: {referenceNumber}
                    </div>
                  )}
                  {evidence && <div className="break-words">{evidence}</div>}
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold text-xs transition cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className={`flex-1 py-3 px-4 rounded-xl text-white font-semibold text-xs shadow-sm transition cursor-pointer flex items-center justify-center gap-2 ${
                isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{t.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
