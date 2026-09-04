import { BIP39_WORDLIST } from './bip39Words';

// Convert buffer to hex string
function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert hex string to Uint8Array
function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Generate random salt hex
export function generateRandomSalt(byteLength = 16): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return buf2hex(arr.buffer);
}

// Generate 12 random words from BIP39 wordlist
export function generate12WordPassphrase(): string[] {
  const wordCount = 12;
  const words: string[] = [];
  const total = BIP39_WORDLIST.length; // 2048

  const randomValues = new Uint16Array(wordCount);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < wordCount; i++) {
    const index = randomValues[i] % total;
    words.push(BIP39_WORDLIST[index]);
  }

  return words;
}

// Validate a 12-word passphrase
export function validatePassphrase(words: string[] | string): { isValid: boolean; error?: string } {
  const wordArr = Array.isArray(words)
    ? words
    : words
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

  if (wordArr.length !== 12) {
    return {
      isValid: false,
      error: `Passphrase must be exactly 12 words (found ${wordArr.length}).`,
    };
  }

  for (const w of wordArr) {
    if (!BIP39_WORDLIST.includes(w.toLowerCase())) {
      return {
        isValid: false,
        error: `Word "${w}" is not a recognized recovery word.`,
      };
    }
  }

  return { isValid: true };
}

// Normalize word list to single space string
export function normalizeWords(words: string[] | string): string {
  if (Array.isArray(words)) {
    return words.map((w) => w.trim().toLowerCase()).join(' ');
  }
  return words.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

// PBKDF2 hash for PIN or Passphrase with 100,000 iterations
export async function hashWithPBKDF2(
  input: string,
  saltHex?: string,
  iterations = 100000
): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hex2buf(saltHex) : new Uint8Array(16);
  if (!saltHex) {
    crypto.getRandomValues(salt);
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(input),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    hash: buf2hex(derivedBits),
    salt: buf2hex(salt.buffer as ArrayBuffer),
  };
}

// Verify PBKDF2 hash
export async function verifyPBKDF2(
  input: string,
  expectedHash: string,
  saltHex: string,
  iterations = 100000
): Promise<boolean> {
  const { hash } = await hashWithPBKDF2(input, saltHex, iterations);
  return hash.toLowerCase() === expectedHash.toLowerCase();
}

// Biometrics prompt using WebAuthn or platform authenticator
export async function isBiometricsAvailable(): Promise<boolean> {
  if (window.PublicKeyCredential) {
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname || 'localhost',
      },
    });

    return !!credential;
  } catch {
    // If WebAuthn fails or not configured, return false cleanly
    return false;
  }
}
