import React, { useState } from 'react';
import { 
  BellRing, 
  Clock, 
  CheckCircle2, 
  X, 
  Plus, 
  Calendar, 
  FolderPlus,
  Volume2
} from 'lucide-react';
import { Category, Transaction } from '../types';
import { TranslationStrings } from '../data/languages';
import { snoozeReminder } from '../services/notifications';

interface OfflineReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  categories: Category[];
  onAddCategory: (category: Category) => void;
  currentLang: string;
  t: TranslationStrings;
  currency: string;
  lastPromptTimeText?: string; // e.g. "સાંજે 8:30 વાગ્યે"
}

export const OfflineReminderModal: React.FC<OfflineReminderModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  categories,
  onAddCategory,
  currentLang,
  t,
  currency,
  lastPromptTimeText,
}) => {
  const [step, setStep] = useState<'prompt' | 'snooze_select' | 'add_form'>('prompt');

  // Form State
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    categories.find((c) => c.type === 'expense')?.name || 'Food / Dining'
  );
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [time, setTime] = useState(
    new Date().toTimeString().substring(0, 5)
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isGu = currentLang === 'gu';

  // Play gentle chime using Web Audio API
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
      if ('vibrate' in navigator) {
        navigator.vibrate([150, 80, 150]);
      }
    } catch {
      // Audio autoplay restrictions
    }
  };

  const handleSnooze = (minutes: number, labelGu: string, labelEn: string) => {
    const nowTimeStr = new Date().toLocaleTimeString(isGu ? 'gu-IN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    localStorage.setItem('ed_reminder_last_context_time', nowTimeStr);
    snoozeReminder(minutes);
    onClose();
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(isGu ? 'કૃપા કરીને માન્ય રકમ દાખલ કરો.' : 'Please enter a valid amount.');
      return;
    }

    let finalCategory = selectedCategory;

    // Handle new category creation
    if (isCustomCategoryMode && customCategoryInput.trim()) {
      const trimmed = customCategoryInput.trim();
      const existing = categories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === 'expense'
      );
      if (!existing) {
        const newCat: Category = {
          id: `cat-${Date.now()}`,
          name: trimmed,
          nameGu: trimmed,
          type: 'expense',
          icon: 'ShoppingBag',
          color: '#F59E0B',
        };
        onAddCategory(newCat);
        finalCategory = trimmed;
      } else {
        finalCategory = existing.name;
      }
    }

    onAddTransaction({
      amount: parsedAmount,
      type: 'expense',
      category: finalCategory,
      title: title.trim() || (isGu ? 'રોકડ ખર્ચ' : 'Cash Expense'),
      date: new Date().toISOString().split('T')[0],
      time: time || undefined,
      paymentMode: 'Cash',
      notes: isGu ? 'દૈનિક ઓફલાઇન રીમાઇન્ડર દ્વારા નોંધાયેલ' : 'Logged via Daily Offline Reminder',
      createdAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div
      id="offline-reminder-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="offline-reminder-dialog"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto relative"
      >
        {/* Header Bell Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
              <BellRing className="w-6 h-6 stroke-[2.2] animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                {isGu ? 'આજનો રોકડ / ઓફલાઇન ખર્ચ' : 'Daily Cash & Offline Expense'}
              </h3>
              <p className="text-xs text-stone-500">
                {isGu ? 'દૈનિક હિસાબ રીમાઇન્ડર' : 'Daily Expense Check'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={playChime}
              title={isGu ? 'રિંગટોન વગાડો' : 'Play chime'}
              className="p-2 text-stone-400 hover:text-amber-600 rounded-full hover:bg-stone-100 transition cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STEP 1: Main Prompt */}
        {step === 'prompt' && (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-stone-800">
              {lastPromptTimeText ? (
                <p className="text-sm sm:text-base leading-relaxed font-medium">
                  {isGu ? (
                    <>
                      મેં તમને છેલ્લે <span className="font-bold text-amber-900 font-mono">{lastPromptTimeText}</span> સમયે તમારો ઓફલાઇન ખર્ચ ઉમેરવા જણાવેલું ત્યારે તમે મને આ સમયે ફરી યાદ કરાવવા કહેલું. શું હાલ તમે કોઈ રોકડ કે ઓફલાઇન ખર્ચ ઉમેરવા માંગો છો?
                    </>
                  ) : (
                    <>
                      I previously reminded you at <span className="font-bold text-amber-900 font-mono">{lastPromptTimeText}</span> to record your offline expenses, and you asked me to remind you at this time. Did you make any cash or offline payments today?
                    </>
                  )}
                </p>
              ) : (
                <p className="text-sm sm:text-base leading-relaxed font-medium">
                  {isGu
                    ? 'શું તમે આજે દિવસ દરમિયાન કોઈ ઓફલાઇન અથવા રોકડ (Cash) ખર્ચ કર્યો છે? જેમ કે ચા-નાસ્તો, શાકભાજી, રિક્ષા ભાડું કે અન્ય કોઈ ચૂકવણી?'
                    : 'Did you make any cash or offline purchases today (e.g. groceries, snacks, transport, fuel, or local shopping)?'}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setStep('add_form')}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-sm shadow-md transition active:scale-98 text-center cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isGu ? 'હા, ખર્ચ ઉમેરો' : 'Yes, Add Expense'}</span>
              </button>

              <button
                onClick={() => setStep('snooze_select')}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-sm transition active:scale-98 text-center cursor-pointer flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4 text-stone-500" />
                <span>{isGu ? 'પછી (Snooze)' : 'Later (Snooze)'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Snooze Options (§8: 1h, 2h, 5h, 12h, 1d) */}
        {step === 'snooze_select' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-stone-800">
                {isGu ? 'કેટલા સમય પછી ફરી યાદ કરાવું?' : 'When should I remind you again?'}
              </h4>
              <button
                onClick={() => setStep('prompt')}
                className="text-xs text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
              >
                {isGu ? 'પાછા જાઓ' : 'Back'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { mins: 60, gu: '૧ કલાક પછી', en: 'In 1 hour' },
                { mins: 120, gu: '૨ કલાક પછી', en: 'In 2 hours' },
                { mins: 300, gu: '૫ કલાક પછી', en: 'In 5 hours' },
                { mins: 720, gu: '૧૨ કલાક પછી', en: 'In 12 hours' },
                { mins: 1440, gu: '૧ દિવસ પછી (આવતીકાલે)', en: 'In 1 day (Tomorrow)' },
              ].map((opt) => (
                <button
                  key={opt.mins}
                  onClick={() => handleSnooze(opt.mins, opt.gu, opt.en)}
                  className="p-3.5 rounded-2xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/40 text-left transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-stone-800">
                      {isGu ? opt.gu : opt.en}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Quick Expense Add Form */}
        {step === 'add_form' && (
          <form onSubmit={handleSaveExpense} className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-stone-800">
                {isGu ? 'ખર્ચની વિગત દાખલ કરો' : 'Enter Expense Details'}
              </h4>
              <button
                type="button"
                onClick={() => setStep('prompt')}
                className="text-xs text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
              >
                {isGu ? 'પાછા જાઓ' : 'Back'}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {error}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {isGu ? 'ખર્ચ રકમ' : 'Amount'} ({currency}) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-stone-500">
                  {currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-base sm:text-lg font-bold font-mono rounded-xl border border-stone-200 outline-none focus:border-[#2D6A4F] bg-stone-50/50"
                />
              </div>
            </div>

            {/* Title / Where spent */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {isGu ? 'ક્યાં / શા માટે ખર્ચ કર્યો?' : 'Where / For what?'}
              </label>
              <input
                type="text"
                placeholder={isGu ? 'દા.ત. ચા-નાસ્તો, શાકભાજી, પેટ્રોલ, દવા' : 'e.g. Snacks, Groceries, Fuel'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 outline-none focus:border-[#2D6A4F]"
              />
            </div>

            {/* Category selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-700">
                  {isGu ? 'કેટેગરી' : 'Category'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategoryMode(!isCustomCategoryMode)}
                  className="text-[11px] text-[#2D6A4F] hover:underline font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isCustomCategoryMode ? (isGu ? 'યાદીમાંથી પસંદ કરો' : 'Pick from list') : (isGu ? '+ નવી કેટેગરી' : '+ New Category')}</span>
                </button>
              </div>

              {!isCustomCategoryMode ? (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none font-medium cursor-pointer"
                >
                  {categories
                    .filter((c) => c.type === 'expense')
                    .map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="space-y-1.5 animate-in fade-in">
                  <input
                    type="text"
                    placeholder={isGu ? 'નવી કેટેગરીનું નામ લખો...' : 'Enter new category name...'}
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-emerald-50/30 outline-none focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-stone-500">
                    {isGu
                      ? 'આ નવી કેટેગરી આપમેળે તમારી કાયમી કેટેગરી લિસ્ટમાં ઉમેરાઈ જશે.'
                      : 'This category will be permanently added to your category list.'}
                  </p>
                </div>
              )}
            </div>

            {/* Time (Optional) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {isGu ? 'સમય (વૈકલ્પિક)' : 'Time (Optional)'}
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 rounded-xl bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs shadow-sm transition cursor-pointer"
              >
                {isGu ? 'ખર્ચ સાચવો' : 'Save Expense'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
