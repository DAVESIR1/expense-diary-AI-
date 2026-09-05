import React, { useState, useEffect, useRef } from 'react';
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
  Layers,
  Share2,
  Mail,
  Tag
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
import { CloudSyncService, CloudSyncConfig } from '../services/cloudSync';
import { AppVaultData, VaultStorage } from '../services/vaultStorage';
import { DeviceEncryption } from '../services/deviceCrypto';
import { parseClearSmsBackup } from '../services/clearSmsImporter';
import { CategoryRuleEngine, RuleDefinition, BUILTIN_CATEGORY_RULES } from '../services/categoryRuleEngine';

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
  onOpenEmailSync?: () => void;
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
  onOpenEmailSync,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const [langSearch, setLangSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Native Permissions State
  const [permStatus, setPermStatus] = useState<NativePermissionsStatus>({ sms: false, notifications: false, usage: false });
  const [notifListenerGranted, setNotifListenerGranted] = useState(false);
  const [permLoading, setPermLoading] = useState(false);

  // Check and refresh permissions on mount and when app regains focus/visibility
  const refreshPermissions = () => {
    NativeBridgeService.checkPermissions().then(setPermStatus).catch(() => {});
    NativeBridgeService.isNotificationListenerEnabled().then(setNotifListenerGranted).catch(() => {});
  };

  useEffect(() => {
    refreshPermissions();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshPermissions();
      }
    };
    window.addEventListener('focus', refreshPermissions);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', refreshPermissions);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleRequestSMS = async () => {
    setPermLoading(true);
    const granted = await NativeBridgeService.requestSMSPermissions();
    if (granted) {
      setPermStatus(prev => ({ ...prev, sms: true }));
      showNotice(isGu ? 'SMS પરમિશન મંજૂર થઈ!' : 'SMS permission granted!');
    } else {
      const detail = await NativeBridgeService.checkSMSPermissionDetailed();
      if (!detail.granted) {
        showNotice(
          isGu
            ? 'પરમિશન માટે "સેટિંગ્સ" બટન દબાવો અને SMS સક્ષમ કરો.'
            : 'To allow access, please tap "Settings" and enable SMS.'
        );
      }
    }
    setPermLoading(false);
  };

  const handleRequestNotifications = async () => {
    setPermLoading(true);
    const granted = await NativeBridgeService.requestNotificationPermissions();
    if (granted) {
      setPermStatus(prev => ({ ...prev, notifications: true }));
      showNotice(isGu ? 'નોટિફિકેશન પરમિશન મંજૂર થઈ!' : 'Notification permission granted!');
    }
    setPermLoading(false);
  };

  const handleOpenAppSettings = async () => {
    await NativeBridgeService.openAppSettings();
  };

  const handleOpenUsageSettings = async () => {
    await NativeBridgeService.openUsageSettings();
  };

  const handleOpenNotificationListenerSettings = async () => {
    await NativeBridgeService.openNotificationListenerSettings();
  };

  // Security Setup Modal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // View Passphrase Modal
  const [isViewPassphraseOpen, setIsViewPassphraseOpen] = useState(false);
  const [passphrasePinInput, setPassphrasePinInput] = useState('');
  const [passphraseVerified, setPassphraseVerified] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  // Restore Modal State (File or Cloud)
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestoreEnvelope, setPendingRestoreEnvelope] = useState<EncryptedBackupEnvelope | null>(null);
  const [restorePassphraseInput, setRestorePassphraseInput] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isMultiRestoreOpen, setIsMultiRestoreOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackupInfoOpen, setIsBackupInfoOpen] = useState(false);

  // Cloud snapshots
  const [cloudBackups, setCloudBackups] = useState<CloudBackupMetadata[]>([]);
  const [isCloudUploading, setIsCloudUploading] = useState(false);

  // Firebase Real-time Cloud Sync & Hidden Vault
  const [cloudSyncConfig, setCloudSyncConfig] = useState<CloudSyncConfig>(CloudSyncService.getConfig());
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [cloudSyncNotice, setCloudSyncNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [tempProjectId, setTempProjectId] = useState(cloudSyncConfig.projectId || '');
  const [tempAutoSync, setTempAutoSync] = useState(cloudSyncConfig.autoSync ?? true);
  const [tempEnabled, setTempEnabled] = useState(cloudSyncConfig.enabled ?? false);
  const [tempDocId, setTempDocId] = useState(cloudSyncConfig.userSyncId || 'my_primary_vault');

  const isGu = currentLang === 'gu';

  const handleSaveCloudSyncSettings = () => {
    const updated = CloudSyncService.saveConfig({
      enabled: tempEnabled,
      projectId: tempProjectId.trim(),
      userSyncId: tempDocId.trim() || 'my_primary_vault',
      autoSync: tempAutoSync,
    });
    setCloudSyncConfig(updated);
    setIsCloudSyncModalOpen(false);
    showNotice(isGu ? 'ક્લાઉડ સેટિંગ્સ સફળતાપૂર્વક સાચવાયા!' : 'Cloud settings saved successfully!');
  };

  const handleTriggerCloudSync = async () => {
    if (!cloudSyncConfig.enabled || !cloudSyncConfig.projectId?.trim()) {
      setIsCloudSyncModalOpen(true);
      return;
    }
    const recoveryWordsRaw = localStorage.getItem('expense_diary_recovery_words');
    const words = recoveryWordsRaw ? JSON.parse(recoveryWordsRaw) : [];
    if (!words || words.length < 12) {
      alert(isGu ? 'કૃપા કરીને સિક્યોરિટી સેટઅપ પૂર્ણ કરી 12 શબ્દો મેળવો.' : 'Please complete security setup with 12 recovery words first.');
      return;
    }

    setIsSyncingNow(true);
    setCloudSyncNotice(null);
    try {
      const fullVaultData: AppVaultData = {
        version: 2,
        updatedAt: new Date().toISOString(),
        transactions,
        diaryEntries,
        borrowedLentRecords,
        categories,
        profile,
        securityConfig,
        savedPassphraseWords: words,
        lang: currentLang,
        theme: activeTheme,
        font: activeFont,
        currency,
        onboarded: true,
      };
      const res = await CloudSyncService.uploadVaultToCloud(fullVaultData, words);
      if (res.success) {
        setCloudSyncNotice({ text: isGu ? 'ક્લાઉડમાં ડેટા સફળતાપૂર્વક સિંક થયો!' : 'Data synced to cloud successfully!' });
        setCloudSyncConfig(CloudSyncService.getConfig());
      } else {
        setCloudSyncNotice({ text: res.error || 'Sync failed', isError: true });
      }
    } catch (e: any) {
      setCloudSyncNotice({ text: e.message || 'Sync error', isError: true });
    } finally {
      setIsSyncingNow(false);
    }
  };

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

  // User Category Rules & Re-run (ClearSMS Pattern)
  const [userCategoryRules, setUserCategoryRules] = useState<RuleDefinition[]>(() => CategoryRuleEngine.getUserRules());
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleTargetCategory, setRuleTargetCategory] = useState(categories[0]?.name || 'Shopping');
  const [isApplyingRules, setIsApplyingRules] = useState(false);

  const handleAddNewRule = () => {
    if (!ruleKeyword.trim()) return;
    const rule = CategoryRuleEngine.learnCategoryRule(ruleKeyword, ruleTargetCategory);
    setUserCategoryRules(CategoryRuleEngine.getUserRules());
    const { updatedTransactions, updatedCount } = CategoryRuleEngine.recategorizePastTransactions(transactions, rule);
    if (updatedCount > 0) {
      onRestoreTransactions(updatedTransactions);
      showNotice(isGu ? `નવો રૂલ બન્યો અને ${updatedCount} વ્યવહારો આપોઆપ અપડેટ થયા!` : `Rule created and ${updatedCount} transactions updated!`);
    } else {
      showNotice(isGu ? 'નવો કેટેગરી રૂલ સાચવવામાં આવ્યો!' : 'Category rule saved successfully!');
    }
    setRuleKeyword('');
  };

  const handleReapplyAllRules = () => {
    setIsApplyingRules(true);
    const allRules = CategoryRuleEngine.getAllRules();
    let currentTxs = [...transactions];
    let totalUpdated = 0;

    for (const rule of allRules) {
      const { updatedTransactions, updatedCount } = CategoryRuleEngine.recategorizePastTransactions(currentTxs, rule);
      currentTxs = updatedTransactions;
      totalUpdated += updatedCount;
    }

    onRestoreTransactions(currentTxs);
    setIsApplyingRules(false);
    showNotice(
      isGu
        ? `તમામ રૂલ્સ સફળતાપૂર્વક લાગુ થયા! ${totalUpdated} વ્યવહારો અપડેટ થયા.`
        : `All rules applied! ${totalUpdated} transactions updated.`
    );
  };

  const handleDeleteUserRule = (id: string) => {
    CategoryRuleEngine.deleteUserRule(id);
    setUserCategoryRules(CategoryRuleEngine.getUserRules());
    showNotice(isGu ? 'રૂલ હટાવવામાં આવ્યો.' : 'Rule deleted.');
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
        borrowedLentRecords,
        securityConfig: {
          ...securityConfig,
          isLocked: false,
        },
      };

      const envelope = await encryptPayload(fullBackupData, passphrase);
      const savedFilename = await downloadEncryptedBackup(envelope, 'expense-diary-encrypted');
      showNotice(
        isGu
          ? `સુરક્ષિત બેકઅપ ફાઈલ (${savedFilename}) Downloads ફોલ્ડરમાં સેવ થઈ ગઈ!`
          : `Encrypted backup (${savedFilename}) saved to Downloads folder!`
      );
    } catch (err: any) {
      alert(err.message || 'Error generating encrypted backup.');
    }
  };

  // 1b. Share Encrypted Backup (.edb) directly via WhatsApp / Drive / Email
  const handleShareEncryptedBackup = async () => {
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
        borrowedLentRecords,
        securityConfig: {
          ...securityConfig,
          isLocked: false,
        },
      };

      const envelope = await encryptPayload(fullBackupData, passphrase);
      const json = JSON.stringify(envelope, null, 2);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `expense-diary-backup-${dateStr}.edb`;

      const shared = await NativeBridgeService.shareFile({
        fileName: filename,
        textContent: json,
        mimeType: 'application/octet-stream',
        title: isGu ? 'ખર્ચ ડાયરી એન્ક્રિપ્ટેડ બેકઅપ' : 'Expense Diary Encrypted Backup'
      });

      if (shared.success) {
        showNotice(isGu ? 'બેકઅપ સફળતાપૂર્વક શેર થયું!' : 'Backup successfully shared!');
      }
    } catch (err: any) {
      alert(err.message || 'Error sharing encrypted backup.');
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
        } else if (parsed.formatVersion || Array.isArray(parsed.messages)) {
          // ClearSMS App Backup File (.json)
          const result = parseClearSmsBackup(text, transactions, categories);
          if (result.success && result.newTransactions.length > 0) {
            onRestoreTransactions([...transactions, ...result.newTransactions]);
            showNotice(
              isGu
                ? `ClearSMS બેકઅપમાંથી ${result.newTransactions.length} વ્યવહારો સફળતાપૂર્વક ઉમેરાયા! (${result.duplicatesSkipped} ડુપ્લિકેટ્સ ફિલ્ટર થયા)`
                : `Imported ${result.newTransactions.length} transactions from ClearSMS! (${result.duplicatesSkipped} duplicates skipped)`
            );
          } else if (result.success) {
            alert(
              isGu
                ? `ClearSMS બેકઅપમાં કોઈ નવા ટ્રાન્ઝેક્શન મળ્યા નહીં (તમામ ${result.duplicatesSkipped} વ્યવહારો પહેલેથી મોજૂદ છે).`
                : `No new transactions found in ClearSMS backup (${result.duplicatesSkipped} already exist).`
            );
          } else {
            alert(result.errorMessage || 'Error importing ClearSMS backup');
          }
        } else if (Array.isArray(parsed.transactions)) {
          // Backward compatibility with legacy plain JSON backup
          onRestoreTransactions(parsed.transactions);
          if (Array.isArray(parsed.diaryEntries)) onRestoreDiaryEntries(parsed.diaryEntries);
          if (Array.isArray(parsed.borrowedLentRecords) && onRestoreBorrowedLentRecords) {
            onRestoreBorrowedLentRecords(parsed.borrowedLentRecords);
          }
          if (Array.isArray(parsed.categories)) {
            parsed.categories.forEach((cat: Category) => {
              if (!categories.some(c => c.id === cat.id)) {
                onAddCategory(cat);
              }
            });
          }
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
        borrowedLentRecords?: BorrowedLentRecord[];
      }>(pendingRestoreEnvelope, normalized);

      if (Array.isArray(decrypted.transactions)) {
        onRestoreTransactions(decrypted.transactions);
      }
      if (Array.isArray(decrypted.diaryEntries)) {
        onRestoreDiaryEntries(decrypted.diaryEntries);
      }
      if (Array.isArray(decrypted.borrowedLentRecords) && onRestoreBorrowedLentRecords) {
        onRestoreBorrowedLentRecords(decrypted.borrowedLentRecords);
      }
      if (Array.isArray(decrypted.categories)) {
        decrypted.categories.forEach((cat: Category) => {
          if (!categories.some(c => c.id === cat.id)) {
            onAddCategory(cat);
          }
        });
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

  // ── On-Device Encryption (AES-GCM-256 at-rest vault seal) ──────────────────
  const [isDeviceEncBusy, setIsDeviceEncBusy] = useState(false);
  const deviceEncEnabled = DeviceEncryption.isEnabled();

  const parseWordsInput = (raw: string): string[] =>
    raw.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const handleToggleDeviceEncryption = async () => {
    if (isDeviceEncBusy) return;
    setIsDeviceEncBusy(true);
    try {
      if (!deviceEncEnabled) {
        const raw = prompt(
          isGu
            ? 'ઓન-ડિવાઇસ એન્ક્રિપ્શન ચાલુ કરવા તમારી ૧૨ શબ્દોની રિકવરી કી દાખલ કરો (એક જગ્યા વચ્ચે):'
            : 'Enter your 12 recovery words (space separated) to enable on-device encryption:'
        );
        if (!raw) return;
        const words = parseWordsInput(raw);
        if (words.length !== 12) {
          alert(isGu ? 'બરાબર ૧૨ શબ્દો જરૂરી છે.' : 'Exactly 12 words are required.');
          return;
        }
        const effectiveWords = savedPassphraseWords.length >= 12 ? savedPassphraseWords : words;
        if (savedPassphraseWords.length >= 12) {
          const stored = savedPassphraseWords.map((w) => w.trim().toLowerCase());
          const matches = words.every((w, i) => w === stored[i]);
          if (!matches) {
            alert(
              isGu
                ? 'શબ્દો સાચવેલી રિકવરી કી સાથે મેળ ખાતા નથી.'
                : 'Words do not match your saved recovery passphrase.'
            );
            return;
          }
        }
        const fullVaultData: AppVaultData = {
          version: 2,
          updatedAt: new Date().toISOString(),
          transactions,
          diaryEntries,
          borrowedLentRecords,
          categories,
          profile,
          securityConfig,
          savedPassphraseWords: effectiveWords,
          lang: currentLang,
          theme: activeTheme,
          font: activeFont,
          currency,
          onboarded: true,
        };
        const res = await DeviceEncryption.enable(fullVaultData, effectiveWords);
        if (!res.ok) {
          alert(res.error || 'Failed to enable encryption.');
          return;
        }
        // Persist the ciphertext wrapper to native Android storage immediately.
        try {
          const blob = localStorage.getItem('expense_diary_device_enc') || '';
          await NativeBridgeService.savePersistentVault(DeviceEncryption.nativeEnvelope(blob));
        } catch {
          // Web/PWA context — native bridge absent
        }
        alert(
          isGu
            ? '✅ ઓન-ડિવાઇસ એન્ક્રિપ્શન ચાલુ થયું! ડેટા હવે AES-256 સાથે સીલ છે.'
            : '✅ On-device encryption enabled! Your data is now sealed with AES-256 at rest.'
        );
        window.location.reload(); // clean reboot through the new lock gate
      } else {
        const raw = prompt(
          isGu
            ? 'એન્ક્રિપ્શન બંધ કરવા તમારી ૧૨ શબ્દોની રિકવરી કી દાખલ કરો:'
            : 'Enter your 12 recovery words to disable encryption:'
        );
        if (!raw) return;
        const words = parseWordsInput(raw);
        const res = await DeviceEncryption.disable(words);
        if (!res.ok || !res.vault) {
          alert(res.error || 'Unlock failed.');
          return;
        }
        // Restore plaintext vault (session continues unencrypted).
        VaultStorage.syncToLocalStorage(res.vault);
        try {
          await NativeBridgeService.savePersistentVault(JSON.stringify(res.vault));
        } catch {
          // Web/PWA context
        }
        alert(
          isGu
            ? '✅ એન્ક્રિપ્શન બંધ થયું. ડેટા પુનઃસ્થાપિત થયો.'
            : '✅ Encryption disabled. Data restored to standard storage.'
        );
        window.location.reload();
      }
    } finally {
      setIsDeviceEncBusy(false);
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

        {/* On-Device Encryption (AES-GCM-256 at-rest seal) */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <ShieldCheck className={`w-3.5 h-3.5 ${deviceEncEnabled ? 'text-emerald-600' : 'text-stone-400'}`} />
              {isGu ? 'ઓન-ડિવાઇસ એન્ક્રિપ્શન (AES-256)' : 'On-Device Encryption (AES-256)'}
              {deviceEncEnabled && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                  {isGu ? 'ચાલુ' : 'ON'}
                </span>
              )}
            </p>
            <p className="text-[10px] text-stone-500 mt-0.5 leading-relaxed">
              {deviceEncEnabled
                ? (isGu
                  ? 'ડેટા આ ઉપકરણ પર AES-256 સાથે સીલ છે. બંધ કરવા ૧૨ શબ્દો જરૂરી છે.'
                  : 'Data is sealed at rest with AES-256. 12 recovery words required to disable.')
                : (isGu
                  ? 'ચાલુ કરવાથી તમારો સમગ્ર ડેટા AES-256 સાથે સીલ થશે — અનલૉક માટે ૧૨ શબ્દો જરૂરી.'
                  : 'Enable to seal your entire vault with AES-256 at rest — 12 words required to unlock.')}
            </p>
          </div>
          <button
            onClick={handleToggleDeviceEncryption}
            disabled={isDeviceEncBusy}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition disabled:opacity-50 ${
              deviceEncEnabled
                ? 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isDeviceEncBusy
              ? (isGu ? '...' : '...')
              : deviceEncEnabled
                ? (isGu ? 'બંધ કરો' : 'Disable')
                : (isGu ? 'ચાલુ કરો' : 'Enable')}
          </button>
        </div>

      </div>

      {/* 2. Encrypted Local & Cloud Backup Section (Tasks 13 & 14) */}
      <div
        id="encrypted-backup-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 stroke-[2]" />
            <h3 className="text-sm font-bold text-stone-800 tracking-tight">
              {t.encryptedBackup} & {t.cloudVault}
            </h3>
          </div>
          <button
            onClick={() => setIsBackupInfoOpen(true)}
            className="px-2.5 py-1 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition"
            title={isGu ? 'બેકઅપ માર્ગદર્શિકા' : 'Backup Guide'}
          >
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isGu ? 'માર્ગદર્શિકા (Guide)' : 'Guide'}</span>
          </button>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed">
          {isGu
            ? 'AES-GCM ૨૫૬-બીટ મિલિટરી-ગ્રેડ એન્ક્રિપ્ટેડ બેકઅપ. તમારો ડેટા સીધો Downloads ફોલ્ડરમાં સેવ થશે.'
            : 'AES-GCM 256-bit military-grade encrypted backup. Files save directly to your Downloads folder.'}
        </p>

        {/* Action Buttons: Export, Share, Import, and Multi-Merge */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            id="export-backup-btn"
            onClick={handleExportEncryptedBackup}
            className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold text-emerald-900 flex items-center justify-center gap-2 cursor-pointer transition shadow-xs active:scale-98"
          >
            <DownloadCloud className="w-4 h-4 text-emerald-700" />
            <span>{isGu ? 'Export Backup (સેવ કરો)' : 'Export to Downloads'}</span>
          </button>

          <button
            id="share-backup-btn"
            onClick={handleShareEncryptedBackup}
            className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 hover:bg-teal-100 text-xs font-bold text-teal-900 flex items-center justify-center gap-2 cursor-pointer transition shadow-xs active:scale-98"
          >
            <Share2 className="w-4 h-4 text-teal-700" />
            <span>{isGu ? 'Share Backup (શેર કરો)' : 'Share Backup File'}</span>
          </button>

          <button
            id="import-backup-btn"
            type="button"
            onClick={() => restoreFileInputRef.current?.click()}
            className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:bg-stone-100 text-xs font-bold text-stone-800 flex items-center justify-center gap-2 cursor-pointer transition shadow-xs active:scale-98"
          >
            <Upload className="w-4 h-4 text-stone-600" />
            <span>{isGu ? 'Import Backup Data (ઇમ્પોર્ટ)' : 'Import Backup Data'}</span>
          </button>
          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".edb,.json,application/json,text/plain,*/*"
            onChange={handleFileSelectForRestore}
            className="hidden"
          />

          <button
            id="multi-import-backup-btn"
            onClick={() => setIsMultiRestoreOpen(true)}
            className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold text-indigo-950 flex items-center justify-center gap-2 cursor-pointer transition shadow-xs active:scale-98"
          >
            <Layers className="w-4 h-4 text-indigo-700" />
            <span>{isGu ? 'Multiple Backup Merge (મર્જ)' : 'Multiple Backup Merge'}</span>
          </button>

          <button
            type="button"
            id="clearsms-import-btn"
            onClick={() => restoreFileInputRef.current?.click()}
            className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold text-emerald-950 flex items-center justify-center gap-2 cursor-pointer transition shadow-xs active:scale-98 col-span-2"
          >
            <Database className="w-4 h-4 text-emerald-700" />
            <span>{isGu ? 'ClearSMS Backup (.json) સીધું ઇમ્પોર્ટ કરો' : 'Import ClearSMS Backup (.json)'}</span>
          </button>
        </div>

        {/* Financial Email Sync Card (Gmail & .EML Statement Parser) */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-amber-950">
                {isGu ? 'નાણાકીય ઈમેલ સિંક સિસ્ટમ (Gmail & .EML)' : 'Financial Email Sync (Gmail & .EML)'}
              </span>
            </div>
            {onOpenEmailSync && (
              <button
                type="button"
                onClick={onOpenEmailSync}
                className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isGu ? 'ઈમેલ સ્કેન શરૂ કરો' : 'Start Email Sync'}</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            {isGu
              ? 'Gmail API અથવા ઓફલાઇન .eml ફાઇલ દ્વારા CRA-NSDL / Protean NPS યોગદાન, પગાર પર્ચી અને મ્યુચ્યુઅલ ફંડ એલોકેશન સ્કેન કરો (૧૦૦% ઓફલાઇન અને પ્રાઇવેટ).'
              : 'Automatically extract CRA-NSDL NPS contributions, salary slips, and mutual fund allotments via Gmail API or offline .eml file import (100% client-side privacy).'}
          </p>
        </div>

        {/* ClearSMS Smart Auto-Category Rule Engine Card */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950">
                {isGu ? 'સ્માર્ટ કેટેગરી રૂલ્સ એન્જિન (Auto-Category Rules)' : 'Smart Category Rule Engine (ClearSMS Pattern)'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleReapplyAllRules}
              disabled={isApplyingRules}
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isApplyingRules ? 'animate-spin' : ''}`} />
              <span>{isGu ? 'તમામ વ્યવહારો પર રૂલ્સ ફરી ચલાવો' : 'Re-apply Rules'}</span>
            </button>
          </div>

          <p className="text-[11px] text-emerald-900 leading-relaxed">
            {isGu
              ? `સિસ્ટમમાં ${BUILTIN_CATEGORY_RULES.length} બિલ્ટ-ઇન અને ${userCategoryRules.length} કસ્ટમ રૂલ્સ સક્રિય છે. જ્યારે પણ તમે કોઈ ખર્ચની કેટેગરી બદલો છો, ત્યારે સિસ્ટમ ભવિષ્યના અને અગાઉના તમામ વ્યવહારો માટે આપમેળે નવો રૂલ બનાવી લે છે.`
              : `${BUILTIN_CATEGORY_RULES.length} built-in & ${userCategoryRules.length} custom rules active. Whenever you assign a category to a vendor, the system remembers and automatically auto-classifies past & future transactions.`}
          </p>

          {/* Quick Add Rule Form */}
          <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              type="text"
              placeholder={isGu ? 'વેન્ડર / કીવર્ડ (દા.ત. Swiggy, Amazon)' : 'Keyword (e.g. Swiggy, Amazon)'}
              value={ruleKeyword}
              onChange={(e) => setRuleKeyword(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 flex-1 outline-none text-stone-800"
            />
            <select
              value={ruleTargetCategory}
              onChange={(e) => setRuleTargetCategory(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 bg-stone-50 outline-none text-stone-700 font-medium"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {isGu && c.nameGu ? c.nameGu : c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddNewRule}
              className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shrink-0"
            >
              {isGu ? '+ રૂલ ઉમેરો' : '+ Add Rule'}
            </button>
          </div>

          {/* User rules list if any */}
          {userCategoryRules.length > 0 && (
            <div className="space-y-1 pt-1 max-h-36 overflow-y-auto">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                {isGu ? 'તમારા શીખેલા રૂલ્સ:' : 'Your Learned Rules:'}
              </span>
              {userCategoryRules.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-stone-200 text-xs">
                  <div className="truncate min-w-0 pr-2">
                    <span className="font-bold text-stone-800">{r.name}</span>
                    <span className="text-stone-400 mx-1">→</span>
                    <span className="text-emerald-700 font-semibold">{r.action.category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteUserRule(r.id)}
                    className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
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

        {/* Real-time Hybrid Sync & Free Firebase Cloud Sync Card */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">
                  {isGu ? 'હાઇબ્રિડ સિંક (હિડન ફોલ્ડર + ફ્રી ક્લાઉડ ડેટાબેઝ)' : 'Hybrid Real-Time Cloud Sync'}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium">
                  {isGu ? 'ફોન સ્ટોરેજ (.smart_vault) અને ક્લાઉડ વચ્ચે ઓટો સિંક' : 'Zero-knowledge encrypted cloud & hidden local vault'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTempEnabled(cloudSyncConfig.enabled);
                  setTempProjectId(cloudSyncConfig.projectId || '');
                  setTempAutoSync(cloudSyncConfig.autoSync ?? true);
                  setTempDocId(cloudSyncConfig.userSyncId || 'my_primary_vault');
                  setIsCloudSyncModalOpen(true);
                }}
                className="py-1 px-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-[11px] transition cursor-pointer"
              >
                {isGu ? 'સેટિંગ્સ / ગાઈડ' : 'Setup & Guide'}
              </button>

              <button
                type="button"
                onClick={handleTriggerCloudSync}
                disabled={isSyncingNow}
                className="py-1 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span>{isSyncingNow ? (isGu ? 'સિંક...' : 'Syncing...') : (isGu ? 'હમણાં સિંક કરો' : 'Sync Now')}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-100 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500">{isGu ? 'ક્લાઉડ સ્ટેટસ:' : 'Cloud Status:'}</span>
              <span className={`font-bold px-2 py-0.5 rounded-md ${
                cloudSyncConfig.enabled && cloudSyncConfig.projectId
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-100 text-stone-600'
              }`}>
                {cloudSyncConfig.enabled && cloudSyncConfig.projectId
                  ? (isGu ? 'સક્રિય (Connected)' : 'Connected')
                  : (isGu ? 'બંધ (Not Configured)' : 'Not Configured')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-stone-500">{isGu ? 'છેલ્લું સિંક:' : 'Last Synced:'}</span>
              <span className="font-mono text-stone-700 font-semibold">
                {cloudSyncConfig.lastSyncedAt
                  ? new Date(cloudSyncConfig.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : (isGu ? 'ક્યારેય નહીં' : 'Never')}
              </span>
            </div>
          </div>

          {cloudSyncNotice && (
            <div className={`p-2 rounded-xl text-xs font-semibold ${
              cloudSyncNotice.isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-white text-emerald-800 border border-emerald-200'
            }`}>
              {cloudSyncNotice.text}
            </div>
          )}
        </div>
      </div>

      {/* 3. Language & Currency Settings (Task 15: Side-by-Side Dropdowns) */}
      <div
        id="language-currency-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Language Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-600 stroke-[2]" />
                <span>{t.languageSelect}</span>
              </span>
              <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
                {LANGUAGES.length} {isGu ? 'ભાષાઓ' : 'Langs'}
              </span>
            </label>
            <div className="relative">
              <select
                id="language-select-dropdown"
                value={currentLang}
                onChange={(e) => onSelectLanguage(e.target.value)}
                className="w-full py-2.5 px-3.5 pr-8 text-xs font-semibold rounded-xl border border-stone-200 bg-stone-50 text-stone-900 outline-none focus:border-emerald-500 cursor-pointer appearance-none transition shadow-xs"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">▼</div>
            </div>
          </div>

          {/* Currency Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600 stroke-[2]" />
                <span>{isGu ? 'પ્રાથમિક કરન્સી' : 'Primary Currency'}</span>
              </span>
              <span className="text-xs font-bold text-emerald-700 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                {currency}
              </span>
            </label>
            <div className="relative">
              <select
                id="currency-select-dropdown"
                value={currency}
                onChange={(e) => onSelectCurrency(e.target.value)}
                className="w-full py-2.5 px-3.5 pr-8 text-xs font-semibold rounded-xl border border-stone-200 bg-stone-50 text-stone-900 outline-none focus:border-emerald-500 cursor-pointer appearance-none transition shadow-xs"
              >
                {[
                  { symbol: '₹', name: 'INR (₹ - Indian Rupee)' },
                  { symbol: '$', name: 'USD ($ - US Dollar)' },
                  { symbol: '€', name: 'EUR (€ - Euro)' },
                  { symbol: '£', name: 'GBP (£ - British Pound)' },
                  { symbol: '¥', name: 'JPY/CNY (¥ - Yen / Yuan)' },
                  { symbol: 'د.إ', name: 'AED (د.إ - UAE Dirham)' },
                  { symbol: 'CA$', name: 'CAD (CA$ - Canadian Dollar)' },
                  { symbol: 'AU$', name: 'AUD (AU$ - Australian Dollar)' },
                ].map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">▼</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Appearance: Theme & Font (Task 16: Side-by-Side Dropdowns) */}
      <div
        id="appearance-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Theme Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-emerald-600 stroke-[2]" />
              <span>{t.themeSelect}</span>
            </label>
            <div className="relative">
              <select
                id="theme-select-dropdown"
                value={activeTheme}
                onChange={(e) => onSelectTheme(e.target.value)}
                className="w-full py-2.5 px-3.5 pr-8 text-xs font-semibold rounded-xl border border-stone-200 bg-stone-50 text-stone-900 outline-none focus:border-emerald-500 cursor-pointer appearance-none transition shadow-xs"
              >
                <option value="cream">Paper Cream ({isGu ? 'પેપર ક્રીમ' : 'Classic Warm'})</option>
                <option value="mint">Soft Mint ({isGu ? 'સોફ્ટ મિન્ટ' : 'Refreshing Mint'})</option>
                <option value="lavender">Lavender ({isGu ? 'લેવેન્ડર' : 'Soft Lavender'})</option>
                <option value="light">Pure White ({isGu ? 'પ્યોર વ્હાઇટ' : 'Clean Modern'})</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">▼</div>
            </div>
          </div>

          {/* Font Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-emerald-600 stroke-[2]" />
              <span>{t.fontSelect}</span>
            </label>
            <div className="relative">
              <select
                id="font-select-dropdown"
                value={activeFont}
                onChange={(e) => onSelectFont(e.target.value)}
                className="w-full py-2.5 px-3.5 pr-8 text-xs font-semibold rounded-xl border border-stone-200 bg-stone-50 text-stone-900 outline-none focus:border-emerald-500 cursor-pointer appearance-none transition shadow-xs"
              >
                <option value="sans">Sans (Modern / આધુનિક)</option>
                <option value="serif">Serif (Classic / ક્લાસિક)</option>
                <option value="mono">Mono (Ledger / લેજર ડિજિટ)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 text-xs">▼</div>
            </div>
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRequestSMS}
                disabled={permLoading}
                className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isGu ? 'પરમિશન આપો' : 'Grant'}
              </button>
              <button
                onClick={handleOpenAppSettings}
                className="py-2 px-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold transition shrink-0 cursor-pointer active:scale-95"
                title={isGu ? 'ઍપ સેટિંગ્સ ખોલો' : 'Open App Settings'}
              >
                {isGu ? 'સેટિંગ્સ' : 'Settings'}
              </button>
            </div>
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRequestNotifications}
                disabled={permLoading}
                className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isGu ? 'પરમિશન આપો' : 'Grant'}
              </button>
              <button
                onClick={handleOpenAppSettings}
                className="py-2 px-2.5 rounded-xl border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-800 text-xs font-semibold transition shrink-0 cursor-pointer active:scale-95"
                title={isGu ? 'ઍપ સેટિંગ્સ ખોલો' : 'Open App Settings'}
              >
                {isGu ? 'સેટિંગ્સ' : 'Settings'}
              </button>
            </div>
          )}
        </div>

        {/* Android 13+ / 14+ Restricted Settings Guidance Note */}
        {(!permStatus.sms || !permStatus.notifications) && (
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-[11px] text-stone-600 space-y-1">
            <div className="font-bold text-stone-800 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{isGu ? 'Android 13+ / 14+ માટે મહત્વપૂર્ણ સૂચના:' : 'Android 13+ / 14+ Note:'}</span>
            </div>
            <p className="leading-relaxed text-stone-600">
              {isGu
                ? 'જો સીધી પરમિશન ન મળે, તો "સેટિંગ્સ" બટન દબાવો -> Permissions માં જઈને SMS ચાલુ કરો (અથવા ઉપરના 3 ડૉટ્સ પર ટૅપ કરીને "Allow restricted settings" પસંદ કરો).'
                : 'If blocked by Android, tap "Settings" -> Permissions -> Allow SMS (or tap 3 dots at top-right -> "Allow restricted settings").'}
            </p>
          </div>
        )}

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

        {/* Notification Listener Permission (UPI / Banking Transaction Notifications) */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-stone-800">
              {isGu ? 'UPI / બેંક નોટિફિકેશન રીડ' : 'Notification Read Access'}
            </div>
            <div className="text-[11px] text-stone-500">
              {isGu ? 'GPay, PhonePe, Paytm નોટિફિકેશનમાંથી વ્યવહાર ઓળખવા' : 'Detect transactions from UPI & payment app notifications'}
            </div>
          </div>
          {notifListenerGranted ? (
            <span className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {isGu ? 'મંજૂર' : 'Granted'}
            </span>
          ) : (
            <button
              onClick={handleOpenNotificationListenerSettings}
              className="py-2 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
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
            v1.2.0 Stable
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

      {/* Backup Guide Info Modal (Task 13) */}
      {isBackupInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    {isGu ? 'બેકઅપ અને રીસ્ટોર માર્ગદર્શિકા' : 'Backup & Restore Guide'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {isGu ? 'ડેટા સુરક્ષા અને ટ્રાન્સફર સંબંધિત માહિતી' : 'Data security and transfer details'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBackupInfoOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-stone-600 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <DownloadCloud className="w-4 h-4 text-emerald-700" />
                  <span>1. Export Backup Data (બેકઅપ એક્સપોર્ટ)</span>
                </div>
                <p className="text-emerald-900">
                  {isGu
                    ? 'તમારા તમામ આવક-ખર્ચના વ્યવહારો, પર્સનલ ડાયરીની એન્ટ્રીઓ, ઉધાર-જમા ખાતા અને પ્રોફાઇલ ડેટાને મિલિટરી-ગ્રેડ AES-GCM ૨૫૬-બીટથી એન્ક્રિપ્ટ કરીને તમારા ફોનના Downloads ફોલ્ડરમાં સાચવે છે.'
                    : 'Encrypted with AES-GCM 256-bit military-grade encryption and saved directly into your device Downloads folder.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-stone-700" />
                  <span>2. Import Backup Data (બેકઅપ ઇમ્પોર્ટ)</span>
                </div>
                <p className="text-stone-700">
                  {isGu
                    ? 'નવો ફોન લીધા પછી અથવા એપ ફરી ઇન્સ્ટોલ કર્યા પછી અગાઉ સાચવેલી .edb કે .json ફાઈલ પસંદ કરી ૧૨-શબ્દોની કી વડે તમામ ડેટા એક ક્લિકમાં પાછો લાવો.'
                    : 'Select your saved .edb or .json file and decrypt using your 12-word passphrase to restore everything.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-1">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-700" />
                  <span>3. Multiple Import Backup Data (મલ્ટિપલ બેકઅપ મર્જ)</span>
                </div>
                <p className="text-indigo-900">
                  {isGu
                    ? 'જો તમારી પાસે અલગ-અલગ તારીખો કે ડિવાઇસના એકથી વધુ બેકઅપ હોય, તો તેને ડુપ્લિકેટ વગર સ્માર્ટ રીતે ભેગા (merge) કરી આપે છે.'
                    : 'Merge multiple backup files without creating duplicate transactions.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  {isGu
                    ? 'સલાહ: બેકઅપ ફાઈલ સેવ થયા બાદ તેને તમારા ગૂગલ ડ્રાઈવ કે ઈમેલમાં સાચવી રાખો જેથી ફોન ખોવાઈ જાય તો પણ તમારો હિસાબ સુરક્ષિત રહે.'
                    : 'Tip: After exporting, save a copy to your Google Drive or email so your records stay safe even if you switch phones.'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsBackupInfoOpen(false)}
              className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs cursor-pointer transition shadow-xs"
            >
              {isGu ? 'સમજાઈ ગયું (Close)' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* CLOUD SYNC & HIDDEN VAULT SETUP MODAL */}
      {isCloudSyncModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsCloudSyncModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 text-stone-800 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {isGu ? 'ફ્રી ક્લાઉડ સિંક સેટઅપ (Firebase)' : 'Free Cloud Sync Setup'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {isGu ? 'ઝીરો-નોલેજ AES-256 મિલિટરી એન્ક્રિપ્શન' : 'Zero-Knowledge AES-256 Encrypted'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCloudSyncModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200">
              <div>
                <span className="text-xs font-bold text-stone-800 block">
                  {isGu ? 'ક્લાઉડ ઓટો-સિંક સક્રિય કરો' : 'Enable Cloud Sync'}
                </span>
                <span className="text-[10px] text-stone-500">
                  {isGu ? 'નવો વ્યવહાર ઉમેરતા જ ક્લાઉડમાં ઓટો-સેવ' : 'Auto-syncs encrypted vault in background'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={tempEnabled}
                onChange={(e) => setTempEnabled(e.target.checked)}
                className="w-5 h-5 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Firebase Project ID Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 block">
                {isGu ? 'Firebase Project ID (પ્રોજેક્ટ આઈડી):' : 'Firebase Project ID:'}
              </label>
              <input
                type="text"
                placeholder="દા.ત. my-smart-expense-app"
                value={tempProjectId}
                onChange={(e) => setTempProjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-mono outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-stone-500 block">
                {isGu
                  ? 'ફ્રી Firebase Spark plan માંથી મળેલો Project ID અહીં દાખલ કરો.'
                  : 'Enter your project ID from Firebase Console (Spark Free Tier).'}
              </span>
            </div>

            {/* Step-by-Step Setup Guide Accordion */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2 text-xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-700" />
                <span>{isGu ? 'ફ્રી ડેટાબેઝ કેવી રીતે બનાવવો? (૨ મિનિટ)' : 'How to set up free cloud db (2 mins)'}</span>
              </div>

              <ol className="list-decimal list-inside space-y-1.5 text-stone-700 text-[11px] leading-relaxed">
                <li>
                  {isGu ? (
                    <>બ્રાઉઝરમાં <strong>console.firebase.google.com</strong> ખોલો અને ગૂગલ એકાઉન્ટથી લૉગિન કરો.</>
                  ) : (
                    <>Go to <strong>console.firebase.google.com</strong> and sign in.</>
                  )}
                </li>
                <li>
                  {isGu ? (
                    <><strong>"Create a project"</strong> પર ક્લિક કરી કોઈપણ નામ આપો (દા.ત. <code>my-expense-vault</code>).</>
                  ) : (
                    <>Click <strong>"Create a project"</strong> and enter any name.</>
                  )}
                </li>
                <li>
                  {isGu ? (
                    <>ડાબી બાજુ <strong>Build &gt; Firestore Database</strong> પર ક્લિક કરી <strong>"Create Database"</strong> કરો (Start in test mode).</>
                  ) : (
                    <>Navigate to <strong>Build &gt; Firestore Database</strong> and click <strong>Create Database</strong>.</>
                  )}
                </li>
                <li>
                  {isGu ? (
                    <>પ્રોજેક્ટ સેટિંગ્સમાંથી <strong>Project ID</strong> કોપી કરી ઉપરના બોક્સમાં પેસ્ટ કરો અને નીચે <strong>Save</strong> કરો!</>
                  ) : (
                    <>Copy your <strong>Project ID</strong> from Project Settings and paste it above!</>
                  )}
                </li>
              </ol>

              <div className="text-[10px] text-emerald-800 bg-white p-2 rounded-xl border border-emerald-100">
                🔒 {isGu
                  ? 'ગેરંટી: તમારો ડેટા તમારા 12 શબ્દોના માસ્ટર પાસફ્રેઝથી ફોનમાં જ 256-બીટ એન્ક્રિપ્ટ થઈને જશે. ક્લાઉડ સર્વર કે અન્ય કોઈ પણ તેને વાંચી શકશે નહીં!'
                  : 'Zero-Knowledge: Encrypted on-device using your 12-word passphrase. 100% private.'}
              </div>

              <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
                ⚠️ {isGu ? (
                  <>Firestore <strong>rules</strong> 'test mode' માં મૂકેલા હોય તો કોઈપણ તમારી <strong>document ID</strong> પર લખી શકે છે (backup ઉપર overwrite). સેટઅપ પછી rules બદલો: <code>allow read, write: if request.auth != null;</code> અને દરેક user <strong>unique document ID</strong> (userSyncId) વાપરે.</>
                ) : (
                  <>If Firestore <strong>rules</strong> remain in 'test mode', anyone can overwrite this backup document. After setup, restrict writes — e.g. <code>allow read, write: if request.auth != null;</code> — and always use a <strong>unique document ID</strong> (userSyncId) per account.</>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCloudSyncModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveCloudSyncSettings}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {isGu ? 'સાચવો અને કનેક્ટ કરો' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
