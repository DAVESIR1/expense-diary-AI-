import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { LANGUAGES, TranslationStrings } from '../data/languages';
import { Category, Transaction, UserProfile } from '../types';
import { SAMPLE_TRANSACTIONS } from '../data/initialData';
import { usePWAInstall } from '../hooks/usePWAInstall';

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
  onOpenSMSModal,
}) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [langSearch, setLangSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const isGu = currentLang === 'gu';

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

  const showNotice = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profile,
      categories,
      transactions,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-diary-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(isGu ? 'બેકઅપ ફાઇલ ડાઉનલોડ થઈ ગઈ છે.' : 'Backup JSON exported successfully.');
  };

  // Import JSON Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data.transactions)) {
          onRestoreTransactions(data.transactions);
          if (data.profile) onUpdateProfile(data.profile);
          showNotice(isGu ? 'ડેટા સફળતાપૂર્વક રીસ્ટોર થયો!' : 'Data restored successfully!');
        } else {
          alert(isGu ? 'અમાન્ય બેકઅપ ફાઈલ.' : 'Invalid backup file format.');
        }
      } catch (err) {
        alert(isGu ? 'બેકઅપ વાંચવામાં ક્ષતિ થઈ.' : 'Error reading backup file.');
      }
    };
    reader.readAsText(file);
  };

  // Load sample data for testing
  const handleLoadSampleData = () => {
    if (confirm(isGu ? 'શું તમે ટેસ્ટિંગ માટે સેમ્પલ ડેટા લોડ કરવા માંગો છો?' : 'Load sample data for testing?')) {
      onRestoreTransactions(SAMPLE_TRANSACTIONS);
      showNotice(isGu ? 'સેમ્પલ ડેટા લોડ થઈ ગયો છે.' : 'Sample data loaded.');
    }
  };

  // Clear all data
  const handleClearAllData = () => {
    if (confirm(isGu ? 'ચેતવણી: શું તમે તમામ વ્યવહારો કાઢી નાખવા માંગો છો?' : 'Warning: Clear all recorded transactions?')) {
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
            ? 'ભાષા, થીમ, ફોન્ટ, કેટેગરીઝ અને ડેટા સેટિંગ્સ'
            : 'Language, themes, fonts, categories, and data settings'}
        </p>
      </div>

      {/* 1. Language Selection (20 World Languages) */}
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

        {/* Search languages */}
        <input
          type="text"
          placeholder={isGu ? 'ભાષા શોધો...' : 'Search languages...'}
          value={langSearch}
          onChange={(e) => setLangSearch(e.target.value)}
          className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
        />

        {/* Languages grid */}
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

      {/* 2. Currency Selector */}
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
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-center cursor-pointer ${
                currency === c.symbol
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Theme & Typography */}
      <div
        id="theme-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Palette className="w-4 h-4 text-stone-500 stroke-[2]" />
            <h3 className="text-sm font-bold text-stone-800 tracking-tight">{t.themeSelect}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'cream', name: isGu ? 'સોફ્ટ ક્રીમ' : 'Soft Cream', bg: 'bg-[#F9FBFC]' },
              { id: 'mint', name: isGu ? 'સોફ્ટ મિન્ટ' : 'Soft Mint', bg: 'bg-[#EBFBEE]' },
              { id: 'lavender', name: isGu ? 'સોફ્ટ લવંડર' : 'Soft Lavender', bg: 'bg-[#FAF7FD]' },
              { id: 'light', name: isGu ? 'ક્લીન વ્હાઇટ' : 'Clean White', bg: 'bg-white' },
            ].map((theme) => (
              <button
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                className={`p-2.5 rounded-xl border text-xs text-center transition cursor-pointer font-medium ${
                  activeTheme === theme.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {theme.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-stone-100">
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
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Custom Category Manager */}
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

        {/* Add category form */}
        <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={isGu ? 'નવી કેટેગરીનું નામ...' : 'New category name...'}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-200 outline-none focus:border-indigo-500"
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
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-800 hover:bg-stone-900 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isGu ? 'ઉમેરો' : 'Add'}</span>
          </button>
        </form>

        {/* Category chips */}
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

      {/* 5. Data Management (Backup, Restore, Sample Data, Clear) */}
      <div
        id="data-settings-card"
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-stone-500 stroke-[2]" />
          <h3 className="text-sm font-bold text-stone-800 tracking-tight">
            {isGu ? 'ડેટા અને બેકઅપ (Data & Storage)' : 'Data & Backup Management'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Export JSON */}
          <button
            onClick={handleExportBackup}
            className="p-3 rounded-2xl border border-stone-200 hover:bg-stone-50 transition text-xs font-semibold text-stone-700 flex items-center gap-2 cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4 text-stone-500" />
            <span>{isGu ? 'બેકઅપ ફાઈલ એક્સપોર્ટ (JSON)' : 'Export Backup (JSON)'}</span>
          </button>

          {/* Import JSON */}
          <label className="p-3 rounded-2xl border border-stone-200 hover:bg-stone-50 transition text-xs font-semibold text-stone-700 flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4 text-stone-500" />
            <span>{isGu ? 'બેકઅપ ફાઈલ રીસ્ટોર (JSON)' : 'Restore Backup (JSON)'}</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          {/* Load Sample Data */}
          <button
            onClick={handleLoadSampleData}
            className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition text-xs font-semibold text-indigo-700 flex items-center gap-2 cursor-pointer"
          >
            <Database className="w-4 h-4 text-indigo-600" />
            <span>{isGu ? 'ટેસ્ટિંગ માટે સેમ્પલ ડેટા લોડ કરો' : 'Load Sample Test Data'}</span>
          </button>

          {/* Clear All Transactions */}
          <button
            onClick={handleClearAllData}
            className="p-3 rounded-2xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition text-xs font-semibold text-rose-700 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>{isGu ? 'તમામ વ્યવહારો સાફ કરો' : 'Clear All Transactions'}</span>
          </button>
        </div>
      </div>

      {/* 6. Android SMS Permissions Manager */}
      <div
        id="sms-permission-card"
        className="p-5 sm:p-6 rounded-3xl bg-indigo-50/70 border border-indigo-200 shadow-xs flex items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs sm:text-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>{isGu ? 'Android SMS ઑટો-ડિટેક્શન પરમિશન' : 'Android SMS Auto-Detection Permission'}</span>
          </div>
          <p className="text-xs text-indigo-800/80">
            {isGu
              ? 'SMS વાંચવાની પરમિશન આપવાથી ખર્ચ આપમેળે નોંધી શકાય છે.'
              : 'Enable SMS permissions for hands-free automatic transaction logging.'}
          </p>
        </div>
        <button
          onClick={onOpenSMSModal}
          className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
        >
          {isGu ? 'તપાસો / મેનેજ કરો' : 'View / Manage'}
        </button>
      </div>

      {/* 7. Multi-OS PWA Install */}
      {isInstallable && (
        <div
          id="multi-os-install-card"
          className="p-5 sm:p-6 rounded-3xl bg-stone-900 text-white shadow-sm flex items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold">{t.installApp}</h3>
            </div>
            <p className="text-xs text-stone-400">
              {isGu
                ? 'Android, Linux, Windows 10/11 અને વેબ માટે ઉપલબ્ધ.'
                : 'Install as native standalone app on Android, Windows, and Linux.'}
            </p>
          </div>
          <button
            onClick={install}
            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs transition cursor-pointer"
          >
            {t.installApp}
          </button>
        </div>
      )}
    </div>
  );
};
