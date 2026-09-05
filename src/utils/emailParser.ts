/**
 * Financial Email Parser for Indian Banking & Investment Communications
 * Parses:
 * - CRA-NSDL / Protean NPS Contribution receipts & PRAN allocations
 * - Salary Credit Advices & Payslips
 * - Mutual Fund SIP / Units Allotment (CAMS, KFintech, AMC)
 * - Bank Debit/Credit transaction alert emails
 */

import { TransactionType } from '../types';

export interface ParsedFinancialEmail {
  id: string;
  source: 'email';
  sender: string;
  subject: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  amount: number;
  type: TransactionType;
  title: string;
  category: string;
  vendorOrPerson?: string;
  accountInfo?: string;
  referenceNumber?: string;
  evidence: string;
  evidenceSender: string;
  confidence: number;
}

export function parseFinancialEmail(
  emailSubject: string,
  emailBody: string,
  sender: string = '',
  receivedTimestamp?: number
): ParsedFinancialEmail | null {
  if (!emailBody && !emailSubject) return null;

  const subject = (emailSubject || '').trim();
  const body = (emailBody || '').trim();
  const lowerSender = (sender || '').toLowerCase();
  const combined = `${subject}\n${body}`.trim();
  const lower = combined.toLowerCase();

  // 1. Skip obvious newsletters, marketing spam, OTPs, or password resets
  if (
    /\b(?:password\s*reset|verify\s*your\s*email|verification\s*code|one[- ]time[- ]password|security\s*code)\b/i.test(lower) ||
    /\b(?:webinar|promotional\s*newsletter|unsubscribe\s*from|click\s*here\s*to\s*unsubscribe)\b/i.test(lower)
  ) {
    return null;
  }

  // 2. Fallback Date & Time
  const fallbackDate = receivedTimestamp ? new Date(receivedTimestamp) : new Date();
  let date = fallbackDate.toISOString().split('T')[0];
  let time = fallbackDate.toTimeString().substring(0, 5);

  const dateMatch = combined.match(/\b(\d{1,2})[-/.]([a-z]{3}|\d{1,2})[-/.](\d{2,4})\b/i);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    let month = dateMatch[2].toLowerCase();
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    if (monthMap[month]) {
      month = monthMap[month];
    } else {
      month = month.padStart(2, '0');
    }
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;
    date = `${year}-${month}-${day}`;
  }

  // -------------------------------------------------------------
  // TEMPLATE 1: CRA-NSDL / Protean NPS Contribution Receipt
  // -------------------------------------------------------------
  const isNps =
    lowerSender.includes('cra-nsdl') ||
    lowerSender.includes('proteantech') ||
    lowerSender.includes('nsdl.co.in') ||
    /\b(?:cra[- ]nsdl|protean|pran|nps\s*tier[- ]?[i1]|national\s*pension\s*system)\b/i.test(combined);

  if (isNps) {
    // Extract Contribution Amount: "contribution of Rs. 50,000", "Amount: Rs 15000", "Rs. 50000.00 has been credited"
    const npsAmountMatch = combined.match(/(?:contribution|receipt|received|invested|amount|credited)[^0-9\n\r]{0,35}?(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      combined.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)[^0-9\n\r]{0,35}?(?:contribution|credited)/i);
    let amount = 0;
    if (npsAmountMatch && npsAmountMatch[1]) {
      amount = parseFloat(npsAmountMatch[1].replace(/,/g, ''));
    }

    if (amount > 0) {
      // Extract PRAN
      let pran = '';
      const pranMatch = combined.match(/\bPRAN\b[\s.:#]*([Xx*0-9]{10,14})/i);
      if (pranMatch && pranMatch[1]) {
        pran = `PRAN *${pranMatch[1].slice(-4)}`;
      }

      // Extract Ref/Ack number
      let refNo = '';
      const ackMatch = combined.match(/(?:ack(?:nowledgement)?\s*no\.?|ref(?:erence)?\s*no\.?|txn\s*id)[\s.:#]*([A-Za-z0-9]{6,20})/i);
      if (ackMatch && ackMatch[1]) {
        refNo = ackMatch[1];
      }

      return {
        id: `email-nps-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        source: 'email',
        sender: sender || 'CRA-NSDL (Protean)',
        subject,
        date,
        time,
        amount,
        type: 'expense', // Investment outflow
        title: 'NPS Contribution (રોકાણ)',
        category: 'Investment',
        vendorOrPerson: 'NPS (Protean CRA)',
        accountInfo: pran || 'PRAN Tier-I',
        referenceNumber: refNo || undefined,
        evidence: `[Email: ${subject}]\n${body.substring(0, 300)}...`,
        evidenceSender: sender || 'CRA-NSDL',
        confidence: 0.98,
      };
    }
  }

  // -------------------------------------------------------------
  // TEMPLATE 2: Mutual Fund SIP / Units Allotment (CAMS / KFintech)
  // -------------------------------------------------------------
  const isMf =
    lowerSender.includes('camsonline') ||
    lowerSender.includes('kfintech') ||
    lowerSender.includes('mfcentral') ||
    /\b(?:units?\s*allotted|sip\s*(?:transaction|installment)|mutual\s*fund\s*investment)\b/i.test(combined);

  if (isMf) {
    const mfAmountMatch = combined.match(/(?:gross\s*amount|invested\s*amount|amount|sip\s*amount)\s*(?:is|:|=)?\s*(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (mfAmountMatch && mfAmountMatch[1]) {
      const amount = parseFloat(mfAmountMatch[1].replace(/,/g, ''));
      if (amount > 0) {
        // Extract scheme name
        let scheme = 'Mutual Fund SIP';
        const schemeMatch = combined.match(/(?:scheme|fund\s*name)\s*[:\-]\s*([A-Za-z0-9\s\-&]+?)(?:\r|\n|Folio|NAV|Units)/i);
        if (schemeMatch && schemeMatch[1]) {
          scheme = schemeMatch[1].trim().substring(0, 35);
        }

        // Folio number
        let folio = '';
        const folioMatch = combined.match(/\bFolio\s*(?:no\.?)?\s*[:\-]?\s*([0-9\/\-Xx*]{5,18})/i);
        if (folioMatch && folioMatch[1]) {
          folio = `Folio *${folioMatch[1].slice(-4)}`;
        }

        return {
          id: `email-mf-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          source: 'email',
          sender: sender || 'Mutual Fund',
          subject,
          date,
          time,
          amount,
          type: 'expense',
          title: `SIP: ${scheme}`,
          category: 'Investment',
          vendorOrPerson: scheme,
          accountInfo: folio || undefined,
          evidence: `[Email: ${subject}]\n${body.substring(0, 300)}...`,
          evidenceSender: sender,
          confidence: 0.95,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // TEMPLATE 3: Salary Slip / Payroll Email
  // -------------------------------------------------------------
  const isSalary =
    /\b(?:salary\s*slip|payslip|salary\s*credit\s*advice|remuneration\s*for)\b/i.test(subject) ||
    (/\b(?:net\s*pay|net\s*salary|take\s*home\s*salary)\b/i.test(combined) && /\b(?:credited\s*to|transferred\s*to)\b/i.test(combined));

  if (isSalary) {
    const salaryAmountMatch = combined.match(/(?:net\s*pay(?:able)?|net\s*salary|credited\s*(?:with|of)?|amount)\s*(?:is|:|=)?\s*(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (salaryAmountMatch && salaryAmountMatch[1]) {
      const amount = parseFloat(salaryAmountMatch[1].replace(/,/g, ''));
      if (amount > 0) {
        let employer = 'Salary Credit';
        const employerMatch = combined.match(/(?:from|by|employer|company)\s*[:\-]?\s*([A-Za-z0-9\s&.,]{3,40}?)(?:\r|\n|for\s+the\s+month|salary)/i);
        if (employerMatch && employerMatch[1] && !/^(the|a|your|ur)\b/i.test(employerMatch[1].trim())) {
          employer = employerMatch[1].trim();
        }

        return {
          id: `email-salary-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          source: 'email',
          sender: sender || 'Payroll',
          subject,
          date,
          time,
          amount,
          type: 'income',
          title: employer !== 'Salary Credit' ? `Salary: ${employer}` : 'Salary Credit (પગાર જમા)',
          category: 'Salary',
          vendorOrPerson: employer,
          evidence: `[Email: ${subject}]\n${body.substring(0, 300)}...`,
          evidenceSender: sender,
          confidence: 0.96,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // TEMPLATE 4: Standard Bank Debit / Credit Alert Email
  // -------------------------------------------------------------
  const isBankAlert =
    lowerSender.includes('sbi') ||
    lowerSender.includes('hdfc') ||
    lowerSender.includes('icici') ||
    lowerSender.includes('axis') ||
    lowerSender.includes('kotak') ||
    lowerSender.includes('bank') ||
    /\b(?:transaction\s*alert|debit\s*alert|credit\s*alert|account\s*debited|account\s*credited)\b/i.test(subject);

  if (isBankAlert) {
    const isDebit = /\b(?:debited|spent|paid|withdrawn)\b/i.test(combined);
    const isCredit = /\b(?:credited|received|deposited|refund)\b/i.test(combined);

    if (isDebit || isCredit) {
      const amtMatch = combined.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
      if (amtMatch && amtMatch[1]) {
        const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
        if (amount > 0) {
          const type: TransactionType = isCredit && !isDebit ? 'income' : 'expense';

          // Extract merchant
          let merchant = '';
          const atMerchantMatch = combined.match(/\bat\s+([A-Za-z0-9\s&.*\-]{2,30}?)(?:\s+on|\.|\r|\n)/i);
          if (atMerchantMatch && atMerchantMatch[1]) {
            merchant = atMerchantMatch[1].trim();
          }

          // Extract UTR/Ref
          let utr = '';
          const utrMatch = combined.match(/(?:utr|reference|ref\s*no\.?|txn\s*id)[\s.:#]*([A-Za-z0-9]{6,22})/i);
          if (utrMatch && utrMatch[1]) {
            utr = utrMatch[1];
          }

          return {
            id: `email-bank-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            source: 'email',
            sender: sender || 'Bank Alert',
            subject,
            date,
            time,
            amount,
            type,
            title: merchant || (type === 'income' ? 'Bank Credit' : 'Bank Debit'),
            category: type === 'income' ? 'Other Income' : 'Other Expense',
            vendorOrPerson: merchant || undefined,
            referenceNumber: utr || undefined,
            evidence: `[Email: ${subject}]\n${body.substring(0, 300)}...`,
            evidenceSender: sender,
            confidence: 0.90,
          };
        }
      }
    }
  }

  return null;
}
