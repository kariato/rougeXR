export type AssetStatus = 'loading' | 'ready' | 'failed';

interface Entry<T> {
  status: AssetStatus;
  refs: number;
  promise: Promise<T>;
  value?: T;
  error?: unknown;
}

export interface AssetLease<T> { value: T; release(): void }

export class AssetCache<T, O extends object = Record<string, never>> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly load: (url: string, options: O) => Promise<T>, private readonly dispose: (value: T) => void) {}

  async acquire(url: string, options: O): Promise<AssetLease<T>> {
    const resolved = resolveUrl(url);
    const key = `${resolved}\n${stableOptions(options)}`;
    let entry = this.entries.get(key);
    if (!entry) {
      const created: Entry<T> = { status: 'loading', refs: 0, promise: Promise.resolve().then(() => this.load(resolved, options)) };
      created.promise = created.promise.then(value => { created.status = 'ready'; created.value = value; return value; }, error => { created.status = 'failed'; created.error = error; throw error; });
      this.entries.set(key, created); entry = created;
    }
    entry.refs++;
    let value: T;
    try { value = await entry.promise; }
    catch (error) { entry.refs--; throw error; }
    let released = false;
    return { value, release: () => {
      if (released) return; released = true; entry!.refs--;
      if (entry!.refs === 0 && entry!.status === 'ready') { this.dispose(value); this.entries.delete(key); }
    } };
  }

  status(url: string, options: O): AssetStatus | null {
    return this.entries.get(`${resolveUrl(url)}\n${stableOptions(options)}`)?.status ?? null;
  }
}

export class SceneGeneration {
  private value = 0;
  next(): number { return ++this.value; }
  isCurrent(token: number): boolean { return token === this.value; }
}

export async function acquireForScene<T, O extends object>(cache: AssetCache<T, O>, url: string, options: O,
  generation: SceneGeneration, token: number, attach: (lease: AssetLease<T>) => void): Promise<void> {
  const lease = await cache.acquire(url, options);
  if (!generation.isCurrent(token)) { lease.release(); return; }
  attach(lease);
}

function stableOptions(options: object): string {
  return JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
}

function resolveUrl(url: string): string {
  return new URL(url, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI).href;
}
