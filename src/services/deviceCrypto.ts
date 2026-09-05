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

const BLOB_KEY = 'expense_diary_device_enc';
const FLAG_KEY = 'expense_diary_device_enc_flag';
const SESSION_KEY = 'expense_diary_device_key_session';

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

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function buf2base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const btoaFn = (globalThis as any).btoa;
  return typeof btoaFn === 'function' ? btoaFn(binary) : '';
}

function base642buf(base64: string): ArrayBuffer {
  const atobFn = (globalThis as any).atob;
  const binary = typeof atobFn === 'function' ? atobFn(base64) : '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function passphraseToKey(words: string[], salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphrase = words.join(' ').trim().toLowerCase();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
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

async function encryptBlob(vault: AppVaultData, words: string[]): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await passphraseToKey(words, salt, ITERATIONS);
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
  return JSON.stringify(envelope);
}

async function decryptBlob(blob: string, words: string[]): Promise<AppVaultData> {
  const envelope = JSON.parse(blob) as DeviceEnvelope;
  if (envelope.magic !== MAGIC) {
    throw new Error('Corrupt or unsupported device vault header.');
  }
  const key = await passphraseToKey(words, hex2buf(envelope.salt), envelope.iterations || ITERATIONS);
  const iv = hex2buf(envelope.iv);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base642buf(envelope.cipherText)
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as AppVaultData;
  } catch {
    throw new Error('Decryption failed. Enter your exact 12 recovery words.');
  }
}

const SENSITIVE_KEYS = [
  'expense_diary_transactions',
  'expense_diary_entries',
  'expense_diary_borrow_lent',
  'expense_diary_recovery_words',
  'expense_diary_pending_ai',
];