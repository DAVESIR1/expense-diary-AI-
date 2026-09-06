/**
 * Optional on-device at-rest encryption for the finance vault.
 *
 * When enabled (`securityConfig.enableDeviceEncryption`), the sensitive financial
 * data (transactions, diary entries, borrow/lent records, recovery words) is wiped
 * from plaintext localStorage and stored as a single AES-GCM-256 ciphertext blob
 * whose key is derived from the user's 12-word passphrase (PBKDF2-SHA256, 200k rounds).
 *
 * - The AES key is cached in sessionStorage for the current WebView session, so the
 *   user only re-enters their 12 words after a session ends.
 * - OFF by default; existing users are unaffected until they explicitly opt in.
 *
 * All crypto runs in WebCrypto (available on https / localhost / Capacitor https).
 */
import { AppVaultData } from './vaultStorage';
import { buf2hex, hex2buf, buf2base64, base64ToBytes } from '../utils/bytes';

const BLOB_KEY = 'expense_diary_device_enc';
const FLAG_KEY = 'expense_diary_device_enc_flag';
const SESSION_KEY = 'expense_diary_device_key_session';

/** Exported for VaultStorage so it can read the sealed blob when persisting to native. */
export const DEVICE_ENC_BLOB_KEY = BLOB_KEY;

const MAGIC = 'EDDVT1';
const ITERATIONS = 200_000;

interface DeviceEnvelope {
  magic: string;
  version: number;
  kdf: string;
  iterations: number;
  salt: string; // hex
  iv: string; // hex
  cipherText: string; // base64
  syncedAt: string;
}

async function passphraseToKey(words: string[], salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphrase = words.join(' ').trim().toLowerCase();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable: the raw key is cached in sessionStorage for the session
    ['encrypt', 'decrypt']
  );
}

const SENSITIVE_KEYS = [
  'expense_diary_transactions',
  'expense_diary_entries',
  'expense_diary_borrow_lent',
  'expense_diary_recovery_words',
  'expense_diary_pending_ai',
  'expense_diary_unified_vault',
  'expense_diary_profile',
];

export interface DeviceUnlockResult {
  ok: boolean;
  vault?: AppVaultData;
  error?: string;
}

function base642RawKey(b64: string): Uint8Array {
  return base64ToBytes(b64);
}

function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as unknown as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function decryptWithKey(blob: string, key: CryptoKey): Promise<AppVaultData> {
  const envelope = JSON.parse(blob) as DeviceEnvelope;
  if (envelope.magic !== MAGIC) {
    throw new Error('Corrupt or unsupported device vault header.');
  }
  const iv = hex2buf(envelope.iv);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(envelope.cipherText));
  return JSON.parse(new TextDecoder().decode(decrypted)) as AppVaultData;
}

export const DeviceEncryption = {
  /** Feature flag: user turned device encryption on and a sealed blob exists. */
  isEnabled(): boolean {
    try {
      return localStorage.getItem(FLAG_KEY) === 'true' && !!localStorage.getItem(BLOB_KEY);
    } catch {
      return false;
    }
  },

  /** True when the AES key for this WebView session is still cached. */
  isUnlocked(): boolean {
    try {
      return sessionStorage.getItem(SESSION_KEY) !== null;
    } catch {
      return false;
    }
  },

  /**
   * Turn device encryption ON: seal the whole vault into a single AES-GCM-256
   * blob (key derived from the 12-word passphrase), cache the session key,
   * then wipe every sensitive plaintext key from localStorage.
   */
  async enable(vault: AppVaultData, words: string[]): Promise<{ ok: boolean; error?: string }> {
    if (!words || words.length < 12) {
      return { ok: false, error: 'Exactly 12 recovery words are required.' };
    }
    try {
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const key = await passphraseToKey(words, salt, ITERATIONS);
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);
      const data = new TextEncoder().encode(JSON.stringify(vault));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
      const envelope: DeviceEnvelope = {
        magic: MAGIC,
        version: 1,
        kdf: 'PBKDF2-SHA256',
        iterations: ITERATIONS,
        salt: buf2hex(salt.buffer),
        iv: buf2hex(iv.buffer),
        cipherText: buf2base64(cipher),
        syncedAt: new Date().toISOString(),
      };
      localStorage.setItem(BLOB_KEY, JSON.stringify(envelope));
      localStorage.setItem(FLAG_KEY, 'true');

      // Cache the raw key material for this WebView session only.
      const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
      sessionStorage.setItem(SESSION_KEY, buf2base64(rawKey.buffer));

      // Wipe plaintext financial data from localStorage.
      for (const k of SENSITIVE_KEYS) {
        localStorage.removeItem(k);
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Failed to enable device encryption.' };
    }
  },

  /** Drop the session key and wipe plaintext keys (data stays sealed in the blob). */
  async lock(): Promise<void> {
    for (const k of SENSITIVE_KEYS) {
      localStorage.removeItem(k);
    }
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Re-seal the blob with the CURRENT vault contents using the cached session
   * key (no PBKDF2 re-derivation — fast enough to call on every save).
   */
  async sealVault(vault: AppVaultData): Promise<boolean> {
    try {
      const sessionB64 = sessionStorage.getItem(SESSION_KEY);
      const envelopeRaw = localStorage.getItem(BLOB_KEY);
      if (!sessionB64 || !envelopeRaw) return false;
      const prev = JSON.parse(envelopeRaw) as DeviceEnvelope;
      const key = await importAesKey(base642RawKey(sessionB64));
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);
      const data = new TextEncoder().encode(JSON.stringify(vault));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
      const envelope: DeviceEnvelope = {
        ...prev,
        iv: buf2hex(iv.buffer),
        cipherText: buf2base64(cipher),
        syncedAt: new Date().toISOString(),
      };
      localStorage.setItem(BLOB_KEY, JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  },

  /** Silent unlock at boot when the session key is still cached. */
  async trySilentUnlock(): Promise<AppVaultData | null> {
    try {
      const sessionB64 = sessionStorage.getItem(SESSION_KEY);
      const blob = localStorage.getItem(BLOB_KEY);
      if (!sessionB64 || !blob) return null;
      const key = await importAesKey(base642RawKey(sessionB64));
      return await decryptWithKey(blob, key);
    } catch {
      return null;
    }
  },

  /** Explicit unlock with the 12 recovery words (session was lost). */
  async unlockWithWords(words: string[]): Promise<DeviceUnlockResult> {
    if (!words || words.length < 12) {
      return { ok: false, error: 'Enter exactly 12 recovery words.' };
    }
    try {
      const blob = localStorage.getItem(BLOB_KEY);
      if (!blob) return { ok: false, error: 'No encrypted vault found on this device.' };
      const envelope = JSON.parse(blob) as DeviceEnvelope;
      if (envelope.magic !== MAGIC) {
        return { ok: false, error: 'Corrupt or unsupported encrypted vault header.' };
      }
      const key = await passphraseToKey(words, hex2buf(envelope.salt), envelope.iterations || ITERATIONS);
      const vault = await decryptWithKey(blob, key);
      const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
      sessionStorage.setItem(SESSION_KEY, buf2base64(rawKey.buffer));
      return { ok: true, vault };
    } catch {
      return { ok: false, error: 'Decryption failed. Enter your exact 12 recovery words.' };
    }
  },

  /**
   * Turn device encryption OFF: verify the words, and remove the blob/flag/
   * session key. Returns the decrypted vault so the caller can rehydrate.
   */
  async disable(words: string[]): Promise<DeviceUnlockResult> {
    const res = await this.unlockWithWords(words);
    if (!res.ok) return res;
    try {
      localStorage.removeItem(BLOB_KEY);
      localStorage.removeItem(FLAG_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    return res;
  },

  /**
   * Native persistent-storage payload helpers: when encryption is enabled the
   * Android SharedPreferences vault stores only this ciphertext wrapper.
   */
  nativeEnvelope(blob: string): string {
    return JSON.stringify({ __deviceEncrypted: true, blob });
  },

  isNativeEnvelope(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw);
      return !!parsed && parsed.__deviceEncrypted === true && typeof parsed.blob === 'string';
    } catch {
      return false;
    }
  },

  /** Decrypt a native persistent-storage envelope (requires unlocked session). */
  async unlockNativeEnvelope(raw: string): Promise<AppVaultData | null> {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.blob) return null;
      const sessionB64 = sessionStorage.getItem(SESSION_KEY);
      if (!sessionB64) return null;
      const key = await importAesKey(base642RawKey(sessionB64));
      return await decryptWithKey(parsed.blob, key);
    } catch {
      return null;
    }
  },
};

