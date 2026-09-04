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
    if (pin.length !== 4) {
      setError(isGu ? 'પિન બરાબર ૪ અંકનો હોવો જોઈએ.' : 'PIN must be exactly 4 digits.');
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

        {/* STEP 1: Profile & Language Setup */}
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

            {/* Task 0: Language Selection with Clear Notice */}
            <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isGu ? 'તમારી ભાષા પસંદ કરો' : 'Choose Your Language'}</span>
                </label>
                <select
                  value={currentLang}
                  onChange={(e) => onSelectLanguage(e.target.value)}
                  className="bg-white border border-indigo-200 text-indigo-950 px-2.5 py-1 rounded-xl outline-none cursor-pointer font-bold text-xs shadow-xs"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-indigo-900/90 leading-relaxed font-medium">
                {isGu
                  ? '📢 હવે પછીની તમામ સૂચનાઓ, કેટેગરી અને સેટિંગ આ જ ભાષામાં આવશે. એમ છતાં તમે ઇચ્છો ત્યારે સેટિંગ્સમાંથી ભાષા બદલી શકશો.'
                  : '📢 All subsequent instructions, categories, and settings will appear in this language. You can change it anytime from Settings.'}
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
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
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

        {/* STEP 2: 12-Word Passphrase with Comprehensive Explanation */}
        {step === 'securityWords' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {t.recoveryPhrase}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {isGu
                  ? 'આ ૧૨ શબ્દો તમારી એપ્લિકેશન અને બેકઅપની મુખ્ય સુરક્ષા ચાવી છે.'
                  : 'These 12 words form the master key for your encrypted diary and backups.'}
              </p>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{isGu ? '૧૨ શબ્દોની સુરક્ષા માર્ગદર્શિકા:' : '12-Word Passphrase Guide:'}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isGu
                  ? '• આ ૧૨ ગુપ્ત શબ્દો તમારી ફાયનાન્શિયલ તિજોરીની માસ્ટર ચાવી છે. જો તમે ક્યારેય ૪-અંકનો પિન ભૂલી જાઓ અથવા નવો ફોન બદલો, ત્યારે ફક્ત આ જ શબ્દો દ્વારા તમારો સમગ્ર હિસાબ પાછો મેળવી શકાશે.'
                  : '• These 12 words are the only master key to decrypt your vault. If you ever forget your PIN or migrate to a new device, these words will restore all data.'}
              </p>
              <p className="text-[11px] leading-relaxed font-semibold text-amber-900">
                {isGu
                  ? '• આ શબ્દો ક્યારેય કોઈ સાથે શેર કરશો નહીં. તેને કોઈ સુરક્ષિત ડાયરી કે કાગળ પર લખીને રાખો.'
                  : '• Never share these words with anyone. Write them down and keep them in a safe physical place.'}
              </p>
            </div>

            {/* Grid of 12 words */}
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
              <span className="text-xs text-stone-700 leading-snug font-medium">
                {isGu
                  ? 'મેં આ ૧૨ શબ્દો સુરક્ષિત કાગળ પર નોંધી લીધા છે અને તેની મહત્વતા સમજી લીધી છે.'
                  : 'I have safely written down these 12 recovery words and understand their importance.'}
              </span>
            </label>

            <button
              type="button"
              onClick={handleWordsNext}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isGu ? 'આગળ: ૪-અંક પિન સેટ કરો' : 'Next: Set 4-Digit PIN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: Security PIN (STRICTLY 4 DIGITS) */}
        {step === 'securityPin' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {isGu ? 'માસ્ટર ૪-અંક પિન સેટ કરો' : 'Set Master 4-Digit PIN'}
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                {isGu
                  ? 'એપ્લિકેશન ખોલવા માટે ફક્ત ૪ અંકનો સુરક્ષા પિન પસંદ કરો (૪ કરતાં વધુ અંક નહીં).'
                  : 'Choose an exact 4-digit numeric PIN to quickly unlock your diary.'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {isGu ? '૪-અંકનો સુરક્ષા પિન' : '4-Digit Security PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 text-center text-xl font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {isGu ? 'પિન ફરીથી દાખલ કરો (Confirm)' : 'Confirm 4-Digit PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 text-center text-xl font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500 focus:bg-white"
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

        {/* STEP 4: Permissions & Daily Offline Reminder with Detailed Guidance */}
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
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
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
                  ? 'UPI અને બેંક SMS આપમેળે ડિટેક્ટ કરી એન્ટ્રી કરશે. ૧-ટેપથી પરમિશન આપતાં જ બેંક મેસેજિસ સ્કેન થશે.'
                  : 'Automatically parses bank SMS to record entries with 1-tap permission approval.'}
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await NativeBridgeService.requestAllNativePermissions();
                    setSmsGranted(res.sms);
                    setNotifGranted(res.notifications);
                  } catch {
                    setSmsGranted(true);
                  }
                }}
                className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                {smsGranted ? (isGu ? 'પરમિશન અપાઈ ગઈ ✓' : 'Enabled ✓') : (isGu ? '૧-ટેપ પરમિશન આપો' : 'Grant 1-Tap Permission')}
              </button>
            </div>

            {/* Notification & Daily Offline Reminder Card with Detailed Explanation */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">
                    {isGu ? 'ઓફલાઇન અને રોકડ ખર્ચ રિમાઇન્ડર' : 'Offline Cash Expense Reminder'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableDailyReminder}
                  onChange={(e) => setEnableDailyReminder(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Task 4: Detailed Guidance on Reminder Time */}
              <div className="bg-white/80 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-950 leading-relaxed">
                <strong>{isGu ? 'શા માટે આ સમય જરૂરી છે?' : 'Why is this reminder essential?'}</strong>{' '}
                {isGu
                  ? 'દિવસ દરમિયાન તમે શાકભાજી, રિક્ષા ભાડું, ચા-નાસ્તો કે અન્ય રોકડ ખર્ચા કર્યા હોય જેનો બેંક SMS નથી આવતો, તે રાત્રે ભૂલાઈ ન જાય તે માટે એપ તમારા પસંદ કરેલા સમયે યાદ અપાવશે અને ૧૦ સેકન્ડમાં નોંધી લેશે.'
                  : 'Cash expenses like groceries, tea, or transit do not have bank SMS alerts. This reminder gently prompts you at your preferred time so no expense is forgotten.'}
              </div>

              {enableDailyReminder && (
                <div className="flex items-center gap-2 pt-1">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <label className="text-xs font-bold text-stone-700">
                    {isGu ? 'યાદ અપાવવાનો સમય:' : 'Reminder Time:'}
                  </label>
                  <input
                    type="time"
                    value={dailyReminderTime}
                    onChange={(e) => setDailyReminderTime(e.target.value)}
                    className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-stone-200 bg-white outline-none cursor-pointer"
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
