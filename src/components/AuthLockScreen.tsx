import React, { useState } from 'react';
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
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  securityConfig,
  onUnlock,
  onResetPinWithPassphrase,
  currentLang,
  t,
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

  const handleKeyClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);
      if (nextPin.length >= 4) {
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
      } else if (candidate.length >= 6) {
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
    if (!securityConfig.biometricsEnabled) return;
    const success = await authenticateWithBiometrics();
    if (success) {
      onUnlock();
    }
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

  return (
    <div
      id="auth-lock-screen"
      className="fixed inset-0 z-[100] bg-stone-900 flex flex-col items-center justify-between p-6 sm:p-10 select-none text-white animate-in fade-in duration-300"
    >
      {/* Top Brand & Security Icon */}
      <div className="flex flex-col items-center mt-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {t.appName}
        </h1>
        <p className="text-xs sm:text-sm text-stone-400 mt-1">
          {t.enterPin}
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
            <AlertCircle className="w-3.5 h-3.5" />
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
          <div key={rIdx} className="grid grid-cols-3 gap-3 sm:gap-4">
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
          {/* Biometrics button */}
          <button
            onClick={handleBiometricClick}
            disabled={!securityConfig.biometricsEnabled}
            className={`h-14 sm:h-16 rounded-2xl flex items-center justify-center transition cursor-pointer border ${
              securityConfig.biometricsEnabled
                ? 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border-stone-700/50 active:scale-95'
                : 'opacity-0 cursor-default border-transparent'
            }`}
          >
            <Fingerprint className="w-6 h-6" />
          </button>

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
