import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Copy, 
  Check, 
  AlertTriangle, 
  Fingerprint, 
  ArrowRight, 
  Lock,
  X
} from 'lucide-react';
import { SecurityConfig } from '../types';
import { 
  generate12WordPassphrase, 
  normalizeWords, 
  hashWithPBKDF2, 
  isBiometricsAvailable 
} from '../services/security';
import { TranslationStrings } from '../data/languages';

interface SecuritySetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSaveSecurityConfig: (cfg: SecurityConfig, passphraseWords: string[]) => void;
  currentLang: string;
  t: TranslationStrings;
  isInitialOnboarding?: boolean;
}

export const SecuritySetupModal: React.FC<SecuritySetupModalProps> = ({
  isOpen,
  onClose,
  onSaveSecurityConfig,
  currentLang,
  t,
  isInitialOnboarding = false,
}) => {
  const [step, setStep] = useState<'words' | 'pin'>('words');
  const [words, setWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasBackedUpWords, setHasBackedUpWords] = useState(false);

  // PIN state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isGu = currentLang === 'gu';

  useEffect(() => {
    if (isOpen) {
      setWords(generate12WordPassphrase());
      setStep('words');
      setCopied(false);
      setHasBackedUpWords(false);
      setPin('');
      setConfirmPin('');
      setErrorMsg(null);

      isBiometricsAvailable().then((supported) => {
        setBiometricsSupported(supported);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyWords = () => {
    const text = words.join(' ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleProceedToPin = () => {
    if (!hasBackedUpWords) {
      setErrorMsg(
        isGu
          ? 'કૃપા કરીને ખાતરી કરો કે તમે આ ૧૨ શબ્દો સાચવી લીધા છે.'
          : 'Please confirm that you have safely written down or saved these 12 words.'
      );
      return;
    }
    setErrorMsg(null);
    setStep('pin');
  };

  const handleSaveSecurity = async () => {
    setErrorMsg(null);
    if (pin.length !== 4) {
      setErrorMsg(isGu ? 'પિન બરાબર ૪ અંકનો હોવો જોઈએ.' : 'PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg(isGu ? 'બંને પિન મેળ ખાતા નથી.' : 'PIN confirmation does not match.');
      return;
    }

    setIsProcessing(true);
    try {
      // Hash PIN using PBKDF2
      const { hash: pinHash, salt: pinSalt } = await hashWithPBKDF2(pin);

      // Hash 12 words for recovery verification
      const normalizedWords = normalizeWords(words);
      const { hash: wordsHash, salt: wordsSalt } = await hashWithPBKDF2(normalizedWords);

      const config: SecurityConfig = {
        hasCompletedSetup: true,
        isLocked: false,
        pinHash,
        pinSalt,
        biometricsEnabled: biometricsSupported && biometricsEnabled,
        autoLockMinutes,
        recoveryWordsHash: wordsHash,
        recoveryWordsSalt: wordsSalt,
        diaryLockEnabled: false,
      };

      onSaveSecurityConfig(config, words);
      if (onClose) onClose();
    } catch {
      setErrorMsg(isGu ? 'સેટિંગ્સ સાચવવામાં ક્ષતિ થઈ.' : 'Failed to initialize security config.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="security-setup-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="security-setup-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 tracking-tight">
                {isGu ? 'સુરક્ષા અને પાસફ્રેઝ સેટઅપ' : 'Security & Recovery Setup'}
              </h3>
              <p className="text-xs text-stone-500">
                {step === 'words'
                  ? (isGu ? 'પગલું ૧: ૧૨ શબ્દોની રિકવરી કી' : 'Step 1: 12-Word Recovery Passphrase')
                  : (isGu ? 'પગલું ૨: સુરક્ષા પિન અને બાયોમેટ્રિક્સ' : 'Step 2: Security PIN & Biometrics')}
              </p>
            </div>
          </div>
          {!isInitialOnboarding && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: 12 Words */}
        {step === 'words' && (
          <div className="space-y-4">
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">
                  {isGu ? 'આ ૧૨ શબ્દો ખૂબ મહત્વના છે:' : 'Keep These 12 Words Safe:'}
                </strong>
                {t.passphraseWarning}
              </div>
            </div>

            {/* 12 Words Grid */}
            <div className="grid grid-cols-3 gap-2 bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
              {words.map((w, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-stone-200 rounded-xl px-2.5 py-2 flex items-center gap-1.5 shadow-xs"
                >
                  <span className="text-[10px] font-bold text-stone-400 w-4 select-none">
                    {idx + 1}.
                  </span>
                  <span className="text-xs font-mono font-semibold text-stone-800 truncate">
                    {w}
                  </span>
                </div>
              ))}
            </div>

            {/* Copy Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyWords}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isGu ? 'કૉપિ થઈ ગયું!' : 'Copied!') : (isGu ? 'શબ્દો કૉપિ કરો' : 'Copy Words')}</span>
              </button>
            </div>

            {/* Checkbox Acknowledgment */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-200/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasBackedUpWords}
                onChange={(e) => setHasBackedUpWords(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <span className="text-xs text-stone-700 leading-snug">
                {isGu
                  ? 'મેં આ ૧૨ શબ્દો સુરક્ષિત જગ્યાએ નોંધી લીધા છે અને હું જાણું છું કે આના વિના ભૂલેલો પિન રિકવર નહીં થઈ શકે.'
                  : 'I have written down or saved these 12 words securely and understand that without them, my data cannot be recovered if I forget my PIN.'}
              </span>
            </label>

            <button
              onClick={handleProceedToPin}
              className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <span>{isGu ? 'આગળ વધો: પિન સેટ કરો' : 'Next: Set Security PIN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Set PIN & Biometrics */}
        {step === 'pin' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {isGu ? '૪-અંકનો સુરક્ષા પિન' : '4-Digit Security PIN'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-center text-xl font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  {t.confirmPin}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-center text-xl font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Biometrics Toggle */}
            {biometricsSupported && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-stone-800">{t.biometrics}</div>
                    <div className="text-[10px] text-stone-500">
                      {isGu ? 'ફિંગરપ્રિન્ટ / ફેસ અનલૉક સક્ષમ કરો' : 'Enable fingerprint / face unlock'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={biometricsEnabled}
                  onChange={(e) => setBiometricsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            )}

            {/* Auto-Lock Timeout */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <label className="text-xs font-bold text-stone-800 block">
                {isGu ? 'ઑટો-લૉક સમય (Auto-lock duration):' : 'Auto-lock timeout:'}
              </label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 bg-white outline-none cursor-pointer"
              >
                <option value={0}>{isGu ? 'તરત જ (Immediate on background)' : 'Immediate'}</option>
                <option value={1}>{isGu ? '૧ મિનિટ (1 minute)' : '1 minute'}</option>
                <option value={5}>{isGu ? '૫ મિનિટ (5 minutes)' : '5 minutes'}</option>
                <option value={15}>{isGu ? '૧૫ મિનિટ (15 minutes)' : '15 minutes'}</option>
                <option value={-1}>{isGu ? 'બંધ (Never auto-lock)' : 'Never'}</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('words')}
                className="py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer"
              >
                {isGu ? 'પાછળ' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleSaveSecurity}
                disabled={isProcessing || !pin || pin !== confirmPin}
                className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isGu ? 'સુરક્ષા સેટિંગ્સ સાચવો' : 'Save Security Settings'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
