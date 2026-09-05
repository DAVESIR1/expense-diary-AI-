import React, { useState } from 'react';
import { Mail, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Upload, FileText, ArrowRight, X } from 'lucide-react';
import { EmailSyncService, EmailSyncResult } from '../services/emailSync';
import { Transaction } from '../types';

interface FinancialEmailSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions: Transaction[];
  onImportTransactions: (transactions: Transaction[]) => void;
  currency: string;
  isGu: boolean;
}

export const FinancialEmailSyncModal: React.FC<FinancialEmailSyncModalProps> = ({
  isOpen,
  onClose,
  existingTransactions,
  onImportTransactions,
  currency,
  isGu,
}) => {
  const [activeTab, setActiveTab] = useState<'gmail' | 'eml'>('gmail');
  const [clientId, setClientId] = useState(EmailSyncService.getGoogleClientId());
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<EmailSyncResult | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleConnectAndScan = async () => {
    setIsScanning(true);
    setStatusMessage(isGu ? 'Google સાથે પ્રમાણીકરણ થઈ રહ્યું છે...' : 'Connecting to Google...');

    const authRes = await EmailSyncService.requestGmailAccessToken(clientId);
    if (!authRes.success || !authRes.token) {
      setIsScanning(false);
      setStatusMessage(authRes.error || (isGu ? 'પ્રમાણીકરણ નિષ્ફળ થયું.' : 'Authentication failed.'));
      return;
    }

    setStatusMessage(isGu ? 'નાણાકીય ઈમેલ (NPS, પગાર, રોકાણ) સ્કેન થઈ રહ્યા છે...' : 'Scanning financial emails...');
    const result = await EmailSyncService.syncFinancialEmailsFromGmail(existingTransactions, 30);
    setIsScanning(false);
    setSyncResult(result);

    if (result.success && result.newTransactions.length > 0) {
      setSelectedTxIds(new Set(result.newTransactions.map((t) => t.id)));
      setStatusMessage(null);
    } else if (result.success && result.newTransactions.length === 0) {
      setStatusMessage(
        isGu
          ? 'કોઈ નવા નાણાકીય ઈમેલ મળ્યા નથી (અથવા અગાઉ ઉમેરાઈ ચૂક્યા છે).'
          : 'No new financial emails found (or already imported).'
      );
    } else {
      setStatusMessage(result.error || (isGu ? 'સ્કેન કરવામાં ક્ષતિ આવી.' : 'Scan error.'));
    }
  };

  const handleEmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setStatusMessage(isGu ? 'ઈમેલ ફાઈલ વંચાઈ રહી છે...' : 'Reading email file...');

    try {
      const text = await file.text();
      const result = await EmailSyncService.parseEmlFile(text, file.name, existingTransactions);
      setIsScanning(false);
      setSyncResult(result);

      if (result.success && result.newTransactions.length > 0) {
        setSelectedTxIds(new Set(result.newTransactions.map((t) => t.id)));
        setStatusMessage(null);
      } else {
        setStatusMessage(result.error || (isGu ? 'આ ફાઈલમાંથી કોઈ નાણાકીય વિગત મળી નથી.' : 'No financial transaction found.'));
      }
    } catch {
      setIsScanning(false);
      setStatusMessage(isGu ? 'ફાઈલ વાંચવામાં ભૂલ થઈ.' : 'Failed to read file.');
    }
  };

  const handleConfirmImport = () => {
    if (!syncResult) return;
    const toImport = syncResult.newTransactions.filter((t) => selectedTxIds.has(t.id));
    if (toImport.length > 0) {
      onImportTransactions(toImport);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-indigo-200">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">
                {isGu ? 'નાણાકીય ઈમેલ સિંક સિસ્ટમ' : 'Financial Email Sync'}
              </h2>
              <p className="text-xs text-indigo-200">
                {isGu
                  ? 'CRA-NSDL NPS કોન્ટ્રીબ્યુશન, પગાર અને મ્યુચ્યુઅલ ફંડ સ્ટેટમેન્ટ'
                  : 'CRA-NSDL NPS, Salary slips & Mutual Fund confirmations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('gmail')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'gmail'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isGu ? 'Gmail લાઈવ સિંક (Google)' : 'Gmail Live Sync'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('eml')}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'eml'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{isGu ? 'ઓફલાઇન .EML ફાઈલ ઇમ્પોર્ટ' : 'Offline .EML File'}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'gmail' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 space-y-1">
                  <p className="font-bold">
                    {isGu ? '૧૦૦% પ્રાઇવેટ અને સલામત સિંક' : '100% Private Client-Side Sync'}
                  </p>
                  <p className="text-indigo-800 leading-relaxed">
                    {isGu
                      ? 'તમારો ઈમેલ ડેટા કોઈ પણ સર્વર પર મોકલવામાં આવતો નથી. બધી વિગતો સીધી તમારા ફોનમાં જ પ્રોસેસ થાય છે.'
                      : 'Zero data leaves your phone. Everything is processed purely on-device via official Google read-only API.'}
                  </p>
                </div>
              </div>

              {/* Client ID input for production Google OAuth */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {isGu ? 'Google OAuth Client ID (વૈકલ્પિક)' : 'Google OAuth Client ID (Optional)'}
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    EmailSyncService.setGoogleClientId(e.target.value);
                  }}
                  placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  {isGu
                    ? 'જો Client ID ન હોય, તો તમે બાજુના ટેબમાંથી સીધી .eml ફાઈલ પણ ઇમ્પોર્ટ કરી શકો છો.'
                    : 'If no Client ID, you can directly import your .eml statement file from the other tab.'}
                </p>
              </div>

              <button
                type="button"
                disabled={isScanning}
                onClick={handleConnectAndScan}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                <span>
                  {isScanning
                    ? isGu
                      ? 'સ્કેન ચાલુ છે...'
                      : 'Scanning...'
                    : isGu
                    ? 'Gmail સાથે કનેક્ટ કરી સ્કેન કરો'
                    : 'Connect Gmail & Scan'}
                </span>
              </button>
            </div>
          )}

          {activeTab === 'eml' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-stone-300 rounded-3xl p-8 text-center bg-stone-50 hover:bg-stone-100/80 transition flex flex-col items-center justify-center">
                <FileText className="w-10 h-10 text-stone-400 mb-3" />
                <p className="text-sm font-bold text-stone-800">
                  {isGu ? 'CRA-NSDL અથવા બેંક ઈમેલ ફાઈલ (.eml) પસંદ કરો' : 'Select .eml or email statement file'}
                </p>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  {isGu ? 'ઓફલાઇન ઇમ્પોર્ટ માટે કોઈ લોગિનની જરૂર નથી' : 'No sign-in required for offline statement imports'}
                </p>

                <label className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer">
                  <span>{isGu ? 'ફાઈલ પસંદ કરો' : 'Browse File'}</span>
                  <input
                    type="file"
                    accept=".eml,.txt,.json,.msg"
                    onChange={handleEmlFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Scan Result Preview */}
          {syncResult && syncResult.newTransactions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isGu
                      ? `મળેલા વ્યવહારો (${syncResult.newTransactions.length})`
                      : `Extracted Transactions (${syncResult.newTransactions.length})`}
                  </span>
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {currency}{syncResult.totalAmountExtracted.toLocaleString()}
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {syncResult.newTransactions.map((tx) => {
                  const isChecked = selectedTxIds.has(tx.id);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        const next = new Set(selectedTxIds);
                        if (next.has(tx.id)) next.delete(tx.id);
                        else next.add(tx.id);
                        setSelectedTxIds(next);
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? 'bg-indigo-50/60 border-indigo-300'
                          : 'bg-white border-stone-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-1 rounded text-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-stone-900 truncate">{tx.title}</p>
                          <span className="text-xs font-mono font-bold text-stone-900">
                            {currency}{tx.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {tx.date} • {tx.notes || tx.category}
                        </p>
                        {tx.evidence && (
                          <p className="text-[10px] text-stone-600 font-mono bg-white p-1.5 rounded-lg border border-stone-200 mt-1.5 line-clamp-2">
                            {tx.evidence}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition cursor-pointer"
          >
            {isGu ? 'રદ કરો' : 'Cancel'}
          </button>

          {syncResult && syncResult.newTransactions.length > 0 ? (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isGu ? `ડાયરીમાં ઉમેરો (${selectedTxIds.size})` : `Import Selected (${selectedTxIds.size})`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-300 transition cursor-pointer"
            >
              {isGu ? 'બંધ કરો' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
