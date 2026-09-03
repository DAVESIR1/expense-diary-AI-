import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable CORS for external PWA scanners, testing tools and mobile apps
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Explicit PWA manifest & service worker routes with strict content-types
app.get('/manifest.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
});

app.get('/sw.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
});

// Serve public directory (icons, screenshots, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

app.use(express.json({ limit: '10mb' }));

// Lazy Gemini client helper
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// 1. Parse SMS / Notification / Email for Income or Expense
app.post('/api/gemini/parse-message', async (req: Request, res: Response) => {
  const text = req.body.text || req.body.message;
  const language = req.body.language || 'gu';
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text message is required' });
  }

  const ai = getGeminiClient();

  if (ai) {
    try {
      const systemPrompt = `You are an expert financial AI transaction parser for Expense Diary AI.
Your job is to read raw SMS messages, banking alerts, UPI transaction texts, or payment notifications (in English, Gujarati, Hindi, or any language) and extract structured transaction data.
Output MUST follow the JSON schema.
- type: either "income" (credited, received, deposited, refund, salary) or "expense" (debited, paid, sent, spent, deducted, charged).
- amount: numerical value (e.g. 450.50).
- title: concise descriptive title in ${language === 'gu' ? 'Gujarati' : 'the requested language'} (or English).
- category: one of [Shopping, Groceries, Food & Dining, Bills & Utilities, Salary, Travel, Health, Entertainment, Transfer, Investment, Others].
- vendorOrPerson: Name of shop, merchant, person, UPI handle, or bank.
- paymentMode: e.g. "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cash", "Net Banking".
- date: ISO date string or estimated date from message.
- notes: any additional notes or reference ID.
- confirmationQuestion: a friendly question to ask user in ${language === 'gu' ? 'Gujarati' : 'English'} to confirm if this transaction is accurate and should be added.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze this message and extract financial transaction details:\n"${text}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['income', 'expense'] },
              amount: { type: Type.NUMBER },
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              vendorOrPerson: { type: Type.STRING },
              paymentMode: { type: Type.STRING },
              date: { type: Type.STRING },
              notes: { type: Type.STRING },
              confirmationQuestion: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['type', 'amount', 'title', 'category', 'confirmationQuestion'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, data: parsed, source: 'gemini' });
    } catch (err: any) {
      console.warn('Gemini parse error, falling back to heuristic parser:', err?.message);
    }
  }

  // Heuristic Smart Fallback (Offline or missing API key)
  const lower = text.toLowerCase();
  const isIncome = /credited|received|deposit|salary|refund|refunded|જમા|આવક|મળ્યા|પગાર/.test(lower);
  const isExpense = /debited|paid|spent|sent|deducted|withdrawn|ખર્ચ|ચૂકવ્યા|ઉપાડ્યા/.test(lower);
  
  // Extract amount
  const amountMatch = text.match(/(?:rs\.?|inr|₹|\$|€)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                      text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹|રૂપિયા)/i) ||
                      text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/);
  
  const rawAmt = amountMatch ? parseFloat(amountMatch[1] ? amountMatch[1].replace(/,/g, '') : amountMatch[0].replace(/,/g, '')) : 0;
  const transactionType = isIncome ? 'income' : 'expense';

  // Vendor detection
  let vendor = 'Unknown';
  if (/zomato|swiggy|uber|ola|amazon|flipkart|blinkit|zepto|myntra/i.test(text)) {
    vendor = text.match(/zomato|swiggy|uber|ola|amazon|flipkart|blinkit|zepto|myntra/i)![0];
  } else if (/to\s+([A-Za-z0-9\s]+?)(?:\s+(?:on|ref|upi|via|for|avc|a\/c|\.))/i.test(text)) {
    const vMatch = text.match(/to\s+([A-Za-z0-9\s]{2,25})/i);
    if (vMatch) vendor = vMatch[1].trim();
  }

  let category = 'Others';
  if (/zomato|swiggy|food|restaurant|cafe|નાસ્તો|હોટેલ/i.test(text)) category = 'Food & Dining';
  else if (/amazon|flipkart|shopping|store|ખરીદી/i.test(text)) category = 'Shopping';
  else if (/bill|electricity|recharge|dth|wifi|gas|લાઇટ બિલ/i.test(text)) category = 'Bills & Utilities';
  else if (/salary|bonus|dividend|પગાર/i.test(text)) category = 'Salary';
  else if (/uber|ola|fuel|petrol|diesel|rickshaw|પ્રવાસ/i.test(text)) category = 'Travel';
  else if (/grocery|milk|vegetable|શાકભાજી|કરિયાણું/i.test(text)) category = 'Groceries';

  const confirmQ = language === 'gu'
    ? `શું આ ₹${rawAmt || '---'} નો ${transactionType === 'income' ? 'આવક' : 'ખર્ચ'} ${vendor !== 'Unknown' ? `(${vendor})` : ''} સાચો છે? તેને ડાયરીમાં ઉમેરું?`
    : `Is this ${transactionType === 'income' ? 'income' : 'expense'} of ₹${rawAmt || '---'} ${vendor !== 'Unknown' ? `(${vendor})` : ''} correct? Should I log it?`;

  return res.json({
    success: true,
    data: {
      type: transactionType,
      amount: rawAmt || 100,
      title: vendor !== 'Unknown' ? `${vendor}` : (transactionType === 'income' ? 'પ્રાપ્ત રકમ' : 'ખર્ચ'),
      category: category,
      vendorOrPerson: vendor,
      paymentMode: /upi/i.test(text) ? 'UPI' : (/card/i.test(text) ? 'Card' : 'Bank Transfer'),
      date: new Date().toISOString(),
      notes: text.substring(0, 100),
      confirmationQuestion: confirmQ,
      confidence: 0.85,
    },
    source: 'heuristic',
  });
});

// 2. Smart Financial Advice, Spending Pattern & Hidden Charges Detector
app.post('/api/gemini/financial-advisor', async (req: Request, res: Response) => {
  const { transactions, budget, language = 'gu' } = req.body;
  const ai = getGeminiClient();

  if (ai && Array.isArray(transactions) && transactions.length > 0) {
    try {
      const prompt = `You are the AI Financial Advisor in Expense Diary AI.
Here is the user's recent income and expense data:
${JSON.stringify(transactions.slice(0, 30), null, 2)}
Monthly Budget: ${budget || 'Not specified'}

Analyze:
1. Where and when is the user spending the most money (e.g. food delivery, weekend spikes, impulsive shopping)?
2. Are there any potential hidden charges, recurring subscriptions, or late penalty risks (e.g. pending bills, bank SMS charges, auto-renewal)?
3. Practical, empathetic, high-impact advice on how to save money and stay within budget.

Respond in ${language === 'gu' ? 'Gujarati language' : 'English'} in a warm, encouraging, minimal tone.
Format response as JSON:
{
  "topSpendingCategory": "Category name",
  "topSpendingInsight": "Insight in words",
  "hiddenChargesWarning": "Warning about hidden charges or late fees (or null if none)",
  "savingAdvice": ["Tip 1", "Tip 2", "Tip 3"],
  "healthScore": 85 (0 to 100 score)
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, data: parsed, source: 'gemini' });
    } catch (err: any) {
      console.warn('Gemini advisor error:', err?.message);
    }
  }

  // Local calculation fallback
  const totalExpense = (transactions || []).reduce((acc: number, t: any) => t.type === 'expense' ? acc + Number(t.amount || 0) : acc, 0);
  const totalIncome = (transactions || []).reduce((acc: number, t: any) => t.type === 'income' ? acc + Number(t.amount || 0) : acc, 0);
  
  return res.json({
    success: true,
    data: {
      topSpendingCategory: 'શોપિંગ અને ખોરાક (Shopping & Food)',
      topSpendingInsight: language === 'gu'
        ? `તમારો કુલ ખર્ચ ₹${totalExpense.toLocaleString('en-IN')} છે. સૌથી વધુ ખર્ચ સપ્તાહના અંતે શોપિંગ અને બહાર જમવામાં જણાય છે.`
        : `Your total expense is ₹${totalExpense.toLocaleString('en-IN')}. Highest spend is during weekends on dining and shopping.`,
      hiddenChargesWarning: language === 'gu'
        ? 'સાવચેત રહો: દર મહિને નાના-મોટા ઓટો-ડેબિટ સબ્સ્ક્રિપ્શન અને બેંક એસએમએસ ચાર્જ તમારા બજેટમાંથી ₹200-500 છૂપી રીતે કાપી રહ્યા છે. બિનજરૂરી એપ્સ અનસબ્સ્ક્રાઇબ કરો.'
        : 'Watch out: recurring monthly micro-subscriptions and bank fees may cost ₹200-500 silently. Review active auto-debits.',
      savingAdvice: language === 'gu' ? [
        'દર મહિને આવક આવતા જ પહેલા 20% રકમ બચતમાં અલગ મૂકી દો.',
        'ઓનલાઇન ફૂડ ઓર્ડર અઠવાડિયામાં માત્ર એકવાર મર્યાદિત કરવાથી દર મહિને ₹2,000+ બચાવી શકાય છે.',
        'ક્રેડિટ કાર્ડ બિલ નિયત તારીખના 3 દિવસ પહેલા ચૂકવો જેથી 3.5% વ્યાજ અને ₹750 લેટ ફીથી બચી શકાય.'
      ] : [
        'Apply the 50/30/20 rule: Allocate 20% to savings as soon as income arrives.',
        'Limiting online food deliveries to once a week can save ₹2,000+ per month.',
        'Pay credit card and utility bills 3 days before due date to avoid interest and late fees.'
      ],
      healthScore: totalIncome > totalExpense ? 82 : 65,
    },
    source: 'local',
  });
});

// 3. Conversational Offline Expense / Shopping App Inquiry Parser
app.post('/api/gemini/conversational-log', async (req: Request, res: Response) => {
  const userReply = req.body.userReply || req.body.message;
  const promptContext = req.body.promptContext;
  const language = req.body.language || 'gu';
  if (!userReply) {
    return res.status(400).json({ error: 'User reply is required' });
  }

  const ai = getGeminiClient();

  if (ai) {
    try {
      const systemPrompt = `You are a conversational financial logger in Expense Diary AI.
Context of AI inquiry: "${promptContext || 'Asking if user spent any offline cash or made a purchase on an app'}"
User's natural speech or reply: "${userReply}"

Determine if the user confirmed an expense or income, and extract:
- confirmed: boolean (true if user mentions an amount or confirms purchase)
- type: "expense" | "income"
- amount: number
- title: concise title in ${language === 'gu' ? 'Gujarati' : 'English'}
- category: one of [Shopping, Groceries, Food & Dining, Bills & Utilities, Salary, Travel, Health, Entertainment, Others]
- notes: short description
- replyMessage: friendly feedback message to the user acknowledging the entry`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userReply,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              confirmed: { type: Type.BOOLEAN },
              type: { type: Type.STRING, enum: ['expense', 'income'] },
              amount: { type: Type.NUMBER },
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              notes: { type: Type.STRING },
              replyMessage: { type: Type.STRING },
            },
            required: ['confirmed'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, data: parsed, source: 'gemini' });
    } catch (err: any) {
      console.warn('Gemini conversational log error:', err?.message);
    }
  }

  // Fallback pattern matching
  const numMatch = userReply.match(/(\d+(?:\.\d+)?)/);
  const amt = numMatch ? parseFloat(numMatch[1]) : 0;
  const isNo = /ના|no|nahi|nothing|કઈ નથી|નથી/i.test(userReply);

  if (isNo || amt === 0) {
    return res.json({
      success: true,
      data: {
        confirmed: false,
        replyMessage: language === 'gu' ? 'સરસ! આજે કોઈ વધારાનો ખર્ચ નોંધાયો નથી.' : 'Great! No additional expense recorded.',
      },
      source: 'heuristic',
    });
  }

  return res.json({
    success: true,
    data: {
      confirmed: true,
      type: 'expense',
      amount: amt,
      title: userReply.replace(/\d+/g, '').trim() || (language === 'gu' ? 'ઓફલાઇન ખર્ચ' : 'Offline Expense'),
      category: /ચા|નાસ્તો|food|lunch|dinner|જમવા/i.test(userReply) ? 'Food & Dining' : (/શાક|grocery|શાકભાજી/i.test(userReply) ? 'Groceries' : 'Others'),
      notes: userReply,
      replyMessage: language === 'gu' ? `₹${amt} નો ખર્ચ સફળતાપૂર્વક તમારી ડાયરીમાં ઉમેરી દીધો છે!` : `Logged ₹${amt} expense successfully!`,
    },
    source: 'heuristic',
  });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Expense Diary AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
