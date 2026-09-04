import React, { useState } from 'react';
import { 
  UploadCloud, 
  Files, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { Transaction, DiaryEntry, BorrowedLentRecord } from '../types';
import { 
  BackupMergeService, 
  FileInspectionResult, 
  MergePreview, 
  ConflictStrategy 
} from '../services/backupMerge';
import { normalizeWords } from '../services/security';

interface MultiRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTransactions: Transaction[];
  currentDiaryEntries: DiaryEntry[];
  currentBorrowLend: BorrowedLentRecord[];
  onCommitRestore: (
    mergedTxs: Transaction[],
    mergedDiary: DiaryEntry[],
    mergedBL: BorrowedLentRecord[]
  ) => void;
  isGu: boolean;
}

export const MultiRestoreModal: React.FC<MultiRestoreModalProps> = ({
  isOpen,
  onClose,
  currentTransactions,
  currentDiaryEntries,
  currentBorrowLend,
  onCommitRestore,
  isGu,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResults, setInspectionResults] = useState<FileInspectionResult[] | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('newer');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [restoreReport, setRestoreReport] = useState<{
    txImported: number;
    txDuplicates: number;
    diaryImported: number;
    blImported: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
      setInspectionResults(null);
      setPreview(null);
      setRestoreReport(null);
    }
  };

  const handleInspectFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsInspecting(true);
    try {
      const normalizedPassphrase = normalizeWords(passphraseInput);
      const results = await BackupMergeService.inspectFiles(selectedFiles, normalizedPassphrase);
      setInspectionResults(results);

      const validFiles = results.filter((r) => r.status === 'valid');
      if (validFiles.length > 0) {
        const computedPreview = BackupMergeService.calculateMergePreview(
          validFiles,
          currentTransactions,
          currentDiaryEntries,
          currentBorrowLend,
          conflictStrategy
        );
        setPreview(computedPreview);
      }
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStrategyChange = (strategy: ConflictStrategy) => {
    setConflictStrategy(strategy);
    if (inspectionResults) {
      const validFiles = inspectionResults.filter((r) => r.status === 'valid');
      const updated = BackupMergeService.calculateMergePreview(
        validFiles,
        currentTransactions,
        currentDiaryEntries,
        currentBorrowLend,
        strategy
      );
      setPreview(updated);
    }
  };

  const handleExecuteRestore = async () => {
    if (!preview) return;
    setIsCommitting(true);
    try {
      // 1. Create pre-restore safety snapshot
      BackupMergeService.createSafetySnapshot();

      // 2. Commit merged records
      onCommitRestore(
        preview.mergedTransactions,
        preview.mergedDiaryEntries,
        preview.mergedBorrowLend
      );

      // 3. Set report
      setRestoreReport({
        txImported: preview.uniqueTransactionsToImport,
        txDuplicates: preview.duplicateTransactionsSkipped,
        diaryImported: preview.uniqueDiaryToImport,
        blImported: preview.uniqueBorrowLendToImport,
      });
    } catch (err) {
      BackupMergeService.rollbackSafetySnapshot();
      alert(isGu ? 'રીસ્ટોર નિષ્ફળ ગયું. જૂનો ડેટા પાછો લાવવામાં આવ્યો છે.' : 'Restore failed. Rolled back safely to previous state.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                {isGu ? 'મલ્ટી-ફાઈલ બેકઅપ રીસ્ટોર અને મર્જ' : 'Multi-File Restore & Smart Merge'}
              </h2>
              <p className="text-xs text-stone-500">
                {isGu ? 'બહુવિધ બેકઅપ ફાઈલો તપાસો, ડુપ્લિકેટ્સ દૂર કરો અને મર્જ કરો' : 'Inspect multiple backup files, dedup & merge safely'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Post-Restore Report View */}
          {restoreReport ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <FileCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-stone-900">
                {isGu ? 'રીસ્ટોર અને મર્જ સફળતાપૂર્વક પૂર્ણ!' : 'Restore & Merge Completed!'}
              </h3>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                {isGu ? 'તમારો ડેટા સુરક્ષિત રીતે મર્જ થઈ ગયો છે.' : 'Your data has been successfully consolidated and updated.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <div className="text-xl font-black text-emerald-700">+{restoreReport.txImported}</div>
                  <div className="text-[11px] text-emerald-900 font-semibold">{isGu ? 'નવા વ્યવહારો' : 'New Txns'}</div>
                </div>
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                  <div className="text-xl font-black text-stone-600">{restoreReport.txDuplicates}</div>
                  <div className="text-[11px] text-stone-500 font-semibold">{isGu ? 'ડુપ્લિકેટ્સ છોડ્યા' : 'Skipped Dupes'}</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="text-xl font-black text-amber-700">+{restoreReport.diaryImported}</div>
                  <div className="text-[11px] text-amber-900 font-semibold">{isGu ? 'ડાયરી એન્ટ્રીઝ' : 'Diary Entries'}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                  <div className="text-xl font-black text-blue-700">+{restoreReport.blImported}</div>
                  <div className="text-[11px] text-blue-900 font-semibold">{isGu ? 'ઉધાર/જમા' : 'Borrow/Lend'}</div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-stone-900 text-white font-semibold rounded-xl text-sm hover:bg-stone-800"
                >
                  {isGu ? 'બંધ કરો' : 'Done & Close'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: File Selection */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/50 hover:bg-stone-50 text-center transition-colors">
                <input
                  type="file"
                  id="multi-backup-file-input"
                  multiple
                  accept=".edb,.json"
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <label htmlFor="multi-backup-file-input" className="cursor-pointer block">
                  <Files className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <span className="text-sm font-bold text-stone-800 block">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} ${isGu ? 'ફાઈલો પસંદ થઈ' : 'files selected'}`
                      : isGu
                      ? 'એક અથવા વધુ બેકઅપ ફાઈલો પસંદ કરો (.edb / .json)'
                      : 'Select one or more backup files (.edb / .json)'}
                  </span>
                  <span className="text-xs text-stone-500 mt-1 block">
                    {isGu ? 'ફોલ્ડરમાંથી તમામ ફાઈલો એકસાથે સિલેક્ટ કરી શકો છો' : 'Hold Shift or Ctrl/Cmd to select multiple files'}
                  </span>
                </label>
              </div>

              {/* Step 2: Passphrase */}
              {selectedFiles.length > 0 && (
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                  <label className="block text-xs font-bold uppercase text-stone-500 tracking-wider">
                    {isGu ? '12-શબ્દની રિકવરી કી (જો ફાઈલો એન્ક્રિપ્ટેડ હોય)' : '12-Word Recovery Passphrase (if files are encrypted)'}
                  </label>
                  <input
                    type="password"
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    placeholder="word1 word2 word3 ... word12"
                    className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 font-mono"
                  />
                  <button
                    onClick={handleInspectFiles}
                    disabled={isInspecting}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isInspecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    {isGu ? 'ફાઈલો ચકાસો અને પ્રિવ્યૂ જુઓ' : 'Inspect & Validate Files'}
                  </button>
                </div>
              )}

              {/* Step 3: Inspection Results Table */}
              {inspectionResults && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-stone-500 tracking-wider">
                    {isGu ? 'ફાઈલ ચકાસણી પરિણામ' : 'File Inspection Summary'}
                  </h4>
                  <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white text-xs">
                    {inspectionResults.map((r, i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-stone-900 truncate">{r.fileName}</div>
                          <div className="text-[11px] text-stone-500">
                            {r.exportedAt ? new Date(r.exportedAt).toLocaleDateString() : 'Unknown date'} • {(r.fileSize / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {r.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {r.transactionCount} txns • {r.diaryCount} diary
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded-lg font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {r.error || r.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Merge Strategy & Preview */}
              {preview && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-emerald-900 tracking-wider mb-2">
                      {isGu ? 'વિરોધાભાસ નિવારણ વ્યૂહ (Conflict Strategy)' : 'Conflict Resolution Strategy'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {[
                        { id: 'newer' as ConflictStrategy, label: isGu ? 'નવીનતમ રાખો' : 'Keep Newer' },
                        { id: 'incoming' as ConflictStrategy, label: isGu ? 'બેકઅપનું રાખો' : 'Keep Incoming' },
                        { id: 'existing' as ConflictStrategy, label: isGu ? 'હાલનું રાખો' : 'Keep Existing' },
                        { id: 'both' as ConflictStrategy, label: isGu ? 'બંને સાચવો' : 'Keep Both' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleStrategyChange(s.id)}
                          className={`py-2 px-3 rounded-xl font-medium border text-center transition-colors ${
                            conflictStrategy === s.id
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dry-Run Metrics */}
                  <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-2 text-xs">
                    <div className="font-bold text-stone-800">
                      {isGu ? 'ડ્રાય-રન પ્રિવ્યૂ (મર્જ પહેલાં)' : 'Dry-Run Preview (Before Write)'}:
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>{isGu ? 'વ્યવહારો:' : 'Transactions:'}</span>
                      <span className="font-semibold text-stone-900">
                        {currentTransactions.length} → {preview.mergedTransactions.length} (+{preview.uniqueTransactionsToImport} new, {preview.duplicateTransactionsSkipped} skipped dupes)
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>{isGu ? 'ડાયરી એન્ટ્રીઝ:' : 'Diary Entries:'}</span>
                      <span className="font-semibold text-stone-900">
                        {currentDiaryEntries.length} → {preview.mergedDiaryEntries.length} (+{preview.uniqueDiaryToImport} new, {preview.duplicateDiarySkipped} skipped)
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>{isGu ? 'ઉધાર/જમા:' : 'Borrow/Lend:'}</span>
                      <span className="font-semibold text-stone-900">
                        {currentBorrowLend.length} → {preview.mergedBorrowLend.length} (+{preview.uniqueBorrowLendToImport} new)
                      </span>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isCommitting}
                    className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isCommitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    )}
                    {isGu ? 'ચકાસાયેલ ડેટા મર્જ કરો (સુરક્ષિત બેકઅપ સાથે)' : 'Confirm & Apply Merged Restore (Safe)'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
