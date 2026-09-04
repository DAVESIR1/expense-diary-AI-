import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Smile, 
  Meh, 
  Frown, 
  Sparkles, 
  Heart, 
  Trash2, 
  Edit3, 
  X, 
  Lock, 
  Unlock, 
  Calendar as CalendarIcon,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Phone,
  User as UserIcon,
  Fingerprint,
  Shield,
  KeyRound
} from 'lucide-react';
import { DiaryEntry, SecurityConfig, Transaction, BorrowedLentRecord, BorrowLendDirection, BorrowLendStatus } from '../types';
import { TranslationStrings } from '../data/languages';
import { verifyPBKDF2, hashWithPBKDF2 } from '../services/security';

interface DiaryScreenProps {
  entries: DiaryEntry[];
  onSaveEntry: (entry: DiaryEntry) => void;
  onDeleteEntry: (id: string) => void;
  borrowedLentRecords: BorrowedLentRecord[];
  onSaveBorrowLent: (record: BorrowedLentRecord) => void;
  onDeleteBorrowLent: (id: string) => void;
  securityConfig: SecurityConfig;
  onUpdateSecurityConfig: (cfg: Partial<SecurityConfig>) => void;
  transactions: Transaction[];
  currentLang: string;
  t: TranslationStrings;
  currency: string;
}

type DiaryTab = 'journal' | 'borrowlent';

const MOODS = [
  { id: 'peaceful', labelGu: 'શાંત', labelEn: 'Peaceful', icon: Heart, color: '#10B981' },
  { id: 'happy', labelGu: 'આનંદિત', labelEn: 'Happy', icon: Smile, color: '#F59E0B' },
  { id: 'excited', labelGu: 'ઉત્સાહિત', labelEn: 'Excited', icon: Sparkles, color: '#6366F1' },
  { id: 'neutral', labelGu: 'સામાન્ય', labelEn: 'Neutral', icon: Meh, color: '#6B7280' },
  { id: 'sad', labelGu: 'ઉદાસ', labelEn: 'Sad', icon: Frown, color: '#EF4444' },
];

export const DiaryScreen: React.FC<DiaryScreenProps> = ({
  entries,
  onSaveEntry,
  onDeleteEntry,
  borrowedLentRecords,
  onSaveBorrowLent,
  onDeleteBorrowLent,
  securityConfig,
  onUpdateSecurityConfig,
  transactions,
  currentLang,
  t,
  currency,
}) => {
  const isGu = currentLang === 'gu';

  // Diary screen lock state
  const [isDiaryLocked, setIsDiaryLocked] = useState<boolean>(
    () => securityConfig.diaryLockEnabled
  );
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Sub-tab
  const [activeTab, setActiveTab] = useState<DiaryTab>('journal');

  // Search & Filter state (journal)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modal State for journal create / edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  // Journal Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<DiaryEntry['mood']>('peaceful');
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [tagsInput, setTagsInput] = useState('');

  // Borrowed/Lent modal & form
  const [isBLModalOpen, setIsBLModalOpen] = useState(false);
  const [editingBL, setEditingBL] = useState<BorrowedLentRecord | null>(null);
  const [blDirection, setBLDirection] = useState<BorrowLendDirection>('borrowed');
  const [blAmount, setBLAmount] = useState('');
  const [blPerson, setBLPerson] = useState('');
  const [blContact, setBLContact] = useState('');
  const [blDate, setBLDate] = useState(new Date().toISOString().split('T')[0]);
  const [blDueDate, setBLDueDate] = useState('');
  const [blNote, setBLNote] = useState('');
  const [blStatusFilter, setBLStatusFilter] = useState<'all' | BorrowLendStatus>('all');

  // Custom Diary PIN setup
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newDiaryPin, setNewDiaryPin] = useState('');
  const [confirmDiaryPin, setConfirmDiaryPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState<string | null>(null);
  const [pinSetupSuccess, setPinSetupSuccess] = useState(false);

  const handleSetDiaryPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinSetupError(null);
    setPinSetupSuccess(false);

    if (newDiaryPin.length < 4) {
      setPinSetupError(isGu ? 'પિન ઓછામાં ઓછો 4 અંકનો હોવો જોઈએ.' : 'PIN must be at least 4 digits.');
      return;
    }
    if (newDiaryPin !== confirmDiaryPin) {
      setPinSetupError(isGu ? 'પિન મેચ થતો નથી. ફરી દાખલ કરો.' : 'PINs do not match. Try again.');
      return;
    }

    const { hash, salt } = await hashWithPBKDF2(newDiaryPin);
    onUpdateSecurityConfig({
      diaryPinHash: hash,
      diaryPinSalt: salt,
      diaryLockEnabled: true,
    });
    setPinSetupSuccess(true);
    setNewDiaryPin('');
    setConfirmDiaryPin('');
    setTimeout(() => {
      setShowPinSetup(false);
      setPinSetupSuccess(false);
    }, 1500);
  };

  // Unlock Diary
  const handleUnlockDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    const pinToVerify = securityConfig.diaryPinHash || securityConfig.pinHash;
    const saltToVerify = securityConfig.diaryPinSalt || securityConfig.pinSalt;

    if (!pinToVerify || !saltToVerify) {
      setIsDiaryLocked(false);
      return;
    }

    const match = await verifyPBKDF2(unlockPin, pinToVerify, saltToVerify);
    if (match) {
      setIsDiaryLocked(false);
      setUnlockPin('');
    } else {
      setUnlockError(isGu ? 'ખોટો પિન. ફરી પ્રયાસ કરો.' : 'Incorrect PIN. Try again.');
    }
  };

  // --- Journal Handlers ---
  const handleOpenAddModal = (entry?: DiaryEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setTitle(entry.title);
      setContent(entry.content);
      setMood(entry.mood || 'peaceful');
      setEntryDate(entry.date);
      setTagsInput(entry.tags ? entry.tags.join(', ') : '');
    } else {
      setEditingEntry(null);
      setTitle('');
      setContent('');
      setMood('peaceful');
      setEntryDate(new Date().toISOString().split('T')[0]);
      setTagsInput('');
    }
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const nowIso = new Date().toISOString();
    const entryObj: DiaryEntry = {
      id: editingEntry ? editingEntry.id : `diary-${Date.now()}`,
      date: entryDate,
      time: new Date().toTimeString().substring(0, 5),
      title: title.trim() || (isGu ? 'વિના શીર્ષક' : 'Untitled Note'),
      content: content.trim(),
      mood,
      tags,
      createdAt: editingEntry ? editingEntry.createdAt : nowIso,
      updatedAt: nowIso,
    };

    onSaveEntry(entryObj);
    setIsModalOpen(false);
  };

  // --- Borrowed/Lent Handlers ---
  const handleOpenBLModal = (record?: BorrowedLentRecord) => {
    if (record) {
      setEditingBL(record);
      setBLDirection(record.direction);
      setBLAmount(String(record.amount));
      setBLPerson(record.personName);
      setBLContact(record.contactNumber || '');
      setBLDate(record.date);
      setBLDueDate(record.dueDate || '');
      setBLNote(record.note || '');
    } else {
      setEditingBL(null);
      setBLDirection('borrowed');
      setBLAmount('');
      setBLPerson('');
      setBLContact('');
      setBLDate(new Date().toISOString().split('T')[0]);
      setBLDueDate('');
      setBLNote('');
    }
    setIsBLModalOpen(true);
  };

  const handleSaveBL = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(blAmount);
    if (!amt || amt <= 0 || !blPerson.trim()) return;

    const nowIso = new Date().toISOString();
    const record: BorrowedLentRecord = {
      id: editingBL ? editingBL.id : `bl-${Date.now()}`,
      direction: blDirection,
      amount: amt,
      partialAmountReturned: editingBL?.partialAmountReturned,
      personName: blPerson.trim(),
      contactNumber: blContact.trim() || undefined,
      date: blDate,
      dueDate: blDueDate || undefined,
      note: blNote.trim() || undefined,
      status: editingBL ? editingBL.status : 'pending',
      createdAt: editingBL ? editingBL.createdAt : nowIso,
      updatedAt: nowIso,
    };

    onSaveBorrowLent(record);
    setIsBLModalOpen(false);
  };

  const handleMarkSettled = (record: BorrowedLentRecord) => {
    onSaveBorrowLent({
      ...record,
      status: 'settled',
      settledDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    });
  };

  // Filter journal entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchContent = e.content.toLowerCase().includes(q);
        const matchTags = e.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchContent && !matchTags) return false;
      }
      if (selectedMood !== 'all' && e.mood !== selectedMood) {
        return false;
      }
      if (selectedDate && e.date !== selectedDate) {
        return false;
      }
      return true;
    });
  }, [entries, searchQuery, selectedMood, selectedDate]);

  // Filter borrowed/lent
  const filteredBL = useMemo(() => {
    if (blStatusFilter === 'all') return borrowedLentRecords;
    return borrowedLentRecords.filter((r) => r.status === blStatusFilter);
  }, [borrowedLentRecords, blStatusFilter]);

  // Summaries
  const blSummary = useMemo(() => {
    const pendingBorrowed = borrowedLentRecords
      .filter((r) => r.direction === 'borrowed' && r.status !== 'settled')
      .reduce((s, r) => s + r.amount - (r.partialAmountReturned || 0), 0);
    const pendingLent = borrowedLentRecords
      .filter((r) => r.direction === 'lent' && r.status !== 'settled')
      .reduce((s, r) => s + r.amount - (r.partialAmountReturned || 0), 0);
    return { pendingBorrowed, pendingLent };
  }, [borrowedLentRecords]);

  // If Diary is locked with separate PIN
  if (isDiaryLocked) {
    return (
      <div
        id="diary-locked-container"
        className="max-w-md mx-auto my-12 p-8 bg-white border border-stone-200 rounded-3xl shadow-sm text-center space-y-4 animate-in fade-in"
      >
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
          <Lock className="w-8 h-8 stroke-[2]" />
        </div>
        <h3 className="text-lg font-bold text-stone-900">
          {isGu ? 'વ્યક્તિગત ડાયરી લૉક કરેલ છે' : 'Personal Diary is Locked'}
        </h3>
        <p className="text-xs text-stone-500 leading-relaxed">
          {isGu
            ? 'આ ડાયરી તમારી ખાનગી નોંધો માટે સુરક્ષિત છે. જોવા માટે તમારો સુરક્ષા પિન દાખલ કરો.'
            : 'This journal is protected for your private reflections. Enter your PIN to unlock.'}
        </p>

        {unlockError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
            {unlockError}
          </div>
        )}

        <form onSubmit={handleUnlockDiary} className="space-y-3">
          <input
            type="password"
            maxLength={6}
            value={unlockPin}
            onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full px-4 py-2.5 text-center text-lg font-mono tracking-widest rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Unlock className="w-4 h-4" />
            <span>{isGu ? 'અનલૉક કરો' : 'Unlock Diary'}</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div id="diary-screen-container" className="space-y-5 pb-28">
      {/* Header & Sub-tab Switcher */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600 stroke-[2.2]" />
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {isGu ? 'વ્યક્તિગત ડાયરી' : 'Personal Diary'}
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {isGu
                ? 'તમારા દૈનિક વિચારો, નોંધો અને ઉછીના પૈસાનો હિસાબ'
                : 'Private journal, reflections, and money tracking'}
            </p>
          </div>

          <button
            onClick={() => activeTab === 'journal' ? handleOpenAddModal() : handleOpenBLModal()}
            className="py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'journal'
              ? (isGu ? 'નવી નોંધ લખો' : 'New Entry')
              : (isGu ? 'નવો રેકોર્ડ' : 'New Record')
            }</span>
          </button>
        </div>

        {/* Sub-tab pills */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'journal'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
            {isGu ? 'જર્નલ' : 'Journal'}
          </button>
          <button
            onClick={() => setActiveTab('borrowlent')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'borrowlent'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 inline mr-1.5" />
            {isGu ? 'ઉછીના પૈસા' : 'Borrowed / Lent'}
          </button>
        </div>
      </div>

      {/* Diary PIN Setup Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600 stroke-[2]" />
            <h3 className="text-xs font-bold text-stone-800">
              {isGu ? 'ડાયરી સુરક્ષા પિન' : 'Diary Security PIN'}
            </h3>
          </div>
          <button
            onClick={() => { setShowPinSetup(!showPinSetup); setPinSetupError(null); setPinSetupSuccess(false); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border border-stone-200 hover:bg-stone-50 text-stone-600"
          >
            {securityConfig.diaryPinHash
              ? (isGu ? 'પિન બદલો' : 'Change PIN')
              : (isGu ? 'પિન સેટ કરો' : 'Set PIN')}
          </button>
        </div>

        <p className="text-[11px] text-stone-500">
          {securityConfig.diaryPinHash
            ? (isGu ? '✅ ડાયરી માટે અલગ પિન સેટ છે.' : '✅ Custom diary PIN is active.')
            : (isGu ? 'ડાયરી માટે અલગ સુરક્ષા પિન સેટ કરો.' : 'Set a separate PIN to protect your diary.')}
        </p>

        {showPinSetup && (
          <form onSubmit={handleSetDiaryPin} className="space-y-2.5 pt-1">
            {pinSetupError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {pinSetupError}
              </div>
            )}
            {pinSetupSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-xl">
                {isGu ? '✅ ડાયરી પિન સફળતાપૂર્વક સેટ થયો!' : '✅ Diary PIN set successfully!'}
              </div>
            )}
            <input
              type="password"
              maxLength={6}
              value={newDiaryPin}
              onChange={(e) => setNewDiaryPin(e.target.value.replace(/\D/g, ''))}
              placeholder={isGu ? 'નવો પિન (4-6 અંક)' : 'New PIN (4-6 digits)'}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-indigo-500 font-mono tracking-widest text-center"
            />
            <input
              type="password"
              maxLength={6}
              value={confirmDiaryPin}
              onChange={(e) => setConfirmDiaryPin(e.target.value.replace(/\D/g, ''))}
              placeholder={isGu ? 'પિન ફરી દાખલ કરો' : 'Confirm PIN'}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-indigo-500 font-mono tracking-widest text-center"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isGu ? 'પિન સેવ કરો' : 'Save PIN'}</span>
            </button>
          </form>
        )}
      </div>

      {/* ===== JOURNAL TAB ===== */}
      {activeTab === 'journal' && (
        <>
          {/* Search & Mood Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isGu ? 'ડાયરીમાં શોધો (શીર્ષક, વિગત, ટેગ)...' : 'Search entries, tags, reflections...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-2xl border border-stone-200 bg-white outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-2xl border border-stone-200 bg-white outline-none focus:border-indigo-500 shadow-xs cursor-pointer text-stone-600"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 hover:text-stone-600 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Mood Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedMood('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 border ${
                selectedMood === 'all'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {isGu ? 'બધા મૂડ' : 'All Moods'}
            </button>
            {MOODS.map((m) => {
              const IconComponent = m.icon;
              const isSelected = selectedMood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMood(m.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-500 font-bold'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5" style={{ color: m.color }} />
                  <span>{isGu ? m.labelGu : m.labelEn}</span>
                </button>
              );
            })}
          </div>

          {/* Entries List */}
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-50 text-stone-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">
                {isGu ? 'હજી સુધી કોઈ નોંધ લખી નથી' : 'No Diary Entries Yet'}
              </h4>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                {isGu
                  ? 'તમારા દિવસના અનુભવો, વિચારો અથવા સ્મૃતિઓ લખવા માટે "નવી નોંધ લખો" પર ક્લિક કરો.'
                  : 'Record your daily experiences, memories, or reflections privately.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => {
                const moodObj = MOODS.find((m) => m.id === entry.mood);
                const MoodIcon = moodObj ? moodObj.icon : Heart;

                return (
                  <div
                    key={entry.id}
                    className="p-5 rounded-3xl bg-white border border-stone-200/80 hover:border-stone-300 transition shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {moodObj && (
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${moodObj.color}15` }}
                            >
                              <MoodIcon className="w-3.5 h-3.5" style={{ color: moodObj.color }} />
                            </div>
                          )}
                          <h4 className="text-sm font-bold text-stone-900 tracking-tight">
                            {entry.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-stone-400 font-medium">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {entry.date}
                          </span>
                          <span>•</span>
                          <span>{entry.time}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenAddModal(entry)}
                          className="p-1.5 text-stone-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                          title={isGu ? 'સુધારો' : 'Edit'}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(isGu ? 'શું તમે આ નોંધ કાઢી નાખવા માંગો છો?' : 'Delete this entry?')) {
                              onDeleteEntry(entry.id);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title={isGu ? 'કાઢી નાખો' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {entry.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2.5 py-0.5 rounded-full bg-stone-100 text-[10px] font-semibold text-stone-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== BORROWED / LENT TAB ===== */}
      {activeTab === 'borrowlent' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/50">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                <span className="text-[11px] font-semibold text-rose-700">
                  {t.borrowed || (isGu ? 'ઉછીના લીધેલા' : 'Borrowed')}
                </span>
              </div>
              <p className="text-lg font-bold text-rose-900">
                {currency}{blSummary.pendingBorrowed.toLocaleString()}
              </p>
              <p className="text-[10px] text-rose-500 mt-0.5">{t.pending || (isGu ? 'બાકી' : 'Pending')}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/50">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-semibold text-emerald-700">
                  {t.lent || (isGu ? 'ઉછીના આપેલા' : 'Lent')}
                </span>
              </div>
              <p className="text-lg font-bold text-emerald-900">
                {currency}{blSummary.pendingLent.toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-500 mt-0.5">{t.pending || (isGu ? 'બાકી' : 'Pending')}</p>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1">
            {([
              { key: 'all' as const, label: isGu ? 'બધા' : 'All' },
              { key: 'pending' as const, label: t.pending || (isGu ? 'બાકી' : 'Pending') },
              { key: 'settled' as const, label: t.settled || (isGu ? 'ચૂકતે' : 'Settled') },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setBLStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 border ${
                  blStatusFilter === f.key
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Records List */}
          {filteredBL.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                <ArrowDownLeft className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">
                {isGu ? 'કોઈ ઉછીના રેકોર્ડ નથી' : 'No Borrowed/Lent Records'}
              </h4>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                {isGu
                  ? 'ઉછીના લીધેલા અથવા આપેલા પૈસાનો હિસાબ રાખવા "નવો રેકોર્ડ" ક્લિક કરો.'
                  : 'Track money you\'ve borrowed or lent by adding a new record.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBL.map((record) => {
                const isBorrowed = record.direction === 'borrowed';
                const isSettled = record.status === 'settled';
                return (
                  <div
                    key={record.id}
                    className={`p-4 rounded-2xl border transition shadow-xs ${
                      isSettled
                        ? 'bg-stone-50 border-stone-200/50 opacity-70'
                        : isBorrowed
                          ? 'bg-white border-rose-200/60 hover:border-rose-300'
                          : 'bg-white border-emerald-200/60 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isBorrowed ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {isBorrowed
                            ? <ArrowDownLeft className="w-4.5 h-4.5" />
                            : <ArrowUpRight className="w-4.5 h-4.5" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-stone-900">
                              {currency}{record.amount.toLocaleString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isSettled
                                ? 'bg-stone-200 text-stone-600'
                                : isBorrowed
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isBorrowed
                                ? (t.borrowed || (isGu ? 'ઉછીના લીધેલા' : 'Borrowed'))
                                : (t.lent || (isGu ? 'ઉછીના આપેલા' : 'Lent'))
                              }
                            </span>
                            {isSettled && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500">
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3 h-3" />
                              {record.personName}
                            </span>
                            {record.contactNumber && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Phone className="w-3 h-3" />
                                  {record.contactNumber}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-400">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {record.date}
                            </span>
                            {record.dueDate && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {isGu ? 'ચૂકવણી:' : 'Due:'} {record.dueDate}
                                </span>
                              </>
                            )}
                          </div>
                          {record.note && (
                            <p className="text-[11px] text-stone-500 mt-1 italic">{record.note}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {!isSettled && (
                          <button
                            onClick={() => handleMarkSettled(record)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-[10px] font-bold transition cursor-pointer"
                            title={t.markSettled || 'Mark as Settled'}
                          >
                            <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                            {t.markSettled || (isGu ? 'ચૂકતે' : 'Settled')}
                          </button>
                        )}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleOpenBLModal(record)}
                            className="p-1.5 text-stone-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(isGu ? 'શું તમે આ રેકોર્ડ કાઢી નાખવા માંગો છો?' : 'Delete this record?')) {
                                onDeleteBorrowLent(record.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Journal New / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-stone-900">
                  {editingEntry
                    ? (isGu ? 'નોંધ સુધારો' : 'Edit Diary Entry')
                    : (isGu ? 'નવી ડાયરી નોંધ' : 'New Diary Entry')}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">{t.date}</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    {isGu ? 'મૂડ (Mood)' : 'Mood'}
                  </label>
                  <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value as DiaryEntry['mood'])}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                  >
                    {MOODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {isGu ? m.labelGu : m.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  {isGu ? 'શીર્ષક / મુખ્ય વાત' : 'Title / Subject'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isGu ? 'આજનો દિવસ કેવો રહ્યો...' : 'How was your day...'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  {isGu ? 'તમારા વિચારો / નોંધ' : 'Thoughts & Notes'}
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder={isGu ? 'અહીં વિગતવાર લખો...' : 'Write your private journal notes here...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3.5 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  {isGu ? 'ટેગ્સ (અલ્પવિરામથી અલગ કરો)' : 'Tags (comma separated)'}
                </label>
                <input
                  type="text"
                  placeholder={isGu ? 'Personal, Finance, Gratitude' : 'Personal, Health, Idea'}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500 text-stone-700"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Borrowed/Lent Modal */}
      {isBLModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-stone-900">
                  {editingBL
                    ? (isGu ? 'રેકોર્ડ સુધારો' : 'Edit Record')
                    : (isGu ? 'ઉછીના પૈસાનો નવો રેકોર્ડ' : 'New Borrowed/Lent Record')}
                </h3>
              </div>
              <button
                onClick={() => setIsBLModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBL} className="space-y-3.5">
              {/* Direction Toggle */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-2">
                  {isGu ? 'પ્રકાર' : 'Direction'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBLDirection('borrowed')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      blDirection === 'borrowed'
                        ? 'bg-rose-100 border-rose-400 text-rose-800'
                        : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    {t.borrowedMoney || (isGu ? 'ઉછીના લીધેલા' : 'I Borrowed')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBLDirection('lent')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      blDirection === 'lent'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                        : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    {t.lentMoney || (isGu ? 'ઉછીના આપેલા' : 'I Lent')}
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">{t.amount}</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={blAmount}
                  onChange={(e) => setBLAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500 font-bold text-lg"
                />
              </div>

              {/* Person Name & Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    {t.personName || (isGu ? 'વ્યક્તિનું નામ' : 'Person Name')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isGu ? 'નામ લખો' : 'Enter name'}
                    value={blPerson}
                    onChange={(e) => setBLPerson(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    {t.contactNumber || (isGu ? 'સંપર્ક નંબર' : 'Contact Number')}
                  </label>
                  <input
                    type="tel"
                    placeholder={isGu ? 'મોબાઈલ નંબર' : 'Phone number'}
                    value={blContact}
                    onChange={(e) => setBLContact(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Date & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">{t.date}</label>
                  <input
                    type="date"
                    required
                    value={blDate}
                    onChange={(e) => setBLDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    {t.dueDate || (isGu ? 'ચૂકવણી તારીખ' : 'Due Date')}
                  </label>
                  <input
                    type="date"
                    value={blDueDate}
                    onChange={(e) => setBLDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">{t.notes}</label>
                <textarea
                  rows={2}
                  placeholder={isGu ? 'વૈકલ્પિક નોંધ...' : 'Optional note...'}
                  value={blNote}
                  onChange={(e) => setBLNote(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-stone-50/50 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBLModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
