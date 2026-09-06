import React, { useRef, useState } from 'react';
import { X, ShieldCheck, FileUp, RefreshCw, Check, AlertTriangle, Undo2, Lock } from 'lucide-react';
import {
  SafeVaultPayload,
  MergeStats,
  MergeStrategy,
  VaultEnvelopeKind,
  decryptSafeVault,
  decryptLegacyVault,
  decryptPlaintextVault,
  mergeVaultData,
  createSafetySnapshot,
  rollbackSafetySnapshot,
  parseVaultEnvelopeText,
} from '../services/safeVault';

interface SafeVaultRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Live vault snapshot at modal open — used for the dry-run and the undo path. */
  current: SafeVaultPayload;
  isGu: boolean;
  /** Commit a merged vault into the app state (parent wires all setters). */
  onApply: (stats: MergeStats) => void;
}

type RestoreStep = 'input' | 'preview' | 'applying' | 'report';

interface DecryptedFile {
  kind: VaultEnvelopeKind;
  payload: SafeVaultPayload;
  integrity: 'verified' | 'legacy' | 'plaintext';
  exportedAt?: string;
  appVersion?: string;
}

/**
 * SafeVault Restore wizard:
 *   1. Input — pick a `.edbvault` / legacy `.edb` file + type the recovery words.
 *   2. Preview — integrity badge, counts, dry-run merge stats per strategy.
 *   3. Apply — auto safety snapshot, then commit via onApply().
 *   4. Report — what changed + instant Undo (reverts to the pre-restore payload).
 */
export const SafeVaultRestoreModal: React.FC<SafeVaultRestoreModalProps> = ({
  isOpen,
  onClose,
  current,
  isGu,
  onApply,
}) => {
  const [step, setStep] = useState<RestoreStep>('input');
  const [wordsInput, setWordsInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedFile | null>(null);
  const [strategy, setStrategy] = useState<MergeStrategy>('newer');
  const [preview, setPreview] = useState<MergeStats | null>(null);
  const [report, setReport] = useState<MergeStats | null>(null);
  const [undone, setUndone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preRestoreRef = useRef<SafeVaultPayload | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep('input');
    setWordsInput('');
    setFileName('');
    setFileText('');
    setError(null);
    setDecrypted(null);
    setStrategy('newer');
    setPreview(null);
    setReport(null);
    setUndone(false);
    preRestoreRef.current = null;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDecrypted(null);
    setPreview(null);
    try {
      const text = await file.text();
      setFileName(file.name);
      setFileText(text);
    } catch {
      setError(isGu ? 'ફાઇલ વાંચી શકાઈ નથી.' : 'Could not read the file.');
    }
  };

  const handleDecrypt = async () => {
    setError(null);
    if (!fileText.trim()) {
      setError(isGu ? 'પહેલા બેકઅપ ફાઇલ પસંદ કરો.' : 'Select a backup file first.');
      return;
    }
    const parsed = parseVaultEnvelopeText(fileText);
    try {
      let result: DecryptedFile;
      if (parsed.kind === 'safevault') {
        const res = await decryptSafeVault(parsed.envelope, wordsInput);
        result = {
          kind: 'safevault',
          payload: res.payload,
          integrity: res.integrity,
          exportedAt: parsed.envelope.exportedAt,
          appVersion: parsed.envelope.manifest?.appVersion,
        };
      } else if (parsed.kind === 'legacy') {
        const res = await decryptLegacyVault(parsed.envelope, wordsInput);
        result = {
          kind: 'legacy',
          payload: res.payload,
          integrity: res.integrity,
          exportedAt: parsed.envelope.exportedAt,
          appVersion: parsed.envelope.appVersion,
        };
      } else {
        const res = decryptPlaintextVault(fileText);
        result = { kind: 'plaintext', payload: res.payload, integrity: res.integrity };
      }
      setDecrypted(result);
      setPreview(mergeVaultData(current, result.payload, strategy));
      setStep('preview');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('PASSPHRASE')) {
        setError(
          isGu
            ? 'ખોટા રિકવરી શબ્દો. ફરી પ્રયાસ કરો.'
            : 'Wrong recovery words. Please try again.'
        );
      } else if (msg.includes('INTEGRITY')) {
        setError(
          isGu
            ? 'ઇન્ટેગ્રિટી ચકાસણી નિષ્ફળ — ફાઇલ દુર્નિવેધિત છે.'
            : 'Integrity verification failed — the file is corrupted or tampered with.'
        );
      } else if (msg.includes('UNRECOGNIZED')) {
        setError(isGu ? 'આ માન્ય બેકઅપ ફાઇલ નથી.' : 'This is not a recognized backup file.');
      } else {
        setError(isGu ? 'ડિક્રિપ્શન નિષ્ફળ.' : 'Decryption failed.');
      }
    }
  };

  const handleStrategyChange = (s: MergeStrategy) => {
    setStrategy(s);
    if (decrypted) {
      setPreview(mergeVaultData(current, decrypted.payload, s));
    }
  };

  const handleApply = () => {
    if (!preview || !decrypted) return;
    setStep('applying');
    preRestoreRef.current = current;
    createSafetySnapshot();
    onApply(preview);
    setReport(preview);
    setTimeout(() => setStep('report'), 400);
  };

  const handleUndo = () => {
    const pre = preRestoreRef.current;
    if (!pre) return;
    rollbackSafetySnapshot();
    // Rebuild the exact pre-restore state — nothing imported, nothing changed.
    const reverted: MergeStats = {
      transactionsFound: 0,
      transactionsImported: 0,
      transactionsDuplicateSkipped: 0,
      transactionsConflictsResolved: 0,
      diaryEntriesFound: 0,
      diaryEntriesImported: 0,
      diaryEntriesDuplicateSkipped: 0,
      borrowLendFound: 0,
      borrowLendImported: 0,
      borrowLendDuplicateSkipped: 0,
      categoriesFound: 0,
      categoriesAdded: 0,
      profileApplied: false,
      prefsApplied: false,
      mergedTransactions: pre.transactions,
      mergedDiaryEntries: pre.diaryEntries,
      mergedBorrowLend: pre.borrowedLentRecords,
      mergedCategories: pre.categories,
      mergedProfile: null,
      mergedPrefs: {},
    };
    onApply(reverted);
    setUndone(true);
  };

  const kindLabel = (k: VaultEnvelopeKind): string => {
    if (k === 'safevault') return isGu ? 'સેફવોલ્ટ v3 (ચકાસાયેલ)' : 'SafeVault v3 (verified)';
    if (k === 'legacy') return isGu ? 'જૂનો EDB બેકઅપ v2' : 'Legacy EDB backup v2';
    return isGu ? 'જૂની અન-એન્ક્રિપ્ટેડ JSON' : 'Old unencrypted JSON';
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
              {isGu ? 'સેફવોલ્ટ રિસ્ટોર' : 'Restore SafeVault Backup'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-stone-800 mb-1.5">
                {isGu ? '1. બેકઅપ ફાઇલ પસંદ કરો' : '1. Select the backup file'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 text-stone-600 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <FileUp className="w-4 h-4" />
                {fileName ? fileName : isGu ? '.edbvault / .edb / .json ફાઇલ' : '.edbvault / .edb / .json file'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".edbvault,.edb,.json,application/json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800 mb-1.5">
                {isGu ? '2. 12 રિકવરી શબ્દો લખો' : '2. Enter the 12 recovery words'}
              </p>
              <textarea
                value={wordsInput}
                onChange={(e) => setWordsInput(e.target.value)}
                rows={3}
                placeholder="word1 word2 … word12"
                className="w-full p-3 text-xs rounded-xl border border-stone-200 outline-none focus:border-emerald-400 text-stone-800"
              />
              <p className="text-[10px] text-stone-400 flex items-center gap-1 mt-1">
                <Lock className="w-3 h-3" />
                {isGu ? 'શબ્દો કદીય ડિવાઇસથી બહાર નથી જતા.' : 'The words never leave your device.'}
              </p>
            </div>
            {error && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            <button
              onClick={handleDecrypt}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isGu ? 'ડિક્રિપ્ટ અને ચકાસો' : 'Decrypt & Verify'}
            </button>
          </div>
        )}

        {step === 'preview' && decrypted && preview && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-extrabold text-emerald-900">{kindLabel(decrypted.kind)}</span>
              </div>
              <p className="text-[10px] text-emerald-800">
                {decrypted.exportedAt ? `${decrypted.exportedAt.slice(0, 10)} · ` : ''}
                {decrypted.appVersion ? `v${decrypted.appVersion}` : ''}
                {decrypted.integrity === 'verified' ? ' · SHA-256 ✓' : ''}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                { n: decrypted.payload.transactions.length, l: isGu ? 'વ્યવ.' : 'Txns' },
                { n: decrypted.payload.diaryEntries.length, l: isGu ? 'ડાયરી' : 'Diary' },
                { n: decrypted.payload.borrowedLentRecords.length, l: isGu ? 'ઉધાર' : 'B/L' },
                { n: decrypted.payload.categories.length, l: isGu ? 'કેટ.' : 'Cats' },
              ].map((s, i) => (
                <div key={i} className="p-2 rounded-lg bg-stone-50 border border-stone-200">
                  <div className="text-xs font-extrabold text-stone-900">{s.n}</div>
                  <div className="text-[9px] text-stone-500">{s.l}</div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800 mb-1.5">
                {isGu ? 'વ્યવહારો માટે કોન્ફ્લિક્ટ નિયમ:' : 'Transaction conflict rule:'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'newer', label: isGu ? 'નવું જીતે' : 'Newer wins' },
                  { id: 'existing', label: isGu ? 'હાલનું રાખો' : 'Keep existing' },
                  { id: 'incoming', label: isGu ? 'બેકઅપ જીતે' : 'Keep backup' },
                  { id: 'both', label: isGu ? 'બંને રાખો' : 'Keep both' },
                ] as Array<{ id: MergeStrategy; label: string }>).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleStrategyChange(s.id)}
                    className={`py-2 px-2 rounded-xl font-bold text-[11px] border text-center transition-colors cursor-pointer ${
                      strategy === s.id
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-[11px]">
              <div className="font-bold text-stone-800">{isGu ? 'ડ્રાય-રન પ્રિવ્યૂ:' : 'Dry-run preview:'}</div>
              <div className="flex justify-between text-stone-600">
                <span>{isGu ? 'વ્યવહારો' : 'Transactions'}</span>
                <span className="font-bold text-stone-900">
                  {current.transactions.length} → {preview.mergedTransactions.length} (+{preview.transactionsImported}, −{preview.transactionsDuplicateSkipped} dup)
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>{isGu ? 'ડાયરી નોંધ' : 'Diary entries'}</span>
                <span className="font-bold text-stone-900">
                  {current.diaryEntries.length} → {preview.mergedDiaryEntries.length} (+{preview.diaryEntriesImported})
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>{isGu ? 'ઉધાર / જમા' : 'Borrow / Lend'}</span>
                <span className="font-bold text-stone-900">
                  {current.borrowedLentRecords.length} → {preview.mergedBorrowLend.length} (+{preview.borrowLendImported})
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>{isGu ? 'કેટેગરી / પ્રોફાઇલ' : 'Categories / profile'}</span>
                <span className="font-bold text-stone-900">
                  +{preview.categoriesAdded} {preview.profileApplied ? '· profile ✓' : ''}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-stone-500 flex items-center gap-1">
              <Undo2 className="w-3 h-3" />
              {isGu
                ? 'રિસ્ટોર પહેલાં સેફટી સ્નેપશોટ આપમેળે બનશે — એક ક્લિકે અન-ડુ શકાશે.'
                : 'A safety snapshot is created automatically — restorable with one click.'}
            </p>
            <button
              onClick={handleApply}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {isGu ? 'રિસ્ટોર કરો' : 'Apply Restore'}
            </button>
          </div>
        )}

        {step === 'applying' && (
          <div className="py-10 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-bold text-stone-800">
              {isGu ? 'સુરક્ષિત રીતે રિસ્ટોર થાય છે…' : 'Restoring safely…'}
            </p>
            <p className="text-[10px] text-stone-500">
              {isGu ? 'સેફટી સ્નેપશોટ લેવાયો છે' : 'Safety snapshot captured'}
            </p>
          </div>
        )}

        {step === 'report' && report && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <Check className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-extrabold text-emerald-900 mt-1">
                {undone ? (isGu ? 'રિસ્ટોર અન-ડુ થયું' : 'Restore undone') : isGu ? 'રિસ્ટોર પૂર્ણ!' : 'Restore complete!'}
              </p>
            </div>
            {!undone && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-stone-700">
                  <span>{isGu ? 'નવા વ્યવહારો' : 'New transactions'}</span>
                  <span className="font-bold text-stone-900">+{report.transactionsImported}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>{isGu ? 'ડુપ્લિકેટ સ્કિપ' : 'Duplicates skipped'}</span>
                  <span className="font-bold text-stone-900">
                    {report.transactionsDuplicateSkipped + report.diaryEntriesDuplicateSkipped + report.borrowLendDuplicateSkipped}
                  </span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>{isGu ? 'કોન્ફ્લિક્ટ સોલ્વ' : 'Conflicts resolved'}</span>
                  <span className="font-bold text-stone-900">{report.transactionsConflictsResolved}</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>{isGu ? 'નવી કેટેગરી' : 'New categories'}</span>
                  <span className="font-bold text-stone-900">+{report.categoriesAdded}</span>
                </div>
                {report.profileApplied && (
                  <div className="flex justify-between text-stone-700">
                    <span>{isGu ? 'પ્રોફાઇલ' : 'Profile'}</span>
                    <span className="font-bold text-emerald-700">✓</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              {!undone && (
                <button
                  onClick={handleUndo}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {isGu ? 'અન-ડુ રિસ્ટોર' : 'Undo restore'}
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg transition cursor-pointer"
              >
                {isGu ? 'પૂર્ણ થયું' : 'Done'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



