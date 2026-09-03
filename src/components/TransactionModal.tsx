import React, { useState } from 'react';
import { X, Plus, Calendar, Clock, Tag, User, CreditCard, FileText } from 'lucide-react';
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
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type,
  categories,
  t,
  currency,
  currentLang,
}) => {
  const isGu = currentLang === 'gu';
  const amountRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(
    categories.find((c) => c.type === type || c.type === 'both')?.name || 'General'
  );
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(
    new Date().toTimeString().split(' ')[0].substring(0, 5)
  );
  const [vendorOrPerson, setVendorOrPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [notes, setNotes] = useState('');

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
      isAiGenerated: false,
    });

    // Reset form
    setAmount('');
    setTitle('');
    setVendorOrPerson('');
    setMobileNumber('');
    setNotes('');
    onClose();
  };

  const isIncome = type === 'income';

  return (
    <div
      id="transaction-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        id="transaction-modal-card"
        className="w-full max-w-lg rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4.5 border-b ${
            isIncome
              ? 'bg-[#EBFBEE] border-[#D1F7D9]'
              : 'bg-[#FFF0F0] border-[#FEE2E2]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isIncome ? 'bg-[#2D6A4F]' : 'bg-[#C53030]'
              }`}
            />
            <h2
              className={`text-lg sm:text-xl font-bold ${
                isIncome ? 'text-[#1B4332]' : 'text-[#742A2A]'
              }`}
              id="transaction-modal-title"
            >
              {isIncome ? t.addIncome : t.addExpense}
            </h2>
          </div>
          <button
            id="close-transaction-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-white/80 transition cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-stone-800">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              {t.amount} ({currency})
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl font-bold text-stone-400">
                {currency}
              </span>
              <input
                ref={amountRef}
                id="transaction-amount-input"
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 text-2xl sm:text-3xl font-bold tracking-tight rounded-2xl border transition-colors outline-none font-mono ${
                  isIncome
                    ? 'border-[#D1F7D9] focus:border-[#2D6A4F] text-[#1B4332] bg-[#EBFBEE]/30'
                    : 'border-[#FEE2E2] focus:border-[#C53030] text-[#742A2A] bg-[#FFF0F0]/30'
                }`}
              />
            </div>
          </div>

          {/* Title / Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              {t.title}
            </label>
            <input
              id="transaction-title-input"
              type="text"
              required
              placeholder={
                isIncome
                  ? (isGu ? 'દા.ત. પગાર, વ્યાજ, વેચાણ' : 'e.g. Salary, Freelance project')
                  : (isGu ? 'દા.ત. શાકભાજી, હોટેલ બિલ' : 'e.g. Groceries, Dinner, Electricity')
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 hover:border-stone-300 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Category & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <Tag className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{t.category}</span>
              </label>
              <select
                id="transaction-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white hover:border-stone-300 focus:border-indigo-500 outline-none transition cursor-pointer font-medium"
              >
                {relevantCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {isGu ? (cat.nameGu || cat.name) : cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <CreditCard className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{t.paymentMode}</span>
              </label>
              <select
                id="transaction-payment-mode-select"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white hover:border-stone-300 focus:border-indigo-500 outline-none transition cursor-pointer font-medium"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Cash">{isGu ? 'રોકડ (Cash)' : 'Cash'}</option>
                <option value="Bank Transfer">{isGu ? 'બેંક ટ્રાન્સફર (NEFT/IMPS)' : 'Bank Transfer'}</option>
                <option value="Debit Card">{isGu ? 'ડેબિટ કાર્ડ (Debit Card)' : 'Debit Card'}</option>
                <option value="Credit Card">{isGu ? 'ક્રેડિટ કાર્ડ (Credit Card)' : 'Credit Card'}</option>
                <option value="Cheque">{isGu ? 'ચેક (Cheque)' : 'Cheque'}</option>
                <option value="Other">{isGu ? 'અન્ય (Other)' : 'Other'}</option>
              </select>
            </div>
          </div>

          {/* Person / Mobile Number (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <User className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{t.personOrMobile}</span>
              </label>
              <input
                id="transaction-vendor-input"
                type="text"
                placeholder={isGu ? 'દા.ત. રમેશભાઈ અથવા દુકાન' : 'e.g. John or Merchant name'}
                value={vendorOrPerson}
                onChange={(e) => setVendorOrPerson(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 hover:border-stone-300 focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                {isGu ? 'મોબાઈલ નંબર (વૈકલ્પિક)' : 'Mobile Number (Optional)'}
              </label>
              <input
                id="transaction-mobile-input"
                type="tel"
                placeholder="9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 hover:border-stone-300 focus:border-indigo-500 outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{t.date}</span>
              </label>
              <input
                id="transaction-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 hover:border-stone-300 focus:border-indigo-500 outline-none transition font-mono cursor-pointer"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>{t.time}</span>
              </label>
              <input
                id="transaction-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 hover:border-stone-300 focus:border-indigo-500 outline-none transition font-mono cursor-pointer"
              />
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
              <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{t.notes}</span>
            </label>
            <textarea
              id="transaction-notes-input"
              rows={2}
              placeholder={isGu ? 'કોઈ ખાસ નોંધ કે સંદર્ભ...' : 'Any optional reference or remarks...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 hover:border-stone-300 focus:border-indigo-500 outline-none transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              id="cancel-transaction-btn"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-semibold text-xs sm:text-sm transition cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              id="save-transaction-btn"
              className={`flex-1 py-3 px-4 rounded-xl text-white font-semibold text-xs sm:text-sm shadow-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                isIncome
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
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
