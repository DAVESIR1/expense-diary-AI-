import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  DownloadCloud, 
  Globe, 
  User
} from 'lucide-react';
import { Transaction, TransactionType, Category, UserProfile, PendingAIMessage } from './types';
import { getTranslation, LANGUAGES } from './data/languages';
import { DEFAULT_CATEGORIES, INITIAL_TRANSACTIONS, INITIAL_USER_PROFILE } from './data/initialData';
import { HomeScreen } from './components/HomeScreen';
import { ReportScreen } from './components/ReportScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AboutScreen } from './components/AboutScreen';
import { Navigation, NavTab } from './components/Navigation';
import { TransactionModal } from './components/TransactionModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AndroidSMSPermissionModal } from './components/AndroidSMSPermissionModal';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  const { isInstallable, install } = usePWAInstall();

  // Persistent Language State - English is the default
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

  // Active Navigation Tab
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Onboarding Modal state for first-run
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem('expense_diary_onboarded');
  });

  // Android SMS Permission modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // AI Assistant drawer / modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Clean initial transactions (starts empty, user-driven)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('expense_diary_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_TRANSACTIONS;
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  // Categories State
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('expense_diary_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
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
      } catch (e) {
        return INITIAL_USER_PROFILE;
      }
    }
    return INITIAL_USER_PROFILE;
  });

  // Pending AI auto-detected notifications (starts empty, no fake mock Swiggy alert)
  const [pendingAiMessages, setPendingAiMessages] = useState<PendingAIMessage[]>(() => {
    const saved = localStorage.getItem('expense_diary_pending_ai');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Modal State for adding transactions
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<TransactionType>('expense');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('expense_diary_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('expense_diary_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('expense_diary_profile', JSON.stringify(profile));
  }, [profile]);

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

  // Transaction handlers
  const handleOpenAddModal = (type: TransactionType) => {
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleAddTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}`,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // AI confirmation handlers
  const handleConfirmAiMessage = (messageId: string, customCategory?: string) => {
    const msg = pendingAiMessages.find((m) => m.id === messageId);
    if (msg) {
      const newTx: Transaction = {
        id: `tx-ai-${Date.now()}`,
        type: msg.parsedData.type,
        amount: msg.parsedData.amount,
        title: msg.parsedData.title,
        category: customCategory || msg.parsedData.category,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        vendorOrPerson: msg.parsedData.vendorOrPerson,
        paymentMode: msg.parsedData.paymentMode || 'UPI',
        notes: msg.parsedData.notes || (isGu ? 'AI આપમેળે શોધાયેલ વ્યવહાર' : 'Auto-detected by AI'),
        isAiGenerated: true,
      };
      setTransactions((prev) => [newTx, ...prev]);
      setPendingAiMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  const handleDismissAiMessage = (messageId: string) => {
    setPendingAiMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleAddPendingAiMessage = (msg: PendingAIMessage) => {
    setPendingAiMessages((prev) => [msg, ...prev]);
  };

  // Categories & Profile handlers
  const handleAddCategory = (newCat: Category) => {
    setCategories((prev) => [...prev, newCat]);
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  const handleRestoreTransactions = (txs: Transaction[]) => {
    setTransactions(txs);
  };

  // Onboarding completion
  const handleOnboardingComplete = (name: string, selectedCurrency: string, budget: number) => {
    setProfile((prev) => ({
      ...prev,
      name,
      monthlyBudget: budget,
      currency: selectedCurrency,
    }));
    setCurrency(selectedCurrency);
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

  // App Theme class resolver
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
      {/* Onboarding Modal for First Time Users */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          currentLang={currentLang}
          onSelectLanguage={setCurrentLang}
          t={t}
        />
      )}

      {/* Top Header Bar with Safe-Area Inset Support */}
      <header
        id="app-top-header"
        className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-md transition-all pt-[env(safe-area-inset-top,0px)]"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Greeting & Date */}
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

          {/* Header Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* AI Assistant Quick Trigger Pill */}
            <button
              id="header-ai-assistant-btn"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition cursor-pointer"
              title="AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            {/* Quick Language Selector */}
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

        {currentTab === 'report' && (
          <ReportScreen
            transactions={transactions}
            categories={categories}
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
            onOpenSMSModal={() => setIsSmsModalOpen(true)}
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

        {currentTab === 'about' && (
          <AboutScreen
            t={t}
            currentLang={currentLang}
          />
        )}
      </main>

      {/* Floating AI Assistant FAB Button (Accessible from any screen) */}
      <button
        id="ai-assistant-floating-btn"
        onClick={() => setIsAiModalOpen(true)}
        className="fixed right-4 bottom-20 sm:bottom-24 z-30 p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
        title="Open AI Assistant"
      >
        <Sparkles className="w-5 h-5" />
      </button>

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

      {/* AI Assistant Modal */}
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
        onGrantPermission={() => {
          // Trigger native Android SMS permission or local storage marker
          localStorage.setItem('expense_diary_sms_granted', 'true');
        }}
        currentLang={currentLang}
        t={t}
      />
    </div>
  );
}
