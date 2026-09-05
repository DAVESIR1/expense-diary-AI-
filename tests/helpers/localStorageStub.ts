/**
 * Minimal in-memory localStorage polyfill so pure-logic modules that read
 * user rules / preferences can be exercised under Node (vitest) without a DOM.
 */
class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export function installLocalStorageStub() {
  globalThis.localStorage = new MemoryStorage();
}

export function clearStorage(): void {
  globalThis.localStorage?.clear();
}