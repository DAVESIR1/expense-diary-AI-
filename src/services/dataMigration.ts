/**
 * Data Migration & Backward Compatibility Manager (§21)
 * 
 * Ensures safe, sequential migration of existing user data across app updates.
 * - Tracks schema version in localStorage ('expense_diary_schema_version')
 * - Maintains an audit log of migrations ('expense_diary_migration_history')
 * - Creates pre-migration automatic snapshots for fail-safe rollback
 * - Validates and normalizes records with default values for new columns
 */

import { Transaction, DiaryEntry, BorrowedLentRecord, Category, SecurityConfig } from '../types';

export const CURRENT_SCHEMA_VERSION = 4;

export interface MigrationLogEntry {
  fromVersion: number;
  toVersion: number;
  timestamp: string;
  success: boolean;
  notes?: string;
}

export class MigrationManager {
  private static STORAGE_KEY_VERSION = 'expense_diary_schema_version';
  private static STORAGE_KEY_HISTORY = 'expense_diary_migration_history';
  private static STORAGE_KEY_SNAPSHOT = 'expense_diary_pre_migration_snapshot';

  /**
   * Run all pending migrations on app startup.
   * Safe to call multiple times (idempotent).
   */
  public static runMigrations(): void {
    try {
      const currentVersion = this.getCurrentVersion();

      if (currentVersion >= CURRENT_SCHEMA_VERSION) {
        return; // Up to date
      }

      console.log(`[Migration] Starting schema migration: v${currentVersion} -> v${CURRENT_SCHEMA_VERSION}`);
      this.createBackupSnapshot();

      for (let v = currentVersion; v < CURRENT_SCHEMA_VERSION; v++) {
        const nextVersion = v + 1;
        console.log(`[Migration] Applying migration step: v${v} -> v${nextVersion}`);

        switch (nextVersion) {
          case 2:
            this.migrateV1toV2();
            break;
          case 3:
            this.migrateV2toV3();
            break;
          case 4:
            this.migrateV3toV4();
            break;
          default:
            console.warn(`[Migration] Unknown migration step to v${nextVersion}`);
        }

        this.setVersion(nextVersion);
        this.logMigration(v, nextVersion, true);
      }

      console.log(`[Migration] Successfully reached schema v${CURRENT_SCHEMA_VERSION}`);
    } catch (err) {
      console.error('[Migration] Failed during migration, initiating rollback:', err);
      this.rollbackFromSnapshot();
      this.logMigration(this.getCurrentVersion(), CURRENT_SCHEMA_VERSION, false, String(err));
    }
  }

  public static getCurrentVersion(): number {
    const raw = localStorage.getItem(this.STORAGE_KEY_VERSION);
    if (!raw) {
      // Check if existing data exists to differentiate between brand new install vs v1 legacy
      const hasLegacyTx = localStorage.getItem('expense_diary_transactions');
      return hasLegacyTx ? 1 : CURRENT_SCHEMA_VERSION;
    }
    return parseInt(raw, 10) || 1;
  }

  private static setVersion(version: number): void {
    localStorage.setItem(this.STORAGE_KEY_VERSION, version.toString());
  }

  /**
   * Snapshot current localStorage state before applying migrations for safe rollback.
   */
  private static createBackupSnapshot(): void {
    try {
      const snapshot: Record<string, string> = {};
      const keys = [
        'expense_diary_transactions',
        'expense_diary_categories',
        'expense_diary_profile',
        'expense_diary_entries',
        'expense_diary_borrow_lent',
        'expense_diary_security'
      ];
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (val !== null) snapshot[k] = val;
      }
      localStorage.setItem(this.STORAGE_KEY_SNAPSHOT, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[Migration] Snapshot creation warning:', e);
    }
  }

  /**
   * Roll back data from pre-migration snapshot if a migration error occurs.
   */
  private static rollbackFromSnapshot(): void {
    try {
      const snap = localStorage.getItem(this.STORAGE_KEY_SNAPSHOT);
      if (snap) {
        const data = JSON.parse(snap);
        for (const [k, v] of Object.entries(data)) {
          localStorage.setItem(k, v as string);
        }
        console.warn('[Migration] Rollback from snapshot completed successfully.');
      }
    } catch (e) {
      console.error('[Migration] Critical: Rollback failed:', e);
    }
  }

  private static logMigration(from: number, to: number, success: boolean, notes?: string): void {
    try {
      const logsRaw = localStorage.getItem(this.STORAGE_KEY_HISTORY);
      const logs: MigrationLogEntry[] = logsRaw ? JSON.parse(logsRaw) : [];
      logs.push({
        fromVersion: from,
        toVersion: to,
        timestamp: new Date().toISOString(),
        success,
        notes
      });
      localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(logs));
    } catch (e) {
      console.error('[Migration] Failed to log migration history:', e);
    }
  }

  /**
   * Migration v1 -> v2:
   * Adds evidence, evidenceSource, and referenceNumber fields to legacy transactions.
   */
  private static migrateV1toV2(): void {
    const raw = localStorage.getItem('expense_diary_transactions');
    if (!raw) return;
    try {
      const txs: Transaction[] = JSON.parse(raw);
      const updated = txs.map(tx => ({
        ...tx,
        evidence: tx.evidence ?? '',
        evidenceSource: tx.evidenceSource ?? (tx.notes ? 'manual' : undefined),
        referenceNumber: tx.referenceNumber ?? ''
      }));
      localStorage.setItem('expense_diary_transactions', JSON.stringify(updated));
    } catch (e) {
      console.error('[Migration] v1 -> v2 error:', e);
      throw e;
    }
  }

  /**
   * Migration v2 -> v3:
   * Initializes diary entries and borrowed/lent storage tables with default constraints.
   */
  private static migrateV2toV3(): void {
    const diaryRaw = localStorage.getItem('expense_diary_entries');
    if (!diaryRaw) {
      localStorage.setItem('expense_diary_entries', JSON.stringify([]));
    } else {
      try {
        const entries: DiaryEntry[] = JSON.parse(diaryRaw);
        const validated = entries.map(e => ({
          ...e,
          mood: e.mood || 'neutral',
          tags: Array.isArray(e.tags) ? e.tags : [],
          createdAt: e.createdAt || new Date().toISOString(),
          updatedAt: e.updatedAt || new Date().toISOString()
        }));
        localStorage.setItem('expense_diary_entries', JSON.stringify(validated));
      } catch (e) {
        console.error('[Migration] v2 -> v3 diary normalization error:', e);
      }
    }

    const borrowRaw = localStorage.getItem('expense_diary_borrow_lent');
    if (!borrowRaw) {
      localStorage.setItem('expense_diary_borrow_lent', JSON.stringify([]));
    }
  }

  /**
   * Migration v3 -> v4:
   * Validates BorrowedLentRecord schema: ensures direction, status, personName, and contact fields.
   */
  private static migrateV3toV4(): void {
    const raw = localStorage.getItem('expense_diary_borrow_lent');
    if (!raw) return;
    try {
      const records: BorrowedLentRecord[] = JSON.parse(raw);
      const validated = records.map(r => ({
        ...r,
        direction: r.direction === 'lent' ? 'lent' : 'borrowed',
        status: r.status || 'pending',
        personName: r.personName || 'Unknown',
        contactNumber: r.contactNumber || '',
        note: r.note || '',
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString()
      }));
      localStorage.setItem('expense_diary_borrow_lent', JSON.stringify(validated));
    } catch (e) {
      console.error('[Migration] v3 -> v4 error:', e);
      throw e;
    }
  }
}
