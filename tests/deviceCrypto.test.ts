import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceEncryption } from '../src/services/deviceCrypto';
import type { AppVaultData } from '../src/services/vaultStorage';
import { installLocalStorageStub, clearStorage } from './helpers/localStorageStub';

// Polyfill web storage APIs the service relies on under Node.
if (typeof (globalThis as any).btoa !== 'function') {
  (globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}
if (typeof (globalThis as any).atob !== 'function') {
  (globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
}

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
(globalThis as any).sessionStorage = new MemorySessionStorage();

const WORDS = ['apple', 'bridge', 'candle', 'dagger', 'engine', 'fabric', 'garden', 'hammer', 'island', 'jacket', 'kettle', 'lemon'];

function makeVault(): AppVaultData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    transactions: [
      {
        id: 'tx-enc-1',
        type: 'expense',
        amount: 1234.5,
        title: 'Secret Chai',
        category: 'Food & Dining',
        date: '2026-09-05',
        time: '09:15',
        paymentMode: 'Cash',
      },
    ],
    diaryEntries: [],
    borrowedLentRecords: [],
    categories: [],
    profile: { name: 'Tester', email: '', mobile: '', avatarUrl: '', monthlyBudget: 10000, currency: '₹', dailyReminderTime: '20:00', enableDailyReminder: false },
    securityConfig: { hasCompletedSetup: true, isLocked: false, biometricsEnabled: false, autoLockMinutes: 1, diaryLockEnabled: false },
    savedPassphraseWords: WORDS,
    lang: 'en',
    theme: 'cream',
    font: 'sans',
    currency: '₹',
    onboarded: true,
  };
}

describe('DeviceEncryption (on-device at-rest vault seal)', () => {
  beforeEach(() => {
    installLocalStorageStub();
    clearStorage();
    (globalThis as any).sessionStorage.clear();
  });

  it('is disabled by default', () => {
    expect(DeviceEncryption.isEnabled()).toBe(false);
    expect(DeviceEncryption.isUnlocked()).toBe(false);
  });

  it('enable() seals the vault, wipes plaintext, and caches the session key', async () => {
    const vault = makeVault();
    localStorage.setItem('expense_diary_transactions', JSON.stringify(vault.transactions));
    localStorage.setItem('expense_diary_recovery_words', JSON.stringify(vault.savedPassphraseWords));

    const res = await DeviceEncryption.enable(vault, WORDS);
    expect(res.ok).toBe(true);
    expect(DeviceEncryption.isEnabled()).toBe(true);
    expect(DeviceEncryption.isUnlocked()).toBe(true);

    // Sensitive plaintext keys must be wiped from localStorage.
    expect(localStorage.getItem('expense_diary_transactions')).toBeNull();
    expect(localStorage.getItem('expense_diary_recovery_words')).toBeNull();
    expect(localStorage.getItem('expense_diary_unified_vault')).toBeNull();
    expect(localStorage.getItem('expense_diary_profile')).toBeNull();

    // The sealed blob must exist and must NOT contain plaintext content.
    const blob = localStorage.getItem('expense_diary_device_enc') || '';
    expect(blob).toContain('"magic":"EDDVT1"');
    expect(blob).not.toContain('Secret Chai');
  });

  it('rejects enabling with fewer than 12 words', async () => {
    const res = await DeviceEncryption.enable(makeVault(), WORDS.slice(0, 5));
    expect(res.ok).toBe(false);
  });

  it('unlockWithWords restores the exact vault and caches the session', async () => {
    const vault = makeVault();
    await DeviceEncryption.enable(vault, WORDS);
    await DeviceEncryption.lock();

    expect(DeviceEncryption.isUnlocked()).toBe(false);

    const wrong = await DeviceEncryption.unlockWithWords(WORDS.map((w, i) => (i === 3 ? 'wrong' : w)));
    expect(wrong.ok).toBe(false);

    const good = await DeviceEncryption.unlockWithWords(WORDS);
    expect(good.ok).toBe(true);
    expect(good.vault?.transactions[0].title).toBe('Secret Chai');
    expect(good.vault?.transactions[0].amount).toBe(1234.5);
    expect(DeviceEncryption.isUnlocked()).toBe(true);
  });

  it('sealVault() refreshes the blob with new data using the cached session key', async () => {
    const vault = makeVault();
    await DeviceEncryption.enable(vault, WORDS);

    const updated = { ...vault, transactions: [{ ...vault.transactions[0], amount: 999 }] };
    const sealed = await DeviceEncryption.sealVault(updated);
    expect(sealed).toBe(true);

    const readBack = await DeviceEncryption.trySilentUnlock();
    expect(readBack?.transactions[0].amount).toBe(999);
  });

  it('lock() drops the session and wipes plaintext; silent unlock then fails', async () => {
    await DeviceEncryption.enable(makeVault(), WORDS);
    await DeviceEncryption.lock();

    expect(DeviceEncryption.isUnlocked()).toBe(false);
    const silent = await DeviceEncryption.trySilentUnlock();
    expect(silent).toBeNull();
  });

  it('native envelope round-trip hides plaintext and decrypts with a session', async () => {
    const vault = makeVault();
    await DeviceEncryption.enable(vault, WORDS);

    const blob = localStorage.getItem('expense_diary_device_enc') || '';
    const envelope = DeviceEncryption.nativeEnvelope(blob);
    expect(DeviceEncryption.isNativeEnvelope(envelope)).toBe(true);
    expect(envelope).not.toContain('Secret Chai');

    const decrypted = await DeviceEncryption.unlockNativeEnvelope(envelope);
    expect(decrypted?.transactions[0].title).toBe('Secret Chai');
  });

  it('disable() removes the blob and flag permanently', async () => {
    await DeviceEncryption.enable(makeVault(), WORDS);
    const res = await DeviceEncryption.disable(WORDS);
    expect(res.ok).toBe(true);
    expect(res.vault?.transactions.length).toBe(1);
    expect(DeviceEncryption.isEnabled()).toBe(false);
    expect(localStorage.getItem('expense_diary_device_enc')).toBeNull();
    expect(localStorage.getItem('expense_diary_device_enc_flag')).toBeNull();
  });
});
