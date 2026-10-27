/** Minimal key-value port so the repo runs on chrome.storage or in memory (tests). */
export interface KV {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  onChanged(cb: (keys: string[]) => void): () => void;
}

export function chromeLocalKV(): KV {
  return {
    get: (keys) => browser.storage.local.get(keys),
    set: (items) => browser.storage.local.set(items),
    onChanged(cb) {
      const listener = (changes: Record<string, unknown>, area: string) => {
        if (area === 'local') cb(Object.keys(changes));
      };
      browser.storage.onChanged.addListener(listener);
      return () => browser.storage.onChanged.removeListener(listener);
    },
  };
}

export function memoryKV(initial: Record<string, unknown> = {}): KV {
  const data = structuredClone(initial);
  const subs = new Set<(keys: string[]) => void>();
  return {
    async get(keys) {
      return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
    },
    async set(items) {
      Object.assign(data, structuredClone(items));
      subs.forEach((cb) => cb(Object.keys(items)));
    },
    onChanged(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
