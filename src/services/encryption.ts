// AES-GCM 256-bit Encrypted Backup & Restore Service
// Using WebCrypto API for authenticated encryption

export interface EncryptedBackupEnvelope {
  magic: 'EDBAES256';
  version: '2.0.0';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // hex
  iv: string; // hex
  ciphertext: string; // base64
  exportedAt: string;
  appVersion: string;
}

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function buf2base64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base642buf(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive AES-GCM 256-bit key from passphrase and salt
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt payload object into an EncryptedBackupEnvelope
export async function encryptPayload<T>(
  data: T,
  passphrase: string,
  iterations = 100000
): Promise<EncryptedBackupEnvelope> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const iv = new Uint8Array(12); // Standard 96-bit IV for AES-GCM
  crypto.getRandomValues(iv);

  const key = await deriveEncryptionKey(passphrase, salt, iterations);

  const jsonString = JSON.stringify(data);
  const encodedData = new TextEncoder().encode(jsonString);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    magic: 'EDBAES256',
    version: '2.0.0',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: buf2hex(salt.buffer),
    iv: buf2hex(iv.buffer),
    ciphertext: buf2base64(encryptedBuffer),
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
  };
}

// Decrypt an EncryptedBackupEnvelope back to data object
export async function decryptPayload<T>(
  envelope: EncryptedBackupEnvelope,
  passphrase: string
): Promise<T> {
  if (envelope.magic !== 'EDBAES256') {
    throw new Error('Unsupported backup file format or corrupt header.');
  }

  const salt = hex2buf(envelope.salt);
  const iv = hex2buf(envelope.iv);
  const iterations = envelope.iterations || 100000;

  const key = await deriveEncryptionKey(passphrase, salt, iterations);
  const ciphertextBuffer = base642buf(envelope.ciphertext);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertextBuffer
    );

    const decodedString = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decodedString) as T;
  } catch {
    throw new Error('Decryption failed. The recovery passphrase is incorrect or the file has been tampered with.');
  }
}

// Download encrypted backup file with .edb extension
export function downloadEncryptedBackup(envelope: EncryptedBackupEnvelope, filenamePrefix = 'expense-diary-backup'): void {
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `${filenamePrefix}-${dateStr}.edb`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
