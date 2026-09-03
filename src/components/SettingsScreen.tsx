import React, { useState } from 'react';
import { 
  Globe, 
  Palette, 
  Type, 
  Clock, 
  FolderPlus, 
  DownloadCloud, 
  Laptop, 
  Smartphone, 
  Check, 
  Trash2, 
  Plus,
  Coins
} from 'lucide-react';
import { LANGUAGES, LanguageInfo, TranslationStrings } from '../data/languages';
import { Category, UserProfile } from '../types';
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
}) => {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [langSearch, setLangSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  const filteredLanguages = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(langSearch.toLowerCase())
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
  };

  return (
    <div id="settings-screen-container" className="space-y-6 pb-28">
      {/* Title */}
      <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-stone-900">
          એપ સેટિંગ્સ (Settings & Configurations)
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          ભાષા, થીમ, ફોન્ટ, કેટેગરીઝ અને મલ્ટી-OS ઇન્સ્ટોલેશન પસંદગીઓ
        </p>
      </div>

      {/* 1. Language Library (20 World Languages) */}
      <div
        id="language-settings-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">
              ભાષા પુસ્તકાલય (20 World Languages)
            </h3>
          </div>
          <span className="text-xs text-stone-400">
            વર્તમાન: <strong className="text-stone-700">{LANGUAGES.find((l) => l.code === currentLang)?.nativeName}</strong>
          </span>
        </div>

        <p className="text-xs text-stone-500">
          વિશ્વની સૌથી વધુ બોલાતી 20 મુખ્ય ભાષાઓનો સમાવેશ. પસંદ કરતાંની સાથે જ સંપૂર્ણ એપનું લખાણ બદલાઈ જશે:
        </p>

        <input
          type="text"
          placeholder="ભાષા શોધો (Search language)..."
          value={langSearch}
          onChange={(e) => setLangSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 outline-none"
        />

        {/* 20 languages grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
          {filteredLanguages.map((lang) => {
            const isSel = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                id={`lang-btn-${lang.code}`}
                onClick={() => onSelectLanguage(lang.code)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition ${
                  isSel
                    ? 'bg-stone-900 text-white border-stone-900 font-medium'
                    : 'bg-stone-50/70 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">{lang.flag}</span>
                  <div className="truncate">
                    <div className="font-semibold truncate">{lang.nativeName}</div>
                    <div className={`text-[10px] ${isSel ? 'text-stone-300' : 'text-stone-400'}`}>
                      {lang.name}
                    </div>
                  </div>
                </div>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Theme & Visual Appearance */}
      <div
        id="theme-settings-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-stone-500 stroke-[1.75]" />
          <h3 className="text-sm font-semibold text-stone-900">
            કલર થીમ (હળવા અને શાંત રંગો)
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { id: 'light', name: 'સોફ્ટ વ્હાઇટ (Default)', preview: 'bg-[#fafaf9] border-stone-300' },
            { id: 'cream', name: 'ક્રીમ પેપર (Warm)', preview: 'bg-[#fcfbf9] border-amber-200' },
            { id: 'mint', name: 'આછો મિન્ટ (Fresh)', preview: 'bg-[#f0fdf4] border-emerald-200' },
            { id: 'lavender', name: 'લેવેન્ડર (Calm)', preview: 'bg-[#faf5ff] border-purple-200' },
          ].map((theme) => (
            <button
              key={theme.id}
              onClick={() => onSelectTheme(theme.id)}
              className={`p-3 rounded-xl border text-left text-xs transition flex flex-col justify-between h-20 ${
                activeTheme === theme.id
                  ? 'ring-2 ring-stone-900 border-stone-900 font-medium'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className={`w-full h-6 rounded-md ${theme.preview} border`} />
              <span className="text-stone-800">{theme.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Font Style & Currency Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Font Style */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">ફોન્ટ શૈલી</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'sans', name: 'મિનિમલ Sans' },
              { id: 'serif', name: 'ક્લાસિક Serif' },
              { id: 'mono', name: 'હિસાબી Mono' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => onSelectFont(f.id)}
                className={`py-2 text-xs font-medium rounded-xl border transition ${
                  activeFont === f.id
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Currency Symbol */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">ચલણ ચિહ્ન (Currency)</h3>
          </div>
          <div className="flex items-center gap-2">
            {['₹', '$', '€', '£', '¥', 'AED'].map((curr) => (
              <button
                key={curr}
                onClick={() => onSelectCurrency(curr)}
                className={`w-10 h-10 rounded-xl font-semibold text-sm border transition ${
                  currency === curr
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Daily Offline Expense Reminder Time */}
      <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">
              દૈનિક ઓફલાઇન ખર્ચ પૂછપરછ સમય
            </h3>
          </div>
          <input
            type="checkbox"
            checked={profile.enableDailyReminder}
            onChange={(e) => onUpdateProfile({ enableDailyReminder: e.target.checked })}
            className="w-4 h-4 rounded text-stone-900"
          />
        </div>

        <p className="text-xs text-stone-500">
          આ સમયે AI તમને પૂછશે કે શું દિવસ દરમિયાન કોઈ રોકડ ખર્ચ કર્યો છે?
        </p>

        <div className="flex items-center gap-3">
          <input
            id="daily-reminder-time-input"
            type="time"
            value={profile.dailyReminderTime}
            onChange={(e) => onUpdateProfile({ dailyReminderTime: e.target.value })}
            className="px-3.5 py-2 text-sm rounded-xl border border-stone-200 outline-none"
          />
          <span className="text-xs text-stone-500 font-mono">
            હાલનો સમય: દરરોજ {profile.dailyReminderTime} કલાકે
          </span>
        </div>
      </div>

      {/* 5. Custom Category Manager */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">
              કસ્ટમ કેટેગરીઝ મેનેજ કરો
            </h3>
          </div>
          <span className="text-xs text-stone-400">કુલ {categories.length}</span>
        </div>

        {/* Add new category */}
        <form onSubmit={handleCreateCategory} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="નવી કેટેગરીનું નામ (દા.ત. જિમ, પેટ્રોલ, દાન)"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 text-xs rounded-xl border border-stone-200 outline-none"
          />
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as 'income' | 'expense')}
            className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white outline-none"
          >
            <option value="expense">ખર્ચ (Expense)</option>
            <option value="income">આવક (Income)</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-xl bg-stone-900 text-white hover:bg-stone-800 transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ઉમેરો</span>
          </button>
        </form>

        {/* Categories chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-700"
            >
              <span>{c.nameGu || c.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  c.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {c.type === 'income' ? 'આવક' : 'ખર્ચ'}
              </span>
              {categories.length > 5 && (
                <button
                  onClick={() => onDeleteCategory(c.id)}
                  className="text-stone-400 hover:text-rose-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Multi-OS PWA Installation Hub */}
      <div
        id="multi-os-install-card"
        className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-white shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-emerald-400 stroke-[1.75]" />
            <h3 className="text-sm font-semibold">
              મલ્ટી-OS સપોર્ટેડ એપ ઇન્સ્ટોલેશન
            </h3>
          </div>
          {isInstalled && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              ઇન્સ્ટોલ થયેલ છે
            </span>
          )}
        </div>

        <p className="text-xs text-stone-300">
          આ એપ્લિકેશન Android, Linux, Windows 10/11, macOS, iOS અને વેબ બ્રાઉઝર પર સંપૂર્ણ સુસંગત છે.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {isInstallable && (
            <button
              id="install-pwa-btn"
              onClick={install}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-semibold text-xs transition flex items-center gap-2"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>ડિવાઇસ પર એપ ઇન્સ્ટોલ કરો</span>
            </button>
          )}

          {isIOS && (
            <span className="text-xs text-amber-300">
              iPhone/iPad: Safari ના 'Share' બટન પર ક્લિક કરી 'Add to Home Screen' કરો.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
