export interface SaveStore {
  loadLatest(): Promise<string | null>;
  storeLatest(text: string): Promise<void>;
}

export type StoreLatestResult = { ok: true } | { ok: false; error: string };

export async function storeLatestSafely(store: SaveStore, text: string): Promise<StoreLatestResult> {
  try { await store.storeLatest(text); return { ok: true }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
}

const DATABASE = 'rougexr';
const STORE = 'saves';
const LATEST = 'latest';

export class IndexedDbSaveStore implements SaveStore {
  private database: Promise<IDBDatabase> | null = null;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  loadLatest(): Promise<string | null> {
    return this.open().then(database => new Promise((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(LATEST);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    }));
  }

  storeLatest(text: string): Promise<void> {
    const write = this.writes.then(() => this.write(text));
    this.writes = write.catch(() => {});
    return write;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const request = this.factory.open(DATABASE, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
      });
    }
    return this.database;
  }

  private async write(text: string): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(text, LATEST);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted'));
    });
  }
}
