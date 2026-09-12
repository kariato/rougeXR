import { describe, expect, it } from 'vitest';
import { storeLatestSafely, type SaveStore } from '../../src/persistence/indexed-db-save-store';

describe('browser autosave failure isolation', () => {
  it('reports a failed write without rejecting the gameplay operation', async () => {
    const unavailable: SaveStore = {
      loadLatest: async () => null,
      storeLatest: async () => { throw new Error('quota exceeded'); },
    };
    await expect(storeLatestSafely(unavailable, '{}')).resolves.toEqual({ ok: false, error: 'quota exceeded' });
  });
});
