import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { SecurityConfig } from '../types';
import { verifyPBKDF2, normalizeWords, authenticateWithBiometrics } from '../services/security';
import { TranslationStrings } from '../data/languages';

interface AuthLockScreenProps {
  securityConfig: SecurityConfig;
  onUnlock: () => void;
  onResetPinWithPassphrase: (newPin: string) => Promise<void>;
  currentLang: string;
  t: TranslationStrings;
  /**
   * On-Device Encryption gate: when present, the sealed at-rest vault must be
   * decrypted with the 12 recovery words BEFORE any PIN/biometric is offered.
   */
  deviceLock?: {
    onUnlockWithWords: (words: string[]) => Promise<string | null>;
  };
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  securityConfig,
  onUnlock,
  onResetPinWithPassphrase,
  currentLang,
  t,
  deviceLock,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Forgot PIN state
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [forgotStep, setForgotStep] = useState<'words' | 'newPin'>('words');
  const [forgotError, setForgotError] = useState<string | null>(null);

  const isGu = currentLang === 'gu';
  const hasBiometrics = !!securityConfig.biometricsEnabled;

  // Immediately prompt native fingerprint/biometrics on screen mount if enabled
  useEffect(() => {
    if (hasBiometrics) {
      // Trigger native Android BiometricPrompt immediately
      const timer = setTimeout(() => {
        handleBiometricClick();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasBiometrics]);

  const handleKeyClick = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);
      if (nextPin.length === 4) {
        checkPin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const checkPin = async (candidate: string) => {
    if (!securityConfig.pinHash || !securityConfig.pinSalt) {
      onUnlock();
      return;
    }

    setIsVerifying(true);
    try {
      const match = await verifyPBKDF2(candidate, securityConfig.pinHash, securityConfig.pinSalt);
      if (match) {
        onUnlock();
      } else {
        setErrorMsg(isGu ? 'ખોટો પિન. ફરી પ્રયાસ કરો.' : 'Incorrect PIN. Try again.');
        setPin('');
      }
    } catch {
      setErrorMsg(isGu ? 'ક્ષતિ થઈ. ફરી પ્રયાસ કરો.' : 'Verification error. Try again.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricClick = async () => {
    try {
      const title = t.appName;
      const subtitle = isGu
        ? 'ઍપ અનલૉક કરવા માટે ફિંગરપ્રિન્ટ સ્કેન કરો'
        : 'Confirm your fingerprint to unlock';
      const success = await authenticateWithBiometrics(title, subtitle);
      if (success) {
        onUnlock();
        return;
      }
    } catch {}
    setErrorMsg(
      isGu
        ? 'ફિંગરપ્રિન્ટ ચકાસણી અપૂર્ણ. ૪-અંકનો પિન દાખલ કરો.'
        : 'Fingerprint not recognized. Please enter 4-digit PIN.'
    );
  };

  // Forgot PIN: verify 12 words
  const handleVerifyPassphrase = async () => {
    setForgotError(null);
    const normalized = normalizeWords(recoveryInput);
    const words = normalized.split(' ').filter(Boolean);

    if (words.length !== 12) {
      setForgotError(
        isGu
          ? `બરાબર ૧૨ શબ્દો દાખલ કરો. (હાલમાં: ${words.length})`
          : `Please enter exactly 12 words. (Current: ${words.length})`
      );
      return;
    }

    if (!securityConfig.recoveryWordsHash || !securityConfig.recoveryWordsSalt) {
      setForgotStep('newPin');
      return;
    }

    setIsVerifying(true);
    try {
      const match = await verifyPBKDF2(
        normalized,
        securityConfig.recoveryWordsHash,
        securityConfig.recoveryWordsSalt
      );
      if (match) {
        setForgotStep('newPin');
        setForgotError(null);
      } else {
        setForgotError(
          isGu
            ? 'આપેલી રિકવરી કી મેળ ખાતી નથી. કૃપા કરીને સાચા શબ્દો દાખલ કરો.'
            : 'Passphrase does not match. Please verify your 12 recovery words.'
        );
      }
    } catch {
      setForgotError(isGu ? 'ચકાસણીમાં ક્ષતિ થઈ.' : 'Error during passphrase verification.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Reset PIN
  const handleSaveNewPin = async () => {
    if (newPin.length < 4 || newPin.length > 6) {
      setForgotError(isGu ? 'પિન ૪ થી ૬ આંકડાનો હોવો જોઈએ.' : 'PIN must be 4 to 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setForgotError(isGu ? 'બંને પિન મેળ ખાતા નથી.' : 'PIN confirmation does not match.');
      return;
    }

    setIsVerifying(true);
    try {
      await onResetPinWithPassphrase(newPin);
      setShowForgotModal(false);
      onUnlock();
    } catch {
      setForgotError(isGu ? 'પિન બદલવામાં ક્ષતિ થઈ.' : 'Failed to update PIN.');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── On-Device Encryption words gate ────────────────────────────────────────
  const [deviceWords, setDeviceWords] = useState('');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);

  const handleDeviceUnlockClick = async () => {
    if (!deviceLock) return;
    const words = normalizeWords(deviceWords).split(' ').filter(Boolean);
    if (words.length !== 12) {
      setDeviceError(
        isGu
          ? `બરાબર ૧૨ શબ્દો દાખલ કરો. (હાલમાં: ${words.length})`
          : `Please enter exactly 12 words. (Current: ${words.length})`
      );
      return;
    }
    setDeviceBusy(true);
    setDeviceError(null);
    try {
      const err = await deviceLock.onUnlockWithWords(words);
      if (err) {
        setDeviceError(err);
      } else {
        onUnlock();
      }
    } catch {
      setDeviceError(isGu ? 'અનલૉક કરવામાં ક્ષતિ થઈ.' : 'Unlock failed. Please try again.');
    } finally {
      setDeviceBusy(false);
    }
  };

  if (deviceLock) {
    return (
      <div
        id="device-encryption-lock"
        className="fixed inset-0 z-[100] bg-stone-900 flex flex-col items-center justify-center p-6 sm:p-10 select-none text-white animate-in fade-in duration-300"
      >
        <div className="w-full max-w-md space-y-5">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
              <KeyRound className="w-8 h-8 stroke-[2.2]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{t.appName}</h1>
            <p className="text-xs sm:text-sm text-stone-400 mt-2 leading-relaxed">
              {isGu
                ? 'તમારો ડેટા આ ઉપકરણ પર એન્ક્રિપ્ટેડ છે. અનલૉક કરવા તમારી ૧૨ શબ્દોની રિકવરી કી દાખલ કરો.'
                : 'Your data is encrypted on this device. Enter your 12 recovery words to unlock.'}
            </p>
          </div>

          {deviceError && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deviceError}</span>
            </div>
          )}

          <textarea
            rows={4}
            value={deviceWords}
            onChange={(e) => {
              setDeviceWords(e.target.value);
              setDeviceError(null);
            }}
            placeholder="word1 word2 word3 ... word12"
            autoFocus
            className="w-full p-3 text-xs rounded-xl bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-600 outline-none focus:border-emerald-500 font-mono"
          />

          <button
            onClick={handleDeviceUnlockClick}
            disabled={deviceBusy || !deviceWords.trim()}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
          >
            <Lock className="w-4 h-4" />
            <span>{deviceBusy ? (isGu ? 'અનલૉક થઈ રહ્યું છે...' : 'Unlocking...') : (isGu ? 'વોલ્ટ અનલૉક કરો' : 'Unlock Vault')}</span>
          </button>

          <p className="text-[10px] text-stone-500 text-center leading-relaxed">
            {isGu
              ? 'એન્ક્રિપ્શન કી તમારા શબ્દોમાંથી બને છે — તે ક્યાંય સેવ થતા નથી. શબ્દો ગુમાવશો તો ડેટા પુનઃપ્રાપ્ત થશે નહીં.'
              : 'The encryption key is derived from your words and is never stored. Without the words, the data cannot be recovered.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="auth-lock-screen"
      className="fixed inset-0 z-[100] bg-stone-900 flex flex-col items-center justify-between p-6 sm:p-10 select-none text-white animate-in fade-in duration-300"
    >
      {/* Top Brand & Security Icon */}
      <div className="flex flex-col items-center mt-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
          {hasBiometrics ? (
            <Fingerprint className="w-9 h-9 stroke-[2.2] animate-pulse" />
          ) : (
            <Lock className="w-8 h-8 stroke-[2.2]" />
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {t.appName}
        </h1>
        <p className="text-xs sm:text-sm text-stone-400 mt-1 text-center">
          {hasBiometrics
            ? (isGu ? 'ફિંગરપ્રિન્ટ સ્કેન કરો અથવા ૪-અંકનો પિન દાખલ કરો' : 'Scan fingerprint or enter 4-digit PIN')
            : t.enterPin}
        </p>
      </div>

      {/* PIN Dots Display */}
      <div className="flex flex-col items-center my-4">
        <div className="flex items-center gap-4 h-10">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  filled
                    ? 'bg-emerald-400 scale-110 shadow-md shadow-emerald-400/50'
                    : 'bg-stone-700 border border-stone-600'
                }`}
              />
            );
          })}
        </div>
        {errorMsg && (
          <div className="text-xs text-rose-400 font-medium mt-3 flex items-center gap-1.5 animate-shake">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs space-y-3 sm:space-y-4 mb-4">
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rIdx) => (
          <div key={row[0]} className="grid grid-cols-3 gap-3 sm:gap-4">
            {row.map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeyClick(digit)}
                disabled={isVerifying}
                className="h-14 sm:h-16 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-xl font-bold transition flex items-center justify-center cursor-pointer active:scale-95 shadow-xs border border-stone-700/50"
              >
                {digit}
              </button>
            ))}
          </div>
        ))}

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {/* Biometrics button (Immediate re-trigger) */}
          {hasBiometrics ? (
            <button
              id="fingerprint-unlock-btn"
              type="button"
              onClick={handleBiometricClick}
              className="h-14 sm:h-16 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-800 text-emerald-400 flex flex-col items-center justify-center transition cursor-pointer border border-emerald-500/40 active:scale-95 shadow-xs relative group"
              title={isGu ? 'ફિંગરપ્રિન્ટ સ્કેનર ફરી ખોલો' : 'Re-open Fingerprint Scanner'}
            >
              <Fingerprint className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-bold text-emerald-300 mt-0.5">
                {isGu ? 'સ્કેન' : 'Scan'}
              </span>
            </button>
          ) : (
            <div className="h-14 sm:h-16" />
          )}

          {/* 0 digit */}
          <button
            onClick={() => handleKeyClick('0')}
            disabled={isVerifying}
            className="h-14 sm:h-16 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-xl font-bold transition flex items-center justify-center cursor-pointer active:scale-95 shadow-xs border border-stone-700/50"
          >
            0
          </button>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-xs font-semibold text-stone-300 transition flex items-center justify-center cursor-pointer active:scale-95 shadow-xs border border-stone-700/50"
          >
            {isGu ? 'કાઢી નાખો' : 'DEL'}
          </button>
        </div>
      </div>

      {/* Forgot PIN Action */}
      <div className="mb-2">
        <button
          onClick={() => {
            setShowForgotModal(true);
            setForgotStep('words');
            setRecoveryInput('');
            setForgotError(null);
          }}
          className="text-xs text-stone-400 hover:text-emerald-400 underline underline-offset-4 cursor-pointer transition"
        >
          {t.forgotPin}
        </button>
      </div>

      {/* Forgot PIN Passphrase Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-800 border border-stone-700 rounded-3xl p-6 shadow-2xl space-y-4 text-stone-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isGu ? 'રિકવરી કી દ્વારા પિન રીસેટ' : 'Reset PIN with Passphrase'}
                </h3>
                <p className="text-xs text-stone-400">
                  {isGu ? 'તમારી ૧૨ શબ્દોની ગુપ્ત કી દાખલ કરો' : 'Enter your 12 recovery words'}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === 'words' ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-400 leading-relaxed">
                  {isGu
                    ? 'ખાતરી કરવા માટે તમારા ૧૨ શબ્દો વચ્ચે એક જગ્યા (Space) રાખીને દાખલ કરો:'
                    : 'Enter your 12 recovery words separated by a single space:'}
                </p>
                <textarea
                  rows={4}
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder="word1 word2 word3 ... word12"
                  className="w-full p-3 text-xs rounded-xl bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-600 outline-none focus:border-emerald-500 font-mono"
                />

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-xs font-semibold text-stone-200 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleVerifyPassphrase}
                    disabled={isVerifying || !recoveryInput.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isGu ? 'ચકાસો' : 'Verify'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {isGu ? 'રિકવરી કી માન્ય છે! હવે નવો પિન સેટ કરો.' : 'Passphrase verified! Set your new PIN.'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-400 block mb-1">
                    {isGu ? 'નવો પિન (૪ થી ૬ અંક):' : 'New PIN (4 to 6 digits):'}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono rounded-xl bg-stone-900 border border-stone-700 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-400 block mb-1">
                    {isGu ? 'નવો પિન ફરી દાખલ કરો:' : 'Confirm New PIN:'}
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono rounded-xl bg-stone-900 border border-stone-700 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-xs font-semibold text-stone-200 cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSaveNewPin}
                    disabled={isVerifying || !newPin || newPin !== confirmNewPin}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    {isGu ? 'નવો પિન સાચવો' : 'Save New PIN'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
