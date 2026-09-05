import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Globe, 
  User, 
  BookOpen, 
  Lock 
} from 'lucide-react';
import { 
  Transaction, 
  TransactionType, 
  Category, 
  UserProfile, 
  PendingAIMessage, 
  DiaryEntry, 
  SecurityConfig,
  BorrowedLentRecord 
} from './types';
import { getTranslation, LANGUAGES } from './data/languages';
import { DEFAULT_CATEGORIES, INITIAL_TRANSACTIONS, INITIAL_USER_PROFILE } from './data/initialData';
import { HomeScreen } from './components/HomeScreen';
import { ReportScreen } from './components/ReportScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { DiaryScreen } from './components/DiaryScreen';
import { Navigation, NavTab } from './components/Navigation';
import { TransactionModal } from './components/TransactionModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AndroidSMSPermissionModal } from './components/AndroidSMSPermissionModal';
import { SmartTransactionScanModal, ScannedCandidate } from './components/SmartTransactionScanModal';
import { TransactionAmbiguityModal } from './components/TransactionAmbiguityModal';
import { AuthLockScreen } from './components/AuthLockScreen';
import { checkAndTriggerDailyReminder } from './services/notifications';
import { hashWithPBKDF2 } from './services/security';
import { MigrationManager } from './services/dataMigration';
import { NativeBridgeService } from './services/nativeBridge';
import { parseTransactionMessage, ParsedExpenseMessage } from './utils/smsParser';
import { uid } from './utils/uid';
import { VaultStorage } from './services/vaultStorage';
import { FinancialEmailSyncModal } from './components/FinancialEmailSyncModal';
import { CategoryRuleEngine } from './services/categoryRuleEngine';

// Sequential data migration & backward compatibility (§21)
MigrationManager.runMigrations();

export default function App() {
  // Persistent Language State
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('expense_diary_lang') || 'en';
  });

  // Persistent Theme & Font State
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return localStorage.getItem('expense_diary_theme') || 'cream';
  });
  const [activeFont, setActiveFont] = useState<string>(() => {
    return localStorage.getItem('expense_diary_font') || 'sans';
  });
  const [currency, setCurrency] = useState<string>(() => {
    return localStorage.getItem('expense_diary_currency') || '₹';
  });

  // Active Navigation Tab: 'home' | 'diary' | 'report' | 'profile' | 'settings'
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Security Configuration & Lock State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    const saved = localStorage.getItem('expense_diary_security_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      hasCompletedSetup: false,
      isLocked: false,
      biometricsEnabled: false,
      autoLockMinutes: 0,
      diaryLockEnabled: false,
    };
  });

  const [savedPassphraseWords, setSavedPassphraseWords] = useState<string[]>(() => {
    const saved = localStorage.getItem('expense_diary_recovery_words');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Runtime Lock State
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    return securityConfig.hasCompletedSetup && !!securityConfig.pinHash;
  });

  // First-run Onboarding State
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem('expense_diary_onboarded');
  });

  // Android SMS Permission modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Financial Email Sync modal state
  const [isEmailSyncModalOpen, setIsEmailSyncModalOpen] = useState(false);

  // Assistant drawer / modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('expense_diary_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_TRANSACTIONS;
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  // Personal Diary Entries State
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(() => {
    const saved = localStorage.getItem('expense_diary_entries');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Borrowed/Lent Records State
  const [borrowedLentRecords, setBorrowedLentRecords] = useState<BorrowedLentRecord[]>(() => {
    const saved = localStorage.getItem('expense_diary_borrow_lent');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Categories State
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('expense_diary_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CATEGORIES;
      }
    }
    return DEFAULT_CATEGORIES;
  });

  // User Profile State
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('expense_diary_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_USER_PROFILE;
      }
    }
    return INITIAL_USER_PROFILE;
  });

  // Pending detected notifications
  const [pendingAiMessages, setPendingAiMessages] = useState<PendingAIMessage[]>(() => {
    const saved = localStorage.getItem('expense_diary_pending_ai');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Modal State for adding transactions
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<TransactionType>('expense');

  // Smart SMS Scan State (Task 2 & 17)
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedCandidates, setScannedCandidates] = useState<ScannedCandidate[]>([]);
  const [ambiguityQueue, setAmbiguityQueue] = useState<ParsedExpenseMessage[]>([]);
  const [ambiguityIndex, setAmbiguityIndex] = useState<number>(0);

  const handleScanSMS = async (): Promise<number> => {
    try {
      // Check native permissions first; request if missing directly like notifications
      const permStatus = await NativeBridgeService.checkPermissions();
      if (!permStatus.sms) {
        const granted = await NativeBridgeService.requestSMSPermissions();
        if (!granted) {
          setIsSmsModalOpen(true);
          return 0;
        }
      }

      // 1. Fetch from 24/7 background receiver (catches SMS & notifications received when app was closed/backgrounded)
      const pendingBg = await NativeBridgeService.getPendingIncomingTransactions();
      // 2. Fetch from active SMS inbox content provider
      const bankSms = await NativeBridgeService.readRecentBankSMS();
      // 3. Fetch from recent saved notifications
      const recentNotifs = await NativeBridgeService.getRecentFinancialNotifications();

      const rawItems: Array<{ body: string; sender?: string; timestamp?: number; source: 'sms' | 'notification' }> = [];

      for (const item of pendingBg) {
        if (item && item.text) {
          rawItems.push({ body: item.text, sender: item.sender, timestamp: item.timestamp, source: item.source });
        }
      }
      for (const msg of bankSms) {
        if (msg && msg.body) {
          rawItems.push({ body: msg.body, sender: msg.address, timestamp: msg.timestamp, source: 'sms' });
        }
      }
      for (const notif of recentNotifs) {
        if (notif && notif.text) {
          const combined = `${notif.title} ${notif.text}`.trim();
          rawItems.push({ body: combined, sender: notif.packageName, timestamp: notif.timestamp, source: 'notification' });
        }
      }

      if (rawItems.length === 0) return 0;

      const candidates: ScannedCandidate[] = [];
      const newAmbiguous: ParsedExpenseMessage[] = [];
      const seenRaw = new Set<string>();

      for (const raw of rawItems) {
        if (seenRaw.has(raw.body)) continue;
        seenRaw.add(raw.body);

        const parsed = parseTransactionMessage(raw.body, categories, raw.source, {
          timestamp: raw.timestamp,
          sender: raw.sender,
        });

        if (parsed) {
          const alreadyExists = transactions.some((t) => {
            if (t.referenceNumber && parsed.referenceNumber && t.referenceNumber === parsed.referenceNumber) {
              return true;
            }
            if (t.evidence && t.evidence.includes(raw.body)) {
              return true;
            }
            return (
              t.amount === parsed.amount &&
              t.date === parsed.date &&
              (t.title === parsed.title || t.vendorOrPerson === parsed.vendorOrPerson)
            );
          });

          if (!alreadyExists) {
            // Check if transaction has ambiguity or needs user confirmation (Requirement 1)
            if (parsed.needsReview || parsed.confidence < 0.85) {
              const inQueue = ambiguityQueue.some(
                (q) => q.amount === parsed.amount && q.date === parsed.date && q.title === parsed.title
              );
              if (!inQueue) {
                newAmbiguous.push(parsed);
              }
            } else {
              candidates.push({
                id: uid('scanned', 10),
                selected: true,
                type: parsed.type,
                amount: parsed.amount,
                title: parsed.title,
                category: parsed.category,
                vendorOrPerson: parsed.vendorOrPerson,
                paymentMode: parsed.paymentMode,
                date: parsed.date,
                time: parsed.time,
                bankOrSource: parsed.bankOrSource,
                evidence: raw.body,
                confidence: parsed.confidence,
              });
            }
          }
        }
      }

      if (newAmbiguous.length > 0) {
        setAmbiguityQueue((prev) => [...prev, ...newAmbiguous]);
      }

      if (candidates.length > 0) {
        setScannedCandidates(candidates);
        setIsScanModalOpen(true);
      }

      return candidates.length + newAmbiguous.length;
    } catch {
      return 0;
    }
  };

  // Continuous Auto-scan: Runs on startup, app resume from background (e.g. after UPI payment), and focus
  useEffect(() => {
    if (isAppLocked || showOnboarding) return;

    const timer = setTimeout(() => {
      handleScanSMS();
    }, 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[App] Resumed to foreground, scanning incoming financial transactions');
        handleScanSMS();
      }
    };

    const onWindowFocus = () => {
      handleScanSMS();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    const interval = setInterval(() => {
      handleScanSMS();
    }, 45000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      clearInterval(interval);
    };
  }, [isAppLocked, showOnboarding, transactions.length]);

  // Synchronize from native Android persistent storage upon app update/launch
  useEffect(() => {
    async function syncFromNativePersistentVault() {
      try {
        const vault = await VaultStorage.loadVault();
        if (vault) {
          const localTxRaw = localStorage.getItem('expense_diary_transactions');
          const localTx: Transaction[] = localTxRaw ? JSON.parse(localTxRaw) : [];
          const isOnboarded = localStorage.getItem('expense_diary_onboarded') === 'true';

          // If local storage was wiped or missing onboarding or empty (typical after APK update)
          if (!isOnboarded || localTx.length === 0) {
            console.log('[App] Auto-restoring from native persistent vault after app update');
            if (vault.transactions && vault.transactions.length > 0) {
              setTransactions(vault.transactions);
            }
            if (vault.diaryEntries) setDiaryEntries(vault.diaryEntries);
            if (vault.borrowedLentRecords) setBorrowedLentRecords(vault.borrowedLentRecords);
            if (vault.categories && vault.categories.length > 0) setCategories(vault.categories);
            if (vault.profile) setProfile(vault.profile);
            if (vault.securityConfig) setSecurityConfig(vault.securityConfig);
            if (vault.savedPassphraseWords) setSavedPassphraseWords(vault.savedPassphraseWords);
            if (vault.lang) setCurrentLang(vault.lang);
            if (vault.theme) setActiveTheme(vault.theme);
            if (vault.font) setActiveFont(vault.font);
            if (vault.currency) setCurrency(vault.currency);

            VaultStorage.syncToLocalStorage(vault);
            setShowOnboarding(false);

            if (vault.securityConfig && vault.securityConfig.hasCompletedSetup) {
              setIsAppLocked(true);
            }
          }
        }
      } catch (err) {
        console.error('[App] Error synchronizing persistent native vault:', err);
      }
    }
    syncFromNativePersistentVault();
  }, []);

  // Persistence Effects: sync both to localStorage and to persistent native Android storage
  useEffect(() => {
    localStorage.setItem('expense_diary_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('expense_diary_entries', JSON.stringify(diaryEntries));
  }, [diaryEntries]);

  useEffect(() => {
    localStorage.setItem('expense_diary_borrow_lent', JSON.stringify(borrowedLentRecords));
  }, [borrowedLentRecords]);

  useEffect(() => {
    localStorage.setItem('expense_diary_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('expense_diary_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('expense_diary_security_config', JSON.stringify(securityConfig));
  }, [securityConfig]);

  useEffect(() => {
    localStorage.setItem('expense_diary_recovery_words', JSON.stringify(savedPassphraseWords));
  }, [savedPassphraseWords]);

  useEffect(() => {
    localStorage.setItem('expense_diary_pending_ai', JSON.stringify(pendingAiMessages));
  }, [pendingAiMessages]);

  useEffect(() => {
    localStorage.setItem('expense_diary_lang', currentLang);
  }, [currentLang]);

  useEffect(() => {
    localStorage.setItem('expense_diary_theme', activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    localStorage.setItem('expense_diary_font', activeFont);
  }, [activeFont]);

  useEffect(() => {
    localStorage.setItem('expense_diary_currency', currency);
  }, [currency]);

  // Unified persistent vault auto-save (Android SharedPreferences + FilesDir)
  useEffect(() => {
    const isOnboarded = localStorage.getItem('expense_diary_onboarded') === 'true' || !showOnboarding;
    if (isOnboarded || transactions.length > 0) {
      VaultStorage.saveVault({
        version: 2,
        updatedAt: new Date().toISOString(),
        transactions,
        diaryEntries,
        borrowedLentRecords,
        categories,
        profile,
        securityConfig,
        savedPassphraseWords,
        lang: currentLang,
        theme: activeTheme,
        font: activeFont,
        currency,
        onboarded: isOnboarded,
      });
    }
  }, [
    transactions,
    diaryEntries,
    borrowedLentRecords,
    categories,
    profile,
    securityConfig,
    savedPassphraseWords,
    currentLang,
    activeTheme,
    activeFont,
    currency,
    showOnboarding,
  ]);

  // Current translation strings
  const t = getTranslation(currentLang);
  const isGu = currentLang === 'gu';

  // Auto-Lock Management (Locks immediately when app goes to background / minimized)
  useEffect(() => {
    let lastHiddenTimestamp = 0;

    const handleVisibilityChange = () => {
      if (!securityConfig.hasCompletedSetup || !securityConfig.pinHash) return;

      if (document.visibilityState === 'hidden') {
        lastHiddenTimestamp = Date.now();
        // If set to 0 or immediately on exit, lock right away
        if ((securityConfig.autoLockMinutes ?? 0) <= 0) {
          setIsAppLocked(true);
        }
      } else if (document.visibilityState === 'visible') {
        const timeoutMinutes = securityConfig.autoLockMinutes ?? 0;
        if (timeoutMinutes <= 0) {
          setIsAppLocked(true);
        } else if (timeoutMinutes > 0 && lastHiddenTimestamp > 0) {
          const elapsedMinutes = (Date.now() - lastHiddenTimestamp) / 60000;
          if (elapsedMinutes >= timeoutMinutes) {
            setIsAppLocked(true);
          }
        }
      }
    };

    const handlePageHide = () => {
      if (!securityConfig.hasCompletedSetup || !securityConfig.pinHash) return;
      if ((securityConfig.autoLockMinutes ?? 0) <= 0) {
        setIsAppLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [securityConfig]);

  // Auto-request native permissions on first launch (SMS + Notifications)
  useEffect(() => {
    const requestNativePermissions = async () => {
      if (!localStorage.getItem('expense_diary_permissions_requested')) {
        try {
          const res = await NativeBridgeService.requestAllNativePermissions();
          if (res && res.sms) {
            localStorage.setItem('expense_diary_sms_granted', 'true');
          }
          localStorage.setItem('expense_diary_permissions_requested', 'true');
        } catch {
          // Web/browser fallback — no-op
        }
      }
    };
    requestNativePermissions();
  }, []);

  // Daily Reminder: Native Alarm Scheduling (AlarmManager) & Foreground Heartbeat
  useEffect(() => {
    if (profile.enableDailyReminder) {
      const [hStr, mStr] = (profile.dailyReminderTime || '20:00').split(':');
      const h = parseInt(hStr, 10) || 20;
      const m = parseInt(mStr, 10) || 0;
      NativeBridgeService.scheduleDailyReminder(h, m, t.reminderTitle, t.reminderBody);
    } else {
      NativeBridgeService.cancelDailyReminder();
    }

    const checkReminder = () => {
      checkAndTriggerDailyReminder(
        profile.enableDailyReminder,
        profile.dailyReminderTime || '20:00',
        { reminderTitle: t.reminderTitle, reminderBody: t.reminderBody },
        transactions
      );
    };

    checkReminder();
    const interval = setInterval(checkReminder, 60000);
    return () => clearInterval(interval);
  }, [profile.enableDailyReminder, profile.dailyReminderTime, t, transactions]);

  // Transaction Handlers
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleOpenAddModal = (type: TransactionType) => {
    setEditingTransaction(null);
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setAddModalType(tx.type);
    setIsAddModalOpen(true);
  };

  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
      const updated: Transaction = {
        ...newTx,
        id: editingTransaction.id,
        updatedAt: new Date().toISOString(),
      };

      // Auto-learn category rule from user edit (ClearSMS Rule Engine pattern)
      const keyword = (newTx.vendorOrPerson || newTx.title || '').trim();
      if (keyword && newTx.category) {
        const learnedRule = CategoryRuleEngine.learnCategoryRule(keyword, newTx.category);
        const { updatedTransactions } = CategoryRuleEngine.recategorizePastTransactions(
          transactions.map((t) => (t.id === editingTransaction.id ? updated : t)),
          learnedRule
        );
        setTransactions(updatedTransactions);
      } else {
        setTransactions((prev) => prev.map((t) => (t.id === editingTransaction.id ? updated : t)));
      }
      setEditingTransaction(null);
    } else {
      const tx: Transaction = {
        ...newTx,
        id: uid('tx', 10),
      };

      const keyword = (newTx.vendorOrPerson || newTx.title || '').trim();
      if (keyword && newTx.category) {
        const learnedRule = CategoryRuleEngine.learnCategoryRule(keyword, newTx.category);
        const { updatedTransactions } = CategoryRuleEngine.recategorizePastTransactions(
          [tx, ...transactions],
          learnedRule
        );
        setTransactions(updatedTransactions);
      } else {
        setTransactions((prev) => [tx, ...prev]);
      }
    }
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Diary Handlers
  const handleSaveDiaryEntry = (entry: DiaryEntry) => {
    setDiaryEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = entry;
        return updated;
      }
      return [entry, ...prev];
    });
  };

  const handleDeleteDiaryEntry = (id: string) => {
    setDiaryEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Borrowed/Lent Handlers
  const handleSaveBorrowLent = (record: BorrowedLentRecord) => {
    setBorrowedLentRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });
  };

  const handleDeleteBorrowLent = (id: string) => {
    setBorrowedLentRecords((prev) => prev.filter((r) => r.id !== id));
  };

  // Pending AI auto-detect Handlers (Accepts message ID or object, with customCategory support)
  const handleConfirmAiMessage = (target: string | PendingAIMessage, customCategory?: string) => {
    const msg = typeof target === 'string' ? pendingAiMessages.find((m) => m.id === target) : target;
    if (!msg) return;

    const finalCategory = customCategory || msg.parsedData.category;
    const newTx: Transaction = {
      id: uid('tx', 10),
      type: msg.parsedData.type,
      amount: msg.parsedData.amount,
      title: msg.parsedData.title,
      category: finalCategory,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      paymentMode: msg.parsedData.paymentMode,
      vendorOrPerson: msg.parsedData.vendorOrPerson,
      notes: msg.parsedData.notes,
      evidence: msg.rawText,
      evidenceSender: msg.sender,
      evidenceSource: 'sms',
      isAiGenerated: true,
    };

    // Auto-learn category rule from user confirmation (ClearSMS Rule Engine pattern)
    const keyword = (msg.parsedData.vendorOrPerson || msg.parsedData.title || '').trim();
    if (keyword && finalCategory) {
      const learnedRule = CategoryRuleEngine.learnCategoryRule(keyword, finalCategory, { sender: msg.sender });
      const { updatedTransactions } = CategoryRuleEngine.recategorizePastTransactions(
        [newTx, ...transactions],
        learnedRule
      );
      setTransactions(updatedTransactions);
    } else {
      setTransactions((prev) => [newTx, ...prev]);
    }

    setPendingAiMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const handleDismissAiMessage = (id: string) => {
    setPendingAiMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddPendingAiMessage = (msg: PendingAIMessage) => {
    setPendingAiMessages((prev) => [msg, ...prev]);
  };

  // Category & Profile Handlers
  const handleAddCategory = (cat: Category) => {
    setCategories((prev) => [...prev, cat]);
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  const handleUpdateSecurityConfig = (updated: Partial<SecurityConfig>) => {
    setSecurityConfig((prev) => ({ ...prev, ...updated }));
  };

  const handleRestoreTransactions = (txs: Transaction[]) => {
    setTransactions(txs);
  };

  const handleRestoreDiaryEntries = (entries: DiaryEntry[]) => {
    setDiaryEntries(entries);
  };

  const handleRestoreBorrowedLentRecords = (records: BorrowedLentRecord[]) => {
    setBorrowedLentRecords(records);
  };

  // Reset PIN with Passphrase
  const handleResetPinWithPassphrase = async (newPin: string) => {
    const { hash: pinHash, salt: pinSalt } = await hashWithPBKDF2(newPin);
    setSecurityConfig((prev) => ({
      ...prev,
      pinHash,
      pinSalt,
    }));
  };

  // Onboarding Complete (Supports direct data restoration from native vault or backup file)
  const handleOnboardingComplete = (data: {
    name: string;
    currency: string;
    budget: number;
    securityConfig: SecurityConfig;
    passphraseWords: string[];
    dailyReminderTime: string;
    enableDailyReminder: boolean;
    restoredData?: {
      transactions?: Transaction[];
      diaryEntries?: DiaryEntry[];
      borrowedLentRecords?: BorrowedLentRecord[];
      categories?: Category[];
    };
  }) => {
    const updatedProfile = {
      ...profile,
      name: data.name,
      monthlyBudget: data.budget,
      currency: data.currency,
      dailyReminderTime: data.dailyReminderTime,
      enableDailyReminder: data.enableDailyReminder,
    };

    setProfile(updatedProfile);
    setCurrency(data.currency);
    setSecurityConfig(data.securityConfig);
    setSavedPassphraseWords(data.passphraseWords);
    setIsAppLocked(false);
    localStorage.setItem('expense_diary_onboarded', 'true');

    let finalTransactions = transactions;
    let finalDiary = diaryEntries;
    let finalBL = borrowedLentRecords;
    let finalCategories = categories;

    if (data.restoredData) {
      if (data.restoredData.transactions && data.restoredData.transactions.length > 0) {
        finalTransactions = data.restoredData.transactions;
        setTransactions(finalTransactions);
      }
      if (data.restoredData.diaryEntries) {
        finalDiary = data.restoredData.diaryEntries;
        setDiaryEntries(finalDiary);
      }
      if (data.restoredData.borrowedLentRecords) {
        finalBL = data.restoredData.borrowedLentRecords;
        setBorrowedLentRecords(finalBL);
      }
      if (data.restoredData.categories && data.restoredData.categories.length > 0) {
        finalCategories = data.restoredData.categories;
        setCategories(finalCategories);
      }
    }

    setShowOnboarding(false);

    // Save full vault immediately to both localStorage and Android SharedPreferences / FilesDir
    VaultStorage.saveVaultImmediate({
      version: 2,
      updatedAt: new Date().toISOString(),
      transactions: finalTransactions,
      diaryEntries: finalDiary,
      borrowedLentRecords: finalBL,
      categories: finalCategories,
      profile: updatedProfile,
      securityConfig: data.securityConfig,
      savedPassphraseWords: data.passphraseWords,
      lang: currentLang,
      theme: activeTheme,
      font: activeFont,
      currency: data.currency,
      onboarded: true,
    });
  };

  // Font class resolver
  const getFontFamilyClass = () => {
    switch (activeFont) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      case 'sans':
      default:
        return 'font-sans';
    }
  };

  // App Theme background
  const getThemeBackground = () => {
    switch (activeTheme) {
      case 'mint':
        return 'bg-[#EBFBEE]';
      case 'lavender':
        return 'bg-[#FAF7FD]';
      case 'light':
        return 'bg-white';
      case 'cream':
      default:
        return 'bg-[#F9FBFC]';
    }
  };

  return (
    <div
      id="app-root-container"
      className={`min-h-screen ${getThemeBackground()} ${getFontFamilyClass()} text-stone-800 transition-colors duration-200 flex flex-col`}
    >
      {/* 1. App Lock Screen (Full Screen PIN Overlay) */}
      {isAppLocked && securityConfig.hasCompletedSetup && securityConfig.pinHash && (
        <AuthLockScreen
          securityConfig={securityConfig}
          onUnlock={() => setIsAppLocked(false)}
          onResetPinWithPassphrase={handleResetPinWithPassphrase}
          currentLang={currentLang}
          t={t}
        />
      )}

      {/* 2. Onboarding Modal for First Time Users */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          currentLang={currentLang}
          onSelectLanguage={setCurrentLang}
          t={t}
        />
      )}

      {/* Top Header Bar */}
      <header
        id="app-top-header"
        className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-md transition-all pt-[env(safe-area-inset-top,0px)]"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div
            className="flex flex-col cursor-pointer select-none"
            onClick={() => setCurrentTab('home')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <h2 className="text-xs sm:text-sm font-bold text-stone-800 tracking-tight truncate max-w-[180px] sm:max-w-xs">
                {profile.name
                  ? (isGu ? `નમસ્તે, ${profile.name}` : `Hello, ${profile.name}`)
                  : t.appName}
              </h2>
            </div>
            <p className="text-[11px] text-stone-400 font-medium mt-0.5">
              {new Date().toLocaleDateString(currentLang === 'gu' ? 'gu-IN' : 'en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Lock Button */}
            {securityConfig.hasCompletedSetup && securityConfig.pinHash && (
              <button
                onClick={() => setIsAppLocked(true)}
                className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                title={isGu ? 'લૉક કરો' : 'Lock App'}
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

            {/* Language Selector */}
            <div className="relative flex items-center bg-white border border-stone-200 hover:border-stone-300 rounded-full px-2.5 py-1 text-xs shadow-xs transition cursor-pointer">
              <Globe className="w-3.5 h-3.5 text-stone-400 pointer-events-none mr-1" />
              <select
                id="header-language-select"
                value={currentLang}
                onChange={(e) => setCurrentLang(e.target.value)}
                className="text-xs font-semibold bg-transparent text-stone-700 outline-none cursor-pointer pr-1 uppercase"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.code.toUpperCase()} ({l.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Avatar */}
            <button
              id="header-profile-avatar-btn"
              onClick={() => setCurrentTab('profile')}
              title={profile.name || t.profile}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-100 border border-stone-200 shadow-xs overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center shrink-0"
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold uppercase">
                  {profile.name ? profile.name.charAt(0) : 'E'}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="app-main-content" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-4 sm:pt-6">
        {currentTab === 'home' && (
          <HomeScreen
            transactions={transactions}
            onOpenAddModal={handleOpenAddModal}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            pendingAiMessages={pendingAiMessages}
            onConfirmAiMessage={handleConfirmAiMessage}
            onDismissAiMessage={handleDismissAiMessage}
            categories={categories}
            t={t}
            currency={currency}
            currentLang={currentLang}
            profile={profile}
            onTriggerScan={handleScanSMS}
            onOpenEmailSync={() => setIsEmailSyncModalOpen(true)}
          />
        )}

        {currentTab === 'diary' && (
          <DiaryScreen
            entries={diaryEntries}
            onSaveEntry={handleSaveDiaryEntry}
            onDeleteEntry={handleDeleteDiaryEntry}
            borrowedLentRecords={borrowedLentRecords}
            onSaveBorrowLent={handleSaveBorrowLent}
            onDeleteBorrowLent={handleDeleteBorrowLent}
            securityConfig={securityConfig}
            onUpdateSecurityConfig={handleUpdateSecurityConfig}
            transactions={transactions}
            currentLang={currentLang}
            t={t}
            currency={currency}
          />
        )}

        {currentTab === 'report' && (
          <ReportScreen
            transactions={transactions}
            categories={categories}
            t={t}
            currency={currency}
            currentLang={currentLang}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileScreen
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            transactions={transactions}
            t={t}
            currency={currency}
            currentLang={currentLang}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsScreen
            currentLang={currentLang}
            onSelectLanguage={setCurrentLang}
            categories={categories}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            activeTheme={activeTheme}
            onSelectTheme={setActiveTheme}
            activeFont={activeFont}
            onSelectFont={setActiveFont}
            t={t}
            currency={currency}
            onSelectCurrency={setCurrency}
            transactions={transactions}
            onRestoreTransactions={handleRestoreTransactions}
            diaryEntries={diaryEntries}
            onRestoreDiaryEntries={handleRestoreDiaryEntries}
            borrowedLentRecords={borrowedLentRecords}
            onRestoreBorrowedLentRecords={handleRestoreBorrowedLentRecords}
            securityConfig={securityConfig}
            onUpdateSecurityConfig={handleUpdateSecurityConfig}
            savedPassphraseWords={savedPassphraseWords}
            onOpenSMSModal={() => setIsSmsModalOpen(true)}
            onOpenEmailSync={() => setIsEmailSyncModalOpen(true)}
          />
        )}
      </main>


      {/* Floating AI FAB removed per §9 — AI processing is background-only */}

      {/* Bottom Floating 5-Tab Navigation */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        t={t}
      />

      {/* Transaction Modal (Add Income / Expense) */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleAddTransaction}
        type={addModalType}
        categories={categories}
        t={t}
        currency={currency}
        currentLang={currentLang}
        initialData={editingTransaction || undefined}
      />

      {/* Assistant Modal */}
      <AIAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        transactions={transactions}
        categories={categories}
        onAddTransaction={handleAddTransaction}
        onAddPendingAiMessage={handleAddPendingAiMessage}
        currency={currency}
        currentLang={currentLang}
        t={t}
      />

      {/* Android SMS Permission Modal */}
      <AndroidSMSPermissionModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        onGrantPermission={async () => {
          await NativeBridgeService.requestSMSPermissions();
          localStorage.setItem('expense_diary_sms_granted', 'true');
        }}
        currentLang={currentLang}
        t={t}
      />

      {/* Smart Financial Transaction Scan Modal (Task 2 & 17) */}
      <SmartTransactionScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        candidates={scannedCandidates}
        categories={categories}
        currency={currency}
        currentLang={currentLang}
        t={t}
        onConfirmImport={(approved) => {
          setTransactions((prev) => [...approved, ...prev]);
        }}
      />

      {/* Queued Fullscreen Pop-up for Ambiguous / Confused Transactions (Requirement 1 & 2) */}
      {ambiguityQueue.length > 0 && ambiguityIndex < ambiguityQueue.length && (
        <TransactionAmbiguityModal
          queue={ambiguityQueue}
          currentIndex={ambiguityIndex}
          categories={categories}
          currency={currency}
          currentLang={currentLang}
          onConfirm={(confirmed) => {
            const newTx: Transaction = {
              id: uid('tx-ambig', 12),
              type: confirmed.type,
              amount: confirmed.amount,
              title: confirmed.title,
              category: confirmed.category,
              vendorOrPerson: confirmed.vendorOrPerson,
              paymentMode: confirmed.paymentMode,
              date: confirmed.date,
              time: confirmed.time,
              evidence: confirmed.evidence,
              evidenceSource: confirmed.evidenceSource,
              referenceNumber: confirmed.referenceNumber,
              isAiGenerated: true,
              needsConfirmation: false,
            };
            setTransactions((prev) => [newTx, ...prev]);
            setAmbiguityIndex((prev) => prev + 1);
          }}
          onSkip={() => {
            setAmbiguityIndex((prev) => prev + 1);
          }}
          onDismissQueue={() => {
            setAmbiguityQueue([]);
            setAmbiguityIndex(0);
          }}
        />
      )}

      {/* Financial Email Sync Modal (Gmail OAuth & Local .EML / Statement Importer) */}
      <FinancialEmailSyncModal
        isOpen={isEmailSyncModalOpen}
        onClose={() => setIsEmailSyncModalOpen(false)}
        existingTransactions={transactions}
        onImportTransactions={(imported) => {
          setTransactions((prev) => [...imported, ...prev]);
        }}
        currency={currency}
        isGu={currentLang === 'gu'}
      />
    </div>
  );
}
