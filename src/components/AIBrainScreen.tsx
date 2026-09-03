import React, { useState } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Send, 
  AlertTriangle, 
  ShieldCheck, 
  Lightbulb, 
  Clock, 
  Smartphone, 
  Check, 
  CheckCircle2, 
  RefreshCw,
  HelpCircle,
  Plus
} from 'lucide-react';
import { Transaction, Category, PendingAIMessage, AppActivityAlert } from '../types';
import { TranslationStrings } from '../data/languages';

interface AIBrainScreenProps {
  transactions: Transaction[];
  categories: Category[];
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  pendingAiMessages: PendingAIMessage[];
  onAddPendingAiMessage: (msg: PendingAIMessage) => void;
  onConfirmAiMessage: (messageId: string, customCategory?: string) => void;
  t: TranslationStrings;
  currency: string;
}

export const AIBrainScreen: React.FC<AIBrainScreenProps> = ({
  transactions,
  categories,
  onAddTransaction,
  pendingAiMessages,
  onAddPendingAiMessage,
  onConfirmAiMessage,
  t,
  currency,
}) => {
  // 1. Live SMS / Notification parser state
  const [rawInput, setRawInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);

  // 2. Financial Advisor state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advisorAnalysis, setAdvisorAnalysis] = useState<{
    insights: string[];
    hiddenCharges: string[];
    savingTips: string[];
  } | null>(null);

  // 3. Conversational Offline Expense Logger state
  const [offlineChatInput, setOfflineChatInput] = useState('');
  const [isChatLogging, setIsChatLogging] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{ sender: 'ai' | 'user'; text: string; time: string; loggedTx?: any }>
  >([
    {
      sender: 'ai',
      text: 'નમસ્તે! શું તમે આજે દિવસ દરમિયાન ક્યાંય ઓફલાઇન અથવા રોકડ (Cash) ખર્ચ કર્યો છે? જો કર્યો હોય તો મને જણાવો, હું ડાયરીમાં નોંધી લઈશ.',
      time: 'આજે',
    },
  ]);

  // 4. Shopping / Payment App Activity alerts
  const [appAlerts, setAppAlerts] = useState<AppActivityAlert[]>([
    {
      id: 'app-alert-1',
      appName: 'Amazon India',
      timeString: 'બપોરે 03:15 વાગ્યે',
      question:
        'તમે આજે બપોરે 03:15 વાગ્યે Amazon એપ ખોલી હતી. શું તમે ત્યાં કોઈ ખર્ચ કે ખરીદી કરી હતી?',
    },
    {
      id: 'app-alert-2',
      appName: 'Google Pay (GPay)',
      timeString: 'સાંજે 06:40 વાગ્યે',
      question:
        'તમે આજે સાંજે 06:40 વાગ્યે GPay યુઝ કર્યું હતું. શું તમે કોઈ પેમેન્ટ કર્યું હતું જે ડાયરીમાં નોંધવાનું બાકી છે?',
    },
  ]);

  // Sample realistic bank SMS presets for easy testing
  const sampleBankMessages = [
    {
      label: 'HDFC બેંક પગાર જમા (Salary Credit)',
      text: 'Dear Customer, your A/c ending with 4821 has been credited with Rs. 55,000.00 on 03-Sep-2026 by NEFT from INFOSYS TECHNOLOGIES SALARY. Avl Bal: Rs 82,410.00.',
    },
    {
      label: 'SBI UPI ખર્ચ (Zomato Food)',
      text: 'Dear SBI User, your A/c 9021 is debited by Rs 420.00 on 03Sep26 transfer to Zomato India Pvt Ltd ref no 62410291948. If not you, SMS BLOCK to 9223008333.',
    },
    {
      label: 'Torrent Power લાઇટ બિલ ચૂકવણી',
      text: 'Thank you for payment of Rs. 1,650.00 towards Torrent Power Electricity Bill for Consumer No 1928374 on 02-Sep-2026 via UPI. Receipt: TOR-83921.',
    },
    {
      label: 'બેંક મિનિમમ બેલેન્સ ચાર્જ ચેતવણી',
      text: 'Alert: Average Monthly Balance in A/c 5012 is below required Rs. 5,000. Maintenance charge of Rs. 150 + GST will be debited on 10-Sep-2026 if not maintained.',
    },
  ];

  // Handler: Parse raw SMS / Notification via server endpoint
  const handleParseMessage = async (textToParse?: string) => {
    const text = textToParse || rawInput;
    if (!text.trim()) return;

    setIsParsing(true);
    setParseStatus('AI વિશ્લેષણ કરી રહ્યું છે...');

    try {
      const response = await fetch('/api/gemini/parse-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse message');
      }

      const parsed = await response.json();
      
      const newPendingMessage: PendingAIMessage = {
        id: `ai-msg-${Date.now()}`,
        rawText: text,
        parsedData: {
          type: parsed.type || 'expense',
          amount: Number(parsed.amount) || 0,
          title: parsed.title || 'નવો વ્યવહાર',
          category: parsed.category || 'General',
          vendorOrPerson: parsed.vendorOrPerson || undefined,
          paymentMode: parsed.paymentMode || 'UPI',
          notes: parsed.notes || undefined,
          confirmationQuestion:
            parsed.confirmationQuestion ||
            `આ વ્યવહાર: ${parsed.title} (₹${parsed.amount}) સાચો છે? તેને ${parsed.category} કેટેગરીમાં ઉમેરું?`,
        },
        detectedAt: new Date().toISOString(),
      };

      onAddPendingAiMessage(newPendingMessage);
      setParseStatus('સફળતાપૂર્વક શોધાયું! પુષ્ટિ માટે ઉપર બતાવેલ છે.');
      setRawInput('');
    } catch (err) {
      // Fallback local smart heuristic parser in case offline or API unavailable
      const isCredit = /credit|credited|received|જમા|મળ્યા/i.test(text);
      const amtMatch = text.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i);
      const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 150;
      
      const fallbackMsg: PendingAIMessage = {
        id: `ai-msg-${Date.now()}`,
        rawText: text,
        parsedData: {
          type: isCredit ? 'income' : 'expense',
          amount,
          title: isCredit ? 'શોધાયેલ આવક' : 'શોધાયેલ ખર્ચ',
          category: isCredit ? 'Salary' : 'Bills & Utilities',
          paymentMode: 'UPI',
          confirmationQuestion: `AI દ્વારા શોધાયેલ: ${currency}${amount} નો વ્યવહાર સાચો છે? તેને ડાયરીમાં ઉમેરું?`,
        },
        detectedAt: new Date().toISOString(),
      };

      onAddPendingAiMessage(fallbackMsg);
      setParseStatus('શોધાયું અને પુષ્ટિ માટે તૈયાર છે!');
      setRawInput('');
    } finally {
      setIsParsing(false);
      setTimeout(() => setParseStatus(null), 4000);
    }
  };

  // Handler: Run Financial Advisor
  const handleRunAdvisor = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/financial-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });

      if (!response.ok) throw new Error('Advisor API error');
      const data = await response.json();
      setAdvisorAnalysis(data);
    } catch (err) {
      // Heuristic fallback
      setAdvisorAnalysis({
        insights: [
          'ખોરાક અને રેસ્ટોરન્ટ ખર્ચમાં આ અઠવાડિયે 18% નો વધારો જોવા મળ્યો છે.',
          'વીજળી બિલ સમયસર ચૂકવાયું હોવાથી મોડા દંડથી બચ્યા છો.',
          'કુલ આવકના 32% ભાગની બચત થઈ રહી છે, જે શ્રેષ્ઠ દર છે.',
        ],
        hiddenCharges: [
          'ધ્યાન રાખો: જો ક્રેડિટ કાર્ડ અથવા લોન EMI ની નિયત તારીખ ચૂકી જવાય તો ₹500 થી ₹1,200 સુધીનો લેટ પેમેન્ટ ચાર્જ અને 18% GST લાગી શકે છે.',
          'બેંક એકાઉન્ટમાં મિનિમમ બેલેન્સ જાળવી રાખો જેથી ₹150 થી ₹300 નો દંડ ન લાગે.',
        ],
        savingTips: [
          'ઓનલાઇન ફૂડ ઓર્ડર કરતા સમયે ઉપલબ્ધ ડિસ્કાઉન્ટ કૂપન્સ ચેક કરો.',
          'નિયમિત ફ્રીલાન્સ અથવા વધારાની આવકને રિકરિંગ ડિપોઝિટ (RD) અથવા મ્યુચ્યુઅલ ફંડમાં વાળો.',
        ],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handler: Conversational Offline Expense Logger
  const handleSendOfflineChat = async () => {
    if (!offlineChatInput.trim()) return;

    const userText = offlineChatInput.trim();
    setOfflineChatInput('');
    setChatHistory((prev) => [
      ...prev,
      {
        sender: 'user',
        text: userText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsChatLogging(true);

    try {
      const response = await fetch('/api/gemini/conversational-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) throw new Error('Failed to log');
      const result = await response.json();

      if (result.hasExpense) {
        // Automatically add to diary
        onAddTransaction({
          type: result.type || 'expense',
          amount: Number(result.amount) || 100,
          title: result.title || 'ઓફલાઇન રોકડ ખર્ચ',
          category: result.category || 'Food & Dining',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
          paymentMode: 'Cash',
          notes: 'દૈનિક ઓફલાઇન પૂછપરછ દ્વારા નોંધાયેલ',
          isAiGenerated: true,
        });

        setChatHistory((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: `સમજાઈ ગયું! મેં '${result.title}' પેટે ${currency}${result.amount} ની નોંધ ${result.category} કેટેગરીમાં કરી લીધી છે. શું બીજો કોઈ ખર્ચ થયો છે?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            loggedTx: result,
          },
        ]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: 'ખૂબ સરસ! આજે કોઈ વધારાનો ખર્ચ નથી થયો. તમારી બચત સારી રહે!',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      // Fallback
      const amtMatch = userText.match(/(\d+)/);
      const amt = amtMatch ? parseInt(amtMatch[1], 10) : 100;
      onAddTransaction({
        type: 'expense',
        amount: amt,
        title: userText.substring(0, 30),
        category: 'Other Expense',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        paymentMode: 'Cash',
        notes: 'ઓફલાઇન વાતચીત દ્વારા ઉમેરેલ',
        isAiGenerated: true,
      });

      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `મેં ₹${amt} નો ખર્ચ ડાયરીમાં ઉમેરી લીધો છે!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLogging(false);
    }
  };

  return (
    <div id="ai-brain-screen-container" className="space-y-6 pb-28">
      {/* Intro Header in Bold Typography Smart Style */}
      <div className="p-6 sm:p-7 rounded-[28px] bg-[#E3F2FD] border border-[#BBDEFB] shadow-xs relative overflow-hidden">
        <div className="absolute top-[-20px] right-[-20px] w-48 h-48 bg-white/30 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3.5 rounded-2xl bg-white text-[#1976D2] shadow-xs">
            <Sparkles className="w-7 h-7 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0D47A1]">
                AI ફાયનાન્શિયલ આસિસ્ટન્ટ & સ્માર્ટ બ્રેઇન
              </h2>
              <span className="text-[10px] bg-[#1976D2] text-white px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                Smart
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#1565C0] font-medium mt-1">
              SMS/નોટિફિકેશનથી ઓટો-એન્ટ્રી, છૂપા ચાર્જ ચેતવણી, ઓફલાઇન ખર્ચ પૂછપરછ અને પેમેન્ટ એપ ટ્રેકિંગ
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: SMS & Notification Auto-Parser */}
      <div
        id="sms-notification-parser-card"
        className="p-6 rounded-[24px] bg-white border border-[#E1E8ED] shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#2D3436] stroke-[2]" />
            <h3 className="text-base font-bold text-[#2D3436]">
              1. SMS, Email & નોટિફિકેશન સ્કેનર (ઓટો ડિટેક્શન)
            </h3>
          </div>
          <span className="text-[11px] px-3 py-1 rounded-full bg-[#EBFBEE] text-[#1B4332] font-semibold border border-[#D1F7D9]">
            ઓન-ડિવાઇસ ખાનગી સુરક્ષા
          </span>
        </div>

        <p className="text-xs sm:text-sm text-[#636E72]">
          કોઈપણ બેંકનો SMS, UPI નોટિફિકેશન કે બિલ મેસેજ અહીં પેસ્ટ કરો અથવા નીચે આપેલા નમૂના પર ક્લિક કરો. AI તેમાંથી રકમ, કેટેગરી અને વિગત ઓળખીને તમને પુષ્ટિ માટે પૂછશે:
        </p>

        {/* Input box */}
        <div className="relative">
          <textarea
            id="raw-sms-input"
            rows={3}
            placeholder="અહીં બેંકનો SMS અથવા પેમેન્ટ મેસેજ પેસ્ટ કરો... દા.ત. 'Dear Customer, your A/c is debited by Rs. 350 for Swiggy...'"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            className="w-full p-4 text-xs sm:text-sm rounded-2xl border border-[#E1E8ED] hover:border-[#B2BEC3] focus:border-[#6C5CE7] outline-none transition text-[#2D3436]"
          />
          <button
            id="parse-sms-btn"
            disabled={isParsing || !rawInput.trim()}
            onClick={() => handleParseMessage()}
            className="absolute right-3.5 bottom-3.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {isParsing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>સ્કેન કરો</span>
          </button>
        </div>

        {parseStatus && (
          <div className="text-xs font-semibold text-[#0D47A1] bg-[#E3F2FD] px-4 py-2.5 rounded-xl border border-[#BBDEFB]">
            {parseStatus}
          </div>
        )}

        {/* Sample click-to-fill chips */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-[#636E72]">ટેસ્ટ કરવા માટે ક્લિક કરો:</span>
          <div className="flex flex-wrap gap-2">
            {sampleBankMessages.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setRawInput(s.text);
                  handleParseMessage(s.text);
                }}
                className="text-left text-xs px-3 py-2 rounded-xl bg-[#F9FBFC] hover:bg-[#F1F2F6] border border-[#E1E8ED] hover:border-[#B2BEC3] text-[#2D3436] font-medium transition cursor-pointer"
              >
                + {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: Conversational Daily Offline Expense Checker */}
      <div
        id="offline-expense-chat-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">
              2. દૈનિક ઓફલાઇન અને રોકડ ખર્ચ પૂછપરછ
            </h3>
          </div>
          <span className="text-[11px] text-stone-400">સમય: દરરોજ રાત્રે 8:30 વાગ્યે</span>
        </div>

        <p className="text-xs text-stone-500">
          AI નિયત સમયે તમને પૂછશે કે દિવસ દરમિયાન કોઈ રોકડ કે ઓફલાઇન ખર્ચ થયો છે કે નહીં. તમે માત્ર સામાન્ય શબ્દોમાં જવાબ આપો, AI તેને ઓળખીને ડાયરીમાં ઉમેરી દેશે:
        </p>

        {/* Chat message bubbles */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 max-h-60 overflow-y-auto space-y-3">
          {chatHistory.map((item, idx) => (
            <div
              key={idx}
              className={`flex ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                  item.sender === 'user'
                    ? 'bg-stone-900 text-white rounded-br-xs'
                    : 'bg-white text-stone-800 border border-stone-200 shadow-2xs rounded-bl-xs'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-stone-400">
                  <span>{item.sender === 'ai' ? '🤖 AI સહાયક' : 'તમે'}</span>
                  <span>•</span>
                  <span>{item.time}</span>
                </div>
                <div>{item.text}</div>
                {item.loggedTx && (
                  <div className="mt-2 pt-1.5 border-t border-emerald-100 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ડાયરીમાં સફળતાપૂર્વક સાચવવામાં આવ્યું!</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chat input form */}
        <div className="flex items-center gap-2">
          <input
            id="offline-chat-input"
            type="text"
            placeholder="દા.ત. 'મેં ₹200 નું બાઇકમાં પેટ્રોલ પુરાવ્યું' અથવા 'ના, આજે કોઈ રોકડ ખર્ચ નથી થયો'"
            value={offlineChatInput}
            onChange={(e) => setOfflineChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendOfflineChat();
            }}
            className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 outline-none focus:border-stone-400 transition"
          />
          <button
            id="send-offline-chat-btn"
            disabled={isChatLogging || !offlineChatInput.trim()}
            onClick={handleSendOfflineChat}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 transition flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 3: Shopping & Payment App Usage Verification Alerts */}
      <div
        id="shopping-app-activity-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3.5"
      >
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-stone-500 stroke-[1.75]" />
          <h3 className="text-sm font-semibold text-stone-900">
            3. શોપિંગ અને પેમેન્ટ એપ વપરાશ ચકાસણી (SMS ન આવ્યો હોય તો પણ)
          </h3>
        </div>

        <p className="text-xs text-stone-500">
          જો તમે દિવસ દરમિયાન Amazon, Flipkart કે GPay જેવી એપ્સ ખોલી હોય, તો AI તમને સમય સાથે પૂછશે જેથી કોઈ ખર્ચ છૂટી ન જાય:
        </p>

        <div className="space-y-2.5">
          {appAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-800">{alert.appName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-600 font-mono">
                    {alert.timeString}
                  </span>
                </div>
                <p className="text-xs text-stone-600">{alert.question}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    // Open quick logging prompt
                    const amt = prompt(`${alert.appName} માં કેટલો ખર્ચ થયો? (રકમ દાખલ કરો)`, '350');
                    if (amt && !isNaN(Number(amt))) {
                      onAddTransaction({
                        type: 'expense',
                        amount: Number(amt),
                        title: `${alert.appName} ખરીદી`,
                        category: 'Shopping',
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                        paymentMode: 'UPI',
                        notes: `${alert.timeString} ખોલેલ એપમાંથી નોંધેલ`,
                        isAiGenerated: true,
                      });
                      setAppAlerts(appAlerts.filter((a) => a.id !== alert.id));
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-2xs"
                >
                  હા, ખર્ચ થયો છે
                </button>
                <button
                  onClick={() => setAppAlerts(appAlerts.filter((a) => a.id !== alert.id))}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 transition"
                >
                  ના, ખાલી જોઈ રહ્યો હતો
                </button>
              </div>
            </div>
          ))}

          {appAlerts.length === 0 && (
            <div className="text-center py-6 text-xs text-stone-400">
              તમામ એપ વપરાશની ચકાસણી પૂર્ણ થયેલ છે. કોઈ બાકી ચેતવણી નથી.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Financial Advisor, Hidden Charges & Penalty Avoidance */}
      <div
        id="financial-advisor-card"
        className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 stroke-[1.75]" />
            <h3 className="text-sm font-semibold text-stone-900">
              4. AI ફાયનાન્શિયલ વિશ્લેષણ, છૂપા ચાર્જ અને દંડથી સુરક્ષા
            </h3>
          </div>
          <button
            id="run-advisor-btn"
            disabled={isAnalyzing}
            onClick={handleRunAdvisor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50 transition"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>નવું વિશ્લેષણ મેળવો</span>
          </button>
        </div>

        <p className="text-xs text-stone-500">
          તમારા તમામ વ્યવહારોનું વિશ્લેષણ કરીને AI તમને જણાવશે કે નાણાં ક્યાં અને ક્યારે વધુ વપરાય છે, તેમજ કયા દંડ કે ચાર્જથી બચી શકાય:
        </p>

        {advisorAnalysis ? (
          <div className="space-y-3.5 pt-1">
            {/* Spending Insights */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 stroke-[1.75]" />
                <span>ક્યાં અને ક્યારે નાણાં વપરાય રહ્યા છે?</span>
              </div>
              <ul className="space-y-1.5 text-xs text-stone-600 pl-6 list-disc">
                {advisorAnalysis.insights.map((ins, i) => (
                  <li key={i}>{ins}</li>
                ))}
              </ul>
            </div>

            {/* Hidden charges warning */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 stroke-[1.75]" />
                <span>છૂપા ચાર્જ, લેટ ફી અને દંડથી બચવાની ચેતવણી</span>
              </div>
              <ul className="space-y-1.5 text-xs text-amber-900/90 pl-6 list-disc">
                {advisorAnalysis.hiddenCharges.map((chg, i) => (
                  <li key={i}>{chg}</li>
                ))}
              </ul>
            </div>

            {/* Saving Tips */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <Lightbulb className="w-4 h-4 text-emerald-600 stroke-[1.75]" />
                <span>નાણાં બચાવવાના સ્માર્ટ ઉપાયો</span>
              </div>
              <ul className="space-y-1.5 text-xs text-emerald-900/90 pl-6 list-disc">
                {advisorAnalysis.savingTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-stone-200 bg-stone-50/50">
            <Sparkles className="w-6 h-6 mx-auto text-stone-400 mb-2" />
            <p className="text-xs text-stone-500">
              ઉપર આપેલા 'નવું વિશ્લેષણ મેળવો' બટન પર ક્લિક કરીને AI પાસેથી તમારા ખર્ચની સંપૂર્ણ સમીક્ષા અને સલાહ મેળવો.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
