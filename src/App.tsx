import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Sparkles, 
  DownloadCloud, 
  Globe, 
  Wallet,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Transaction, TransactionType, Category, UserProfile, PendingAIMessage } from './types';
import { TRANSLATIONS, getTranslation, LANGUAGES } from './data/languages';
import { DEFAULT_CATEGORIES, INITIAL_TRANSACTIONS, INITIAL_USER_PROFILE } from './data/initialData';
import { HomeScreen } from './components/HomeScreen';
import { ReportScreen } from './components/ReportScreen';
import { AIBrainScreen } from './components/AIBrainScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AboutScreen } from './components/AboutScreen';
import { Navigation, NavTab } from './components/Navigation';
import { TransactionModal } from './components/TransactionModal';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  // PWA hook
  const { isInstallable, install } = usePWAInstall();

  // Persistent Language State
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('expense_diary_lang') || 'gu';
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

  // Active Tab
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Transactions State
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

  // Pending AI auto-detected notifications (shows in Home and AI screens)
  const [pendingAiMessages, setPendingAiMessages] = useState<PendingAIMessage[]>([
    {
      id: 'ai-initial-demo',
      rawText: 'Dear User, your A/c debited by Rs. 380.00 on 03-Sep-2026 transfer to Swiggy India UPI ref 92837194. Avl Bal: Rs 42,100.00.',
      parsedData: {
        type: 'expense',
        amount: 380,
        title: 'Swiggy Food Delivery',
        category: 'Food & Dining',
        vendorOrPerson: 'Swiggy',
        paymentMode: 'UPI',
        notes: 'Ref: 92837194',
        confirmationQuestion:
          'AI દ્વારા UPI SMS ડિટેક્ટ થયો છે: શું Swiggy નો ₹380 ખર્ચ સાચો છે? તેને "Food & Dining" કેટેગરીમાં ઉમેરું?',
      },
      detectedAt: new Date().toISOString(),
    },
  ]);

  // Modal State
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

  // Handlers
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
        notes: msg.parsedData.notes || 'AI આપમેળે શોધાયેલ વ્યવહાર',
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

  const handleResetSampleData = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setCategories(DEFAULT_CATEGORIES);
    setProfile(INITIAL_USER_PROFILE);
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
      className={`min-h-screen ${getThemeBackground()} ${getFontFamilyClass()} text-[#2D3436] transition-colors duration-200`}
    >
      {/* Top Header Bar with Bold Typography theme layout */}
      <header
        id="app-top-header"
        className="sticky top-0 z-30 border-b border-[#E1E8ED] bg-[#F9FBFC]/90 backdrop-blur-md transition-all"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          {/* Greeting & Date / App identity */}
          <div
            className="flex flex-col cursor-pointer select-none"
            onClick={() => setCurrentTab('home')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6C5CE7]" />
              <h2 className="text-xs sm:text-sm uppercase tracking-widest text-[#636E72] font-semibold truncate">
                {profile.name ? `નમસ્તે, ${profile.name}` : `નમસ્તે, ${t.appName}`}
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-[#B2BEC3] font-medium mt-0.5">
              {new Date().toLocaleDateString(currentLang === 'gu' ? 'gu-IN' : 'en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Header Controls: Quick Language Switch, Install & User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {isInstallable && (
              <button
                id="header-pwa-install-btn"
                onClick={install}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#2D6A4F] hover:bg-[#EBFBEE] border border-[#D1F7D9] text-xs font-semibold shadow-xs transition cursor-pointer"
                title="ડિવાઇસ પર એપ ઇન્સ્ટોલ કરો"
              >
                <DownloadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">ઇન્સ્ટોલ</span>
              </button>
            )}

            {/* Quick Language Selector matching Bold Typography pill */}
            <div className="relative flex items-center bg-white border border-[#E1E8ED] hover:border-[#B2BEC3] rounded-full px-3 py-1.5 shadow-xs transition cursor-pointer">
              <Globe className="w-3.5 h-3.5 text-[#636E72] pointer-events-none mr-1.5" />
              <select
                id="header-language-select"
                value={currentLang}
                onChange={(e) => setCurrentLang(e.target.value)}
                className="text-xs font-medium bg-transparent text-[#2D3436] outline-none cursor-pointer pr-1"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.code.toUpperCase()} ({l.nativeName})
                  </option>
                ))}
              </select>
            </div>

            {/* User Avatar Circle from Bold Typography theme */}
            <button
              id="header-profile-avatar-btn"
              onClick={() => setCurrentTab('profile')}
              title={profile.name || t.profile}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#DFE6E9] border-2 border-white shadow-xs overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center shrink-0"
            >
              <div className="w-full h-full bg-gradient-to-br from-[#A29BFE] to-[#6C5CE7] flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
                {profile.name ? profile.name.charAt(0) : 'E'}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="app-main-content" className="max-w-4xl mx-auto px-4 sm:px-6 pt-5">
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
          />
        )}

        {currentTab === 'ai' && (
          <AIBrainScreen
            transactions={transactions}
            categories={categories}
            onAddTransaction={handleAddTransaction}
            pendingAiMessages={pendingAiMessages}
            onAddPendingAiMessage={handleAddPendingAiMessage}
            onConfirmAiMessage={handleConfirmAiMessage}
            t={t}
            currency={currency}
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
          />
        )}

        {currentTab === 'profile' && (
          <ProfileScreen
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            transactions={transactions}
            onRestoreTransactions={handleRestoreTransactions}
            onResetSampleData={handleResetSampleData}
            t={t}
            currency={currency}
          />
        )}

        {currentTab === 'about' && <AboutScreen t={t} />}
      </main>

      {/* Floating Bottom Navigation Bar: 'home' 'report' 'ai' 'setting' 'પ્રોફાઈલ' 'about' */}
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        t={t}
        pendingAiCount={pendingAiMessages.length}
      />

      {/* Add Transaction Modal ('આવક ઉમેરો' / 'ખર્ચ ઉમેરો') */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddTransaction}
        type={addModalType}
        categories={categories}
        t={t}
        currency={currency}
      />
    </div>
  );
}
