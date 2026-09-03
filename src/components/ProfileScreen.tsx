import React, { useState, useRef } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Target, 
  Camera, 
  CheckCircle2, 
  Clock,
  Bell
} from 'lucide-react';
import { UserProfile, Transaction } from '../types';
import { TranslationStrings } from '../data/languages';

interface ProfileScreenProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  transactions: Transaction[];
  t: TranslationStrings;
  currency: string;
  currentLang: string;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  onUpdateProfile,
  transactions,
  t,
  currency,
  currentLang,
}) => {
  const isGu = currentLang === 'gu';
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [mobile, setMobile] = useState(profile.mobile);
  const [monthlyBudget, setMonthlyBudget] = useState(profile.monthlyBudget ? profile.monthlyBudget.toString() : '');
  const [dailyReminderTime, setDailyReminderTime] = useState(profile.dailyReminderTime || '20:30');
  const [enableReminder, setEnableReminder] = useState(profile.enableDailyReminder ?? true);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute current month expenses
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const currentMonthExpenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthStr))
    .reduce((sum, item) => sum + item.amount, 0);

  const budgetNum = parseFloat(monthlyBudget) || 0;
  const budgetUsagePercent = budgetNum > 0 ? Math.min(100, Math.round((currentMonthExpenses / budgetNum) * 100)) : 0;
  const remainingBudget = budgetNum > 0 ? budgetNum - currentMonthExpenses : 0;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarUrl(dataUrl);
      onUpdateProfile({ avatarUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      monthlyBudget: parseFloat(monthlyBudget) || 0,
      dailyReminderTime,
      enableDailyReminder: enableReminder,
      avatarUrl,
    });
    setSaveMessage(isGu ? 'પ્રોફાઈલ માહિતી સફળતાપૂર્વક સાચવવામાં આવી!' : 'Profile updated successfully!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div id="profile-screen-container" className="space-y-6 pb-28">
      {/* Save Toast */}
      {saveMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center gap-5">
        {/* Avatar with Camera upload */}
        <div className="relative group shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-stone-100 border-2 border-emerald-500/30 flex items-center justify-center text-stone-400">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : name ? (
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 uppercase">
                {name.charAt(0)}
              </span>
            ) : (
              <User className="w-10 h-10 stroke-[1.5]" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={isGu ? 'ફોટો બદલો' : 'Change photo'}
            className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold text-stone-900">
            {name || (isGu ? 'નવા વપરાશકર્તા' : 'User Profile')}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {email || (isGu ? 'ઈમેલ સેટ કરેલ નથી' : 'No email added')}
            {mobile && ` • ${mobile}`}
          </p>
          <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {isGu ? 'સક્રિય એકાઉન્ટ' : 'Active Account'}
          </span>
        </div>
      </div>

      {/* Monthly Budget Card */}
      {budgetNum > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-stone-700">
              <Target className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isGu ? 'આ મહિનાનું બજેટ ટ્રેકિંગ' : 'Monthly Budget Progress'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-stone-800">
              {budgetUsagePercent}% {isGu ? 'વપરાયેલ' : 'used'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                budgetUsagePercent > 90
                  ? 'bg-rose-500'
                  : budgetUsagePercent > 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${budgetUsagePercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-stone-500 pt-1 font-medium">
            <span>
              {isGu ? 'ખર્ચ થયો:' : 'Spent:'} {currency}{currentMonthExpenses.toLocaleString()}
            </span>
            <span>
              {isGu ? 'બાકી:' : 'Remaining:'} {currency}{Math.max(0, remainingBudget).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Profile Edit Form */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs">
        <h3 className="text-sm font-bold text-stone-800 tracking-tight mb-4">
          {isGu ? 'ખાતા સંબંધી માહિતી (Account Details)' : 'Account Details'}
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              {isGu ? 'તમારું નામ (Name)' : 'Full Name'}
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isGu ? 'તમારું નામ' : 'Enter your name'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              {isGu ? 'મોબાઈલ નંબર (Mobile Number)' : 'Mobile Number'}
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              {isGu ? 'ઈમેલ આઈડી (Email ID)' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Monthly Budget */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
              {isGu ? 'માસિક બજેટ લિમિટ (Monthly Budget)' : 'Monthly Budget Goal'}
            </label>
            <div className="relative">
              <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="30000"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Daily Offline Cash Reminder Time */}
          <div className="pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  {isGu ? 'દૈનિક ઑફલાઇન ખર્ચ પૂછવાનો સમય' : 'Daily Offline Cash Inquiry Time'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableReminder}
                  onChange={(e) => setEnableReminder(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
            <input
              type="time"
              value={dailyReminderTime}
              onChange={(e) => setDailyReminderTime(e.target.value)}
              disabled={!enableReminder}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm outline-none focus:border-emerald-500 font-mono disabled:opacity-50"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              {isGu
                ? 'AI આ સમયે તમને પૂછશે કે આજે કોઈ રોકડ ખર્ચ કર્યો છે કે નહીં.'
                : 'AI will prompt you at this time to log any unrecorded cash expenses.'}
            </p>
          </div>

          <button
            type="submit"
            className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition shadow-xs cursor-pointer"
          >
            {t.save}
          </button>
        </form>
      </div>
    </div>
  );
};
