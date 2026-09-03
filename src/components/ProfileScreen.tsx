import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Target, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { UserProfile, Transaction } from '../types';
import { TranslationStrings } from '../data/languages';

interface ProfileScreenProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  transactions: Transaction[];
  onRestoreTransactions: (txs: Transaction[]) => void;
  onResetSampleData: () => void;
  t: TranslationStrings;
  currency: string;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  onUpdateProfile,
  transactions,
  onRestoreTransactions,
  onResetSampleData,
  t,
  currency,
}) => {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [mobile, setMobile] = useState(profile.mobile);
  const [monthlyBudget, setMonthlyBudget] = useState(profile.monthlyBudget.toString());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Compute current month expenses
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const currentMonthExpenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthStr))
    .reduce((sum, item) => sum + item.amount, 0);

  const budgetNum = parseFloat(monthlyBudget) || 1;
  const budgetUsagePercent = Math.min(100, Math.round((currentMonthExpenses / budgetNum) * 100));
  const remainingBudget = budgetNum - currentMonthExpenses;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      monthlyBudget: parseFloat(monthlyBudget) || 30000,
    });
    setSaveMessage('પ્રોફાઈલ માહિતી સફળતાપૂર્વક સાચવવામાં આવી!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Export JSON backup
  const handleBackupData = () => {
    const backupObj = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profile,
      transactions,
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Expense_Diary_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Restore JSON backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.transactions)) {
          onRestoreTransactions(parsed.transactions);
          if (parsed.profile) {
            onUpdateProfile(parsed.profile);
            setName(parsed.profile.name || name);
            setEmail(parsed.profile.email || email);
            setMobile(parsed.profile.mobile || mobile);
            setMonthlyBudget((parsed.profile.monthlyBudget || 30000).toString());
          }
          setSaveMessage('બેકઅપ ડેટા સફળતાપૂર્વક પુનઃસ્થાપિત થયો!');
          setTimeout(() => setSaveMessage(null), 3000);
        } else {
          alert('અમાન્ય બેકઅપ ફાઇલ ફોર્મેટ.');
        }
      } catch (err) {
        alert('બેકઅપ ફાઇલ વાંચવામાં ભૂલ થઈ.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="profile-screen-container" className="space-y-6 pb-28">
      {/* Title */}
      <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-stone-900">
          વપરાશકર્તા પ્રોફાઈલ & બજેટ પ્લાનર
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          વ્યક્તિગત માહિતી, માસિક બજેટ લિમિટ અને ડેટા બેકઅપ/રીસ્ટોર
        </p>
      </div>

      {saveMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Monthly Budget Target Card */}
      <div
        id="budget-target-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">
              ચાલુ મહિનાનું બજેટ ટ્રેકર ({new Date().toLocaleString('default', { month: 'long' })})
            </h3>
          </div>
          <span className="text-xs font-semibold font-mono text-stone-700">
            {budgetUsagePercent}% વપરાયેલ
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden p-0.5 border border-stone-200/80">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              budgetUsagePercent > 90
                ? 'bg-rose-500'
                : budgetUsagePercent > 70
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${budgetUsagePercent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
            <div className="text-[10px] text-stone-400">માસિક લિમિટ</div>
            <div className="font-bold text-stone-800 font-mono mt-0.5">
              {currency}{budgetNum.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-100">
            <div className="text-[10px] text-rose-600">હાલનો ખર્ચ</div>
            <div className="font-bold text-rose-700 font-mono mt-0.5">
              {currency}{currentMonthExpenses.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <div className="text-[10px] text-emerald-600">બાકી બજેટ</div>
            <div className={`font-bold font-mono mt-0.5 ${remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {currency}{remainingBudget.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* User Information Form */}
      <form
        onSubmit={handleSaveProfile}
        id="profile-info-form"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <User className="w-4 h-4 text-stone-500 stroke-[1.75]" />
          <span>વ્યક્તિગત વિગતો</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              પૂરું નામ (Full Name)
            </label>
            <input
              id="profile-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              મોબાઈલ નંબર
            </label>
            <input
              id="profile-mobile-input"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              ઇમેઇલ આઇડી
            </label>
            <input
              id="profile-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              માસિક બજેટ લક્ષ્યાંક ({currency})
            </label>
            <input
              id="profile-budget-input"
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            id="save-profile-btn"
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 transition"
          >
            સાચવો (Save Profile)
          </button>
        </div>
      </form>

      {/* Data Backup, Export & Restore */}
      <div
        id="data-backup-restore-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-stone-500 stroke-[1.75]" />
          <h3 className="text-sm font-semibold text-stone-900">
            ડેટા સુરક્ષા & બેકઅપ (100% તમારા નિયંત્રણમાં)
          </h3>
        </div>

        <p className="text-xs text-stone-500">
          તમારો તમામ હિસાબ 100% તમારા ડિવાઇસ પર જ સાચવવામાં આવે છે. તમે કોઈપણ સમયે संपूर्ण ડેટા ડાઉનલોડ કરી શકો છો અથવા પુનઃસ્થાપિત કરી શકો છો:
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="backup-json-btn"
            onClick={handleBackupData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-800 transition"
          >
            <Download className="w-4 h-4" />
            <span>બેકઅપ ડાઉનલોડ કરો (.json)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-800 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            <span>બેકઅપ રીસ્ટોર કરો</span>
            <input
              id="restore-file-input"
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>

          <button
            id="reset-sample-btn"
            onClick={() => {
              if (confirm('શું તમે સેમ્પલ ડેટા ફરી લોડ કરવા માંગો છો?')) {
                onResetSampleData();
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-100 text-xs font-medium text-rose-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>સેમ્પલ ડેટા રીસેટ કરો</span>
          </button>
        </div>
      </div>
    </div>
  );
};
