import { Transaction, Category } from '../types';
import { parseTransactionMessage } from '../utils/smsParser';
import { uid } from '../utils/uid';

export interface ClearSmsImportResult {
  success: boolean;
  totalMessagesScanned: number;
  newTransactions: Transaction[];
  duplicatesSkipped: number;
  totalDebitAmount: number;
  totalCreditAmount: number;
  identifiedBanks: string[];
  errorMessage?: string;
}

/**
 * Imports and parses a ClearSMS backup JSON file into Expense Diary AI
 */
export function parseClearSmsBackup(
  jsonContent: string,
  existingTransactions: Transaction[] = [],
  categories: Category[] = []
): ClearSmsImportResult {
  try {
    const data = JSON.parse(jsonContent);

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        totalMessagesScanned: 0,
        newTransactions: [],
        duplicatesSkipped: 0,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
        identifiedBanks: [],
        errorMessage: 'અમાન્ય ફાઇલ ફોર્મેટ (Invalid JSON)',
      };
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];

    const existingRefs = new Set(
      existingTransactions.map((t) => t.referenceNumber?.toUpperCase()).filter(Boolean)
    );
    const existingSignatures = new Set(
      existingTransactions.map((t) => `${t.amount}_${t.date}_${t.type}_${(t.vendorOrPerson || t.title || '').toLowerCase()}`)
    );

    const newTransactions: Transaction[] = [];
    let duplicatesSkipped = 0;
    let totalDebitAmount = 0;
    let totalCreditAmount = 0;
    const banksSet = new Set<string>();

    for (const acc of accounts) {
      if (acc.bankName && typeof acc.bankName === 'string') {
        banksSet.add(acc.bankName);
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.body) continue;

      const parsed = parseTransactionMessage(msg.body, categories, 'sms', {
        sender: msg.sender,
        timestamp: msg.timestamp,
      });

      if (!parsed) continue;

      // Deduplication check
      const ref = parsed.referenceNumber?.toUpperCase();
      if (ref && existingRefs.has(ref)) {
        duplicatesSkipped++;
        continue;
      }

      const sig = `${parsed.amount}_${parsed.date}_${parsed.type}_${(parsed.vendorOrPerson || parsed.title || '').toLowerCase()}`;
      if (existingSignatures.has(sig)) {
        duplicatesSkipped++;
        continue;
      }

      // Add to seen sets to avoid duplicate SMS in the same backup
      if (ref) existingRefs.add(ref);
      existingSignatures.add(sig);

      if (parsed.bankOrSource) {
        banksSet.add(parsed.bankOrSource);
      }

      if (parsed.type === 'expense') {
        totalDebitAmount += parsed.amount;
      } else {
        totalCreditAmount += parsed.amount;
      }

      const txn: Transaction = {
        id: uid('clearsms', 9),
        type: parsed.type,
        amount: parsed.amount,
        title: parsed.title,
        category: parsed.category,
        date: parsed.date,
        time: parsed.time,
        vendorOrPerson: parsed.vendorOrPerson,
        paymentMode: parsed.paymentMode,
        notes: parsed.bankOrSource ? `${parsed.bankOrSource} (${parsed.accountInfo || 'A/c'})` : parsed.accountInfo,
        isAiGenerated: true,
        needsConfirmation: parsed.needsReview,
        evidence: parsed.evidence,
        evidenceSource: 'sms',
        evidenceSender: msg.sender,
        referenceNumber: parsed.referenceNumber,
        updatedAt: new Date().toISOString(),
      };

      newTransactions.push(txn);
    }

    return {
      success: true,
      totalMessagesScanned: messages.length,
      newTransactions,
      duplicatesSkipped,
      totalDebitAmount,
      totalCreditAmount,
      identifiedBanks: Array.from(banksSet),
    };
  } catch (err: any) {
    return {
      success: false,
      totalMessagesScanned: 0,
      newTransactions: [],
      duplicatesSkipped: 0,
      totalDebitAmount: 0,
      totalCreditAmount: 0,
      identifiedBanks: [],
      errorMessage: err.message || 'Error processing ClearSMS backup',
    };
  }
}
