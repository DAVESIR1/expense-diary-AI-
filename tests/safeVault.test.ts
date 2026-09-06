import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { installLocalStorageStub, clearStorage } from './helpers/localStorageStub';
import {
  SafeVaultPayload,
  SafeVaultEnvelope,
  createSafeBackup,
  decryptSafeVault,
  decryptLegacyVault,
  decryptPlaintextVault,
  mergeVaultData,
  parseVaultEnvelopeText,
  createSafetySnapshot,
  rollbackSafetySnapshot,
  discardSafetySnapshot,
  buildVaultFileName,
  cleanupLegacyBackupArtifacts,
  SAFE_VAULT_MAGIC,
} from '../src/services/safeVault';
import { Transaction, DiaryEntry, BorrowedLentRecord, Category, UserProfile } from '../src/types';

// Node-specific polyfills for the browser-native crypto helpers.
if (typeof (globalThis as any).btoa !== 'function') {
  (globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}
if (typeof (globalThis as any).atob !== 'function') {
  (globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
}
(globalThis as any).window = globalThis;

beforeAll(() => {
  installLocalStorageStub();
});
beforeEach(() => {
  clearStorage();
});

const tx = (over: Partial<Transaction> = {}): Transaction =>
  ({
    id: 'tx-1',
    type: 'expense',
    amount: 100,
    category: 'Food & Dining',
    title: 'Chai',
    date: '2026-09-01',
    time: '09:00',
    paymentMode: 'cash',
    personOrMobile: '',
    notes: '',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  }) as Transaction;

const diary = (over: Partial<DiaryEntry> = {}): DiaryEntry =>
  ({
    id: 'd-1',
    date: '2026-09-01',
    title: 'Day One',
    content: 'Notes about the day',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  }) as DiaryEntry;

const bl = (over: Partial<BorrowedLentRecord> = {}): BorrowedLentRecord =>
  ({
    id: 'bl-1',
    direction: 'lent',
    personName: 'Raj',
    amount: 500,
    date: '2026-09-01',
    status: 'pending',
    notes: '',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  }) as BorrowedLentRecord;

const cat = (over: Partial<Category> = {}): Category =>
  ({
    id: 'cat-1',
    name: 'Food & Dining',
    nameGu: 'ખોરાક',
    type: 'expense',
    icon: 'Utensils',
    color: '#f97316',
    ...over,
  }) as Category;

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Tester',
  email: '',
  mobile: '',
  avatarUrl: '',
  monthlyBudget: 10000,
  currency: '₹',
  dailyReminderTime: '20:00',
  enableDailyReminder: false,
  ...over,
});

const payload = (over: Partial<SafeVaultPayload> = {}): SafeVaultPayload => ({
  transactions: [tx()],
  diaryEntries: [diary()],
  borrowedLentRecords: [bl()],
  categories: [cat()],
  profile: profile(),
  prefs: { lang: 'en', theme: 'cream', font: 'sans', currency: '₹' },
  ...over,
});

// Faster tests: override the 600k default iterations via the public option.
const FAST = { iterations: 20_000 };

describe('createSafeBackup / decryptSafeVault round-trip', () => {
  it('encrypts, decrypts and verifies the full vault payload', async () => {
    const { envelope, words } = await createSafeBackup(payload(), FAST);
    expect(words).toHaveLength(12);
    expect(envelope.magic).toBe(SAFE_VAULT_MAGIC);
    expect(envelope.iterations).toBe(FAST.iterations);
    expect(envelope.manifest.counts).toEqual({
      transactions: 1,
      diaryEntries: 1,
      borrowedLentRecords: 1,
      categories: 1,
    });
    // Ciphertext must not leak plaintext.
    expect(JSON.stringify(envelope)).not.toContain('Chai');

    const res = await decryptSafeVault(envelope, words.join(' '));
    expect(res.integrity).toBe('verified');
    expect(res.payload.transactions[0].title).toBe('Chai');
    expect(res.payload.prefs.lang).toBe('en');
    expect(res.payload.profile?.name).toBe('Tester');
  });

  it('normalizes word case and spacing on decrypt', async () => {
    const { envelope, words } = await createSafeBackup(payload(), FAST);
    const messy = words.join('   ').toUpperCase();
    const res = await decryptSafeVault(envelope, messy);
    expect(res.integrity).toBe('verified');
  });

  it('rejects wrong recovery words', async () => {
    const { envelope } = await createSafeBackup(payload(), FAST);
    await expect(decryptSafeVault(envelope, 'wrong words entirely none match any list')).rejects.toThrow(
      /PASSPHRASE/
    );
  });

  it('rejects a tampered ciphertext even with the correct words', async () => {
    const { envelope, words } = await createSafeBackup(payload(), FAST);
    const tampered: SafeVaultEnvelope = {
      ...envelope,
      ciphertext: envelope.ciphertext.slice(0, -4) + 'AAAA',
    };
    await expect(decryptSafeVault(tampered, words.join(' '))).rejects.toThrow();
  });

  it('detects manifest mismatch (count/splice attacks)', async () => {
    const { envelope, words } = await createSafeBackup(payload(), FAST);
    const { envelope: env2 } = await createSafeBackup(
      payload({ transactions: [tx(), tx({ id: 'tx-2', amount: 999 })] }),
      { words, iterations: FAST.iterations }
    );
    // Envelope2's real ciphertext paired with envelope1's stale manifest.
    const spliced: SafeVaultEnvelope = { ...env2, manifest: { ...envelope.manifest } };
    await expect(decryptSafeVault(spliced, words.join(' '))).rejects.toThrow(/INTEGRITY/);
  });
});

describe('parseVaultEnvelopeText', () => {
  it('detects safevault, legacy and plaintext payloads', async () => {
    const { envelope } = await createSafeBackup(payload(), FAST);
    expect(parseVaultEnvelopeText(JSON.stringify(envelope)).kind).toBe('safevault');
    expect(parseVaultEnvelopeText(JSON.stringify({ magic: 'EDBAES256', ciphertext: 'x' })).kind).toBe('legacy');
    expect(parseVaultEnvelopeText(JSON.stringify({ transactions: [] })).kind).toBe('plaintext');
    expect(parseVaultEnvelopeText('not json {').kind).toBe('plaintext');
  });
});

describe('legacy compatibility', () => {
  it('decrypts a pre-v3 EDBAES256 envelope', async () => {
    // Build a legacy envelope exactly like the retired encryption.ts did.
    const passphrase = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu';
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, [
      'deriveKey',
    ]);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 50_000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const plaintext = JSON.stringify({
      transactions: [tx()],
      diaryEntries: [diary()],
      profile: profile(),
    });
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    const toHex = (a: Uint8Array) => Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
    const legacy = {
      magic: 'EDBAES256',
      version: '2.0.0',
      kdf: 'PBKDF2-SHA256',
      iterations: 50_000,
      salt: toHex(salt),
      iv: toHex(iv),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipher))),
      exportedAt: '2026-01-01T00:00:00.000Z',
      appVersion: '1.3.0',
    };

    const res = await decryptLegacyVault(legacy as any, passphrase);
    expect(res.integrity).toBe('legacy');
    expect(res.payload.transactions).toHaveLength(1);
    expect(res.payload.diaryEntries).toHaveLength(1);
  });

  it('imports old unencrypted JSON exports', () => {
    const res = decryptPlaintextVault(JSON.stringify({ transactions: [tx({ amount: 42 })] }));
    expect(res.integrity).toBe('plaintext');
    expect(res.payload.transactions[0].amount).toBe(42);
    expect(() => decryptPlaintextVault('{"nope":true}')).toThrow(/UNRECOGNIZED/);
  });
});

describe('mergeVaultData', () => {
  it('skips exact duplicates and adds new transactions', () => {
    const current = payload();
    const incoming = payload({
      transactions: [tx(), tx({ id: 'tx-9', amount: 77, title: 'New Entry' })],
    });
    const s = mergeVaultData(current, incoming, 'newer');
    expect(s.transactionsFound).toBe(2);
    expect(s.transactionsDuplicateSkipped).toBe(1);
    expect(s.transactionsImported).toBe(1);
    expect(s.mergedTransactions).toHaveLength(2);
  });

  it("strategy 'newer' keeps the most recently updated conflict winner", () => {
    const current = payload({ transactions: [tx({ amount: 20, updatedAt: '2026-09-02T00:00:00.000Z' })] });
    const incoming = payload({ transactions: [tx({ amount: 10, updatedAt: '2026-09-01T00:00:00.000Z' })] });
    const s = mergeVaultData(current, incoming, 'newer');
    expect(s.mergedTransactions[0].amount).toBe(20);
    expect(s.transactionsConflictsResolved).toBe(1);
  });

  it("strategy 'incoming' overwrites, 'existing' keeps, 'both' keeps both with a fresh id", () => {
    const current = payload({ transactions: [tx({ amount: 20 })] });
    const incoming = payload({ transactions: [tx({ amount: 10 })] });

    const sIncoming = mergeVaultData(current, incoming, 'incoming');
    expect(sIncoming.mergedTransactions[0].amount).toBe(10);

    const sExisting = mergeVaultData(current, incoming, 'existing');
    expect(sExisting.mergedTransactions[0].amount).toBe(20);
    expect(sExisting.mergedTransactions).toHaveLength(1);

    const sBoth = mergeVaultData(current, incoming, 'both');
    expect(sBoth.mergedTransactions).toHaveLength(2);
    expect(sBoth.mergedTransactions[1].id).not.toBe('tx-1');
  });

  it('dedups diary entries and borrow/lend records', () => {
    const current = payload();
    const incoming = payload({ diaryEntries: [diary()], borrowedLentRecords: [bl()] });
    const s = mergeVaultData(current, incoming, 'newer');
    expect(s.diaryEntriesDuplicateSkipped).toBe(1);
    expect(s.borrowLendDuplicateSkipped).toBe(1);
    expect(s.diaryEntriesImported).toBe(0);
  });

  it('unions categories by id and applies incoming profile/prefs', () => {
    const current = payload();
    const incoming = payload({
      categories: [cat(), cat({ id: 'cat-2', name: 'Health' })],
      profile: profile({ name: 'From Backup', monthlyBudget: 25000 }),
      prefs: { lang: 'gu', theme: 'dark' },
    });
    const s = mergeVaultData(current, incoming, 'newer');
    expect(s.categoriesAdded).toBe(1);
    expect(s.mergedCategories).toHaveLength(2);
    expect(s.profileApplied).toBe(true);
    expect(s.mergedProfile?.name).toBe('From Backup');
    expect(s.prefsApplied).toBe(true);
    expect(s.mergedPrefs.lang).toBe('gu');
    expect(s.mergedPrefs.theme).toBe('dark');
    expect(s.mergedPrefs.currency).toBeUndefined();
  });
});

describe('safety snapshot / rollback', () => {
  it('rolls the vault keys back after a restore', () => {
    localStorage.setItem('expense_diary_transactions', JSON.stringify([tx({ amount: 1 })]));
    expect(createSafetySnapshot()).toBe(true);
    localStorage.setItem('expense_diary_transactions', JSON.stringify([tx({ amount: 2 })]));
    expect(rollbackSafetySnapshot()).toBe(true);
    expect(JSON.parse(localStorage.getItem('expense_diary_transactions')!)[0].amount).toBe(1);
    // Snapshot consumed after rollback.
    expect(rollbackSafetySnapshot()).toBe(false);
    discardSafetySnapshot();
  });

  it('discards the snapshot after a successful restore', () => {
    createSafetySnapshot();
    discardSafetySnapshot();
    expect(rollbackSafetySnapshot()).toBe(false);
  });
});

describe('utilities', () => {
  it('builds a dated .edbvault filename', () => {
    expect(buildVaultFileName('expense-diary-vault', new Date('2026-09-06T10:00:00Z'))).toBe(
      'expense-diary-vault-2026-09-06.edbvault'
    );
  });

  it('cleans up legacy system artifacts', () => {
    localStorage.setItem('ed_cloud_vault_backups_v2', '[]');
    localStorage.setItem('smart_expense_cloud_config', '{}');
    localStorage.setItem('expense_diary_pre_restore_safety_backup', '{}');
    cleanupLegacyBackupArtifacts();
    expect(localStorage.getItem('ed_cloud_vault_backups_v2')).toBeNull();
    expect(localStorage.getItem('smart_expense_cloud_config')).toBeNull();
    expect(localStorage.getItem('expense_diary_pre_restore_safety_backup')).toBeNull();
  });
});
