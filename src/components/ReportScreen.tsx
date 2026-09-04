import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Printer, 
  Share2, 
  Calendar, 
  Layers, 
  Search, 
  Check, 
  CheckSquare, 
  Square,
  ShieldCheck
} from 'lucide-react';
import { Transaction, Category, ReportPeriod, LayoutStyle, PageTheme } from '../types';
import { TranslationStrings } from '../data/languages';

interface ReportScreenProps {
  transactions: Transaction[];
  categories: Category[];
  t: TranslationStrings;
  currency: string;
  currentLang?: string;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  transactions,
  t,
  currency,
  currentLang = 'en',
}) => {
  const isGu = currentLang === 'gu';

  // 1. Period filter
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q3');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // 2. Type filter: 'all' | 'income' | 'expense' | 'both'
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'both'>('all');

  // 3. Dynamic category selections
  const [selectedIncomeCategories, setSelectedIncomeCategories] = useState<string[]>([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);

  // 4. Evidence inclusion toggle
  const [includeEvidence, setIncludeEvidence] = useState<boolean>(true);

  // 5. Layout options: STRICTLY Box and Minimal Card
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('box');
  const [pageTheme, setPageTheme] = useState<PageTheme>('paper');

  const reportPreviewRef = useRef<HTMLDivElement>(null);

  // Derive actual unique categories present in user's data
  const actualIncomeCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.type === 'income' && tx.category) set.add(tx.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  const actualExpenseCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.category) set.add(tx.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Sync category selections when switching filters or initial load
  const isAllIncomeSelected = selectedIncomeCategories.length === actualIncomeCategories.length;
  const isAllExpenseSelected = selectedExpenseCategories.length === actualExpenseCategories.length;

  const toggleAllIncome = () => {
    if (isAllIncomeSelected) {
      setSelectedIncomeCategories([]);
    } else {
      setSelectedIncomeCategories([...actualIncomeCategories]);
    }
  };

  const toggleAllExpense = () => {
    if (isAllExpenseSelected) {
      setSelectedExpenseCategories([]);
    } else {
      setSelectedExpenseCategories([...actualExpenseCategories]);
    }
  };

  const toggleIncomeCategory = (cat: string) => {
    if (selectedIncomeCategories.includes(cat)) {
      setSelectedIncomeCategories(selectedIncomeCategories.filter((c) => c !== cat));
    } else {
      setSelectedIncomeCategories([...selectedIncomeCategories, cat]);
    }
  };

  const toggleExpenseCategory = (cat: string) => {
    if (selectedExpenseCategories.includes(cat)) {
      setSelectedExpenseCategories(selectedExpenseCategories.filter((c) => c !== cat));
    } else {
      setSelectedExpenseCategories([...selectedExpenseCategories, cat]);
    }
  };

  // Filtered transactions computation
  const filteredData = useMemo(() => {
    return transactions.filter((item) => {
      // 1. Period filter
      const itemDate = item.date;
      if (period === 'date' || period === 'today') {
        const target = period === 'today' ? new Date().toISOString().split('T')[0] : selectedDate;
        if (itemDate !== target) return false;
      } else if (period === 'month') {
        if (!itemDate.startsWith(selectedMonth)) return false;
      } else if (period === 'quarter') {
        const itemMonth = parseInt(itemDate.split('-')[1], 10);
        const itemYr = parseInt(itemDate.split('-')[0], 10);
        if (itemYr !== selectedYear) return false;
        if (selectedQuarter === 'Q1' && (itemMonth < 1 || itemMonth > 3)) return false;
        if (selectedQuarter === 'Q2' && (itemMonth < 4 || itemMonth > 6)) return false;
        if (selectedQuarter === 'Q3' && (itemMonth < 7 || itemMonth > 9)) return false;
        if (selectedQuarter === 'Q4' && (itemMonth < 10 || itemMonth > 12)) return false;
      } else if (period === 'year') {
        const itemYr = parseInt(itemDate.split('-')[0], 10);
        if (itemYr !== selectedYear) return false;
      } else if (period === 'custom_range') {
        if (itemDate < customStartDate || itemDate > customEndDate) return false;
      }

      // 2. Type & Dynamic Category filtering
      if (typeFilter === 'income') {
        if (item.type !== 'income') return false;
        if (selectedIncomeCategories.length > 0 && !selectedIncomeCategories.includes(item.category)) {
          return false;
        }
      } else if (typeFilter === 'expense') {
        if (item.type !== 'expense') return false;
        if (selectedExpenseCategories.length > 0 && !selectedExpenseCategories.includes(item.category)) {
          return false;
        }
      } else if (typeFilter === 'both') {
        if (item.type === 'income') {
          if (selectedIncomeCategories.length > 0 && !selectedIncomeCategories.includes(item.category)) {
            return false;
          }
        } else if (item.type === 'expense') {
          if (selectedExpenseCategories.length > 0 && !selectedExpenseCategories.includes(item.category)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    transactions,
    period,
    selectedDate,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    customStartDate,
    customEndDate,
    typeFilter,
    selectedIncomeCategories,
    selectedExpenseCategories,
  ]);

  // Aggregate totals
  const totalIncome = useMemo(() => {
    return filteredData
      .filter((t) => t.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
  }, [filteredData]);

  const totalExpense = useMemo(() => {
    return filteredData
      .filter((t) => t.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
  }, [filteredData]);

  const netSavings = totalIncome - totalExpense;

  // EXPORT 1: Clean Vector PDF via Native Print API
  const handlePrintPdf = () => {
    window.print();
  };

  // EXPORT 2: Excel / CSV with UTF-8 BOM
  const handleExportExcel = () => {
    const headers = [
      isGu ? 'તારીખ' : 'Date',
      isGu ? 'સમય' : 'Time',
      isGu ? 'પ્રકાર' : 'Type',
      isGu ? 'વિગત / શીર્ષક' : 'Title',
      isGu ? 'કેટેગરી' : 'Category',
      isGu ? 'રકમ' : 'Amount',
      isGu ? 'ચૂકવણી પદ્ધતિ' : 'Payment Mode',
      isGu ? 'વ્યક્તિ / વેન્ડર' : 'Person / Vendor',
      isGu ? 'નોંધ / પુરાવો' : 'Notes & Evidence',
    ];

    const rows = filteredData.map((tx) => {
      const typeLabel = tx.type === 'income' ? t.income : t.expense;
      let notesAndEvidence = tx.notes || '';
      if (includeEvidence && (tx.evidence || tx.referenceNumber)) {
        const evidenceNote = [
          tx.referenceNumber ? `Ref: ${tx.referenceNumber}` : '',
          tx.evidence ? `Evidence: ${tx.evidence}` : '',
        ]
          .filter(Boolean)
          .join(' | ');
        notesAndEvidence = notesAndEvidence ? `${notesAndEvidence} [${evidenceNote}]` : evidenceNote;
      }

      return [
        tx.date,
        tx.time || '',
        typeLabel,
        `"${(tx.title || '').replace(/"/g, '""')}"`,
        `"${(tx.category || '').replace(/"/g, '""')}"`,
        tx.amount,
        `"${(tx.paymentMode || '').replace(/"/g, '""')}"`,
        `"${(tx.vendorOrPerson || '').replace(/"/g, '""')}"`,
        `"${notesAndEvidence.replace(/"/g, '""')}"`,
      ];
    });

    // Add summary row at the bottom
    rows.push([]);
    rows.push([
      isGu ? 'કુલ આવક' : 'Total Income',
      '',
      '',
      '',
      '',
      totalIncome,
      '',
      '',
      '',
    ]);
    rows.push([
      isGu ? 'કુલ ખર્ચ' : 'Total Expense',
      '',
      '',
      '',
      '',
      totalExpense,
      '',
      '',
      '',
    ]);
    rows.push([
      isGu ? 'ચોખ્ખી બચત' : 'Net Savings',
      '',
      '',
      '',
      '',
      netSavings,
      '',
      '',
      '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Expense_Report_${period}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Android Native Share Sheet
  const handleShareReport = async () => {
    const summaryText = `${t.appName} - ${isGu ? 'નાણાકીય હિસાબ' : 'Financial Summary'}\n${t.totalIncome}: ${currency}${totalIncome.toLocaleString()}\n${t.totalExpense}: ${currency}${totalExpense.toLocaleString()}\n${t.netSavings}: ${currency}${netSavings.toLocaleString()}\n${isGu ? 'કુલ વ્યવહારો' : 'Transactions'}: ${filteredData.length}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: isGu ? 'નાણાકીય રિપોર્ટ' : 'Expense Diary Financial Report',
          text: summaryText,
        });
      } catch {
        // user cancelled or failed cleanly
      }
    } else {
      handleExportExcel();
    }
  };

  return (
    <div id="report-screen-container" className="space-y-6 pb-28">
      {/* 1. Top Control Bar: PDF & Excel Buttons */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600 stroke-[2.2]" />
            <span>{t.report}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {isGu
              ? 'વ્યવસાયિક PDF અને Excel રિપોર્ટ જનરેશન અને એક્સપોર્ટ'
              : 'Professional PDF & Excel reports with dynamic filtering'}
          </p>
        </div>

        {/* Action Buttons: Strictly PDF and Excel */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrintPdf}
            className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
          >
            <Printer className="w-4 h-4 text-stone-300" />
            <span>{t.exportPdf}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>{t.exportExcel}</span>
          </button>

          <button
            onClick={handleShareReport}
            className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition cursor-pointer"
            title={isGu ? 'શેર કરો' : 'Share'}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Filter & Layout Configuration Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
        {/* Period Selector Tabs */}
        <div>
          <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5 mb-2.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{isGu ? 'સમયગાળો (Period Filter):' : 'Select Period:'}</span>
          </label>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'today', labelGu: 'આજે', labelEn: 'Today' },
              { id: 'date', labelGu: 'તારીખવાર', labelEn: 'Single Date' },
              { id: 'month', labelGu: 'માસિક', labelEn: 'Monthly' },
              { id: 'quarter', labelGu: 'ત્રિમાસિક', labelEn: 'Quarterly' },
              { id: 'year', labelGu: 'વાર્ષિક', labelEn: 'Annual' },
              { id: 'custom_range', labelGu: 'કસ્ટમ તારીખ', labelEn: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as ReportPeriod)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer border ${
                  period === p.id
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {isGu ? p.labelGu : p.labelEn}
              </button>
            ))}
          </div>

          {/* Period-specific pickers */}
          <div className="mt-3">
            {period === 'date' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
              />
            )}

            {period === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
              />
            )}

            {period === 'quarter' && (
              <div className="flex gap-2">
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
                >
                  <option value="Q1">Q1 (Jan - Mar)</option>
                  <option value="Q2">Q2 (Apr - Jun)</option>
                  <option value="Q3">Q3 (Jul - Sep)</option>
                  <option value="Q4">Q4 (Oct - Dec)</option>
                </select>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="w-24 px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
                />
              </div>
            )}

            {period === 'year' && (
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-28 px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
              />
            )}

            {period === 'custom_range' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
                />
                <span className="text-xs text-stone-400">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. Transaction Type Filter Mode: All / Income Only / Expense Only / Both */}
        <div className="border-t border-stone-100 pt-4">
          <label className="text-xs font-bold text-stone-700 block mb-2">
            {isGu ? 'વ્યવહાર પ્રકાર (Type Filter):' : 'Transaction Filter Mode:'}
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { id: 'all', labelGu: 'સંપૂર્ણ રિપોર્ટ (બધા)', labelEn: 'All (Complete Report)' },
              { id: 'income', labelGu: 'માત્ર આવક (Income Only)', labelEn: 'Income Only' },
              { id: 'expense', labelGu: 'માત્ર ખર્ચ (Expense Only)', labelEn: 'Expense Only' },
              { id: 'both', labelGu: 'આવક અને ખર્ચ (બંને)', labelEn: 'Both Categories' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setTypeFilter(m.id as any)}
                className={`px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer border ${
                  typeFilter === m.id
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {isGu ? m.labelGu : m.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Dynamic Category Checkboxes (Based on selected Type) */}
        {(typeFilter === 'income' || typeFilter === 'both') && actualIncomeCategories.length > 0 && (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">
                {isGu ? 'આવકના સ્ત્રોતો / કેટેગરીઝ:' : 'Income Sources / Categories:'}
              </span>
              <button
                onClick={toggleAllIncome}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                {isAllIncomeSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{isAllIncomeSelected ? (isGu ? 'બધા પસંદ કરેલ' : 'Deselect All') : (isGu ? 'બધા પસંદ કરો' : 'Select All')}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {actualIncomeCategories.map((cat) => {
                const isSelected = selectedIncomeCategories.length === 0 || selectedIncomeCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleIncomeCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                        : 'bg-white text-emerald-900 border-emerald-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(typeFilter === 'expense' || typeFilter === 'both') && actualExpenseCategories.length > 0 && (
          <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900">
                {isGu ? 'ખર્ચની કેટેગરીઝ:' : 'Expense Categories:'}
              </span>
              <button
                onClick={toggleAllExpense}
                className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
              >
                {isAllExpenseSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{isAllExpenseSelected ? (isGu ? 'બધા પસંદ કરેલ' : 'Deselect All') : (isGu ? 'બધા પસંદ કરો' : 'Select All')}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {actualExpenseCategories.map((cat) => {
                const isSelected = selectedExpenseCategories.length === 0 || selectedExpenseCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleExpenseCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 font-semibold'
                        : 'bg-white text-rose-900 border-rose-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Layout Style Selector (Box vs Minimal Card ONLY) & Evidence Toggle */}
        <div className="border-t border-stone-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-stone-500" />
              <span>{isGu ? 'લેઆઉટ શૈલી:' : 'Layout Style:'}</span>
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => setLayoutStyle('box')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                  layoutStyle === 'box'
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-white text-stone-600 border-stone-200'
                }`}
              >
                {t.boxLayout}
              </button>
              <button
                onClick={() => setLayoutStyle('minimal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                  layoutStyle === 'minimal'
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-white text-stone-600 border-stone-200'
                }`}
              >
                {t.cardLayout}
              </button>
            </div>
          </div>

          {/* Evidence Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-700">
            <input
              type="checkbox"
              checked={includeEvidence}
              onChange={(e) => setIncludeEvidence(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {isGu ? 'ઓરિજિનલ પુરાવો / રેફરન્સ નોંધી રાખો' : 'Include Original Evidence / Ref'}
            </span>
          </label>
        </div>
      </div>

      {/* 3. REPORT PREVIEW CONTAINER (Used for Print / Save PDF) */}
      <div
        id="report-preview-document"
        ref={reportPreviewRef}
        className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-6 print:p-0 print:border-none print:shadow-none"
      >
        {/* Report Document Header */}
        <div className="border-b border-stone-200 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 block mb-1">
              {isGu ? 'નાણાકીય હિસાબ પ્રમાણપત્ર' : 'FINANCIAL STATEMENT & AUDIT'}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              {t.appName}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {isGu ? 'સમયગાળો' : 'Period'}: {period.toUpperCase()} | {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="text-right text-xs text-stone-500">
            <div>{isGu ? 'કુલ વ્યવહારો' : 'Transactions'}: <strong className="text-stone-800">{filteredData.length}</strong></div>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              {t.totalIncome}
            </span>
            <span className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 block">
              {currency}{totalIncome.toLocaleString()}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
              {t.totalExpense}
            </span>
            <span className="text-lg sm:text-xl font-bold text-rose-700 mt-1 block">
              {currency}{totalExpense.toLocaleString()}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">
              {t.netSavings}
            </span>
            <span className="text-lg sm:text-xl font-bold text-stone-900 mt-1 block">
              {currency}{netSavings.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Render transactions according to layoutStyle */}
        {filteredData.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-xs font-medium border border-dashed border-stone-200 rounded-2xl">
            {t.noTransactions}
          </div>
        ) : layoutStyle === 'box' ? (
          /* 1. Box Layout (Standard professional ledger table) */
          <div className="overflow-x-auto border border-stone-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-700 border-b border-stone-200 font-bold">
                  <th className="py-3 px-3.5">{t.date}</th>
                  <th className="py-3 px-3">{isGu ? 'પ્રકાર' : 'Type'}</th>
                  <th className="py-3 px-3.5">{t.title}</th>
                  <th className="py-3 px-3">{t.category}</th>
                  <th className="py-3 px-3.5">{t.paymentMode}</th>
                  <th className="py-3 px-3.5 text-right">{t.amount}</th>
                  {includeEvidence && <th className="py-3 px-3.5">{t.notes} & {t.evidence}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredData.map((tx) => {
                  const isInc = tx.type === 'income';
                  return (
                    <tr key={tx.id} className="hover:bg-stone-50/60 transition">
                      <td className="py-2.5 px-3.5 font-medium text-stone-600 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isInc ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isInc ? t.income : t.expense}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-stone-800">
                        {tx.title}
                        {tx.vendorOrPerson && (
                          <span className="block text-[10px] text-stone-400 font-normal">
                            {tx.vendorOrPerson}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600 whitespace-nowrap">{tx.category}</td>
                      <td className="py-2.5 px-3.5 text-stone-500 whitespace-nowrap">{tx.paymentMode}</td>
                      <td
                        className={`py-2.5 px-3.5 text-right font-bold whitespace-nowrap ${
                          isInc ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isInc ? '+' : '-'} {currency}{tx.amount.toLocaleString()}
                      </td>
                      {includeEvidence && (
                        <td className="py-2.5 px-3.5 text-[11px] text-stone-500 max-w-xs truncate">
                          {tx.notes || ''}
                          {tx.referenceNumber && ` [Ref: ${tx.referenceNumber}]`}
                          {tx.evidence && ` (Ev: ${tx.evidence})`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* 2. Minimal Card Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredData.map((tx) => {
              const isInc = tx.type === 'income';
              return (
                <div
                  key={tx.id}
                  className="p-4 rounded-2xl bg-stone-50/60 border border-stone-200/80 space-y-2 hover:border-stone-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{tx.title}</h4>
                      <p className="text-[10px] text-stone-400 font-medium">
                        {tx.date} • {tx.category} • {tx.paymentMode}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isInc ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isInc ? '+' : '-'} {currency}{tx.amount.toLocaleString()}
                    </span>
                  </div>

                  {includeEvidence && (tx.evidence || tx.referenceNumber || tx.notes) && (
                    <div className="text-[10px] text-stone-500 bg-white p-2 rounded-lg border border-stone-100 font-mono leading-tight">
                      {tx.notes && <div>{tx.notes}</div>}
                      {tx.referenceNumber && <div>Ref: {tx.referenceNumber}</div>}
                      {tx.evidence && <div className="truncate text-stone-400">"{tx.evidence}"</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
