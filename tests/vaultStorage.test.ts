import { describe, it, expect, beforeEach } from 'vitest';
import { VaultStorage, AppVaultData } from '../src/services/vaultStorage';
import { installLocalStorageStub, clearStorage } from './helpers/localStorageStub';

// VaultStorage also touches sessionStorage (device-encryption session key).
class MemorySessionStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

function makeVault(over: Partial<AppVaultData> = {}): AppVaultData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    transactions: [
      {
        id: 'tx-1',
        type: 'expense',
        amount: 250,
        title: 'Lunch',
        category: 'Food & Dining',
        date: '2026-09-05',
        time: '13:00',
        paymentMode: 'UPI',
      },
    ],
    diaryEntries: [],
    borrowedLentRecords: [],
    categories: [],
    profile: {
      name: 'Test',
      email: '',
      mobile: '',
      avatarUrl: '',
      monthlyBudget: 0,
      currency: '₹',
      dailyReminderTime: '20:00',
      enableDailyReminder: false,
    },
    securityConfig: { hasCompletedSetup: false, isLocked: false, biometricsEnabled: false, autoLockMinutes: 0, diaryLockEnabled: false },
    savedPassphraseWords: [],
    lang: 'en',
    theme: 'cream',
    font: 'sans',
    currency: '₹',
    onboarded: true,
    ...over,
  };
}

beforeEach(() => {
  installLocalStorageStub();
  clearStorage();
  (globalThis as any).sessionStorage = new MemorySessionStorage();
});

describe('VaultStorage.syncToLocalStorage', () => {
  it('writes the standard localStorage keys', () => {
    const vault = makeVault();
    VaultStorage.syncToLocalStorage(vault);

    expect(JSON.parse(localStorage.getItem('expense_diary_transactions')!)).toHaveLength(1);
    expect(localStorage.getItem('expense_diary_entries')).toBe('[]');
    expect(JSON.parse(localStorage.getItem('expense_diary_profile')!).name).toBe('Test');
    expect(localStorage.getItem('expense_diary_lang')).toBe('en');
    expect(localStorage.getItem('expense_diary_onboarded')).toBe('true');
  });

  it('does not write sensitive keys when device encryption is sealed but locked', async () => {
    // Enable device encryption (unlocked) -> then lock -> only UI prefs are synced.
    const vault = makeVault();
    const words = ['apple', 'bridge', 'candle', 'dagger', 'engine', 'fabric', 'garden', 'hammer', 'island', 'jacket', 'kettle', 'lemon'];
    const { DeviceEncryption } = await import('../src/services/deviceCrypto');
    await DeviceEncryption.enable(vault, words);
    await DeviceEncryption.lock();

    const prefs = makeVault({ lang: 'gu' });
    VaultStorage.syncToLocalStorage(prefs);

    expect(localStorage.getItem('expense_diary_transactions')).toBeNull();
    expect(localStorage.getItem('expense_diary_profile')).toBeNull();
    expect(localStorage.getItem('expense_diary_lang')).toBe('gu');
  });
});

describe('VaultStorage.loadVault', () => {
  it('assembles a vault from the flat localStorage keys', async () => {
    const vault = makeVault();
    VaultStorage.syncToLocalStorage(vault);

    const loaded = await VaultStorage.loadVault();
    expect(loaded).not.toBeNull();
    expect(loaded!.transactions).toHaveLength(1);
    expect(loaded!.transactions[0].amount).toBe(250);
    expect(loaded!.onboarded).toBe(true);
  });

  it('returns null when there is nothing stored', async () => {
    const loaded = await VaultStorage.loadVault();
    expect(loaded).toBeNull();
  });
});

describe('VaultStorage.saveVaultImmediate + clearVault', () => {
  it('round-trips a vault through immediate native persistence (degrades silently on web)', async () => {
    const vault = makeVault({ version: 2 });
    const ok = await VaultStorage.saveVaultImmediate(vault);
    // On web (no native bridge) this resolves false but localStorage is still synced.
    expect(typeof ok).toBe('boolean');

    const loaded = await VaultStorage.loadVault();
    expect(loaded?.transactions[0].title).toBe('Lunch');
  });

  it('clearVault wipes all persistence keys', async () => {
    const vault = makeVault();
    VaultStorage.syncToLocalStorage(vault);
    await VaultStorage.clearVault();

    expect(localStorage.getItem('expense_diary_transactions')).toBeNull();
    expect(localStorage.getItem('expense_diary_entries')).toBeNull();
    expect(localStorage.getItem('expense_diary_onboarded')).toBeNull();
    const loaded = await VaultStorage.loadVault();
    expect(loaded).toBeNull();
  });
});