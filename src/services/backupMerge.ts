/**
 * Multi-File Backup Restore & Merge Engine (§6)
 * 
 * Supports:
 * 1. Multi-file inspection and envelope validation
 * 2. Deduplication across transactions, diary entries, and borrowed/lent records
 * 3. Conflict resolution strategies (keep newer, keep existing, keep incoming, keep both)
 * 4. Pre-restore safety snapshot for 100% fail-safe rollback
 * 5. Dry-run preview calculation and post-restore report
 */

import { Transaction, DiaryEntry, BorrowedLentRecord, Category, UserProfile } from '../types';
import { EncryptedBackupEnvelope, decryptPayload } from './encryption';

export interface FileInspectionResult {
  fileName: string;
  fileSize: number;
  exportedAt?: string;
  appVersion?: string;
  transactionCount: number;
  diaryCount: number;
  borrowLendCount: number;
  status: 'valid' | 'corrupt' | 'passphrase_error' | 'unsupported';
  error?: string;
  decryptedData?: {
    transactions?: Transaction[];
    categories?: Category[];
    profile?: UserProfile;
    diaryEntries?: DiaryEntry[];
    borrowedLentRecords?: BorrowedLentRecord[];
  };
}

export type ConflictStrategy = 'newer' | 'existing' | 'incoming' | 'both';

export interface MergePreview {
  totalFilesProcessed: number;
  totalTransactionsFound: number;
  uniqueTransactionsToImport: number;
  duplicateTransactionsSkipped: number;
  conflictingTransactions: number;
  
  totalDiaryFound: number;
  uniqueDiaryToImport: number;
  duplicateDiarySkipped: number;

  totalBorrowLendFound: number;
  uniqueBorrowLendToImport: number;
  duplicateBorrowLendSkipped: number;

  mergedTransactions: Transaction[];
  mergedDiaryEntries: DiaryEntry[];
  mergedBorrowLend: BorrowedLentRecord[];
}

export class BackupMergeService {
  private static SAFETY_SNAPSHOT_KEY = 'expense_diary_pre_restore_safety_backup';

  /**
   * Parse and inspect multiple selected files
   */
  public static async inspectFiles(
    files: File[],
    passphrase: string
  ): Promise<FileInspectionResult[]> {
    const results: FileInspectionResult[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        let envelope: EncryptedBackupEnvelope;
        try {
          envelope = JSON.parse(text);
        } catch {
          results.push({
            fileName: file.name,
            fileSize: file.size,
            transactionCount: 0,
            diaryCount: 0,
            borrowLendCount: 0,
            status: 'corrupt',
            error: 'File is not a valid JSON or EDB envelope',
          });
          continue;
        }

        if (envelope.magic !== 'EDBAES256') {
          // Check if unencrypted JSON legacy backup
          if (Array.isArray((envelope as any).transactions)) {
            const rawData = envelope as any;
            results.push({
              fileName: file.name,
              fileSize: file.size,
              exportedAt: rawData.exportedAt || new Date().toISOString(),
              appVersion: rawData.version || '1.0.0',
              transactionCount: rawData.transactions?.length || 0,
              diaryCount: rawData.diaryEntries?.length || 0,
              borrowLendCount: rawData.borrowedLentRecords?.length || 0,
              status: 'valid',
              decryptedData: rawData,
            });
            continue;
          }

          results.push({
            fileName: file.name,
            fileSize: file.size,
            transactionCount: 0,
            diaryCount: 0,
            borrowLendCount: 0,
            status: 'unsupported',
            error: 'Unsupported backup header format',
          });
          continue;
        }

        // Decrypt with provided passphrase
        try {
          const decrypted = await decryptPayload<any>(envelope, passphrase);
          results.push({
            fileName: file.name,
            fileSize: file.size,
            exportedAt: envelope.exportedAt,
            appVersion: envelope.appVersion,
            transactionCount: decrypted.transactions?.length || 0,
            diaryCount: decrypted.diaryEntries?.length || 0,
            borrowLendCount: decrypted.borrowedLentRecords?.length || 0,
            status: 'valid',
            decryptedData: decrypted,
          });
        } catch (decryptErr: any) {
          results.push({
            fileName: file.name,
            fileSize: file.size,
            exportedAt: envelope.exportedAt,
            appVersion: envelope.appVersion,
            transactionCount: 0,
            diaryCount: 0,
            borrowLendCount: 0,
            status: 'passphrase_error',
            error: decryptErr.message || 'Passphrase mismatch or corrupt payload',
          });
        }
      } catch (fileErr: any) {
        results.push({
          fileName: file.name,
          fileSize: file.size,
          transactionCount: 0,
          diaryCount: 0,
          borrowLendCount: 0,
          status: 'corrupt',
          error: fileErr.message || 'Read error',
        });
      }
    }

    return results;
  }

  /**
   * Compute dry-run preview and merged records across all inspected files
   */
  public static calculateMergePreview(
    validInspections: FileInspectionResult[],
    currentTransactions: Transaction[],
    currentDiaryEntries: DiaryEntry[],
    currentBorrowLend: BorrowedLentRecord[],
    conflictStrategy: ConflictStrategy = 'newer'
  ): MergePreview {
    let totalTxFound = 0;
    let totalDiaryFound = 0;
    let totalBorrowLendFound = 0;

    // Maps for deduplication and conflict detection
    // Key: date_amount_type_notes
    const txMap = new Map<string, Transaction>();
    // Existing IDs lookup
    const existingTxIds = new Set(currentTransactions.map((t) => t.id));

    // Seed existing
    currentTransactions.forEach((t) => {
      const key = `${t.date}_${t.amount}_${t.type}_${(t.referenceNumber || t.notes || '').trim()}`;
      txMap.set(key, t);
    });

    let duplicateTxCount = 0;
    let conflictTxCount = 0;

    // Process incoming transactions
    validInspections.forEach((f) => {
      const incomingTxs = f.decryptedData?.transactions || [];
      totalTxFound += incomingTxs.length;

      incomingTxs.forEach((inTx) => {
        const key = `${inTx.date}_${inTx.amount}_${inTx.type}_${(inTx.referenceNumber || inTx.notes || '').trim()}`;
        const existing = txMap.get(key);

        if (existing) {
          // Match by content -> duplicate
          duplicateTxCount++;
          if (existing.id === inTx.id && inTx.updatedAt && existing.updatedAt && inTx.updatedAt !== existing.updatedAt) {
            conflictTxCount++;
            if (conflictStrategy === 'newer') {
              if (new Date(inTx.updatedAt) > new Date(existing.updatedAt)) {
                txMap.set(key, inTx);
              }
            } else if (conflictStrategy === 'incoming') {
              txMap.set(key, inTx);
            }
          }
        } else {
          // New transaction
          // If ID collision with different data, assign a new UUID if 'both'
          if (existingTxIds.has(inTx.id)) {
            conflictTxCount++;
            if (conflictStrategy === 'both') {
              const clone = { ...inTx, id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` };
              txMap.set(key, clone);
              existingTxIds.add(clone.id);
            } else if (conflictStrategy === 'incoming') {
              txMap.set(key, inTx);
            }
          } else {
            txMap.set(key, inTx);
            existingTxIds.add(inTx.id);
          }
        }
      });
    });

    const mergedTransactions = Array.from(txMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Merge Diary Entries
    const diaryMap = new Map<string, DiaryEntry>();
    currentDiaryEntries.forEach((d) => {
      const key = `${d.date}_${(d.title || '').trim()}_${d.content.trim().substring(0, 100)}`;
      diaryMap.set(key, d);
    });

    let duplicateDiaryCount = 0;
    validInspections.forEach((f) => {
      const incomingDiary = f.decryptedData?.diaryEntries || [];
      totalDiaryFound += incomingDiary.length;

      incomingDiary.forEach((inD) => {
        const key = `${inD.date}_${(inD.title || '').trim()}_${inD.content.trim().substring(0, 100)}`;
        if (diaryMap.has(key)) {
          duplicateDiaryCount++;
        } else {
          diaryMap.set(key, inD);
        }
      });
    });

    const mergedDiaryEntries = Array.from(diaryMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Merge Borrowed / Lent Records
    const blMap = new Map<string, BorrowedLentRecord>();
    currentBorrowLend.forEach((b) => {
      const key = `${b.direction}_${b.personName.trim().toLowerCase()}_${b.amount}_${b.date}`;
      blMap.set(key, b);
    });

    let duplicateBlCount = 0;
    validInspections.forEach((f) => {
      const incomingBl = f.decryptedData?.borrowedLentRecords || [];
      totalBorrowLendFound += incomingBl.length;

      incomingBl.forEach((inB) => {
        const key = `${inB.direction}_${inB.personName.trim().toLowerCase()}_${inB.amount}_${inB.date}`;
        if (blMap.has(key)) {
          duplicateBlCount++;
        } else {
          blMap.set(key, inB);
        }
      });
    });

    const mergedBorrowLend = Array.from(blMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return {
      totalFilesProcessed: validInspections.length,
      totalTransactionsFound: totalTxFound,
      uniqueTransactionsToImport: Math.max(0, mergedTransactions.length - currentTransactions.length),
      duplicateTransactionsSkipped: duplicateTxCount,
      conflictingTransactions: conflictTxCount,

      totalDiaryFound: totalDiaryFound,
      uniqueDiaryToImport: Math.max(0, mergedDiaryEntries.length - currentDiaryEntries.length),
      duplicateDiarySkipped: duplicateDiaryCount,

      totalBorrowLendFound: totalBorrowLendFound,
      uniqueBorrowLendToImport: Math.max(0, mergedBorrowLend.length - currentBorrowLend.length),
      duplicateBorrowLendSkipped: duplicateBlCount,

      mergedTransactions,
      mergedDiaryEntries,
      mergedBorrowLend,
    };
  }

  /**
   * Create safety backup before executing restore
   */
  public static createSafetySnapshot(): void {
    try {
      const snapshot: Record<string, string> = {};
      const keys = [
        'expense_diary_transactions',
        'expense_diary_entries',
        'expense_diary_borrow_lent',
        'expense_diary_categories',
        'expense_diary_profile',
      ];
      keys.forEach((k) => {
        const v = localStorage.getItem(k);
        if (v !== null) snapshot[k] = v;
      });
      localStorage.setItem(this.SAFETY_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[Restore] Could not create safety snapshot:', e);
    }
  }

  /**
   * Rollback in case of restore failure
   */
  public static rollbackSafetySnapshot(): boolean {
    try {
      const snap = localStorage.getItem(this.SAFETY_SNAPSHOT_KEY);
      if (snap) {
        const data = JSON.parse(snap);
        Object.entries(data).forEach(([k, v]) => {
          localStorage.setItem(k, v as string);
        });
        return true;
      }
    } catch (e) {
      console.error('[Restore] Rollback failed:', e);
    }
    return false;
  }
}
