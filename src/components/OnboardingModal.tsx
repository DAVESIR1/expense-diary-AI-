import React, { useState } from 'react';
import { Sparkles, ArrowRight, Wallet, User, Globe } from 'lucide-react';
import { TranslationStrings, LANGUAGES } from '../data/languages';

interface OnboardingModalProps {
  onComplete: (name: string, currency: string, budget: number) => void;
  currentLang: string;
  onSelectLanguage: (lang: string) => void;
  t: TranslationStrings;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  onComplete,
  currentLang,
  onSelectLanguage,
  t,
}) => {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('₹');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [error, setError] = useState('');

  const currencies = [
    { symbol: '₹', label: 'INR (₹)' },
    { symbol: '$', label: 'USD ($)' },
    { symbol: '€', label: 'EUR (€)' },
    { symbol: '£', label: 'GBP (£)' },
    { symbol: '¥', label: 'JPY/CNY (¥)' },
    { symbol: 'د.إ', label: 'AED (د.إ)' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(currentLang === 'gu' ? 'કૃપા કરીને તમારું નામ દાખલ કરો' : 'Please enter your name');
      return;
    }
    const budgetNum = parseFloat(monthlyBudget) || 0;
    onComplete(name.trim(), currency, budgetNum);
  };

  return (
    <div
      id="onboarding-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="onboarding-modal-card"
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-200"
      >
        {/* Language selector pill at top right */}
        <div className="flex justify-between items-center mb-6">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="relative flex items-center bg-stone-50 border border-stone-200 rounded-full px-3 py-1 text-xs">
            <Globe className="w-3.5 h-3.5 text-stone-500 mr-1.5 pointer-events-none" />
            <select
              value={currentLang}
              onChange={(e) => onSelectLanguage(e.target.value)}
              className="bg-transparent text-stone-700 outline-none cursor-pointer font-medium"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.nativeName})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">
            {currentLang === 'gu' ? 'સ્વાગત છે!' : 'Welcome!'}
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            {currentLang === 'gu'
              ? 'તમારી વ્યક્તિગત AI ખર્ચ ડાયરી શરૂ કરવા માટે બે વિગતો આપો.'
              : 'Set up your personal AI Expense Diary in seconds.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              {currentLang === 'gu' ? 'તમારું નામ (Name)' : 'Your Name'}
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder={currentLang === 'gu' ? 'દા.ત. નીતિન અથવા તમારું નામ' : 'e.g. Alex Smith'}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm transition"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          {/* Currency selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              {currentLang === 'gu' ? 'પ્રાથમિક કરન્સી (Currency)' : 'Primary Currency'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {currencies.map((c) => (
                <button
                  key={c.symbol}
                  type="button"
                  onClick={() => setCurrency(c.symbol)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-center cursor-pointer ${
                    currency === c.symbol
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly budget (optional) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              {currentLang === 'gu' ? 'માસિક બજેટ લક્ષ્ય (વૈકલ્પિક)' : 'Monthly Budget Goal (Optional)'}
            </label>
            <div className="relative">
              <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder={currentLang === 'gu' ? 'દા.ત. 30000' : 'e.g. 1500'}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm transition font-mono"
              />
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="w-full mt-2 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
          >
            <span>{currentLang === 'gu' ? 'ડાયરી શરૂ કરો' : 'Start My Diary'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
