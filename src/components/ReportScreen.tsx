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
  ShieldCheck,
  DownloadCloud,
  Filter
} from 'lucide-react';
import { Transaction, Category, ReportPeriod, LayoutStyle } from '../types';
import { TranslationStrings } from '../data/languages';
import { NativeBridgeService } from '../services/nativeBridge';

interface ReportScreenProps {
  transactions: Transaction[];
  categories: Category[];
  t: TranslationStrings;
  currency: string;
  currentLang?: string;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  transactions,
  categories = [],
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

  // 3. Dynamic Category Selection across all categories (Task 11)
  const [categoryFilterMode, setCategoryFilterMode] = useState<'all' | 'single' | 'multi'>('all');
  const [selectedSingleCategory, setSelectedSingleCategory] = useState<string>('');
  const [selectedMultiCategories, setSelectedMultiCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');

  // 4. Evidence inclusion toggle
  const [includeEvidence, setIncludeEvidence] = useState<boolean>(true);

  // 5. Layout options: STRICTLY Box and Minimal Card
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('box');

  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportModalType, setExportModalType] = useState<'pdf' | 'excel' | null>(null);

  const showExportNotice = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const reportPreviewRef = useRef<HTMLDivElement>(null);

  // Derive comprehensive list of categories from props and actual data
  const allAvailableCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; nameGu?: string; type: string }>();
    categories.forEach((c) => {
      map.set(c.name, { id: c.id, name: c.name, nameGu: c.nameGu, type: c.type });
    });
    transactions.forEach((tx) => {
      if (tx.category && !map.has(tx.category)) {
        map.set(tx.category, { id: tx.category, name: tx.category, nameGu: tx.category, type: tx.type });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, transactions]);

  const toggleMultiCategory = (catName: string) => {
    if (selectedMultiCategories.includes(catName)) {
      setSelectedMultiCategories(selectedMultiCategories.filter((c) => c !== catName));
    } else {
      setSelectedMultiCategories([...selectedMultiCategories, catName]);
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

      // 2. Type filter
      if (typeFilter === 'income' && item.type !== 'income') return false;
      if (typeFilter === 'expense' && item.type !== 'expense') return false;

      // 3. Category filter (Task 11)
      if (categoryFilterMode === 'single' && selectedSingleCategory) {
        if (item.category !== selectedSingleCategory) return false;
      } else if (categoryFilterMode === 'multi' && selectedMultiCategories.length > 0) {
        if (!selectedMultiCategories.includes(item.category)) return false;
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
    categoryFilterMode,
    selectedSingleCategory,
    selectedMultiCategories,
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

  // CSV Generator
  const generateCsvString = () => {
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

    rows.push([]);
    rows.push([isGu ? 'કુલ આવક' : 'Total Income', '', '', '', '', totalIncome, '', '', '']);
    rows.push([isGu ? 'કુલ ખર્ચ' : 'Total Expense', '', '', '', '', totalExpense, '', '', '']);
    rows.push([isGu ? 'ચોખ્ખી બચત' : 'Net Savings', '', '', '', '', netSavings, '', '', '']);

    return '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  };

  const downloadCsvBlob = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateHtmlReport = () => {
    const title = `${t.appName} - ${isGu ? 'નાણાકીય હિસાબ રિપોર્ટ' : 'Financial Statement'}`;
    const dateStr = new Date().toLocaleDateString();
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #1c1917; }
    h1 { margin: 0 0 4px; font-size: 22px; color: #047857; }
    .subtitle { color: #78716c; font-size: 13px; margin-bottom: 20px; }
    .metrics { display: flex; gap: 16px; margin-bottom: 24px; }
    .card { flex: 1; padding: 14px; border-radius: 12px; border: 1px solid #e7e5e4; }
    .card.income { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
    .card.expense { background: #fff1f2; border-color: #fecdd3; color: #be123c; }
    .card.savings { background: #f5f5f4; color: #1c1917; }
    .val { font-size: 20px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background: #f5f5f4; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e7e5e4; }
    td { padding: 8px 10px; border-bottom: 1px solid #f5f5f4; }
    tr:nth-child(even) { background: #fafaf9; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">${isGu ? 'સમયગાળો' : 'Period'}: ${period.toUpperCase()} | ${dateStr} | ${filteredData.length} ${isGu ? 'વ્યવહારો' : 'Transactions'}</div>
  <div class="metrics">
    <div class="card income">
      <div>${t.totalIncome}</div>
      <div class="val">${currency}${totalIncome.toLocaleString()}</div>
    </div>
    <div class="card expense">
      <div>${t.totalExpense}</div>
      <div class="val">${currency}${totalExpense.toLocaleString()}</div>
    </div>
    <div class="card savings">
      <div>${t.netSavings}</div>
      <div class="val">${currency}${netSavings.toLocaleString()}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${isGu ? 'તારીખ' : 'Date'}</th>
        <th>${isGu ? 'પ્રકાર' : 'Type'}</th>
        <th>${isGu ? 'વિગત' : 'Title'}</th>
        <th>${isGu ? 'કેટેગરી' : 'Category'}</th>
        <th>${isGu ? 'રકમ' : 'Amount'}</th>
        <th>${isGu ? 'ચૂકવણી' : 'Mode'}</th>
      </tr>
    </thead>
    <tbody>
      ${filteredData
        .map(
          (tx) => `
      <tr>
        <td>${tx.date}</td>
        <td style="font-weight:bold;color:${tx.type === 'income' ? '#15803d' : '#be123c'}">${tx.type === 'income' ? t.income : t.expense}</td>
        <td>${tx.title || '-'}</td>
        <td>${tx.category || '-'}</td>
        <td style="font-weight:bold;">${currency}${tx.amount.toLocaleString()}</td>
        <td>${tx.paymentMode || '-'}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
  };

  // 1-Tap PDF Export (Pristine Printable HTML to Native Print/PDF + Downloads)
  const handlePrintPdf = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const jobName = `Expense_Report_${period}_${dateStr}`;
    const htmlContent = generateHtmlReport();
    const filename = `${jobName}.html`;

    // 1. Save HTML report copy to Downloads folder via Scoped Storage
    try {
      await NativeBridgeService.saveFileToDownloads(filename, htmlContent, 'text/html');
    } catch {}

    // 2. Trigger native Android Print / "Save as PDF" dialog with off-screen WebView
    try {
      const printed = await NativeBridgeService.printDocument(jobName, htmlContent);
      if (printed) {
        showExportNotice(
          isGu
            ? `PDF પ્રિન્ટ / 'Save as PDF' ડાયલોગ શરૂ થયો.`
            : `PDF Print / 'Save as PDF' dialog opened.`
        );
        return;
      }
    } catch {}

    // 3. Web Print fallback
    try {
      window.print();
    } catch {}

    showExportNotice(
      isGu
        ? `રિપોર્ટ Downloads ફોલ્ડરમાં સેવ થયો (${filename})`
        : `Report saved to Downloads folder (${filename})`
    );
  };

  // 1-Tap Excel / CSV Export (Downloads folder + optional share)
  const handleExportExcel = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Expense_Report_${period}_${dateStr}.csv`;
    const csvContent = generateCsvString();

    try {
      const res = await NativeBridgeService.saveFileToDownloads(filename, csvContent, 'text/csv');
      if (res && res.success) {
        showExportNotice(
          isGu
            ? `Excel (CSV) રિપોર્ટ Downloads ફોલ્ડરમાં સેવ થયો: ${filename}`
            : `Excel (CSV) report saved to Downloads folder: ${filename}`
        );
        // Also prompt native share sheet for quick export to WhatsApp / Drive
        try {
          await NativeBridgeService.shareFile(
            filename,
            csvContent,
            'text/csv',
            isGu ? 'નાણાકીય હિસાબ Excel' : 'Expense Diary Financial Report'
          );
        } catch {}
        return;
      }
    } catch {}

    // Web browser blob fallback
    downloadCsvBlob(csvContent, filename);
    showExportNotice(
      isGu
        ? `Excel રિપોર્ટ ડાઉનલોડ શરૂ થયો: ${filename}`
        : `Excel report download started: ${filename}`
    );
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
      const csvContent = generateCsvString();
      const dateStr = new Date().toISOString().split('T')[0];
      downloadCsvBlob(csvContent, `Expense_Report_${period}_${dateStr}.csv`);
    }
  };

  // Export modal action handlers
  const executeSaveToDevice = async () => {
    setExportModalType(null);
    if (exportModalType === 'pdf') {
      await handlePrintPdf();
    } else {
      await handleExportExcel();
    }
  };

  const executeShare = async () => {
    const modalType = exportModalType;
    setExportModalType(null);
    if (modalType === 'pdf') {
      // Share the HTML report content
      const htmlContent = generateHtmlReport();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Expense_Report_${period}_${dateStr}.html`;
      try {
        await NativeBridgeService.shareFile(
          filename,
          htmlContent,
          'text/html',
          isGu ? 'નાણાકીય PDF રિપોર્ટ' : 'Expense Diary Financial Report'
        );
      } catch {
        await handleShareReport();
      }
    } else {
      // Share CSV content
      const csvContent = generateCsvString();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Expense_Report_${period}_${dateStr}.csv`;
      try {
        await NativeBridgeService.shareFile(
          filename,
          csvContent,
          'text/csv',
          isGu ? 'નાણાકીય Excel રિપોર્ટ' : 'Expense Diary Financial Report'
        );
      } catch {
        await handleShareReport();
      }
    }
  };


  return (
    <div id="report-screen-container" className="space-y-6 pb-28">
      {/* Export Notification Toast */}
      {exportNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
      </div>

      {/* 1. FILTERS & CATEGORY CONFIGURATION CARD (Task 10: AT TOP) */}
      <div id="report-filters-card" className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-5">
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
                  className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 outline-none font-medium"
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

        {/* 2. Transaction Type Filter: All / Income Only / Expense Only */}
        <div className="border-t border-stone-100 pt-4">
          <label className="text-xs font-bold text-stone-700 block mb-2">
            {isGu ? 'વ્યવહાર પ્રકાર (Type Filter):' : 'Transaction Filter Mode:'}
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { id: 'all', labelGu: 'સંપૂર્ણ રિપોર્ટ (બધા)', labelEn: 'All (Complete Report)' },
              { id: 'income', labelGu: 'માત્ર આવક (Income Only)', labelEn: 'Income Only' },
              { id: 'expense', labelGu: 'માત્ર ખર્ચ (Expense Only)', labelEn: 'Expense Only' },
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

        {/* 3. Category Filter Mode (Task 11: Single vs Multi Across All 56 Categories) */}
        <div className="border-t border-stone-100 pt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>{isGu ? 'કેટેગરી ફિલ્ટર (Category Filter):' : 'Category Filter:'}</span>
            </label>

            <div className="flex gap-1 text-xs">
              <button
                onClick={() => {
                  setCategoryFilterMode('all');
                  setSelectedSingleCategory('');
                  setSelectedMultiCategories([]);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  categoryFilterMode === 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {isGu ? 'બધી કેટેગરીઝ (All)' : 'All Categories'}
              </button>
              <button
                onClick={() => setCategoryFilterMode('single')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  categoryFilterMode === 'single'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {isGu ? 'સિંગલ (Single)' : 'Single'}
              </button>
              <button
                onClick={() => setCategoryFilterMode('multi')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  categoryFilterMode === 'multi'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {isGu ? 'મલ્ટી (Multi)' : 'Multi'}
              </button>
            </div>
          </div>

          {/* SINGLE CATEGORY SELECTOR */}
          {categoryFilterMode === 'single' && (
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="text-xs text-stone-600 font-medium">
                {isGu ? 'કોઈપણ એક ચોક્કસ કેટેગરી પસંદ કરો:' : 'Select any single category to filter:'}
              </div>
              <select
                value={selectedSingleCategory}
                onChange={(e) => setSelectedSingleCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-white outline-none focus:border-emerald-500 font-semibold cursor-pointer"
              >
                <option value="">{isGu ? '-- કેટેગરી પસંદ કરો --' : '-- Choose a Category --'}</option>
                {allAvailableCategories
                  .filter((c) => (typeFilter === 'income' ? c.type === 'income' : typeFilter === 'expense' ? c.type === 'expense' : true))
                  .map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {isGu ? (c.nameGu || c.name) : c.name} ({c.type === 'income' ? t.income : t.expense})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* MULTI CATEGORY SELECTOR */}
          {categoryFilterMode === 'multi' && (
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-800">
                  {isGu ? 'એકથી વધુ કેટેગરીઝ પસંદ કરો' : 'Select Multiple Categories'}
                  {selectedMultiCategories.length > 0 && ` (${selectedMultiCategories.length})`}
                </span>
                <div className="flex gap-2 text-[11px]">
                  <button
                    onClick={() => {
                      const allNames = allAvailableCategories
                        .filter((c) => (typeFilter === 'income' ? c.type === 'income' : typeFilter === 'expense' ? c.type === 'expense' : true))
                        .map((c) => c.name);
                      setSelectedMultiCategories(allNames);
                    }}
                    className="text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    {isGu ? 'બધા પસંદ' : 'Select All'}
                  </button>
                  <span className="text-stone-300">|</span>
                  <button
                    onClick={() => setSelectedMultiCategories([])}
                    className="text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    {isGu ? 'સાફ કરો' : 'Clear All'}
                  </button>
                </div>
              </div>

              {/* Search bar inside multi categories */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder={isGu ? 'કેટેગરી શોધો...' : 'Search categories...'}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category Chips Grid */}
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {allAvailableCategories
                  .filter((c) => (typeFilter === 'income' ? c.type === 'income' : typeFilter === 'expense' ? c.type === 'expense' : true))
                  .filter((c) => {
                    if (!categorySearchQuery) return true;
                    const q = categorySearchQuery.toLowerCase();
                    return c.name.toLowerCase().includes(q) || (c.nameGu && c.nameGu.includes(q));
                  })
                  .map((cat) => {
                    const isSelected = selectedMultiCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.id || cat.name}
                        onClick={() => toggleMultiCategory(cat.name)}
                        className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded-xs border border-stone-300 inline-block" />}
                        <span>{isGu ? (cat.nameGu || cat.name) : cat.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* 4. Layout Style Selector & Evidence Toggle */}
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

      {/* 2. EXPORT & SHARE ACTIONS CARD (Task 10: RIGHT BELOW FILTERS) */}
      <div id="report-export-actions-card" className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-emerald-600 stroke-[2.2]" />
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">
              {isGu ? 'રિપોર્ટ એક્સપોર્ટ અને શેર કરો' : 'Export & Share Report'}
            </h3>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
            {filteredData.length} {isGu ? 'વ્યવહારો ફિલ્ટર થયેલ' : 'records filtered'}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed">
          {isGu
            ? 'ઉપર પસંદ કરેલા સમયગાળા અને કેટેગરી ફિલ્ટર્સ મુજબ PDF અથવા Excel (CSV) રિપોર્ટ તમારા ફોનમાં ડાઉનલોડ કરો અથવા શેર કરો:'
            : 'Download PDF or Excel reports directly to your Downloads folder or share with other apps:'}
        </p>

        {/* Action Buttons: Strictly PDF, Excel and Share */}
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            id="export-pdf-btn"
            onClick={handlePrintPdf}
            className="flex-1 min-w-[140px] py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
          >
            <Printer className="w-4 h-4 text-stone-300" />
            <span>{t.exportPdf}</span>
          </button>

          <button
            id="export-excel-btn"
            onClick={handleExportExcel}
            className="flex-1 min-w-[140px] py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>{t.exportExcel}</span>
          </button>

          <button
            id="share-report-btn"
            onClick={handleShareReport}
            className="p-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition cursor-pointer flex items-center justify-center shadow-xs"
            title={isGu ? 'શેર કરો' : 'Share'}
          >
            <Share2 className="w-4 h-4" />
          </button>
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

      {/* EXPORT OPTIONS MODAL (Task 9: Save to Device vs Share File) */}
      {exportModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  {exportModalType === 'pdf' ? <Printer className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {exportModalType === 'pdf'
                      ? (isGu ? 'PDF રિપોર્ટ એક્સપોર્ટ' : 'Export PDF Report')
                      : (isGu ? 'Excel / CSV એક્સપોર્ટ' : 'Export Excel / CSV Report')}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {isGu ? 'એક્સપોર્ટ પદ્ધતિ પસંદ કરો' : 'Choose export method'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExportModalType(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {isGu
                ? 'તમારે આ રિપોર્ટ સીધો તમારા ફોનના Downloads ફોલ્ડરમાં સાચવવો છે કે અન્ય એપ્સ સાથે શેર કરવો છે?'
                : 'Do you want to save this report directly to your Downloads folder or share it with other apps?'}
            </p>

            {/* Prompt: Include Proof / Evidence Column */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-stone-800">
                      {isGu ? 'રિપોર્ટમાં પુરાવો (Evidence) ઉમેરવો?' : 'Include Evidence / Proof Column?'}
                    </div>
                    <div className="text-[10px] text-stone-500">
                      {isGu ? 'SMS ટેક્સ્ટ, UTR અને બેંક વિગત સાથે રિપોર્ટ બનાવો' : 'Include raw SMS snippet, UTR & Bank sender'}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={includeEvidence}
                  onChange={(e) => setIncludeEvidence(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: Save to Device */}
              <button
                id="modal-save-to-device-btn"
                onClick={executeSaveToDevice}
                className="w-full p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-left transition cursor-pointer flex items-center gap-3 active:scale-98 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <DownloadCloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950">
                    {isGu ? '💾 તમારા ફોનમાં સેવ કરો' : '💾 Save to Device (Downloads)'}
                  </div>
                  <div className="text-[10px] text-emerald-800">
                    {isGu ? 'ફાઈલ સીધી તમારા Downloads ફોલ્ડરમાં સેવ થશે.' : 'Saves file directly to device Downloads folder.'}
                  </div>
                </div>
              </button>

              {/* Option 2: Share File */}
              <button
                id="modal-share-file-btn"
                onClick={executeShare}
                className="w-full p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:bg-stone-100 text-left transition cursor-pointer flex items-center gap-3 active:scale-98 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    {isGu ? '📤 અન્ય સાથે શેર કરો' : '📤 Share with Apps'}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {isGu ? 'વોટ્સએપ, જીમેલ કે ડ્રાઈવ પર તરત શેર કરો.' : 'Share via WhatsApp, Gmail, Drive, etc.'}
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setExportModalType(null)}
              className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition cursor-pointer"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
