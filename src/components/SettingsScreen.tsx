import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Palette, 
  Type, 
  FolderPlus, 
  DownloadCloud, 
  Upload, 
  Trash2, 
  Plus, 
  Coins, 
  Database, 
  ShieldCheck, 
  Check, 
  Lock, 
  Key, 
  Cloud, 
  Info, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  RefreshCw,
  Layers 
} from 'lucide-react';
import { LANGUAGES, TranslationStrings } from '../data/languages';
import { Category, Transaction, UserProfile, SecurityConfig, DiaryEntry, BorrowedLentRecord } from '../types';
import { SAMPLE_TRANSACTIONS } from '../data/initialData';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  encryptPayload, 
  decryptPayload, 
  downloadEncryptedBackup, 
  EncryptedBackupEnvelope 
} from '../services/encryption';
import { 
  defaultCloudProvider, 
  CloudBackupMetadata 
} from '../services/cloudBackup';
import { verifyPBKDF2, normalizeWords } from '../services/security';
import { SecuritySetupModal } from './SecuritySetupModal';
import { MultiRestoreModal } from './MultiRestoreModal';
import { NativeBridgeService, NativePermissionsStatus } from '../services/nativeBridge';

interface SettingsScreenProps {
  currentLang: string;
  onSelectLanguage: (code: string) => void;
  categories: Category[];
  onAddCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  activeTheme: string;
  onSelectTheme: (theme: string) => void;
  activeFont: string;
  onSelectFont: (font: string) => void;
  t: TranslationStrings;
  currency: string;
  onSelectCurrency: (curr: string) => void;
  transactions: Transaction[];
  onRestoreTransactions: (txs: Transaction[]) => void;
  diaryEntries: DiaryEntry[];
  onRestoreDiaryEntries: (entries: DiaryEntry[]) => void;
  borrowedLentRecords?: BorrowedLentRecord[];
  onRestoreBorrowedLentRecords?: (records: BorrowedLentRecord[]) => void;
  securityConfig: SecurityConfig;
  onUpdateSecurityConfig: (cfg: Partial<SecurityConfig>) => void;
  savedPassphraseWords: string[];
  onOpenSMSModal: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentLang,
  onSelectLanguage,
  categories,
  onAddCategory,
  onDeleteCategory,
  profile,
  onUpdateProfile,
  activeTheme,
  onSelectTheme,
  activeFont,
  onSelectFont,
  t,
  currency,
  onSelectCurrency,
  transactions,
  onRestoreTransactions,
  diaryEntries,
  onRestoreDiaryEntries,
  borrowedLentRecords = [],
  onRestoreBorrowedLentRecords,
  securityConfig,
  onUpdateSecurityConfig,
  savedPassphraseWords,
  onOpenSMSModal,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const [langSearch, setLangSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Native Permissions State
  const [permStatus, setPermStatus] = useState<NativePermissionsStatus>({ sms: false, notifications: false, usage: false });
  const [permLoading, setPermLoading] = useState(false);

  // Check permissions on mount
  useEffect(() => {
    NativeBridgeService.checkPermissions().then(setPermStatus).catch(() => {});
  }, []);

  const handleRequestSMS = async () => {
    setPermLoading(true);
    const granted = await NativeBridgeService.requestSMSPermissions();
    if (granted) setPermStatus(prev => ({ ...prev, sms: true }));
    setPermLoading(false);
  };

  const handleRequestNotifications = async () => {
    setPermLoading(true);
    const granted = await NativeBridgeService.requestNotificationPermissions();
    if (granted) setPermStatus(prev => ({ ...prev, notifications: true }));
    setPermLoading(false);
  };

  const handleOpenUsageSettings = async () => {
    await NativeBridgeService.openUsageSettings();
  };

  // Security Setup Modal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // View Passphrase Modal
  const [isViewPassphraseOpen, setIsViewPassphraseOpen] = useState(false);
  const [passphrasePinInput, setPassphrasePinInput] = useState('');
  const [passphraseVerified, setPassphraseVerified] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  // Restore Modal State (File or Cloud)
  const [pendingRestoreEnvelope, setPendingRestoreEnvelope] = useState<EncryptedBackupEnvelope | null>(null);
  const [restorePassphraseInput, setRestorePassphraseInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isMultiRestoreOpen, setIsMultiRestoreOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Cloud snapshots
  const [cloudBackups, setCloudBackups] = useState<CloudBackupMetadata[]>([]);
  const [isCloudUploading, setIsCloudUploading] = useState(false);

  const isGu = currentLang === 'gu';

  useEffect(() => {
    loadCloudBackups();
  }, []);

  const loadCloudBackups = async () => {
    try {
      const list = await defaultCloudProvider.listBackups();
      setCloudBackups(list);
    } catch {
      // ignore
    }
  };

  const showNotice = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const filteredLanguages = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  );

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: Category = {
      id: `custom-cat-${Date.now()}`,
      name: newCatName.trim(),
      nameGu: newCatName.trim(),
      icon: 'Tag',
      type: newCatType,
      color: newCatType === 'income' ? '#059669' : '#DC2626',
    };

    onAddCategory(newCat);
    setNewCatName('');
    showNotice(isGu ? 'કેટેગરી સફળતાપૂર્વક ઉમેરાઈ!' : 'Category added successfully!');
  };

  // 1. Export Encrypted Local Backup (.edb) using AES-GCM 256-bit
  const handleExportEncryptedBackup = async () => {
    try {
      const passphrase =
        savedPassphraseWords.length > 0
          ? savedPassphraseWords.join(' ')
          : prompt(
              isGu
                ? 'બેકઅપને એન્ક્રિપ્ટ કરવા માટે તમારો ગુપ્ત પાસવર્ડ દાખલ કરો:'
                : 'Enter a passphrase to encrypt your backup:'
            );

      if (!passphrase) return;

      const fullBackupData = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        profile,
        categories,
        transactions,
        diaryEntries,
        securityConfig: {
          ...securityConfig,
          isLocked: false,
        },
      };

      const envelope = await encryptPayload(fullBackupData, passphrase);
      downloadEncryptedBackup(envelope, 'expense-diary-encrypted');
      showNotice(
        isGu
          ? 'સુરક્ષિત એન્ક્રિપ્ટેડ બેકઅપ (.edb) સફળતાપૂર્વક ડાઉનલોડ થયો!'
          : 'Encrypted backup (.edb) downloaded successfully!'
      );
    } catch (err: any) {
      alert(err.message || 'Error generating encrypted backup.');
    }
  };

  // 2. Select file to restore
  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed.magic === 'EDBAES256') {
          setPendingRestoreEnvelope(parsed as EncryptedBackupEnvelope);
          setRestorePassphraseInput(savedPassphraseWords.join(' '));
          setRestoreError(null);
        } else if (Array.isArray(parsed.transactions)) {
          // Backward compatibility with legacy plain JSON backup
          onRestoreTransactions(parsed.transactions);
          if (parsed.profile) onUpdateProfile(parsed.profile);
          showNotice(isGu ? 'ડેટા સફળતાપૂર્વક રીસ્ટોર થયો!' : 'Data restored successfully!');
        } else {
          alert(isGu ? 'અમાન્ય બેકઅપ ફાઈલ.' : 'Invalid backup file format.');
        }
      } catch {
        alert(isGu ? 'બેકઅપ ફાઈલ વાંચવામાં ક્ષતિ.' : 'Failed to parse backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3. Decrypt and execute restore
  const handleExecuteRestore = async () => {
    if (!pendingRestoreEnvelope) return;
    setIsRestoring(true);
    setRestoreError(null);

    try {
      const normalized = normalizeWords(restorePassphraseInput);
      const decrypted = await decryptPayload<{
        transactions: Transaction[];
        categories?: Category[];
        profile?: UserProfile;
        diaryEntries?: DiaryEntry[];
      }>(pendingRestoreEnvelope, normalized);

      if (Array.isArray(decrypted.transactions)) {
        onRestoreTransactions(decrypted.transactions);
      }
      if (Array.isArray(decrypted.diaryEntries)) {
        onRestoreDiaryEntries(decrypted.diaryEntries);
      }
      if (decrypted.profile) {
        onUpdateProfile(decrypted.profile);
      }

      setPendingRestoreEnvelope(null);
      setRestorePassphraseInput('');
      showNotice(
        isGu
          ? 'એન્ક્રિપ્ટેડ બેકઅપ સફળતાપૂર્વક ચકાસાઈને રીસ્ટોર થયો!'
          : 'Encrypted backup successfully verified and restored!'
      );
    } catch (err: any) {
      setRestoreError(
        isGu
          ? 'રિકવરી કી ખોટી છે અથવા ફાઈલ બગડી ગયેલ છે.'
          : err.message || 'Decryption failed. Invalid passphrase.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  // 4. Cloud Backup (Zero-Knowledge Upload)
  const handleUploadToCloudVault = async () => {
    if (savedPassphraseWords.length === 0 && !securityConfig.recoveryWordsHash) {
      alert(
        isGu
          ? 'ક્લાઉડ બેકઅપ પહેલાં સુરક્ષા સેટઅપ પૂર્ણ કરો.'
          : 'Please complete security setup before cloud backup.'
      );
      return;
    }

    setIsCloudUploading(true);
    try {
      const passphrase = savedPassphraseWords.join(' ');
      const payload = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        profile,
        categories,
        transactions,
        diaryEntries,
        borrowedLentRecords,
      };

      const envelope = await encryptPayload(payload, passphrase);
      await defaultCloudProvider.uploadEncryptedBackup(envelope);
      await loadCloudBackups();
      showNotice(
        isGu
          ? 'ઝીરો-નોલેજ ક્લાઉડ વોલ્ટમાં એન્ક્રિપ્ટેડ સ્નેપશોટ અપલોડ થઈ ગયો!'
          : 'Encrypted snapshot uploaded to Zero-Knowledge Cloud Vault!'
      );
    } catch (err: any) {
      alert(err.message || 'Cloud backup failed.');
    } finally {
      setIsCloudUploading(false);
    }
  };

  // 5. Restore from Cloud Vault
  const handleRestoreFromCloud = async (backupId: string) => {
    try {
      const envelope = await defaultCloudProvider.downloadEncryptedBackup(backupId);
      setPendingRestoreEnvelope(envelope);
      setRestorePassphraseInput(savedPassphraseWords.join(' '));
      setRestoreError(null);
    } catch (err: any) {
      alert(err.message || 'Failed to download cloud snapshot.');
    }
  };

  // View Passphrase Verification
  const handleVerifyPinForPassphrase = async () => {
    setPassphraseError(null);
    if (!securityConfig.pinHash || !securityConfig.pinSalt) {
      setPassphraseVerified(true);
      return;
    }
    const match = await verifyPBKDF2(passphrasePinInput, securityConfig.pinHash, securityConfig.pinSalt);
    if (match) {
      setPassphraseVerified(true);
    } else {
      setPassphraseError(isGu ? 'ખોટો પિન. ફરી પ્રયાસ કરો.' : 'Incorrect PIN.');
    }
  };

  // Load sample data
  const handleLoadSampleData = () => {
    if (confirm(isGu ? 'સેમ્પલ ડેટા લોડ કરવો છે?' : 'Load sample data?')) {
      onRestoreTransactions(SAMPLE_TRANSACTIONS);
      showNotice(isGu ? 'સેમ્પલ ડેટા લોડ થયો.' : 'Sample data loaded.');
    }
  };

  // Clear all data
  const handleClearAllData = () => {
    if (confirm(isGu ? 'તમામ વ્યવહારો કાઢી નાખવા છે?' : 'Clear all recorded transactions?')) {
      onRestoreTransactions([]);
      showNotice(isGu ? 'બધા વ્યવહારો સાફ થઈ ગયા છે.' : 'All transactions cleared.');
    }
  };

  return (
    <div id="settings-screen-container" className="space-y-6 pb-28">
      {/* Flash notification */}
      {notificationMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs">
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">
          {t.settings}
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          {isGu
            ? 'સુરક્ષા, એન્ક્રિપ્ટેડ બેકઅપ, ભાષા, થીમ અને એપ્લિકેશન માહિતી'
            : 'Security, encrypted backups, language, appearance, and app info'}
        </p>
      </div>

      {/* 1. Security & Authentication Section */}
      <div
        id="security-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600 stroke-[2]" />
            <h3 className="text-sm font-bold text-stone-800 tracking-tight">
              {t.security}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            {securityConfig.hasCompletedSetup
              ? (isGu ? 'સુરક્ષિત (PIN Enabled)' : 'Protected')
              : (isGu ? 'સેટઅપ બાકી' : 'Setup Required')}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed">
          {isGu
            ? 'તમારી એપ્લિકેશન ૪-૬ અંકના પિન, બાયોમેટ્રિક્સ અને ૧૨-શબ્દોની રિકવરી કી દ્વારા સંપૂર્ણ સુરક્ષિત છે.'
            : 'Your data is secured with PIN, Biometrics, and a 12-word cryptographic recovery passphrase.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={() => setIsSecurityModalOpen(true)}
            className="p-3 rounded-2xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <Key className="w-4 h-4 text-emerald-600" />
            <span>{isGu ? 'પિન / સુરક્ષા બદલો' : 'Reconfigure Security / PIN'}</span>
          </button>

          <button
            onClick={() => {
              setIsViewPassphraseOpen(true);
              setPassphraseVerified(false);
              setPassphrasePinInput('');
              setPassphraseError(null);
            }}
            className="p-3 rounded-2xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <Eye className="w-4 h-4 text-stone-500" />
            <span>{isGu ? '૧૨ શબ્દોની રિકવરી કી જુઓ' : 'View 12-Word Passphrase'}</span>
          </button>
        </div>

        {/* Diary Lock Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
          <div>
            <div className="text-xs font-bold text-stone-800">
              {isGu ? 'વ્યક્તિગત ડાયરી માટે અલગ લૉક' : 'Personal Diary Lock'}
            </div>
            <div className="text-[11px] text-stone-500">
              {isGu
                ? 'ડાયરી ટેબ ખોલવા માટે પણ પિન પૂછો'
                : 'Require PIN verification to open Personal Diary'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={securityConfig.diaryLockEnabled}
            onChange={(e) =>
              onUpdateSecurityConfig({ diaryLockEnabled: e.target.checked })
            }
            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Encrypted Local & Cloud Backup Section */}
      <div
        id="encrypted-backup-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600 stroke-[2]" />
          <h3 className="text-sm font-bold text-stone-800 tracking-tight">
            {t.encryptedBackup} & {t.cloudVault}
          </h3>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed">
          {isGu
            ? 'AES-GCM ૨૫૬-બીટ પ્રમાણિત એન્ક્રિપ્શન. તમારો પિન કે ડેટા ક્યારેય અનએન્ક્રિપ્ટેડ સ્વરૂપે સાચવવામાં કે મોકલવામાં આવતો નથી.'
            : 'AES-GCM 256-bit authenticated encryption. Your passphrase or PIN is never transmitted unencrypted.'}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={handleExportEncryptedBackup}
            className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold text-emerald-900 flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <DownloadCloud className="w-4 h-4 text-emerald-700" />
            <span>{isGu ? 'એન્ક્રિપ્ટેડ બેકઅપ ડાઉનલોડ (.edb)' : 'Export Encrypted Backup (.edb)'}</span>
          </button>

          <label className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:bg-stone-100 text-xs font-bold text-stone-800 flex items-center justify-center gap-2 cursor-pointer transition">
            <Upload className="w-4 h-4 text-stone-600" />
            <span>{isGu ? 'બેકઅપ ફાઈલ પસંદ કરી રીસ્ટોર કરો' : 'Restore Single File'}</span>
            <input
              type="file"
              accept=".edb,.json"
              onChange={handleFileSelectForRestore}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsMultiRestoreOpen(true)}
            className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold text-indigo-950 flex items-center justify-center gap-2 cursor-pointer transition col-span-1 sm:col-span-2"
          >
            <Layers className="w-4 h-4 text-indigo-700" />
            <span>{isGu ? 'મલ્ટી-ફાઈલ / ફોલ્ડર બેકઅપ તપાસો અને મર્જ કરો (Smart Merge)' : 'Multi-File / Folder Restore & Deduplicated Merge'}</span>
          </button>
        </div>

        {/* Cloud Vault Card */}
        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-950">
                {isGu ? 'ઝીરો-નોલેજ ક્લાઉડ વોલ્ટ' : 'Zero-Knowledge Cloud Vault'}
              </span>
            </div>
            <button
              onClick={handleUploadToCloudVault}
              disabled={isCloudUploading}
              className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCloudUploading ? 'animate-spin' : ''}`} />
              <span>{isGu ? 'નવો સ્નેપશોટ અપલોડ' : 'Upload Snapshot'}</span>
            </button>
          </div>

          {cloudBackups.length === 0 ? (
            <div className="text-[11px] text-stone-500 py-1">
              {isGu ? 'ક્લાઉડમાં કોઈ સ્નેપશોટ નથી.' : 'No cloud snapshots recorded yet.'}
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              {cloudBackups.map((bk) => (
                <div
                  key={bk.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-indigo-100 text-xs text-stone-700"
                >
                  <div>
                    <div className="font-semibold text-stone-800">
                      {new Date(bk.timestamp).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      {(bk.sizeBytes / 1024).toFixed(1)} KB • {bk.deviceName}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestoreFromCloud(bk.id)}
                    className="py-1 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer"
                  >
                    {isGu ? 'રીસ્ટોર' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Language Selection */}
      <div
        id="language-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-stone-500 stroke-[2]" />
            <h3 className="text-sm font-bold text-stone-800 tracking-tight">
              {t.languageSelect} (20 World Languages)
            </h3>
          </div>
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-semibold">
            {LANGUAGES.length}
          </span>
        </div>

        <input
          type="text"
          placeholder={isGu ? 'ભાષા શોધો...' : 'Search languages...'}
          value={langSearch}
          onChange={(e) => setLangSearch(e.target.value)}
          className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-emerald-500"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
          {filteredLanguages.map((l) => {
            const isSelected = currentLang === l.code;
            return (
              <button
                key={l.code}
                onClick={() => onSelectLanguage(l.code)}
                className={`p-2.5 rounded-xl text-left border text-xs transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div>
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-[10px] text-stone-400">{l.nativeName}</div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Currency Selector */}
      <div
        id="currency-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3"
      >
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-stone-500 stroke-[2]" />
          <h3 className="text-sm font-bold text-stone-800 tracking-tight">
            {isGu ? 'પ્રાથમિક કરન્સી (Currency)' : 'Primary Currency Symbol'}
          </h3>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { symbol: '₹', name: 'INR (₹)' },
            { symbol: '$', name: 'USD ($)' },
            { symbol: '€', name: 'EUR (€)' },
            { symbol: '£', name: 'GBP (£)' },
            { symbol: '¥', name: 'JPY/CNY (¥)' },
            { symbol: 'د.إ', name: 'AED (د.إ)' },
          ].map((c) => (
            <button
              key={c.symbol}
              onClick={() => onSelectCurrency(c.symbol)}
              className={`p-2.5 rounded-xl border text-xs text-center transition cursor-pointer ${
                currency === c.symbol
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <div className="text-base font-bold">{c.symbol}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">{c.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Appearance: Theme & Font */}
      <div
        id="appearance-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Palette className="w-4 h-4 text-stone-500 stroke-[2]" />
            <h3 className="text-sm font-bold text-stone-800 tracking-tight">{t.themeSelect}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'cream', name: 'Paper Cream', bg: '#F9FBFC' },
              { id: 'mint', name: 'Soft Mint', bg: '#EBFBEE' },
              { id: 'lavender', name: 'Lavender', bg: '#FAF7FD' },
              { id: 'light', name: 'Pure White', bg: '#FFFFFF' },
            ].map((th) => (
              <button
                key={th.id}
                onClick={() => onSelectTheme(th.id)}
                className={`p-3 rounded-xl border text-xs text-left transition cursor-pointer flex items-center justify-between ${
                  activeTheme === th.id
                    ? 'border-emerald-500 bg-emerald-50/40 font-bold shadow-xs'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span className="text-stone-800">{th.name}</span>
                <span
                  className="w-4 h-4 rounded-full border border-stone-300"
                  style={{ backgroundColor: th.bg }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-stone-100 pt-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Type className="w-4 h-4 text-stone-500 stroke-[2]" />
            <h3 className="text-sm font-bold text-stone-800 tracking-tight">{t.fontSelect}</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'sans', name: 'Sans (Modern)' },
              { id: 'serif', name: 'Serif (Classic)' },
              { id: 'mono', name: 'Mono (Ledger)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => onSelectFont(f.id)}
                className={`py-2 px-3 rounded-xl border text-xs text-center transition cursor-pointer font-medium ${
                  activeFont === f.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Custom Categories */}
      <div
        id="categories-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-stone-500 stroke-[2]" />
          <h3 className="text-sm font-bold text-stone-800 tracking-tight">
            {isGu ? 'કેટેગરી મેનેજમેન્ટ' : 'Category Management'}
          </h3>
        </div>

        <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={isGu ? 'નવી કેટેગરીનું નામ...' : 'New category name...'}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-200 outline-none focus:border-emerald-500"
          />
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as 'income' | 'expense')}
            className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none font-medium cursor-pointer"
          >
            <option value="expense">{t.expense}</option>
            <option value="income">{t.income}</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isGu ? 'ઉમેરો' : 'Add'}</span>
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50/80 text-xs text-stone-700"
            >
              <span>{isGu ? (c.nameGu || c.name) : c.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  c.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {c.type === 'income' ? t.income : t.expense}
              </span>
              {categories.length > 4 && (
                <button
                  onClick={() => onDeleteCategory(c.id)}
                  className="text-stone-400 hover:text-rose-600 transition ml-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 7. Data Testing & Reset */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
          {isGu ? 'ટેસ્ટિંગ અને ક્લિયર ડેટા' : 'Testing & Reset'}
        </h4>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleLoadSampleData}
            className="py-2.5 px-4 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            {isGu ? 'સેમ્પલ ડેટા લોડ કરો' : 'Load Sample Data'}
          </button>
          <button
            onClick={handleClearAllData}
            className="py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
          >
            {isGu ? 'તમામ વ્યવહારો સાફ કરો' : 'Clear All Transactions'}
          </button>
        </div>
      </div>

      {/* 8. Native Permissions Section (SMS + Notifications + App Usage) */}
      <div
        id="native-permissions-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 stroke-[2]" />
          <h3 className="text-sm font-bold text-stone-800 tracking-tight">
            {isGu ? 'એપ પરમિશન્સ' : 'App Permissions'}
          </h3>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">
          {isGu
            ? 'આ પરમિશન્સ એપની મુખ્ય સુવિધાઓ માટે જરૂરી છે. દરેક પરમિશન માટે નીચે ટેપ કરો.'
            : 'These permissions are required for core features. Tap each to grant access.'}
        </p>

        {/* SMS Permission */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-stone-800">
              {isGu ? 'SMS સ્માર્ટ ડિટેક્શન' : 'SMS Smart Detection'}
            </div>
            <div className="text-[11px] text-stone-500">
              {isGu ? 'બેંક SMS માંથી ઓટો ખર્ચ શોધણી' : 'Auto-detect expenses from bank SMS'}
            </div>
          </div>
          {permStatus.sms ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {isGu ? 'મંજૂર' : 'Granted'}
            </span>
          ) : (
            <button
              onClick={handleRequestSMS}
              disabled={permLoading}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isGu ? 'પરમિશન આપો' : 'Grant'}
            </button>
          )}
        </div>

        {/* Notification Permission */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-stone-800">
              {isGu ? 'નોટિફિકેશન' : 'Notifications'}
            </div>
            <div className="text-[11px] text-stone-500">
              {isGu ? 'દૈનિક રિમાઇન્ડર અને ખર્ચ એલર્ટ' : 'Daily reminders & expense alerts'}
            </div>
          </div>
          {permStatus.notifications ? (
            <span className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {isGu ? 'મંજૂર' : 'Granted'}
            </span>
          ) : (
            <button
              onClick={handleRequestNotifications}
              disabled={permLoading}
              className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isGu ? 'પરમિશન આપો' : 'Grant'}
            </button>
          )}
        </div>

        {/* App Usage Permission */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-stone-800">
              {isGu ? 'એપ વપરાશ ડેટા' : 'App Usage Data'}
            </div>
            <div className="text-[11px] text-stone-500">
              {isGu ? 'પેમેન્ટ એપ વાપર્યા પછી સ્માર્ટ રિમાઇન્ડર' : 'Smart reminders after using payment apps'}
            </div>
          </div>
          {permStatus.usage ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {isGu ? 'મંજૂર' : 'Granted'}
            </span>
          ) : (
            <button
              onClick={handleOpenUsageSettings}
              className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
            >
              {isGu ? 'સેટિંગ્સ ખોલો' : 'Open Settings'}
            </button>
          )}
        </div>
      </div>

      {/* 9. Integrated "About" Section */}
      <div
        id="about-app-card"
        className="p-5 sm:p-6 rounded-3xl bg-stone-900 text-white shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">{t.appName}</h3>
          </div>
          <span className="text-[10px] font-mono font-bold bg-stone-800 text-emerald-400 px-2 py-0.5 rounded-md border border-stone-700">
            v1.1.0 Stable
          </span>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          {isGu
            ? 'ખર્ચ ડાયરી એ ૧૦૦% પ્રાઇવેટ, ઑફલાઇન-પ્રથમ નાણાકીય અને વ્યક્તિગત ડાયરી એપ્લિકેશન છે. તમારો ડેટા ફક્ત તમારા ફોનમાં જ સુરક્ષિત રહે છે.'
            : 'Expense Diary is a 100% private, offline-first personal finance and diary application with AES-GCM 256-bit encryption and multi-language support.'}
        </p>

        <div className="text-[11px] text-stone-400 border-t border-stone-800 pt-3 flex flex-wrap justify-between gap-2">
          <span>{isGu ? 'એન્ક્રિપ્શન: AES-GCM ૨૫૬' : 'Encryption: AES-GCM-256'}</span>
          <span>{isGu ? 'લાઇસન્સ: MIT Open-Source' : 'License: MIT'}</span>
        </div>
      </div>

      {/* Security Setup Modal */}
      <SecuritySetupModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        onSaveSecurityConfig={(cfg) => {
          onUpdateSecurityConfig(cfg);
          showNotice(isGu ? 'સુરક્ષા સેટિંગ્સ સફળતાપૂર્વક સાચવાઈ!' : 'Security settings updated!');
        }}
        currentLang={currentLang}
        t={t}
      />

      {/* View Passphrase Modal */}
      {isViewPassphraseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  {t.recoveryPhrase}
                </h3>
              </div>
              <button
                onClick={() => setIsViewPassphraseOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full"
              >
                ✕
              </button>
            </div>

            {!passphraseVerified ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-500">
                  {isGu
                    ? '૧૨ શબ્દોની ગુપ્ત કી જોવા માટે તમારો સુરક્ષા પિન દાખલ કરો:'
                    : 'Enter your Security PIN to reveal your 12 recovery words:'}
                </p>

                {passphraseError && (
                  <div className="text-xs text-rose-600 font-medium">
                    {passphraseError}
                  </div>
                )}

                <input
                  type="password"
                  maxLength={6}
                  value={passphrasePinInput}
                  onChange={(e) => setPassphrasePinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-emerald-500"
                />

                <button
                  onClick={handleVerifyPinForPassphrase}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                >
                  {isGu ? 'ચકાસો અને જુઓ' : 'Verify & Reveal'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  {savedPassphraseWords.map((w, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-stone-800 truncate"
                    >
                      <span className="text-[10px] text-stone-400 mr-1">{idx + 1}.</span>
                      {w}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setIsViewPassphraseOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs cursor-pointer"
                >
                  {isGu ? 'બંધ કરો' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore Passphrase Prompt Modal */}
      {pendingRestoreEnvelope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-stone-900">
                {isGu ? 'એન્ક્રિપ્ટેડ બેકઅપ ડિક્રિપ્ટ કરો' : 'Decrypt & Restore Backup'}
              </h3>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              {isGu
                ? 'આ બેકઅપ AES-GCM ૨૫૬-બીટ દ્વારા સુરક્ષિત છે. ડેટા પુનઃપ્રાપ્ત કરવા માટે તમારી ૧૨ શબ્દોની રિકવરી કી દાખલ કરો:'
                : 'This file is encrypted with AES-GCM-256. Enter your 12 recovery words to restore:'}
            </p>

            {restoreError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            <textarea
              rows={3}
              value={restorePassphraseInput}
              onChange={(e) => setRestorePassphraseInput(e.target.value)}
              placeholder="word1 word2 word3 ... word12"
              className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-stone-50 font-mono outline-none focus:border-emerald-500"
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingRestoreEnvelope(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-700 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={isRestoring || !restorePassphraseInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? (isGu ? 'ચકાસણી...' : 'Restoring...') : (isGu ? 'રીસ્ટોર કરો' : 'Restore Data')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-File Restore & Smart Merge Modal (§6) */}
      <MultiRestoreModal
        isOpen={isMultiRestoreOpen}
        onClose={() => setIsMultiRestoreOpen(false)}
        currentTransactions={transactions}
        currentDiaryEntries={diaryEntries}
        currentBorrowLend={borrowedLentRecords}
        onCommitRestore={(mergedTxs, mergedDiary, mergedBL) => {
          onRestoreTransactions(mergedTxs);
          onRestoreDiaryEntries(mergedDiary);
          if (onRestoreBorrowedLentRecords) {
            onRestoreBorrowedLentRecords(mergedBL);
          }
        }}
        isGu={isGu}
      />
    </div>
  );
};
