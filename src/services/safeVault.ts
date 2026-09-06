/**
 * SafeVault — Unified Encrypted Backup & Restore Engine (v3)
 *
 * One thought-through system that replaces the previous trio of overlapping
 * mechanisms (manual .edb export/share, pseudo "Cloud Vault", Firebase sync).
 *
 * Design principles:
 * 1. Zero-knowledge: data is ALWAYS sealed on-device with AES-GCM-256; the key
 *    is derived from a 12-word BIP39 recovery phrase (PBKDF2-SHA256, 600k rounds).
 * 2. Verifiable: every envelope carries a SHA-256 manifest of the plaintext and
 *    per-collection counts, re-checked after decryption — silent corruption and
 *    tampering are detected before anything touches the live vault.
 * 3. Fail-safe: restore is dry-run previewed, and the current data is snapshotted
 *    so a restore can be undone instantly.
 * 4. Compatible: legacy `EDBAES256` (.edb) envelopes and old unencrypted JSON
 *    exports can still be restored (read-only migration path).
 * 5. Security-first: the backup NEVER contains the device lock config (PIN/bio)
 *    or the device vault recovery words — only financial data + preferences.
 */

import { Transaction, DiaryEntry, BorrowedLentRecord, Category, UserProfile } from '../types';
import { buf2hex, hex2buf, buf2base64, base64ToBytes, utf8ToBytes, bytesToUtf8, sha256Hex } from '../utils/bytes';
import { generate12WordPassphrase, validatePassphrase, normalizeWords } from './security';
import { NativeBridgeService } from './nativeBridge';
import { uid } from '../utils/uid';

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

export const SAFE_VAULT_MAGIC = 'EDBVAULT1';
export const SAFE_VAULT_VERSION = '3.0.0';
export const SAFE_VAULT_KDF = 'PBKDF2-SHA256';
export const SAFE_VAULT_ITERATIONS = 600_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
export const LEGACY_VAULT_MAGIC = 'EDBAES256';

const SNAPSHOT_KEY = 'expense_diary_safevault_snapshot';
/** localStorage keys protected by the pre-restore safety snapshot. */
const SNAPSHOT_KEYS = [
  'expense_diary_transactions',
  'expense_diary_entries',
  'expense_diary_borrow_lent',
  'expense_diary_categories',
  'expense_diary_profile',
  'expense_diary_lang',
  'expense_diary_theme',
  'expense_diary_font',
  'expense_diary_currency',
];

export interface SafeVaultPrefs {
  lang?: string;
  theme?: string;
  font?: string;
  currency?: string;
}

export interface SafeVaultPayload {
  transactions: Transaction[];
  diaryEntries: DiaryEntry[];
  borrowedLentRecords: BorrowedLentRecord[];
  categories: Category[];
  profile: UserProfile | null;
  prefs: SafeVaultPrefs;
}

export interface SafeVaultManifest {
  schema: 3;
  counts: {
    transactions: number;
    diaryEntries: number;
    borrowedLentRecords: number;
    categories: number;
  };
  /** SHA-256 hex of the canonical plaintext JSON — verified after decryption. */
  sha256: string;
  createdAt: string;
  appVersion: string;
}

export interface SafeVaultEnvelope {
  magic: typeof SAFE_VAULT_MAGIC;
  version: typeof SAFE_VAULT_VERSION;
  kdf: typeof SAFE_VAULT_KDF;
  iterations: number;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // base64
  manifest: SafeVaultManifest;
  exportedAt: string;
}

/** Pre-v3 envelope produced by the retired manual export flow. */
export interface LegacyEncryptedBackupEnvelope {
  magic: typeof LEGACY_VAULT_MAGIC;
  version: string;
  kdf: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
  appVersion: string;
}

export type VaultEnvelope = SafeVaultEnvelope | LegacyEncryptedBackupEnvelope;
export type VaultEnvelopeKind = 'safevault' | 'legacy' | 'plaintext';

export type MergeStrategy = 'newer' | 'existing' | 'incoming' | 'both';

export interface MergeStats {
  transactionsFound: number;
  transactionsImported: number;
  transactionsDuplicateSkipped: number;
  transactionsConflictsResolved: number;

  diaryEntriesFound: number;
  diaryEntriesImported: number;
  diaryEntriesDuplicateSkipped: number;

  borrowLendFound: number;
  borrowLendImported: number;
  borrowLendDuplicateSkipped: number;

  categoriesFound: number;
  categoriesAdded: number;
  profileApplied: boolean;
  prefsApplied: boolean;

  mergedTransactions: Transaction[];
  mergedDiaryEntries: DiaryEntry[];
  mergedBorrowLend: BorrowedLentRecord[];
  mergedCategories: Category[];
  mergedProfile: UserProfile | null;
  mergedPrefs: SafeVaultPrefs;
}

export type ExportMethod = 'downloads' | 'share' | 'browser' | 'failed';

// ---------------------------------------------------------------------------
// Envelope parse
// ---------------------------------------------------------------------------

export function parseVaultEnvelopeText(
  text: string
): { kind: 'safevault'; envelope: SafeVaultEnvelope } | { kind: 'legacy'; envelope: LegacyEncryptedBackupEnvelope } | { kind: 'plaintext'; envelope: null } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'plaintext', envelope: null };
  }
  if (raw && raw.magic === SAFE_VAULT_MAGIC && typeof raw.ciphertext === 'string') {
    return { kind: 'safevault', envelope: raw as unknown as SafeVaultEnvelope };
  }
  if (raw && raw.magic === LEGACY_VAULT_MAGIC && typeof raw.ciphertext === 'string') {
    return { kind: 'legacy', envelope: raw as unknown as LegacyEncryptedBackupEnvelope };
  }
  return { kind: 'plaintext', envelope: null };
}

// ---------------------------------------------------------------------------
// Crypto core
// ---------------------------------------------------------------------------

async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    utf8ToBytes(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function canonicalPayloadJson(payload: SafeVaultPayload): string {
  // Fixed key order so the SHA-256 manifest is stable across devices.
  return JSON.stringify({
    transactions: payload.transactions,
    diaryEntries: payload.diaryEntries,
    borrowedLentRecords: payload.borrowedLentRecords,
    categories: payload.categories,
    profile: payload.profile,
    prefs: payload.prefs,
  });
}

function countPayload(payload: SafeVaultPayload): SafeVaultManifest['counts'] {
  return {
    transactions: payload.transactions.length,
    diaryEntries: payload.diaryEntries.length,
    borrowedLentRecords: payload.borrowedLentRecords.length,
    categories: payload.categories.length,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateBackupOptions {
  /** Provide an existing 12-word phrase; a fresh one is generated when omitted. */
  words?: string[];
  iterations?: number;
  appVersion?: string;
}

export async function createSafeBackup(
  payload: SafeVaultPayload,
  options: CreateBackupOptions = {}
): Promise<{ envelope: SafeVaultEnvelope; words: string[] }> {
  const words = options.words && options.words.length === 12 ? options.words : generate12WordPassphrase();
  const validation = validatePassphrase(words);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid recovery phrase.');
  }

  const iterations = options.iterations ?? SAFE_VAULT_ITERATIONS;
  const plaintext = canonicalPayloadJson(payload);
  const digest = await sha256Hex(plaintext);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12); // Standard 96-bit IV for AES-GCM
  crypto.getRandomValues(iv);

  const key = await deriveVaultKey(normalizeWords(words), salt, iterations);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8ToBytes(plaintext));

  const now = new Date().toISOString();
  const envelope: SafeVaultEnvelope = {
    magic: SAFE_VAULT_MAGIC,
    version: SAFE_VAULT_VERSION,
    kdf: SAFE_VAULT_KDF,
    iterations,
    salt: buf2hex(salt.buffer),
    iv: buf2hex(iv.buffer),
    ciphertext: buf2base64(ciphertext),
    manifest: {
      schema: 3,
      counts: countPayload(payload),
      sha256: digest,
      createdAt: now,
      appVersion: options.appVersion || '1.3.1',
    },
    exportedAt: now,
  };
  return { envelope, words };
}

// ---------------------------------------------------------------------------
// Decrypt (+ integrity verification)
// ---------------------------------------------------------------------------

export interface DecryptVaultResult {
  payload: SafeVaultPayload;
  integrity: 'verified' | 'legacy' | 'plaintext';
}

function emptyPayload(): SafeVaultPayload {
  return { transactions: [], diaryEntries: [], borrowedLentRecords: [], categories: [], profile: null, prefs: {} };
}

function normalizeLegacyPayload(raw: Record<string, unknown>): SafeVaultPayload {
  const payload = emptyPayload();
  payload.transactions = Array.isArray(raw.transactions) ? (raw.transactions as Transaction[]) : [];
  payload.diaryEntries = Array.isArray(raw.diaryEntries) ? (raw.diaryEntries as DiaryEntry[]) : [];
  payload.borrowedLentRecords = Array.isArray(raw.borrowedLentRecords)
    ? (raw.borrowedLentRecords as BorrowedLentRecord[])
    : [];
  payload.categories = Array.isArray(raw.categories) ? (raw.categories as Category[]) : [];
  payload.profile = (raw.profile as UserProfile) || null;
  return payload;
}

/** Decrypt a SafeVault v3 envelope and verify its SHA-256 manifest. */
export async function decryptSafeVault(
  envelope: SafeVaultEnvelope,
  wordsInput: string | string[]
): Promise<DecryptVaultResult> {
  const passphrase = normalizeWords(wordsInput);
  if (!passphrase) {
    throw new Error('VAULT_PASSPHRASE_REJECTED');
  }
  const salt = hex2buf(envelope.salt);
  const iv = hex2buf(envelope.iv);
  const iterations = envelope.iterations || SAFE_VAULT_ITERATIONS;

  const key = await deriveVaultKey(passphrase, salt, iterations);
  let plaintext: string;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    plaintext = bytesToUtf8(decrypted);
  } catch {
    throw new Error('VAULT_PASSPHRASE_REJECTED');
  }

  const raw = JSON.parse(plaintext) as Record<string, unknown> & Partial<SafeVaultPayload>;
  const payload: SafeVaultPayload = {
    transactions: (raw.transactions as Transaction[]) || [],
    diaryEntries: (raw.diaryEntries as DiaryEntry[]) || [],
    borrowedLentRecords: (raw.borrowedLentRecords as BorrowedLentRecord[]) || [],
    categories: (raw.categories as Category[]) || [],
    profile: (raw.profile as UserProfile) || null,
    prefs: (raw.prefs as SafeVaultPrefs) || {},
  };

  // Integrity gate: the manifest must match what we actually decrypted.
  const digest = await sha256Hex(canonicalPayloadJson(payload));
  const manifest = envelope.manifest;
  if (!manifest || manifest.sha256 !== digest) {
    throw new Error('VAULT_INTEGRITY_FAILED');
  }
  const counts = countPayload(payload);
  if (
    manifest.counts &&
    (manifest.counts.transactions !== counts.transactions ||
      manifest.counts.diaryEntries !== counts.diaryEntries ||
      manifest.counts.borrowedLentRecords !== counts.borrowedLentRecords ||
      manifest.counts.categories !== counts.categories)
  ) {
    throw new Error('VAULT_INTEGRITY_FAILED');
  }
  return { payload, integrity: 'verified' };
}

/** Decrypt a legacy EDBAES256 envelope (pre-v3 .edb export). */
export async function decryptLegacyVault(
  envelope: LegacyEncryptedBackupEnvelope,
  passphraseInput: string | string[]
): Promise<DecryptVaultResult> {
  const passphrase = normalizeWords(passphraseInput);
  const salt = hex2buf(envelope.salt);
  const iv = hex2buf(envelope.iv);
  const iterations = envelope.iterations || 100_000;

  const key = await deriveVaultKey(passphrase, salt, iterations);
  let plaintext: string;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    plaintext = bytesToUtf8(decrypted);
  } catch {
    throw new Error('VAULT_PASSPHRASE_REJECTED');
  }
  const payload = normalizeLegacyPayload(JSON.parse(plaintext) as Record<string, unknown>);
  return { payload, integrity: 'legacy' };
}

/** Restore an old unencrypted JSON export (migration path only). */
export function decryptPlaintextVault(text: string): DecryptVaultResult {
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (!Array.isArray(raw.transactions)) {
    throw new Error('VAULT_UNRECOGNIZED');
  }
  return { payload: normalizeLegacyPayload(raw), integrity: 'plaintext' };
}

// ---------------------------------------------------------------------------
// Merge engine
// ---------------------------------------------------------------------------

const txContentKey = (t: Transaction): string =>
  [t.date, t.type, t.amount, (t.title || '').trim().toLowerCase()].join('|');

const diaryContentKey = (d: DiaryEntry): string =>
  [d.date, (d.title || '').trim().toLowerCase(), (d.content || '').trim().slice(0, 100)].join('|');

const blContentKey = (b: BorrowedLentRecord): string =>
  [b.direction, b.personName.trim().toLowerCase(), b.amount, b.date].join('|');

const txTimestamp = (t: Transaction): number => new Date(t.updatedAt || t.date || 0).getTime();

export function mergeVaultData(
  current: SafeVaultPayload,
  incoming: SafeVaultPayload,
  strategy: MergeStrategy = 'newer'
): MergeStats {
  const stats: MergeStats = {
    transactionsFound: incoming.transactions.length,
    transactionsImported: 0,
    transactionsDuplicateSkipped: 0,
    transactionsConflictsResolved: 0,
    diaryEntriesFound: incoming.diaryEntries.length,
    diaryEntriesImported: 0,
    diaryEntriesDuplicateSkipped: 0,
    borrowLendFound: incoming.borrowedLentRecords.length,
    borrowLendImported: 0,
    borrowLendDuplicateSkipped: 0,
    categoriesFound: incoming.categories.length,
    categoriesAdded: 0,
    profileApplied: false,
    prefsApplied: false,
    mergedTransactions: [...current.transactions],
    mergedDiaryEntries: [...current.diaryEntries],
    mergedBorrowLend: [...current.borrowedLentRecords],
    mergedCategories: [...current.categories],
    mergedProfile: null,
    mergedPrefs: {},
  };

  // --- Transactions: content-key dedup + id-aware conflict resolution ---
  const byKey = new Map<string, Transaction>();
  const byId = new Map<string, Transaction>();
  for (const tx of current.transactions) {
    byKey.set(txContentKey(tx), tx);
    byId.set(tx.id, tx);
  }

  for (const incomingTx of incoming.transactions) {
    const key = txContentKey(incomingTx);
    const existingById = byId.get(incomingTx.id);
    const existingByKey = byKey.get(key);

    if (existingByKey) {
      // Exact same date/type/amount/title → duplicate regardless of id.
      stats.transactionsDuplicateSkipped++;
      continue;
    }
    if (existingById) {
      // Same id but different content → genuine conflict.
      stats.transactionsConflictsResolved++;
      const replaceInPlace = () => {
        const idx = stats.mergedTransactions.findIndex((t) => t.id === incomingTx.id);
        if (idx >= 0) stats.mergedTransactions[idx] = incomingTx;
      };
      if (strategy === 'existing') {
        stats.transactionsDuplicateSkipped++;
        continue;
      }
      if (strategy === 'newer' && txTimestamp(incomingTx) < txTimestamp(existingById)) {
        stats.transactionsDuplicateSkipped++;
        continue;
      }
      if (strategy === 'both') {
        const clone: Transaction = { ...incomingTx, id: uid('tx') };
        stats.mergedTransactions.push(clone);
        byId.set(clone.id, clone);
        byKey.set(key, clone);
        stats.transactionsImported++;
        continue;
      }
      replaceInPlace();
      byKey.set(key, incomingTx);
      stats.transactionsImported++;
      continue;
    }
    stats.mergedTransactions.push(incomingTx);
    byId.set(incomingTx.id, incomingTx);
    byKey.set(key, incomingTx);
    stats.transactionsImported++;
  }

  // --- Diary entries: content dedup ---
  const diaryKeys = new Set(current.diaryEntries.map(diaryContentKey));
  for (const entry of incoming.diaryEntries) {
    const key = diaryContentKey(entry);
    if (diaryKeys.has(key)) {
      stats.diaryEntriesDuplicateSkipped++;
      continue;
    }
    diaryKeys.add(key);
    stats.mergedDiaryEntries.push(entry);
    stats.diaryEntriesImported++;
  }

  // --- Borrow / lend records: content dedup ---
  const blKeys = new Set(current.borrowedLentRecords.map(blContentKey));
  for (const record of incoming.borrowedLentRecords) {
    const key = blContentKey(record);
    if (blKeys.has(key)) {
      stats.borrowLendDuplicateSkipped++;
      continue;
    }
    blKeys.add(key);
    stats.mergedBorrowLend.push(record);
    stats.borrowLendImported++;
  }

  // --- Categories: union by id ---
  const catById = new Map(current.categories.map((c) => [c.id, c]));
  for (const cat of incoming.categories) {
    if (catById.has(cat.id)) continue;
    catById.set(cat.id, cat);
    stats.mergedCategories.push(cat);
    stats.categoriesAdded++;
  }

  // --- Profile & preferences: incoming wins when present ---
  if (incoming.profile && (incoming.profile.name || incoming.profile.monthlyBudget)) {
    stats.mergedProfile = incoming.profile;
    stats.profileApplied = true;
  }
  const prefs: SafeVaultPrefs = {};
  if (incoming.prefs.lang) prefs.lang = incoming.prefs.lang;
  if (incoming.prefs.theme) prefs.theme = incoming.prefs.theme;
  if (incoming.prefs.font) prefs.font = incoming.prefs.font;
  if (incoming.prefs.currency) prefs.currency = incoming.prefs.currency;
  stats.mergedPrefs = prefs;
  stats.prefsApplied = Object.keys(prefs).length > 0;

  return stats;
}

// ---------------------------------------------------------------------------
// Fail-safe snapshot (undo)
// ---------------------------------------------------------------------------

export function createSafetySnapshot(): boolean {
  try {
    const snapshot: Record<string, string> = {};
    for (const k of SNAPSHOT_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) snapshot[k] = v;
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return true;
  } catch (e) {
    console.warn('[SafeVault] Could not create safety snapshot:', e);
    return false;
  }
}

export function rollbackSafetySnapshot(): boolean {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw) as Record<string, string>;
    for (const k of SNAPSHOT_KEYS) {
      if (k in snapshot) localStorage.setItem(k, snapshot[k]);
      else localStorage.removeItem(k);
    }
    localStorage.removeItem(SNAPSHOT_KEY);
    return true;
  } catch (e) {
    console.error('[SafeVault] Rollback failed:', e);
    return false;
  }
}

export function discardSafetySnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Export (save to Downloads / share sheet / browser download)
// ---------------------------------------------------------------------------

export function buildVaultFileName(prefix = 'expense-diary-vault', date = new Date()): string {
  const dateStr = date.toISOString().split('T')[0];
  return `${prefix}-${dateStr}.edbvault`;
}

export async function exportVaultEnvelope(
  envelope: VaultEnvelope,
  filename?: string
): Promise<{ ok: boolean; method: ExportMethod; filename: string }> {
  const json = JSON.stringify(envelope, null, 2);
  const name = filename || buildVaultFileName();

  // 1. Native Android — save straight into the public Downloads folder.
  try {
    const res = await NativeBridgeService.saveFileToDownloads(name, json, 'application/octet-stream');
    if (res && res.success) {
      return { ok: true, method: 'downloads', filename: name };
    }
  } catch {
    // Not running under the native bridge — fall through.
  }

  // 2. Native share sheet (user picks Drive, WhatsApp, Files, ...).
  try {
    const res = await NativeBridgeService.shareFile({
      fileName: name,
      mimeType: 'application/octet-stream',
      textContent: json,
      title: 'SafeVault Encrypted Backup',
    });
    if (res && res.success) {
      return { ok: true, method: 'share', filename: name };
    }
  } catch {
    // Fall through to browser download.
  }

  // 3. Browser download fallback (PWA / web).
  try {
    const blob = new Blob([json], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, method: 'browser', filename: name };
  } catch (e) {
    console.error('[SafeVault] Export failed:', e);
    return { ok: false, method: 'failed', filename: name };
  }
}

// ---------------------------------------------------------------------------
// Legacy artifact cleanup
// ---------------------------------------------------------------------------

/** Removes stale localStorage keys left behind by the retired backup systems. */
export function cleanupLegacyBackupArtifacts(): void {
  const staleKeys = [
    'ed_cloud_vault_backups_v2', // retired pseudo Cloud Vault
    'smart_expense_cloud_config', // retired Firebase sync config
    'expense_diary_pre_restore_safety_backup', // superseded snapshot key
  ];
  try {
    staleKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore (non-browser environments)
  }
}



