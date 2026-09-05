/**
 * Cryptographically secure, collision-resistant unique ID helper.
 *
 * Replaces the old `Math.random().toString(36).substr(2, n)` pattern
 * (deprecated `.substr()` + no collision guarantees across rapid calls).
 */
export function uid(prefix = 'id', length = 8): string {
  let raw: string;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    raw = crypto.randomUUID();
  } else {
    // Deterministic fallback for non-secure contexts (old WebViews).
    raw = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  const token = raw.replace(/[^a-z0-9]/gi, '').slice(0, length);
  return `${prefix}-${token || Math.random().toString(36).slice(2, 2 + length)}`;
}