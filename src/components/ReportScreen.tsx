import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Filter, 
  Calendar, 
  Palette, 
  Columns, 
  Layers, 
  Search,
  Check,
  ChevronDown
} from 'lucide-react';
import { Transaction, Category, ReportPeriod, PageTheme, LayoutStyle } from '../types';
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
  categories,
  t,
  currency,
  currentLang = 'en',
}) => {
  const isGu = currentLang === 'gu';
  // Period filter
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q3');
  const [selectedHalfYear, setSelectedHalfYear] = useState<string>('H2');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [customDaysCount, setCustomDaysCount] = useState<number>(30);

  // Additional filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [personFilter, setPersonFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Customization: Theme, Layout & Columns
  const [pageTheme, setPageTheme] = useState<PageTheme>('paper');
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('ruled');
  
  // Available columns that user can arrange/select
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'date',
    'income',
    'incomeSource',
    'expense',
    'expenseSource',
    'personOrMobile',
    'notes',
  ]);

  const reportPreviewRef = useRef<HTMLDivElement>(null);

  // Available column metadata
  const columnDefs = [
    { id: 'date', label: isGu ? 'તારીખ / સમય' : 'Date / Time', minWidth: '100px' },
    { id: 'income', label: isGu ? 'આવક' : 'Income', minWidth: '110px' },
    { id: 'incomeSource', label: isGu ? 'આવકનો સ્ત્રોત' : 'Income Source', minWidth: '120px' },
    { id: 'expense', label: isGu ? 'ખર્ચ' : 'Expense', minWidth: '110px' },
    { id: 'expenseSource', label: isGu ? 'ખર્ચનો સ્ત્રોત' : 'Expense Category', minWidth: '120px' },
    { id: 'personOrMobile', label: isGu ? 'વ્યક્તિ / મોબાઈલ' : 'Person / Mobile', minWidth: '130px' },
    { id: 'paymentMode', label: isGu ? 'ચૂકવણી પદ્ધતિ' : 'Payment Mode', minWidth: '100px' },
    { id: 'notes', label: isGu ? 'નોંધ' : 'Notes', minWidth: '140px' },
  ];


  const toggleColumn = (colId: string) => {
    if (selectedColumns.includes(colId)) {
      if (selectedColumns.length > 2) {
        setSelectedColumns(selectedColumns.filter((c) => c !== colId));
      }
    } else {
      setSelectedColumns([...selectedColumns, colId]);
    }
  };

  // Filtered transactions computation
  const filteredData = useMemo(() => {
    return transactions.filter((item) => {
      // 1. Period filter
      const itemDate = item.date;
      if (period === 'date') {
        if (itemDate !== selectedDate) return false;
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
      } else if (period === 'six_months') {
        const itemMonth = parseInt(itemDate.split('-')[1], 10);
        const itemYr = parseInt(itemDate.split('-')[0], 10);
        if (itemYr !== selectedYear) return false;
        if (selectedHalfYear === 'H1' && itemMonth > 6) return false;
        if (selectedHalfYear === 'H2' && itemMonth <= 6) return false;
      } else if (period === 'year') {
        if (!itemDate.startsWith(selectedYear.toString())) return false;
      } else if (period === 'custom_range') {
        if (itemDate < customStartDate || itemDate > customEndDate) return false;
      } else if (period === 'custom_days') {
        const now = new Date().getTime();
        const tTime = new Date(itemDate).getTime();
        const diffDays = (now - tTime) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > customDaysCount) return false;
      }

      // 2. Type filter
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;

      // 3. Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // 4. Person / Mobile filter
      if (personFilter.trim()) {
        const pf = personFilter.toLowerCase();
        const matchName = item.vendorOrPerson?.toLowerCase().includes(pf);
        const matchMobile = item.mobileNumber?.includes(pf);
        if (!matchName && !matchMobile) return false;
      }

      return true;
    });
  }, [
    transactions,
    period,
    selectedDate,
    selectedMonth,
    selectedQuarter,
    selectedHalfYear,
    selectedYear,
    customStartDate,
    customEndDate,
    customDaysCount,
    typeFilter,
    selectedCategory,
    personFilter,
  ]);

  // Aggregate totals
  const totalIncome = filteredData
    .filter((t) => t.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalExpense = filteredData
    .filter((t) => t.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  const netSavings = totalIncome - totalExpense;

  // EXPORT 1: PDF (via styled print window)
  const handleExportPDF = () => {
    window.print();
  };

  // EXPORT 2: CSV / Excel
  const handleExportCSV = () => {
    const headers = ['તારીખ (Date)', 'સમય (Time)', 'પ્રકાર (Type)', 'શીર્ષક (Title)', 'કેટેગરી (Category)', 'રકમ (Amount)', 'વ્યક્તિ/મોબાઈલ', 'ચૂકવણી પદ્ધતિ', 'નોંધ'];
    const rows = filteredData.map((tx) => [
      tx.date,
      tx.time,
      tx.type === 'income' ? 'આવક' : 'ખર્ચ',
      `"${(tx.title || '').replace(/"/g, '""')}"`,
      `"${tx.category}"`,
      tx.amount,
      `"${tx.vendorOrPerson || ''} ${tx.mobileNumber || ''}"`.trim(),
      tx.paymentMode,
      `"${(tx.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Expense_Report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORT 3: Text (.txt) formatted report
  const handleExportText = () => {
    let txt = `=========================================================================\n`;
    txt += `                    EXPENSE DIARY AI - FINANCIAL REPORT                  \n`;
    txt += `=========================================================================\n`;
    txt += `${isGu ? 'તારીખ' : 'Date'}: ${new Date().toLocaleDateString()} | ${isGu ? 'સમયગાળો' : 'Period'}: ${period.toUpperCase()}\n`;
    txt += `${t.totalIncome}: ${currency}${totalIncome.toLocaleString()} | ${t.totalExpense}: ${currency}${totalExpense.toLocaleString()} | ${t.netSavings}: ${currency}${netSavings.toLocaleString()}\n`;
    txt += `${isGu ? 'કુલ વ્યવહારો' : 'Total Transactions'}: ${filteredData.length}\n`;
    txt += `-------------------------------------------------------------------------\n`;
    txt += `${isGu ? 'તારીખ' : 'Date'}       | ${isGu ? 'પ્રકાર' : 'Type'}   | ${isGu ? 'રકમ' : 'Amount'}      | ${isGu ? 'વિગત' : 'Title'}             | ${isGu ? 'કેટેગરી' : 'Category'}\n`;
    txt += `-------------------------------------------------------------------------\n`;
    filteredData.forEach((tx) => {
      const typeLabel = tx.type === 'income' ? t.income : t.expense;
      const amtStr = `${currency}${tx.amount}`.padEnd(11, ' ');
      const titleStr = tx.title.substring(0, 18).padEnd(19, ' ');
      txt += `${tx.date} | ${typeLabel.padEnd(6, ' ')} | ${amtStr} | ${titleStr} | ${tx.category}\n`;
    });
    txt += `=========================================================================\n`;

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expense_Report_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  // EXPORT 4: Clean Image generation via HTML5 Canvas
  const handleExportImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 360 + filteredData.length * 44;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Theme Background
    let bgColor = '#FFFFFF';
    if (pageTheme === 'paper') bgColor = '#FAF8F5';
    else if (pageTheme === 'mint') bgColor = '#F0FDF4';
    else if (pageTheme === 'lavender') bgColor = '#FAF5FF';
    else if (pageTheme === 'amber') bgColor = '#FFFBEB';
    else if (pageTheme === 'slate') bgColor = '#F8FAFC';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative subtle top bar
    ctx.fillStyle = '#10B981';
    ctx.fillRect(0, 0, canvas.width, 8);

    // Title
    ctx.fillStyle = '#1C1917';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(isGu ? 'Expense Diary AI - નાણાકીય હિસાબ રિપોર્ટ' : 'Expense Diary AI - Financial Report', 40, 55);

    ctx.fillStyle = '#78716C';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${isGu ? 'સમયગાળો' : 'Period'}: ${period} | ${isGu ? 'જનરેટ તારીખ' : 'Generated'}: ${new Date().toLocaleDateString()}`, 40, 85);

    // Summary Box
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E7E5E4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(40, 105, 920, 80, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${t.totalIncome}: ${currency}${totalIncome.toLocaleString()}`, 65, 150);

    ctx.fillStyle = '#DC2626';
    ctx.fillText(`${t.totalExpense}: ${currency}${totalExpense.toLocaleString()}`, 380, 150);

    ctx.fillStyle = '#1C1917';
    ctx.fillText(`${t.netSavings}: ${currency}${netSavings.toLocaleString()}`, 700, 150);

    // Table Header
    ctx.fillStyle = '#292524';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(isGu ? 'તારીખ' : 'Date', 50, 225);
    ctx.fillText(isGu ? 'પ્રકાર' : 'Type', 160, 225);
    ctx.fillText(isGu ? 'વિગત / શીર્ષક' : 'Title / Item', 260, 225);
    ctx.fillText(isGu ? 'કેટેગરી' : 'Category', 530, 225);
    ctx.fillText(isGu ? 'રકમ' : 'Amount', 830, 225);

    ctx.strokeStyle = '#D6D3D1';
    ctx.beginPath();
    ctx.moveTo(40, 235);
    ctx.lineTo(960, 235);
    ctx.stroke();

    // Table Rows
    ctx.font = '13px sans-serif';
    filteredData.forEach((tx, idx) => {
      const y = 265 + idx * 40;
      
      // Lined paper style horizontal guide line
      ctx.strokeStyle = '#E7E5E4';
      ctx.beginPath();
      ctx.moveTo(40, y + 8);
      ctx.lineTo(960, y + 8);
      ctx.stroke();

      ctx.fillStyle = '#57534E';
      ctx.fillText(tx.date, 50, y);

      const isInc = tx.type === 'income';
      ctx.fillStyle = isInc ? '#059669' : '#DC2626';
      ctx.fillText(isInc ? `${t.income} (+)` : `${t.expense} (-)`, 160, y);

      ctx.fillStyle = '#1C1917';
      ctx.fillText(tx.title.substring(0, 32), 260, y);

      ctx.fillStyle = '#78716C';
      ctx.fillText(tx.category, 530, y);

      ctx.fillStyle = isInc ? '#059669' : '#DC2626';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${currency}${tx.amount.toLocaleString()}`, 830, y);
      ctx.font = '13px sans-serif';
    });

    const link = document.createElement('a');
    link.download = `Expense_Report_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };


  // Theme styling classes for preview container
  const getThemeContainerClass = () => {
    switch (pageTheme) {
      case 'mint':
        return 'bg-[#f2fbf7] text-emerald-950 border-emerald-200';
      case 'lavender':
        return 'bg-[#faf7fd] text-purple-950 border-purple-200';
      case 'amber':
        return 'bg-[#fffdf5] text-amber-950 border-amber-200';
      case 'slate':
        return 'bg-[#f8fafc] text-slate-900 border-slate-200';
      case 'white':
        return 'bg-white text-stone-900 border-stone-200';
      case 'paper':
      default:
        return 'bg-[#fcfbf9] text-stone-800 border-stone-200';
    }
  };

  return (
    <div id="report-screen-container" className="space-y-6 pb-28">
      {/* Header & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-stone-100 text-stone-700">
              <FileText className="w-5 h-5 stroke-[1.75]" />
            </span>
            <h2 className="text-xl font-bold text-stone-900">
              નાણાકીય રિપોર્ટ (Financial Reports)
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            તારીખ, મહિનો, ક્વાર્ટર, છ મહિના, વરસ કે કસ્ટમ દિવસો મુજબ કસ્ટમાઇઝ કરી શકાય તેવા રિપોર્ટ્સ
          </p>
        </div>

        {/* 4 Multi-Format Export Buttons: PDF, Excel, Text, Image */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="export-pdf-btn"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-stone-900 text-white hover:bg-stone-800 active:scale-98 transition shadow-2xs"
            title="PDF પ્રિન્ટ અથવા ડાઉનલોડ"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            id="export-excel-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 active:scale-98 transition shadow-2xs"
            title="Excel / CSV ડાઉનલોડ"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            id="export-text-btn"
            onClick={handleExportText}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200 transition"
            title="પ્લેન ટેક્સ્ટ (.txt) ડાઉનલોડ"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>

          <button
            id="export-image-btn"
            onClick={handleExportImage}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200 transition"
            title="ઇમેજ (PNG) ડાઉનલોડ"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image</span>
          </button>
        </div>
      </div>

      {/* FILTER & CUSTOMIZATION ACCORDIONS / PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel 1: Time Periods Filter */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Calendar className="w-4 h-4 text-stone-400 stroke-[1.75]" />
            <span>સમયગાળો (Time Period)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'date', label: 'તારીખ વાઇઝ' },
              { id: 'month', label: 'મહિના વાઇઝ' },
              { id: 'quarter', label: 'ક્વાર્ટર (3M)' },
              { id: 'six_months', label: 'છ મહિના (6M)' },
              { id: 'year', label: 'વાર્ષિક (Year)' },
              { id: 'custom_range', label: 'કસ્ટમ તારીખ' },
              { id: 'custom_days', label: 'કસ્ટમ દિવસ' },
            ].map((item) => (
              <button
                key={item.id}
                id={`period-filter-${item.id}`}
                onClick={() => setPeriod(item.id as ReportPeriod)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                  period === item.id
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Dynamic Period Inputs */}
          <div className="pt-2 border-t border-stone-100">
            {period === 'date' && (
              <div>
                <label className="block text-xs text-stone-500 mb-1">તારીખ પસંદ કરો</label>
                <input
                  id="filter-input-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                />
              </div>
            )}

            {period === 'month' && (
              <div>
                <label className="block text-xs text-stone-500 mb-1">મહિનો પસંદ કરો</label>
                <input
                  id="filter-input-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                />
              </div>
            )}

            {period === 'quarter' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">વર્ષ</label>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">ત્રિમાસિક (Quarter)</label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none bg-white"
                  >
                    <option value="Q1">Q1 (જાન્યુ - માર્ચ)</option>
                    <option value="Q2">Q2 (એપ્રિલ - જૂન)</option>
                    <option value="Q3">Q3 (જુલાઈ - સપ્ટે)</option>
                    <option value="Q4">Q4 (ઓક્ટો - ડિસે)</option>
                  </select>
                </div>
              </div>
            )}

            {period === 'six_months' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">વર્ષ</label>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">અર્ધવાર્ષિક (6M)</label>
                  <select
                    value={selectedHalfYear}
                    onChange={(e) => setSelectedHalfYear(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none bg-white"
                  >
                    <option value="H1">પ્રથમ છ મહિના (જાન્યુ - જૂન)</option>
                    <option value="H2">દ્વિતીય છ મહિના (જુલાઈ - ડિસે)</option>
                  </select>
                </div>
              </div>
            )}

            {period === 'year' && (
              <div>
                <label className="block text-xs text-stone-500 mb-1">વર્ષ પસંદ કરો</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                />
              </div>
            )}

            {period === 'custom_range' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">શરૂઆત</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">અંત</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
                  />
                </div>
              </div>
            )}

            {period === 'custom_days' && (
              <div>
                <label className="block text-xs text-stone-500 mb-1">
                  છેલ્લા દિવસોની સંખ્યા: <strong className="text-stone-800">{customDaysCount} દિવસ</strong>
                </label>
                <div className="flex items-center gap-2">
                  {[7, 15, 30, 45, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setCustomDaysCount(d)}
                      className={`px-2 py-1 text-xs rounded-md border ${
                        customDaysCount === d ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'
                      }`}
                    >
                      {d}દિ
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Specific Filters (Category, Person, Type) */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Filter className="w-4 h-4 text-stone-400 stroke-[1.75]" />
            <span>કેટેગરી અને વ્યક્તિ ફિલ્ટર</span>
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">પ્રકાર</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setTypeFilter('all')}
                className={`py-1 text-xs rounded-lg border ${
                  typeFilter === 'all' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'
                }`}
              >
                બધા
              </button>
              <button
                onClick={() => setTypeFilter('income')}
                className={`py-1 text-xs rounded-lg border ${
                  typeFilter === 'income' ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-emerald-700'
                }`}
              >
                માત્ર આવક
              </button>
              <button
                onClick={() => setTypeFilter('expense')}
                className={`py-1 text-xs rounded-lg border ${
                  typeFilter === 'expense' ? 'bg-rose-700 text-white' : 'bg-stone-50 text-rose-700'
                }`}
              >
                માત્ર ખર્ચ
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">ચોક્કસ કેટેગરી</label>
            <select
              id="report-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none bg-white"
            >
              <option value="all">બધી કેટેગરીઝ (All)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.nameGu ? `${cat.nameGu} (${cat.name})` : cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">
              ચોક્કસ વ્યક્તિ અથવા મોબાઈલ નંબર
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                id="report-person-filter"
                type="text"
                placeholder="દા.ત. રમેશભાઈ અથવા 9876..."
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Panel 3: Style, Colors & Column Selector */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Palette className="w-4 h-4 text-stone-400 stroke-[1.75]" />
            <span>પેઇજ કલર, લેઆઉટ અને કોલમ્સ</span>
          </div>

          {/* Color Themes */}
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">પેઇજનો રંગ</label>
            <div className="flex items-center gap-2">
              {[
                { id: 'paper', label: 'ક્રીમ પેપર', bg: 'bg-[#faf8f5]', border: 'border-stone-300' },
                { id: 'white', label: 'સ્વચ્છ સફેદ', bg: 'bg-white', border: 'border-stone-200' },
                { id: 'mint', label: 'આછો લીલો', bg: 'bg-[#f0fdf4]', border: 'border-emerald-300' },
                { id: 'lavender', label: 'લેવેન્ડર', bg: 'bg-[#faf5ff]', border: 'border-purple-300' },
                { id: 'amber', label: 'હૂંફાળો પીળો', bg: 'bg-[#fffbeb]', border: 'border-amber-300' },
              ].map((th) => (
                <button
                  key={th.id}
                  onClick={() => setPageTheme(th.id as PageTheme)}
                  title={th.label}
                  className={`w-7 h-7 rounded-full ${th.bg} ${th.border} border-2 flex items-center justify-center transition-transform ${
                    pageTheme === th.id ? 'scale-110 ring-2 ring-stone-400' : 'hover:scale-105'
                  }`}
                >
                  {pageTheme === th.id && <Check className="w-3.5 h-3.5 text-stone-800" />}
                </button>
              ))}
            </div>
          </div>

          {/* Layout Styles */}
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">ડિઝાઇન શૈલી (Style)</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'ruled', label: 'લાઇનિંગ વાળું' },
                { id: 'box', label: 'બોક્સ વાળું' },
                { id: 'minimal', label: 'મિનિમલ કાર્ડ' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setLayoutStyle(st.id as LayoutStyle)}
                  className={`py-1 text-xs font-medium rounded-lg border transition ${
                    layoutStyle === st.id ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column Customizer */}
          <div>
            <label className="block text-xs text-stone-500 mb-1.5">
              કોલમ્સ કસ્ટમાઇઝ (પસંદગી મુજબ ગોઠવો)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {columnDefs.map((col) => {
                const isSelected = selectedColumns.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`px-2 py-1 text-[11px] rounded-md border transition-all ${
                      isSelected
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'bg-white text-stone-500 border-stone-200 line-through opacity-70'
                    }`}
                  >
                    {col.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* LIVE REPORT PREVIEW (STYLED PAGE) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-stone-500 px-1">
          <span className="font-semibold uppercase tracking-wider">
            રિપોર્ટ પ્રિવ્યૂ (લાઈવ કસ્ટમાઈઝ્ડ આઉટપુટ)
          </span>
          <span>કુલ પરિણામો: {filteredData.length} વ્યવહારો</span>
        </div>

        <div
          ref={reportPreviewRef}
          id="custom-report-printable-area"
          className={`overflow-hidden rounded-2xl border p-6 sm:p-8 shadow-sm transition-colors ${getThemeContainerClass()}`}
        >
          {/* Header of Report Document */}
          <div className="border-b border-stone-200/80 pb-5 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-stone-100 text-stone-600 mb-1.5">
                Expense Diary AI • અધિકૃત નાણાકીય સ્ટેટમેન્ટ
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                નાણાકીય હિસાબ રિપોર્ટ
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                સમયગાળો: <span className="font-semibold text-stone-700">{period.toUpperCase()}</span> | જનરેટ તારીખ: {new Date().toLocaleDateString('gu-IN')}
              </p>
            </div>

            {/* Financial Summary Badges in Bold Typography Theme */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-2xl bg-[#EBFBEE] border border-[#D1F7D9] text-right">
                <div className="text-[10px] font-semibold text-[#2D6A4F] uppercase">કુલ આવક</div>
                <div className="text-base sm:text-lg font-bold font-mono text-[#1B4332]">
                  {currency}{totalIncome.toLocaleString()}
                </div>
              </div>

              <div className="px-4 py-2.5 rounded-2xl bg-[#FFF0F0] border border-[#FEE2E2] text-right">
                <div className="text-[10px] font-semibold text-[#C53030] uppercase">કુલ ખર્ચ</div>
                <div className="text-base sm:text-lg font-bold font-mono text-[#742A2A]">
                  {currency}{totalExpense.toLocaleString()}
                </div>
              </div>

              <div className="px-4 py-2.5 rounded-2xl bg-white border border-[#E1E8ED] text-right shadow-xs">
                <div className="text-[10px] font-semibold text-[#636E72] uppercase">ચોખ્ખી બચત</div>
                <div className={`text-base sm:text-lg font-bold font-mono ${netSavings >= 0 ? 'text-[#1B4332]' : 'text-[#742A2A]'}`}>
                  {currency}{netSavings.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Report Data Presentation */}
          {filteredData.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              આ પસંદ કરેલ ફિલ્ટરમાં કોઈ વ્યવહાર મળ્યો નથી.
            </div>
          ) : layoutStyle === 'minimal' ? (
            /* Minimal Card List View */
            <div className="space-y-2.5">
              {filteredData.map((item) => {
                const isInc = item.type === 'income';
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white/80 border border-stone-200/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{item.title}</div>
                      <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                        <span>{item.date} {item.time}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                        {item.vendorOrPerson && <span>• {item.vendorOrPerson}</span>}
                      </div>
                    </div>
                    <div className={`text-base font-bold font-mono ${isInc ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isInc ? '+' : '-'} {currency}{item.amount.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Lined Paper or Boxed Table View */
            <div className="overflow-x-auto">
              <table
                className={`w-full text-left text-xs border-collapse ${
                  layoutStyle === 'box' ? 'border border-stone-300' : ''
                }`}
              >
                <thead>
                  <tr
                    className={`border-b-2 border-stone-300 text-stone-700 font-semibold ${
                      layoutStyle === 'box' ? 'bg-stone-100/70' : 'bg-transparent'
                    }`}
                  >
                    {selectedColumns.includes('date') && (
                      <th className={`py-3 px-3.5 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        તારીખ
                      </th>
                    )}
                    {selectedColumns.includes('income') && (
                      <th className={`py-3 px-3.5 text-emerald-800 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        આવક (+)
                      </th>
                    )}
                    {selectedColumns.includes('incomeSource') && (
                      <th className={`py-3 px-3.5 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        આવકનો સ્ત્રોત
                      </th>
                    )}
                    {selectedColumns.includes('expense') && (
                      <th className={`py-3 px-3.5 text-rose-800 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        જાવક (-)
                      </th>
                    )}
                    {selectedColumns.includes('expenseSource') && (
                      <th className={`py-3 px-3.5 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        જાવકનો સ્ત્રોત
                      </th>
                    )}
                    {selectedColumns.includes('personOrMobile') && (
                      <th className={`py-3 px-3.5 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        વ્યક્તિ / મોબાઈલ
                      </th>
                    )}
                    {selectedColumns.includes('paymentMode') && (
                      <th className={`py-3 px-3.5 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        પદ્ધતિ
                      </th>
                    )}
                    {selectedColumns.includes('notes') && (
                      <th className="py-3 px-3.5">નોંધ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/80">
                  {filteredData.map((item, index) => {
                    const isInc = item.type === 'income';
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          layoutStyle === 'ruled'
                            ? 'border-b border-stone-200/70 hover:bg-stone-50/50'
                            : 'border-b border-stone-300 hover:bg-stone-50/50'
                        }`}
                      >
                        {selectedColumns.includes('date') && (
                          <td
                            className={`py-2.5 px-3.5 font-mono text-stone-600 whitespace-nowrap ${
                              layoutStyle === 'box' ? 'border-r border-stone-300' : ''
                            }`}
                          >
                            {item.date} <span className="text-[10px] text-stone-400">{item.time}</span>
                          </td>
                        )}

                        {selectedColumns.includes('income') && (
                          <td
                            className={`py-2.5 px-3.5 font-mono font-semibold whitespace-nowrap ${
                              isInc ? 'text-emerald-700' : 'text-stone-300'
                            } ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}
                          >
                            {isInc ? `${currency}${item.amount.toLocaleString()}` : '-'}
                          </td>
                        )}

                        {selectedColumns.includes('incomeSource') && (
                          <td
                            className={`py-2.5 px-3.5 text-stone-800 ${
                              layoutStyle === 'box' ? 'border-r border-stone-300' : ''
                            }`}
                          >
                            {isInc ? item.title : '-'}
                          </td>
                        )}

                        {selectedColumns.includes('expense') && (
                          <td
                            className={`py-2.5 px-3.5 font-mono font-semibold whitespace-nowrap ${
                              !isInc ? 'text-rose-700' : 'text-stone-300'
                            } ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}
                          >
                            {!isInc ? `${currency}${item.amount.toLocaleString()}` : '-'}
                          </td>
                        )}

                        {selectedColumns.includes('expenseSource') && (
                          <td
                            className={`py-2.5 px-3.5 text-stone-800 ${
                              layoutStyle === 'box' ? 'border-r border-stone-300' : ''
                            }`}
                          >
                            {!isInc ? `${item.title} (${item.category})` : '-'}
                          </td>
                        )}

                        {selectedColumns.includes('personOrMobile') && (
                          <td
                            className={`py-2.5 px-3.5 text-stone-600 ${
                              layoutStyle === 'box' ? 'border-r border-stone-300' : ''
                            }`}
                          >
                            {item.vendorOrPerson || ''} {item.mobileNumber ? `(${item.mobileNumber})` : ''}
                          </td>
                        )}

                        {selectedColumns.includes('paymentMode') && (
                          <td
                            className={`py-2.5 px-3.5 text-stone-500 whitespace-nowrap ${
                              layoutStyle === 'box' ? 'border-r border-stone-300' : ''
                            }`}
                          >
                            {item.paymentMode}
                          </td>
                        )}

                        {selectedColumns.includes('notes') && (
                          <td className="py-2.5 px-3.5 text-stone-500 max-w-xs truncate">
                            {item.notes || '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={`font-bold border-t-2 border-stone-400 ${layoutStyle === 'box' ? 'bg-stone-100' : 'bg-transparent'}`}>
                    {selectedColumns.includes('date') && (
                      <td className={`py-3 px-3.5 ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        કુલ (TOTAL)
                      </td>
                    )}
                    {selectedColumns.includes('income') && (
                      <td className={`py-3 px-3.5 text-emerald-800 font-mono ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        {currency}{totalIncome.toLocaleString()}
                      </td>
                    )}
                    {selectedColumns.includes('incomeSource') && (
                      <td className={`${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}></td>
                    )}
                    {selectedColumns.includes('expense') && (
                      <td className={`py-3 px-3.5 text-rose-800 font-mono ${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}>
                        {currency}{totalExpense.toLocaleString()}
                      </td>
                    )}
                    {selectedColumns.includes('expenseSource') && (
                      <td className={`${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}></td>
                    )}
                    {selectedColumns.includes('personOrMobile') && (
                      <td className={`${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}></td>
                    )}
                    {selectedColumns.includes('paymentMode') && (
                      <td className={`${layoutStyle === 'box' ? 'border-r border-stone-300' : ''}`}></td>
                    )}
                    {selectedColumns.includes('notes') && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Footer of Statement */}
          <div className="mt-8 pt-4 border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-400">
            <div>Expense Diary AI • સુરક્ષિત અને વ્યક્તિગત ઓફલાઇન-ફર્સ્ટ ડાયરી</div>
            <div>પૃષ્ઠ 1 / 1</div>
          </div>
        </div>
      </div>
    </div>
  );
};
