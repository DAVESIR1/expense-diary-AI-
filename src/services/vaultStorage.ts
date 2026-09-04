import { Transaction, DiaryEntry, BorrowedLentRecord, Category, UserProfile, SecurityConfig } from '../types';
import { NativeBridgeService } from './nativeBridge';

export interface AppVaultData {
  version: number;
  updatedAt: string;
  transactions: Transaction[];
  diaryEntries: DiaryEntry[];
  borrowedLentRecords: BorrowedLentRecord[];
  categories: Category[];
  profile: UserProfile;
  securityConfig: SecurityConfig;
  savedPassphraseWords: string[];
  lang: string;
  theme: string;
  font: string;
  currency: string;
  onboarded: boolean;
}

const VAULT_STORAGE_KEY = 'expense_diary_unified_vault';
let debounceTimer: any = null;

export const VaultStorage = {
  /**
   * Sync complete vault data into standard localStorage keys
   */
  syncToLocalStorage(vault: Partial<AppVaultData>): void {
    try {
      if (vault.transactions) {
        localStorage.setItem('expense_diary_transactions', JSON.stringify(vault.transactions));
      }
      if (vault.diaryEntries) {
        localStorage.setItem('expense_diary_entries', JSON.stringify(vault.diaryEntries));
      }
      if (vault.borrowedLentRecords) {
        localStorage.setItem('expense_diary_borrow_lent', JSON.stringify(vault.borrowedLentRecords));
      }
      if (vault.categories) {
        localStorage.setItem('expense_diary_categories', JSON.stringify(vault.categories));
      }
      if (vault.profile) {
        localStorage.setItem('expense_diary_profile', JSON.stringify(vault.profile));
      }
      if (vault.securityConfig) {
        localStorage.setItem('expense_diary_security_config', JSON.stringify(vault.securityConfig));
      }
      if (vault.savedPassphraseWords) {
        localStorage.setItem('expense_diary_recovery_words', JSON.stringify(vault.savedPassphraseWords));
      }
      if (vault.lang) {
        localStorage.setItem('expense_diary_lang', vault.lang);
      }
      if (vault.theme) {
        localStorage.setItem('expense_diary_theme', vault.theme);
      }
      if (vault.font) {
        localStorage.setItem('expense_diary_font', vault.font);
      }
      if (vault.currency) {
        localStorage.setItem('expense_diary_currency', vault.currency);
      }
      if (vault.onboarded !== undefined) {
        localStorage.setItem('expense_diary_onboarded', vault.onboarded ? 'true' : 'false');
      }
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
    } catch (e) {
      console.warn('[VaultStorage] Error syncing to localStorage:', e);
    }
  },

  /**
   * Save vault both to localStorage and to native Android SharedPreferences + internal file storage
   */
  saveVault(vault: AppVaultData): void {
    // 1. Immediately sync to localStorage for synchronous web UI access
    this.syncToLocalStorage(vault);

    // 2. Debounce native persistent write (300ms) to prevent excessive disk writes on rapid edits
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const json = JSON.stringify(vault);
        await NativeBridgeService.savePersistentVault(json);
      } catch (e) {
        console.warn('[VaultStorage] Failed to save persistent native vault:', e);
      }

      // Background Zero-Knowledge Cloud Backup (if enabled)
      try {
        const { CloudSyncService } = await import('./cloudSync');
        const cloudConfig = CloudSyncService.getConfig();
        if (cloudConfig.enabled && cloudConfig.autoSync && vault.savedPassphraseWords && vault.savedPassphraseWords.length >= 12) {
          CloudSyncService.uploadVaultToCloud(vault, vault.savedPassphraseWords).catch(err => {
            console.warn('[VaultStorage] Background cloud sync deferred:', err);
          });
        }
      } catch {
        // ignore background sync errors
      }
    }, 300);
  },

  /**
   * Immediately save vault without debouncing (e.g. before closing, exporting, or completing setup)
   */
  async saveVaultImmediate(vault: AppVaultData): Promise<boolean> {
    this.syncToLocalStorage(vault);
    try {
      const json = JSON.stringify(vault);
      return await NativeBridgeService.savePersistentVault(json);
    } catch (e) {
      console.warn('[VaultStorage] Immediate persistent save failed:', e);
      return false;
    }
  },

  /**
   * Check if native Android persistent vault exists
   */
  async hasNativeVault(): Promise<{ exists: boolean; transactionCount?: number; diaryCount?: number; vaultData?: AppVaultData }> {
    try {
      const res = await NativeBridgeService.getPersistentVault();
      if (res.exists && res.vaultData) {
        const parsed = JSON.parse(res.vaultData);
        return {
          exists: true,
          transactionCount: parsed.transactions?.length || 0,
          diaryCount: parsed.diaryEntries?.length || 0,
          vaultData: parsed,
        };
      }
    } catch {
      // ignore
    }
    return { exists: false };
  },

  /**
   * Load vault from persistent native Android storage or localStorage
   */
  async loadVault(): Promise<AppVaultData | null> {
    // Priority 1: Native Android persistent storage
    try {
      const res = await NativeBridgeService.getPersistentVault();
      if (res.exists && res.vaultData) {
        const parsed: AppVaultData = JSON.parse(res.vaultData);
        if (parsed && (parsed.transactions?.length > 0 || parsed.onboarded)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[VaultStorage] Could not read from native persistent vault:', e);
    }

    // Priority 2: Unified localStorage snapshot
    try {
      const unifiedRaw = localStorage.getItem(VAULT_STORAGE_KEY);
      if (unifiedRaw) {
        const parsed: AppVaultData = JSON.parse(unifiedRaw);
        if (parsed && (parsed.transactions?.length > 0 || parsed.onboarded)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // Priority 3: Assemble from individual localStorage keys
    try {
      const onboarded = localStorage.getItem('expense_diary_onboarded') === 'true';
      const txRaw = localStorage.getItem('expense_diary_transactions');
      const diaryRaw = localStorage.getItem('expense_diary_entries');
      const blRaw = localStorage.getItem('expense_diary_borrow_lent');
      const catRaw = localStorage.getItem('expense_diary_categories');
      const profRaw = localStorage.getItem('expense_diary_profile');
      const secRaw = localStorage.getItem('expense_diary_security_config');
      const recRaw = localStorage.getItem('expense_diary_recovery_words');

      if (onboarded || txRaw) {
        return {
          version: 2,
          updatedAt: new Date().toISOString(),
          transactions: txRaw ? JSON.parse(txRaw) : [],
          diaryEntries: diaryRaw ? JSON.parse(diaryRaw) : [],
          borrowedLentRecords: blRaw ? JSON.parse(blRaw) : [],
          categories: catRaw ? JSON.parse(catRaw) : [],
          profile: profRaw ? JSON.parse(profRaw) : { name: '', monthlyBudget: 0, currency: '₹' },
          securityConfig: secRaw ? JSON.parse(secRaw) : { hasCompletedSetup: false, isLocked: false },
          savedPassphraseWords: recRaw ? JSON.parse(recRaw) : [],
          lang: localStorage.getItem('expense_diary_lang') || 'gu',
          theme: localStorage.getItem('expense_diary_theme') || 'cream',
          font: localStorage.getItem('expense_diary_font') || 'sans',
          currency: localStorage.getItem('expense_diary_currency') || '₹',
          onboarded,
        };
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Clear all persistent and local vault data
   */
  async clearVault(): Promise<void> {
    const keys = [
      'expense_diary_transactions',
      'expense_diary_entries',
      'expense_diary_borrow_lent',
      'expense_diary_categories',
      'expense_diary_profile',
      'expense_diary_security_config',
      'expense_diary_recovery_words',
      'expense_diary_onboarded',
      VAULT_STORAGE_KEY,
    ];
    for (const k of keys) {
      localStorage.removeItem(k);
    }
    await NativeBridgeService.clearPersistentVault();
  },
};
