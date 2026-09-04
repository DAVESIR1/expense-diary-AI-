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
import { AuthLockScreen } from './components/AuthLockScreen';
import { checkAndTriggerDailyReminder } from './services/notifications';
import { hashWithPBKDF2 } from './services/security';
import { MigrationManager } from './services/dataMigration';
import { NativeBridgeService } from './services/nativeBridge';

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
      autoLockMinutes: 5,
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

  // Persistence Effects
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

  // Current translation strings
  const t = getTranslation(currentLang);
  const isGu = currentLang === 'gu';

  // Auto-Lock Management
  useEffect(() => {
    let lastHiddenTimestamp = 0;

    const handleVisibilityChange = () => {
      if (!securityConfig.hasCompletedSetup || !securityConfig.pinHash) return;

      if (document.visibilityState === 'hidden') {
        lastHiddenTimestamp = Date.now();
      } else if (document.visibilityState === 'visible') {
        const timeoutMinutes = securityConfig.autoLockMinutes;
        if (timeoutMinutes === 0) {
          setIsAppLocked(true);
        } else if (timeoutMinutes > 0 && lastHiddenTimestamp > 0) {
          const elapsedMinutes = (Date.now() - lastHiddenTimestamp) / 60000;
          if (elapsedMinutes >= timeoutMinutes) {
            setIsAppLocked(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [securityConfig]);

  // Auto-request native permissions on first launch (§7)
  useEffect(() => {
    const requestNativePermissions = async () => {
      if (!localStorage.getItem('expense_diary_permissions_requested')) {
        try {
          await NativeBridgeService.requestNotificationPermissions();
          localStorage.setItem('expense_diary_permissions_requested', 'true');
        } catch {
          // Web/browser fallback — no-op
        }
      }
    };
    requestNativePermissions();
  }, []);

  // Daily Reminder Interval with smart duplicate suppression (§11)
  useEffect(() => {
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
  const handleOpenAddModal = (type: TransactionType) => {
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const tx: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    };
    setTransactions((prev) => [tx, ...prev]);
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

  // Pending AI auto-detect Handlers
  const handleConfirmAiMessage = (msg: PendingAIMessage) => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: msg.parsedData.type,
      amount: msg.parsedData.amount,
      title: msg.parsedData.title,
      category: msg.parsedData.category,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      paymentMode: msg.parsedData.paymentMode,
      vendorOrPerson: msg.parsedData.vendorOrPerson,
      notes: msg.parsedData.notes,
      evidence: msg.rawText,
      evidenceSource: 'sms',
      isAiGenerated: true,
    };
    setTransactions((prev) => [newTx, ...prev]);
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

  // Onboarding Complete
  const handleOnboardingComplete = (data: {
    name: string;
    currency: string;
    budget: number;
    securityConfig: SecurityConfig;
    passphraseWords: string[];
    dailyReminderTime: string;
    enableDailyReminder: boolean;
  }) => {
    setProfile((prev) => ({
      ...prev,
      name: data.name,
      monthlyBudget: data.budget,
      currency: data.currency,
      dailyReminderTime: data.dailyReminderTime,
      enableDailyReminder: data.enableDailyReminder,
    }));
    setCurrency(data.currency);
    setSecurityConfig(data.securityConfig);
    setSavedPassphraseWords(data.passphraseWords);
    setIsAppLocked(false);
    localStorage.setItem('expense_diary_onboarded', 'true');
    setShowOnboarding(false);
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

            {/* Smart Assistant Trigger */}
            <button
              id="header-ai-assistant-btn"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition cursor-pointer"
              title={t.aiAssistant}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.aiAssistant}</span>
            </button>

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
            pendingAiMessages={pendingAiMessages}
            onConfirmAiMessage={handleConfirmAiMessage}
            onDismissAiMessage={handleDismissAiMessage}
            categories={categories}
            t={t}
            currency={currency}
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
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddTransaction}
        type={addModalType}
        categories={categories}
        t={t}
        currency={currency}
        currentLang={currentLang}
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
    </div>
  );
}
