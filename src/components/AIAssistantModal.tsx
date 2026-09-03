import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  MessageSquareText, 
  Lightbulb, 
  ShieldAlert, 
  Send, 
  Check, 
  Smartphone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Transaction, Category, PendingAIMessage, AppActivityAlert } from '../types';
import { TranslationStrings } from '../data/languages';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  onAddPendingAiMessage: (msg: PendingAIMessage) => void;
  currency: string;
  currentLang: string;
  t: TranslationStrings;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories,
  onAddTransaction,
  onAddPendingAiMessage,
  currency,
  currentLang,
  t,
}) => {
  if (!isOpen) return null;

  const isGu = currentLang === 'gu';
  const [activeSubTab, setActiveSubTab] = useState<'offlineChat' | 'smsParser' | 'advisor' | 'appAlerts'>('offlineChat');

  // Offline cash expense chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; time: string }>>([
    {
      sender: 'ai',
      text: isGu
        ? 'નમસ્તે! શું તમે આજે દિવસ દરમિયાન ક્યાંય ઓફલાઇન અથવા રોકડ (Cash) ખર્ચ કર્યો છે? જો કર્યો હોય તો મને રકમ અને વિગત જણાવો, હું ડાયરીમાં નોંધી લઈશ.'
        : 'Hello! Did you make any offline or cash expenses today? Tell me the amount and item, and I will record it in your diary.',
      time: 'Today',
    },
  ]);

  // SMS input state
  const [smsInput, setSmsInput] = useState('');
  const [smsStatus, setSmsStatus] = useState<string | null>(null);

  // App Activity Alerts
  const [appAlerts, setAppAlerts] = useState<AppActivityAlert[]>([
    {
      id: 'app-alert-1',
      appName: 'Amazon India',
      timeString: isGu ? 'બપોરે 03:15 વાગ્યે' : '3:15 PM today',
      question: isGu
        ? 'તમે આજે બપોરે 03:15 વાગ્યે Amazon એપ ખોલી હતી. શું તમે ત્યાં કોઈ ખર્ચ કર્યો હતો?'
        : 'You opened Amazon at 3:15 PM today. Did you make any purchase?',
    },
    {
      id: 'app-alert-2',
      appName: 'Google Pay (GPay)',
      timeString: isGu ? 'સાંજે 06:40 વાગ્યે' : '6:40 PM today',
      question: isGu
        ? 'તમે આજે સાંજે 06:40 વાગ્યે GPay યુઝ કર્યું હતું. શું તમે કોઈ પેમેન્ટ કર્યું હતું જે ડાયરીમાં નોંધવાનું બાકી છે?'
        : 'You opened GPay at 6:40 PM today. Did you make any payment that needs to be logged?',
    },
  ]);

  // Quick SMS samples
  const sampleBankMessages = [
    {
      label: isGu ? 'HDFC પગાર જમા (Salary Credit)' : 'HDFC Salary Credit',
      text: 'Dear Customer, your A/c ending 4821 has been credited with Rs. 55,000.00 on 03-Sep-2026 by NEFT from INFOSYS TECHNOLOGIES SALARY. Avl Bal: Rs 82,410.00.',
    },
    {
      label: isGu ? 'SBI UPI ખર્ચ (Zomato Food)' : 'SBI UPI Food Expense',
      text: 'Dear SBI User, your A/c 9021 is debited by Rs 420.00 on 03Sep26 transfer to Zomato India Pvt Ltd ref no 62410291948. If not you, SMS BLOCK to 9223008333.',
    },
    {
      label: isGu ? 'વીજળી બિલ ચૂકવણી (Torrent Power)' : 'Electricity Bill Payment',
      text: 'Thank you for payment of Rs. 1,650.00 towards Torrent Power Electricity Bill for Consumer No 1928374 on 02-Sep-2026 via UPI. Receipt: TOR-83921.',
    },
  ];

  // Handle Offline Chat message send
  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatMessages((prev) => [...prev, { sender: 'user', text: userText, time: nowTime }]);
    setChatInput('');

    // Parse amount from text
    const amountMatch = userText.match(/(\d+(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    const isNegative = /ના|no|nahi|nothing|કઈ નથી|નથી/i.test(userText);

    setTimeout(() => {
      if (isNegative || amount === 0) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: isGu
              ? 'સરસ! આજે કોઈ વધારાનો ખર્ચ નોંધાયો નથી. બચત સારી ચાલી રહી છે.'
              : 'Great! No extra expense recorded. Good job keeping to your budget.',
            time: nowTime,
          },
        ]);
        return;
      }

      // Infer category
      let category = 'Food & Dining';
      let title = userText.replace(/\d+/g, '').replace(/રૂપિયા|rs|inr|cash|રોકડા/gi, '').trim();
      if (!title) title = isGu ? 'ઓફલાઇન ખર્ચ' : 'Offline Expense';

      if (/શાક|શાકભાજી|grocery|કરિયાણું|દૂધ/i.test(userText)) {
        category = 'Groceries';
      } else if (/ચા|નાસ્તો|જમવા|restaurant|lunch|dinner|hotel/i.test(userText)) {
        category = 'Food & Dining';
      } else if (/પેટ્રોલ|ડીઝલ|fuel|petrol|riksha|auto|bus|ભાડું/i.test(userText)) {
        category = 'Travel & Fuel';
      } else if (/દવા|medical|medicine|ડોક્ટર/i.test(userText)) {
        category = 'Health & Medicines';
      }

      // Log transaction
      onAddTransaction({
        type: 'expense',
        amount,
        title,
        category,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        paymentMode: 'Cash',
        notes: isGu ? `AI ચેટ દ્વારા ઉમેરેલ: "${userText}"` : `Logged via AI Chat: "${userText}"`,
        isAiGenerated: true,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: isGu
            ? `મેં ₹${amount} નો "${title}" ખર્ચ (${category}) તમારી ડાયરીમાં નોંધી લીધો છે!`
            : `I have logged ${currency}${amount} for "${title}" under ${category} into your diary!`,
          time: nowTime,
        },
      ]);
    }, 400);
  };

  // Handle SMS Parser
  const handleParseSMS = (textToParse: string) => {
    if (!textToParse.trim()) return;

    const lower = textToParse.toLowerCase();
    const isCredited = /credited|deposited|received|જમા|મળ્યા|credited with/i.test(lower);
    const isDebited = /debited|spent|paid|payment of|transfer to|ચૂકવ્યા|કપાયા/i.test(lower);

    // Extract amount
    const amtMatch = textToParse.match(/(?:rs\.?|inr|inr\.?)\s*([\d,]+(?:\.\d{2})?)/i) ||
                     textToParse.match(/([\d,]+(?:\.\d{2})?)\s*(?:rs|inr)/i) ||
                     textToParse.match(/([\d,]+(?:\.\d{2})?)/);

    const amountStr = amtMatch ? amtMatch[1].replace(/,/g, '') : '0';
    const amount = parseFloat(amountStr) || 0;

    const type: 'income' | 'expense' = isCredited ? 'income' : 'expense';

    // Infer vendor/merchant
    let vendor = '';
    if (/zomato/i.test(textToParse)) vendor = 'Zomato Food';
    else if (/swiggy/i.test(textToParse)) vendor = 'Swiggy Food';
    else if (/torrent/i.test(textToParse)) vendor = 'Torrent Power';
    else if (/infosys/i.test(textToParse)) vendor = 'Infosys Salary';
    else if (/amazon/i.test(textToParse)) vendor = 'Amazon Shopping';
    else if (/flipkart/i.test(textToParse)) vendor = 'Flipkart Shopping';
    else vendor = type === 'income' ? 'Bank Deposit' : 'Merchant Payment';

    let category = 'Other Expense';
    if (type === 'income') {
      category = /salary|પગાર/i.test(textToParse) ? 'Salary' : 'Other Income';
    } else {
      if (/food|zomato|swiggy|restaurant/i.test(textToParse)) category = 'Food & Dining';
      else if (/bill|power|electricity|recharge|dth/i.test(textToParse)) category = 'Bills & Utilities';
      else if (/grocery|mart|store|શાકભાજી/i.test(textToParse)) category = 'Groceries';
    }

    const question = isGu
      ? `AI દ્વારા મેસેજ ઓળખાયો: શું ${currency}${amount} નો વ્યવહાર (${vendor}) સાચો છે?`
      : `AI detected a transaction: Is ${currency}${amount} (${vendor}) correct?`;

    const newPending: PendingAIMessage = {
      id: `pending-ai-${Date.now()}`,
      rawText: textToParse,
      parsedData: {
        type,
        amount,
        title: vendor,
        category,
        vendorOrPerson: vendor,
        paymentMode: /upi/i.test(textToParse) ? 'UPI' : (/neft|bank/i.test(textToParse) ? 'Bank Transfer' : 'Card'),
        notes: isGu ? 'બેંક SMS માંથી આપમેળે ઓળખાયેલ' : 'Auto-detected from Bank SMS',
        confirmationQuestion: question,
      },
      detectedAt: new Date().toISOString(),
    };

    onAddPendingAiMessage(newPending);
    setSmsStatus(isGu ? 'મેસેજ સફળતાપૂર્વક પાર્સ થયો! હોમ સ્ક્રીન પર કન્ફર્મેશન કાર્ડ ઉમેરાઈ ગયું છે.' : 'Transaction detected! Confirmation card has been added to Home Screen.');
    setSmsInput('');
  };

  // Spending calculations for Financial Advisor
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const highestCategory = sortedCategories[0];

  return (
    <div
      id="ai-assistant-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="ai-assistant-card"
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 leading-tight">
                {isGu ? 'AI ફાયનાન્સિયલ સહાયક' : 'AI Financial Assistant'}
              </h3>
              <p className="text-xs text-stone-500">
                {isGu ? 'સ્માર્ટ ટ્રેકિંગ, SMS પાર્સર અને ઑફલાઇન ચેટ' : 'Smart Tracking, SMS Parser & Offline Chat'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex border-b border-stone-100 bg-stone-50/70 p-1.5 gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('offlineChat')}
            className={`flex-1 py-2 rounded-xl transition text-center cursor-pointer ${
              activeSubTab === 'offlineChat'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {isGu ? 'રોકડ ખર્ચ ચેટ' : 'Cash Expense Chat'}
          </button>
          <button
            onClick={() => setActiveSubTab('smsParser')}
            className={`flex-1 py-2 rounded-xl transition text-center cursor-pointer ${
              activeSubTab === 'smsParser'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {isGu ? 'SMS / મેસેજ પાર્સર' : 'SMS Parser'}
          </button>
          <button
            onClick={() => setActiveSubTab('advisor')}
            className={`flex-1 py-2 rounded-xl transition text-center cursor-pointer ${
              activeSubTab === 'advisor'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {isGu ? 'બચત સલાહ' : 'AI Advisor'}
          </button>
          <button
            onClick={() => setActiveSubTab('appAlerts')}
            className={`flex-1 py-2 rounded-xl transition text-center cursor-pointer ${
              activeSubTab === 'appAlerts'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {isGu ? 'ઍપ રીમાઇન્ડર' : 'App Prompts'}
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: Conversational Offline Cash Logger */}
          {activeSubTab === 'offlineChat' && (
            <div className="flex flex-col h-[340px] justify-between">
              <div className="space-y-3 overflow-y-auto pr-1">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-xs'
                          : 'bg-stone-100 text-stone-800 rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Chat input box */}
              <div className="mt-3 pt-3 border-t border-stone-100 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  placeholder={
                    isGu
                      ? 'દા.ત. શાકભાજી ૨૫૦ રૂપિયા રોકડા અથવા ચા ૪૦'
                      : 'e.g. Lunch 200 cash or Groceries 450'
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                />
                <button
                  onClick={handleSendChatMessage}
                  className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Bank SMS & Notification Parser */}
          {activeSubTab === 'smsParser' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  {isGu ? 'બેંક મેસેજ પેસ્ટ કરો (Paste Bank SMS / UPI Alert)' : 'Paste Bank SMS / Alert Text'}
                </label>
                <textarea
                  rows={3}
                  value={smsInput}
                  onChange={(e) => {
                    setSmsInput(e.target.value);
                    setSmsStatus(null);
                  }}
                  placeholder={
                    isGu
                      ? 'Dear User, your A/c has been debited by Rs. 350.00 transfer to Zomato UPI...'
                      : 'Dear Customer, your A/c has been credited with Rs. 25,000.00...'
                  }
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-stone-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none"
                />
              </div>

              {smsStatus && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{smsStatus}</span>
                </div>
              )}

              <button
                onClick={() => handleParseSMS(smsInput)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
              >
                {isGu ? 'મેસેજ પાર્સ કરો અને શોધો' : 'Parse & Detect Transaction'}
              </button>

              {/* Sample Presets for Quick Testing */}
              <div className="pt-2">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  {isGu ? 'ટેસ્ટિંગ માટે તૈયાર મેસેજ (Quick Presets):' : 'Quick Test Samples:'}
                </p>
                <div className="space-y-1.5">
                  {sampleBankMessages.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSmsInput(s.text);
                        handleParseSMS(s.text);
                      }}
                      className="w-full text-left p-2.5 rounded-xl border border-stone-100 bg-stone-50/70 hover:bg-indigo-50 hover:border-indigo-200 transition text-xs flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium text-stone-800">{s.label}</span>
                      <span className="text-[10px] text-indigo-600 font-semibold">{isGu ? 'ટેસ્ટ કરો' : 'Test'} &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI Financial Advisor */}
          {activeSubTab === 'advisor' && (
            <div className="space-y-4">
              {/* Spending Pattern Insight */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs sm:text-sm uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <span>{isGu ? 'મુખ્ય ખર્ચ વિશ્લેષણ (High Spend Analysis)' : 'High Spend Analysis'}</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {highestCategory
                    ? (isGu
                        ? `તમારો સૌથી વધુ ખર્ચ "${highestCategory[0]}" માં થયો છે (કુલ ${currency}${highestCategory[1].toLocaleString()}). જો આ કેટેગરીમાં ૧૫% ઘટાડો કરશો તો દર મહિને ${currency}${Math.round(highestCategory[1] * 0.15).toLocaleString()} ની બચત થઈ શકે છે.`
                        : `Your highest expense is in "${highestCategory[0]}" (${currency}${highestCategory[1].toLocaleString()}). Cutting 15% here could save you ${currency}${Math.round(highestCategory[1] * 0.15).toLocaleString()} each month.`)
                    : (isGu
                        ? 'હજુ પૂરતા વ્યવહારો નોંધાયા નથી. જેમ જેમ તમે ખર્ચ ઉમેરશો તેમ AI સ્માર્ટ વિશ્લેષણ આપશે.'
                        : 'No transactions recorded yet. Add expenses to see personalized AI insights.')}
                </p>
              </div>

              {/* Hidden Charges & Penalties Alert */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs sm:text-sm uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>{isGu ? 'છૂપા ચાર્જીસ અને દંડથી બચો' : 'Hidden Charges & Penalties'}</span>
                </div>
                <ul className="text-xs text-rose-900 space-y-1.5 pl-4 list-disc leading-relaxed">
                  <li>
                    {isGu
                      ? 'બેંક ખાતામાં મિનિમમ બેલેન્સ જાળવો જેથી દર ક્વાર્ટરે લાગતો ₹200-₹500 નો દંડ બચે.'
                      : 'Keep minimum required bank balance to avoid ₹200-₹500 quarterly penalties.'}
                  </li>
                  <li>
                    {isGu
                      ? 'વીજળી કે ક્રેડિટ કાર્ડ બિલ નિયત તારીખ પહેલાં ચૂકવો જેથી ₹150+ લેટ ફી ન લાગે.'
                      : 'Pay utility bills before due date to avoid late fees.'}
                  </li>
                  <li>
                    {isGu
                      ? 'બિનઉપયોગી OTT કે એપ સબ્સ્ક્રિપ્શન ઑટો-ડેબિટ રદ કરો.'
                      : 'Cancel unused recurring app subscriptions.'}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: Shopping / Payment App Prompts */}
          {activeSubTab === 'appAlerts' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 leading-relaxed">
                {isGu
                  ? 'તમે દિવસ દરમિયાન કોઈ શોપિંગ કે પેમેન્ટ એપ ખોલી હોય પણ SMS ન મળ્યો હોય, તો AI તમને પૂછીને ખર્ચ નોંધી આપશે:'
                  : 'If you opened a shopping or payment app without an SMS alert, AI helps you log it:'}
              </p>

              {appAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold text-xs sm:text-sm text-stone-800">{alert.appName}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium">{alert.timeString}</span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">{alert.question}</p>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        onAddTransaction({
                          type: 'expense',
                          amount: 299,
                          title: `${alert.appName} Purchase`,
                          category: 'Shopping',
                          date: new Date().toISOString().split('T')[0],
                          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                          paymentMode: 'UPI',
                          notes: isGu ? 'ઍપ રીમાઇન્ડર દ્વારા ઉમેરેલ' : 'Logged from App Prompt',
                          isAiGenerated: true,
                        });
                        setAppAlerts(prev => prev.filter(a => a.id !== alert.id));
                      }}
                      className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      {isGu ? 'હા, ₹299 નોંધી લો' : 'Yes, Log Expense'}
                    </button>
                    <button
                      onClick={() => setAppAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      className="py-1.5 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium transition cursor-pointer"
                    >
                      {isGu ? 'ના, કઈ ખરીદ્યું નથી' : 'No, Did not spend'}
                    </button>
                  </div>
                </div>
              ))}

              {appAlerts.length === 0 && (
                <div className="p-6 text-center text-xs text-stone-400">
                  {isGu ? 'બધા ઍપ રીમાઇન્ડર્સ ક્લિયર થઈ ગયા છે.' : 'All app prompts resolved.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
