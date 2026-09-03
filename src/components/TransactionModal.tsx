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
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type,
  categories,
  t,
  currency,
}) => {
  const amountRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent){
      if(e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(()=>{
    // focus amount for quicker entry
    setTimeout(()=> amountRef.current?.focus(), 50);
  }, []);
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

    onClose();
    // Reset form
    setAmount('');
    setTitle('');
    setVendorOrPerson('');
    setMobileNumber('');
    setNotes('');
  };

  const isIncome = type === 'income';

  return (
    <div
      id="transaction-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        id="transaction-modal-card"
        className="w-full max-w-lg rounded-[28px] bg-white border border-[#E1E8ED] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        tabIndex={-1}
      >
        {/* Header with Bold Typography tone */}
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
              className={`text-xl font-bold ${
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
            className="p-1.5 rounded-full text-[#B2BEC3] hover:text-[#2D3436] hover:bg-white/90 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-[#2D3436]">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
              {t.amount} ({currency})
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl font-bold text-[#B2BEC3]">
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
                aria-label={t.amount}
                className={`w-full pl-11 pr-4 py-3.5 text-3xl font-bold tracking-tight rounded-2xl border transition-colors outline-none font-mono ${
                  isIncome
                    ? 'border-[#D1F7D9] focus:border-[#2D6A4F] text-[#1B4332] bg-[#EBFBEE]/30'
                    : 'border-[#FEE2E2] focus:border-[#C53030] text-[#742A2A] bg-[#FFF0F0]/30'
                }`}
              />
            </div>
          </div>

          {/* Title / Description */}
          <div>
            <label className="block text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
              {t.title}
            </label>
            <input
              id="transaction-title-input"
              type="text"
              required
              placeholder={isIncome ? 'દા.ત. માસિક પગાર, વેચાણ' : 'દા.ત. શાકભાજી, હોટેલ બિલ'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
            />
          </div>

          {/* Category & Payment Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
                <Tag className="w-3.5 h-3.5 stroke-[1.75]" />
                {t.category}
              </label>
              <select
                id="transaction-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] bg-white hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
              >
                {relevantCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.nameGu ? `${cat.nameGu} (${cat.name})` : cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
                <CreditCard className="w-3.5 h-3.5 stroke-[1.75]" />
                {t.paymentMode}
              </label>
              <select
                id="transaction-payment-mode-select"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] bg-white hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Cash">રોકડ (Cash)</option>
                <option value="Bank Transfer">બેંક ટ્રાન્સફર (NEFT/IMPS)</option>
                <option value="Debit Card">ડેબિટ કાર્ડ (Debit Card)</option>
                <option value="Credit Card">ક્રેડિટ કાર્ડ (Credit Card)</option>
                <option value="Cheque">ચેક (Cheque)</option>
                <option value="Other">અન્ય (Other)</option>
              </select>
            </div>
          </div>

          {/* Person / Mobile Number (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
                <User className="w-3.5 h-3.5 stroke-[1.75]" />
                {t.personOrMobile}
              </label>
              <input
                id="transaction-vendor-input"
                type="text"
                placeholder="દા.ત. રમેશભાઈ / Zomato"
                value={vendorOrPerson}
                onChange={(e) => setVendorOrPerson(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
                મોબાઈલ નંબર (વૈકલ્પિક)
              </label>
              <input
                id="transaction-mobile-input"
                type="tel"
                placeholder="9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />
                {t.date}
              </label>
              <input
                id="transaction-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
                {t.time}
              </label>
              <input
                id="transaction-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#636E72] uppercase tracking-wider mb-1.5">
              <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
              {t.notes}
            </label>
            <input
              id="transaction-notes-input"
              type="text"
              placeholder="વિશેષ નોંધ અથવા સંદર્ભ નંબર"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E8ED]">
            <button
              id="cancel-transaction-modal-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-[#636E72] hover:text-[#2D3436] rounded-xl hover:bg-[#F1F2F6] transition-colors cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              id="save-transaction-modal-btn"
              type="submit"
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer ${
                isIncome
                  ? 'bg-[#1B4332] hover:bg-[#2D6A4F] active:scale-98'
                  : 'bg-[#742A2A] hover:bg-[#C53030] active:scale-98'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
