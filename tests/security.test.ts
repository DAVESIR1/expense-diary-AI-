import { describe, it, expect } from 'vitest';
import {
  generate12WordPassphrase,
  validatePassphrase,
  normalizeWords,
  generateRandomSalt,
  hashWithPBKDF2,
  verifyPBKDF2,
} from '../src/services/security';
import { BIP39_WORDLIST } from '../src/services/bip39Words';

// A valid 12-word BIP-39 passphrase (first 12 words of the standard wordlist).
const VALID_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent',
  'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
];

describe('generate12WordPassphrase', () => {
  it('returns exactly 12 words from the BIP-39 wordlist', () => {
    const words = generate12WordPassphrase();
    expect(words).toHaveLength(12);
    for (const w of words) {
      expect(BIP39_WORDLIST).toContain(w);
    }
  });

  it('generates different passphrases across calls', () => {
    const a = generate12WordPassphrase().join(' ');
    const b = generate12WordPassphrase().join(' ');
    expect(a).not.toBe(b);
  });
});

describe('validatePassphrase', () => {
  it('accepts a valid 12-word array', () => {
    expect(validatePassphrase(VALID_WORDS).isValid).toBe(true);
  });

  it('accepts a valid 12-word string, normalised', () => {
    const spaced = VALID_WORDS.join('   ');
    expect(validatePassphrase(spaced).isValid).toBe(true);
  });

  it('rejects wrong word counts', () => {
    const res = validatePassphrase(VALID_WORDS.slice(0, 11));
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('12');
  });

  it('rejects words not in the BIP-39 list', () => {
    const bad = [...VALID_WORDS.slice(0, 11), 'notaword'];
    const res = validatePassphrase(bad);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('notaword');
  });
});

describe('normalizeWords', () => {
  it('lowercases and joins arrays', () => {
    expect(normalizeWords(['Abandon', 'ABILITY'])).toBe('abandon ability');
  });

  it('collapses whitespace in strings', () => {
    expect(normalizeWords('  Ability   ABANDON  ')).toBe('ability abandon');
  });
});

describe('generateRandomSalt', () => {
  it('produces a hex string of the requested byte length', () => {
    const salt = generateRandomSalt(16);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces different salts each call', () => {
    expect(generateRandomSalt(16)).not.toBe(generateRandomSalt(16));
  });
});

describe('hashWithPBKDF2 / verifyPBKDF2', () => {
  it('is deterministic given the same input and salt', async () => {
    const salt = generateRandomSalt(16);
    const a = await hashWithPBKDF2('my-secret-pin', salt);
    const b = await hashWithPBKDF2('my-secret-pin', salt);
    expect(a.hash).toBe(b.hash);
    expect(a.salt).toBe(salt);
  });

  it('produces different hashes for different inputs', async () => {
    const salt = generateRandomSalt(16);
    const a = await hashWithPBKDF2('pin-one', salt);
    const b = await hashWithPBKDF2('pin-two', salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('verifies correct input and rejects wrong input', async () => {
    const { hash, salt } = await hashWithPBKDF2('correct-horse');
    expect(await verifyPBKDF2('correct-horse', hash, salt)).toBe(true);
    expect(await verifyPBKDF2('wrong-horse', hash, salt)).toBe(false);
  });

  it('supports custom iteration counts', async () => {
    const { hash, salt } = await hashWithPBKDF2('abc', undefined, 5000);
    expect(await verifyPBKDF2('abc', hash, salt, 5000)).toBe(true);
  });
});