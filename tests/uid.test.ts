import { describe, it, expect, beforeEach } from 'vitest';
import { uid } from '../src/utils/uid';

describe('uid', () => {
  it('returns unique ids across many rapid calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const id = uid('tx');
      expect(id.startsWith('tx-')).toBe(true);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it('respects length and prefixes', () => {
    const id = uid('email-nps', 12);
    expect(id.startsWith('email-nps-')).toBe(true);
    // prefix (10 chars incl. trailing dash) + max 12 chars body
    expect(id.length).toBeLessThanOrEqual(10 + 12);
    expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('returns distinct ids from any two prefixes regardless of call timing', () => {
    const a = uid('a', 16);
    const b = uid('b', 16);
    expect(a).not.toBe(b);
  });
});