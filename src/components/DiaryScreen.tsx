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
  KeyRound,
  Calendar as CalendarIcon
} from 'lucide-react';
import { DiaryEntry, SecurityConfig, Transaction } from '../types';
import { TranslationStrings } from '../data/languages';
import { verifyPBKDF2 } from '../services/security';

interface DiaryScreenProps {
  entries: DiaryEntry[];
  onSaveEntry: (entry: DiaryEntry) => void;
  onDeleteEntry: (id: string) => void;
  securityConfig: SecurityConfig;
  onUpdateSecurityConfig: (cfg: Partial<SecurityConfig>) => void;
  transactions: Transaction[];
  currentLang: string;
  t: TranslationStrings;
  currency: string;
}

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
  securityConfig,
  currentLang,
  t,
}) => {
  const isGu = currentLang === 'gu';

  // Diary screen lock state
  const [isDiaryLocked, setIsDiaryLocked] = useState<boolean>(
    () => securityConfig.diaryLockEnabled
  );
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modal State for create / edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<DiaryEntry['mood']>('peaceful');
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [tagsInput, setTagsInput] = useState('');

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

  // Filter entries
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
      {/* Header & New Entry Button */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 stroke-[2.2]" />
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              {isGu ? 'વ્યક્તિગત ડાયરી' : 'Personal Diary'}
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {isGu
              ? 'તમારા દૈનિક વિચારો, નોંધો અને વ્યક્તિગત હિસાબની સ્મૃતિઓ'
              : 'Your private thoughts, personal journal, and daily reflections'}
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal()}
          className="py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isGu ? 'નવી નોંધ લખો' : 'New Entry'}</span>
        </button>
      </div>

      {/* Search & Mood Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
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

        {/* Date filter */}
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

                {/* Content text */}
                <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>

                {/* Tags */}
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

      {/* New / Edit Modal */}
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
              {/* Date & Mood row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    {t.date}
                  </label>
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

              {/* Title */}
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

              {/* Content */}
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

              {/* Tags */}
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
    </div>
  );
};
