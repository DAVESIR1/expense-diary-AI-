import React, { useState } from 'react';
import { X, ShieldCheck, Copy, Check, RefreshCw, KeyRound, AlertTriangle, FileDown } from 'lucide-react';
import {
  SafeVaultPayload,
  createSafeBackup,
  exportVaultEnvelope,
  ExportMethod,
  SAFE_VAULT_ITERATIONS,
} from '../services/safeVault';
import { generate12WordPassphrase } from '../services/security';

interface SafeVaultCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SafeVaultPayload;
  isGu: boolean;
}

type CreateStep = 'intro' | 'words' | 'creating' | 'done';

/**
 * SafeVault Create wizard:
 *   1. Intro — what this does and why the phrase matters.
 *   2. Words — show the generated 12-word recovery phrase once, gate on
 *      "I saved my words" (there is NO password reset in a zero-knowledge system).
 *   3. Creating — AES-256-GCM seal + manifest.
 *   4. Done — file saved (Downloads / share sheet / browser) with a receipt.
 */
export const SafeVaultCreateModal: React.FC<SafeVaultCreateModalProps> = ({ isOpen, onClose, payload, isGu }) => {
  const [step, setStep] = useState<CreateStep>('intro');
  const [words, setWords] = useState<string[]>([]);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ filename: string; method: ExportMethod } | null>(null);
  const [envelope, setEnvelope] = useState<Awaited<ReturnType<typeof createSafeBackup>>['envelope'] | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep('intro');
    setWords([]);
    setConfirmedSaved(false);
    setCopied(false);
    setError(null);
    setResult(null);
    setEnvelope(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = () => {
    setWords(generate12WordPassphrase());
    setConfirmedSaved(false);
    setStep('words');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(words.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(isGu ? 'કોપી કરવામાં નિષ્ફળ. શબ્દો જાતે લખી લો.' : 'Copy failed. Please write the words down manually.');
    }
  };

  const handleCreate = async () => {
    setStep('creating');
    setError(null);
    try {
      const { envelope: env } = await createSafeBackup(payload, { words });
      setEnvelope(env);
      const exportRes = await exportVaultEnvelope(env);
      if (!exportRes.ok) {
        throw new Error(isGu ? 'ફાઇલ સેવ કરવામાં નિષ્ફળ.' : 'Could not save the backup file.');
      }
      setResult({ filename: exportRes.filename, method: exportRes.method });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('words');
    }
  };

  const methodLabel = (m: ExportMethod): string => {
    if (m === 'downloads') return isGu ? 'ડાઉનલોડ્સ ફોલ્ડરમાં સેવ થયું' : 'Saved to Downloads';
    if (m === 'share') return isGu ? 'શેર શીટ ખોલાઈ' : 'Opened share sheet';
    return isGu ? 'બ્રાઉઝર ડાઉનલોડ' : 'Browser download';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-extrabold text-stone-900">
              {isGu ? 'સેફવોલ્ટ બેકઅપ બનાવો' : 'Create SafeVault Backup'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {step === 'intro' && (
          <div className="space-y-4">
            <p className="text-xs text-stone-600 leading-relaxed">
              {isGu
                ? `તમારો આખો ડેટા (${payload.transactions.length} વ્યવહારો, ${payload.diaryEntries.length} ડાયરી નોંધ, ${payload.borrowedLentRecords.length} ઉધાર-જમા) એક AES-256 એન્ક્રિપ્ટેડ ફાઇલમાં સીલ થશે. ફાઇલ ફક્ત તમારા 12 શબ્દોથી જ ખૂલી શકે — એપ પાસે પણ ચાવી નથી હોતી.`
                : `Your entire vault (${payload.transactions.length} transactions, ${payload.diaryEntries.length} diary entries, ${payload.borrowedLentRecords.length} borrow/lend records) is sealed into one AES-256 encrypted file. Only your 12 recovery words can open it — not even the app holds the key.`}
            </p>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {isGu
                  ? 'સિસ્ટમ તમારા માટે 12 રિકવરી શબ્દો બનાવશે. તેમને સુરક્ષિત સ્થળે લખી લો — શબ્દો ગુમાવો એટલે બેકઅપ કાયમ માટે ગુમાવ્યો.'
                  : 'The system will generate 12 recovery words. Write them down somewhere safe — losing the words means losing the backup forever.'}
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              {isGu ? '12 રિકવરી શબ્દો બનાવો' : 'Generate 12 Recovery Words'}
            </button>
          </div>
        )}

        {step === 'words' && (
          <div className="space-y-4">
            <p className="text-xs font-bold text-stone-800">
              {isGu ? 'આ 12 શબ્દો લખી લો (ફક્ત એક જ વાર દેખાશે):' : 'Write down these 12 words (shown only once):'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {words.map((w, i) => (
                <div key={i} className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-center">
                  <div className="text-[9px] font-bold text-stone-400">{i + 1}</div>
                  <div className="text-xs font-bold text-stone-900 truncate">{w}</div>
                </div>
              ))}
            </div>
            <button
              onClick={handleCopy}
              className="w-full py-2 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-stone-50 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? (isGu ? 'કોપી થયું!' : 'Copied!') : isGu ? 'બધા શબ્દો કોપી કરો' : 'Copy all words'}
            </button>
            <label className="flex items-start gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="mt-0.5 accent-emerald-600"
              />
              <span className="text-[11px] text-stone-700 leading-relaxed">
                {isGu
                  ? 'મેં આ 12 શબ્દો સુરક્ષિત સ્થળે લખી લીધા છે. શબ્દો ગુમાવવાથી બેકઅપ કદી ખૂલશે નહીં.'
                  : 'I have saved these 12 words somewhere safe. The backup cannot be opened without them.'}
              </span>
            </label>
            {error && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            <button
              onClick={handleCreate}
              disabled={!confirmedSaved}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isGu ? 'એન્ક્રિપ્ટેડ બેકઅપ બનાવો' : 'Create Encrypted Backup'}
            </button>
          </div>
        )}

        {step === 'creating' && (
          <div className="py-10 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-bold text-stone-800">
              {isGu ? 'AES-256 થી સીલ કરાય છે…' : 'Sealing with AES-256…'}
            </p>
            <p className="text-[10px] text-stone-500">
              {isGu ? 'PBKDF2-SHA256 · 600,000 રાઉન્ડ' : 'PBKDF2-SHA256 · 600,000 rounds'}
            </p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
              <Check className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-extrabold text-emerald-900">
                {isGu ? 'બેકઅપ તૈયાર છે!' : 'Backup created!'}
              </p>
              <p className="text-xs font-bold text-emerald-800 break-all">{result.filename}</p>
              <p className="text-[10px] text-emerald-700">{methodLabel(result.method)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-sm font-extrabold text-stone-900">{payload.transactions.length}</div>
                <div className="text-[10px] text-stone-500">{isGu ? 'વ્યવહારો' : 'Transactions'}</div>
              </div>
              <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-sm font-extrabold text-stone-900">{payload.diaryEntries.length}</div>
                <div className="text-[10px] text-stone-500">{isGu ? 'ડાયરી નોંધ' : 'Diary entries'}</div>
              </div>
              <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-sm font-extrabold text-stone-900">{payload.borrowedLentRecords.length}</div>
                <div className="text-[10px] text-stone-500">{isGu ? 'ઉધાર / જમા' : 'Borrow / Lend'}</div>
              </div>
              <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-sm font-extrabold text-stone-900">{payload.categories.length}</div>
                <div className="text-[10px] text-stone-500">{isGu ? 'કેટેગરી' : 'Categories'}</div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {isGu
                  ? 'ફાઇલ અને 12 શબ્દો — બંને જરૂરી છે. આ ફાઇલ SHA-256 ઇન્ટેગ્રિટી મેનીફેસ્ટ સાથે સીલ છે, તેથી રિસ્ટોર સમયે ચકાસણી થશે.'
                  : 'Keep BOTH the file and the 12 words. This file is sealed with a SHA-256 integrity manifest that is re-verified at restore time.'}
              </p>
            </div>
            <p className="text-[10px] text-stone-400 text-center truncate">
              {SAFE_VAULT_ITERATIONS.toLocaleString()} PBKDF2 rounds · manifest {(envelope?.manifest.sha256 || '').slice(0, 16)}…
            </p>
            <button
              onClick={handleClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              {isGu ? 'પૂર્ણ થયું' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


