import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Wallet, 
  User, 
  Globe, 
  ShieldCheck, 
  Lock, 
  Bell, 
  MessageSquareText, 
  Check, 
  Copy, 
  AlertTriangle,
  Fingerprint,
  Clock
} from 'lucide-react';
import { TranslationStrings, LANGUAGES } from '../data/languages';
import { SecurityConfig } from '../types';
import { 
  generate12WordPassphrase, 
  normalizeWords, 
  hashWithPBKDF2, 
  isBiometricsAvailable 
} from '../services/security';
import { requestNotificationPermission } from '../services/notifications';

interface OnboardingModalProps {
  onComplete: (data: {
    name: string;
    currency: string;
    budget: number;
    securityConfig: SecurityConfig;
    passphraseWords: string[];
    dailyReminderTime: string;
    enableDailyReminder: boolean;
  }) => void;
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
  const [step, setStep] = useState<'profile' | 'securityWords' | 'securityPin' | 'permissions'>('profile');

  // Step 1: Profile
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('₹');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [error, setError] = useState('');

  // Step 2: 12 Words
  const [words, setWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasBackedUpWords, setHasBackedUpWords] = useState(false);

  // Step 3: PIN
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [biometricsSupported, setBiometricsSupported] = useState(false);

  // Step 4: Permissions & Daily Reminder
  const [smsGranted, setSmsGranted] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [dailyReminderTime, setDailyReminderTime] = useState('20:00');
  const [enableDailyReminder, setEnableDailyReminder] = useState(true);

  const isGu = currentLang === 'gu';

  useEffect(() => {
    setWords(generate12WordPassphrase());
    isBiometricsAvailable().then((res) => setBiometricsSupported(res));
  }, []);

  const currencies = [
    { symbol: '₹', label: 'INR (₹)' },
    { symbol: '$', label: 'USD ($)' },
    { symbol: '€', label: 'EUR (€)' },
    { symbol: '£', label: 'GBP (£)' },
    { symbol: '¥', label: 'JPY/CNY (¥)' },
    { symbol: 'د.إ', label: 'AED (د.إ)' },
  ];

  const handleProfileNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isGu ? 'કૃપા કરીને તમારું નામ દાખલ કરો' : 'Please enter your name');
      return;
    }
    setError('');
    setStep('securityWords');
  };

  const handleCopyWords = () => {
    navigator.clipboard.writeText(words.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWordsNext = () => {
    if (!hasBackedUpWords) {
      setError(
        isGu
          ? 'કૃપા કરીને ખાતરી કરો કે તમે આ ૧૨ શબ્દો નોંધી લીધા છે.'
          : 'Please confirm that you have safely saved your 12 recovery words.'
      );
      return;
    }
    setError('');
    setStep('securityPin');
  };

  const handlePinNext = () => {
    if (pin.length < 4 || pin.length > 6) {
      setError(isGu ? 'પિન ૪ થી ૬ અંકનો હોવો જોઈએ.' : 'PIN must be 4 to 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError(isGu ? 'બંને પિન મેળ ખાતા નથી.' : 'PIN confirmation does not match.');
      return;
    }
    setError('');
    setStep('permissions');
  };

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
  };

  const handleFinishOnboarding = async () => {
    // Generate hashes
    const { hash: pinHash, salt: pinSalt } = await hashWithPBKDF2(pin);
    const normalized = normalizeWords(words);
    const { hash: wordsHash, salt: wordsSalt } = await hashWithPBKDF2(normalized);

    const securityConfig: SecurityConfig = {
      hasCompletedSetup: true,
      isLocked: false,
      pinHash,
      pinSalt,
      biometricsEnabled: biometricsSupported && biometricsEnabled,
      autoLockMinutes: 5,
      recoveryWordsHash: wordsHash,
      recoveryWordsSalt: wordsSalt,
      diaryLockEnabled: false,
    };

    onComplete({
      name: name.trim(),
      currency,
      budget: parseFloat(monthlyBudget) || 0,
      securityConfig,
      passphraseWords: words,
      dailyReminderTime,
      enableDailyReminder,
    });
  };

  return (
    <div
      id="onboarding-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="onboarding-modal-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto"
      >
        {/* Language selector pill at top */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              {step === 'profile' && (isGu ? 'પગલું ૧/૪: પ્રોફાઈલ' : 'Step 1/4: Profile')}
              {step === 'securityWords' && (isGu ? 'પગલું ૨/૪: રિકવરી કી' : 'Step 2/4: Recovery Key')}
              {step === 'securityPin' && (isGu ? 'પગલું ૩/૪: સુરક્ષા પિન' : 'Step 3/4: Security PIN')}
              {step === 'permissions' && (isGu ? 'પગલું ૪/૪: પરમિશન અને રિમાઇન્ડર' : 'Step 4/4: Setup')}
            </span>
          </div>

          <div className="relative flex items-center bg-stone-50 border border-stone-200 rounded-full px-2.5 py-1 text-xs">
            <Globe className="w-3.5 h-3.5 text-stone-500 mr-1.5 pointer-events-none" />
            <select
              value={currentLang}
              onChange={(e) => onSelectLanguage(e.target.value)}
              className="bg-transparent text-stone-700 outline-none cursor-pointer font-semibold text-[11px]"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Profile */}
        {step === 'profile' && (
          <form onSubmit={handleProfileNext} className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {isGu ? 'સ્વાગત છે!' : 'Welcome to Expense Diary!'}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {isGu
                  ? 'તમારી વ્યક્તિગત અને સુરક્ષિત ફાયનાન્શિયલ ડાયરી સેટઅપ કરવા માટે પ્રાથમિક વિગતો આપો.'
                  : 'Let’s set up your private, offline-first financial diary in seconds.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                {isGu ? 'તમારું નામ (Your Name)' : 'Your Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isGu ? 'દા.ત. અજય પટેલ' : 'e.g. Alex Smith'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none text-xs sm:text-sm font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                {isGu ? 'પ્રાથમિક કરન્સી (Currency)' : 'Primary Currency'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {currencies.map((c) => (
                  <button
                    key={c.symbol}
                    type="button"
                    onClick={() => setCurrency(c.symbol)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      currency === c.symbol
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                {isGu ? 'માસિક બજેટ લક્ષ્ય (વૈકલ્પિક)' : 'Monthly Budget Goal (Optional)'}
              </label>
              <div className="relative">
                <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  placeholder="25000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none text-xs sm:text-sm font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isGu ? 'આગળ વધો' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: 12-Word Passphrase */}
        {step === 'securityWords' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {t.recoveryPhrase}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {isGu
                  ? 'આ ૧૨ શબ્દો તમારી એપ્લિકેશન અને બેકઅપની મુખ્ય ચાવી છે.'
                  : 'These 12 words form the master key for your encrypted diary and backups.'}
              </p>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>{isGu ? 'મહત્વની સૂચના:' : 'Crucial Security Note:'}</strong>{' '}
                {t.passphraseWarning}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
              {words.map((w, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 flex items-center gap-1 shadow-xs"
                >
                  <span className="text-[10px] font-bold text-stone-400 w-4">{idx + 1}.</span>
                  <span className="text-xs font-mono font-bold text-stone-800 truncate">{w}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyWords}
                className="text-xs font-semibold text-emerald-700 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isGu ? 'કૉપિ થઈ ગયું!' : 'Copied!') : (isGu ? 'શબ્દો કૉપિ કરો' : 'Copy Words')}</span>
              </button>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasBackedUpWords}
                onChange={(e) => setHasBackedUpWords(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <span className="text-xs text-stone-700 leading-snug">
                {isGu
                  ? 'મેં આ ૧૨ શબ્દો સુરક્ષિત જગ્યાએ લખી લીધા છે.'
                  : 'I have saved or written down these 12 recovery words in a safe place.'}
              </span>
            </label>

            <button
              type="button"
              onClick={handleWordsNext}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isGu ? 'આગળ: પિન સેટ કરો' : 'Next: Set PIN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: Security PIN */}
        {step === 'securityPin' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {t.setPin}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {isGu
                  ? 'એપ્લિકેશન ખોલવા માટે ૪ થી ૬ અંકનો સુરક્ષા પિન પસંદ કરો.'
                  : 'Choose a 4 to 6 digit PIN to unlock your diary quickly.'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  {t.enterPin}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 text-center text-lg font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  {t.confirmPin}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 text-center text-lg font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {biometricsSupported && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-stone-800">{t.biometrics}</span>
                </div>
                <input
                  type="checkbox"
                  checked={biometricsEnabled}
                  onChange={(e) => setBiometricsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handlePinNext}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isGu ? 'આગળ: પરમિશન સેટઅપ' : 'Next: Permissions'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 4: Permissions & Daily Reminder */}
        {step === 'permissions' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {isGu ? 'સ્માર્ટ ફીચર્સ અને પરમિશન' : 'Features & Permissions'}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {isGu
                  ? 'ખર્ચ આપમેળે શોધવા અને દૈનિક રિમાઇન્ડર માટે સેટઅપ કરો.'
                  : 'Configure auto-detection and daily reminders.'}
              </p>
            </div>

            {/* SMS Permission Card */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">
                    {isGu ? 'SMS સ્માર્ટ ખર્ચ ડિટેક્શન' : 'SMS Expense Detection'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                  {smsGranted ? (isGu ? 'સક્ષમ' : 'Allowed') : (isGu ? 'વૈકલ્પિક' : 'Optional')}
                </span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                {isGu
                  ? 'UPI અને બેંક SMS આપમેળે ડિટેક્ટ કરી એન્ટ્રી કરશે. જો ન આપો તો પણ તમે મેન્યુઅલી બધું નોંધી શકશો.'
                  : 'Automatically parses bank SMS to record entries. If denied, manual entry works fully.'}
              </p>
              <button
                type="button"
                onClick={() => setSmsGranted(true)}
                className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                {smsGranted ? (isGu ? 'પરમિશન અપાઈ ગઈ' : 'Enabled') : (isGu ? 'પરમિશન આપો' : 'Grant Permission')}
              </button>
            </div>

            {/* Notification & Daily Reminder Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">
                    {isGu ? 'દૈનિક ખર્ચ રિમાઇન્ડર' : 'Daily Expense Reminder'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableDailyReminder}
                  onChange={(e) => setEnableDailyReminder(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {enableDailyReminder && (
                <div className="flex items-center gap-2 pt-1">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <label className="text-xs text-stone-700">
                    {isGu ? 'રિમાઇન્ડર સમય:' : 'Reminder Time:'}
                  </label>
                  <input
                    type="time"
                    value={dailyReminderTime}
                    onChange={(e) => setDailyReminderTime(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-stone-200 bg-white outline-none"
                  />
                  {!notifGranted && (
                    <button
                      type="button"
                      onClick={handleRequestNotif}
                      className="ml-auto text-[10px] font-bold text-emerald-800 underline"
                    >
                      {isGu ? 'નોટિફિકેશન મંજૂર કરો' : 'Allow Notifications'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isGu ? 'સેટઅપ પૂર્ણ કરો અને શરૂ કરો' : 'Finish Setup & Start'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
