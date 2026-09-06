/**
 * Shared binary <-> text encoding helpers (single source of truth).
 *
 * Used by the SafeVault engine, deviceCrypto and security services so the
 * buf2hex/hex2buf/base64 logic is defined exactly once in the codebase.
 *
 * All byte helpers are typed for TS 5.7+ generic Uint8Array and return views
 * backed by a plain ArrayBuffer, making every value WebCrypto `BufferSource`
 * compatible (a SharedArrayBuffer-backed view would be rejected by lib.dom).
 */

export function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hex2buf(hex: string): Uint8Array<ArrayBuffer> {
  const clean = (hex || '').trim();
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array<ArrayBuffer> {
  // TextEncoder always allocates a fresh ArrayBuffer; the assertion just
  // narrows the lib.dom `ArrayBufferLike` default for WebCrypto compatibility.
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
}

export function bytesToUtf8(bytes: ArrayBuffer): string {
  return new TextDecoder().decode(bytes);
}

export function buf2base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const btoaFn = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (typeof btoaFn === 'function') {
    return btoaFn(binary);
  }
  return '';
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  const binary = typeof atobFn === 'function' ? atobFn(base64) : '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** SHA-256 digest of a string or buffer, hex encoded. */
export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data =
    typeof input === 'string' ? utf8ToBytes(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return buf2hex(digest);
}
