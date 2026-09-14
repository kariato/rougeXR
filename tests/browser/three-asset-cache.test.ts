import { describe, expect, it, vi } from 'vitest';
import { AssetCache, SceneGeneration, acquireForScene } from '../../src/presentation/three/asset-cache';

describe('3D asset lifecycle', () => {
  it('keys by resolved URL and options rather than filename', async () => {
    const load = vi.fn(async (url: string) => ({ url }));
    const dispose = vi.fn(); const cache = new AssetCache(load, dispose);
    const first = await cache.acquire('/actors/a/model.glb', { quality: 1 });
    const second = await cache.acquire('/actors/b/model.glb', { quality: 1 });
    const shared = await cache.acquire('/actors/a/model.glb', { quality: 1 });
    expect(load).toHaveBeenCalledTimes(2); expect(first.value).toBe(shared.value); expect(first.value).not.toBe(second.value);
    first.release(); expect(dispose).not.toHaveBeenCalled(); shared.release(); second.release(); expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('records failed loads and invalidates stale scene generations', async () => {
    const cache = new AssetCache(async () => { throw new Error('missing'); }, () => {});
    await expect(cache.acquire('/missing.glb', {})).rejects.toThrow('missing');
    expect(cache.status('/missing.glb', {})).toBe('failed');
    const generation = new SceneGeneration(); const stale = generation.next(); const current = generation.next();
    expect(generation.isCurrent(stale)).toBe(false); expect(generation.isCurrent(current)).toBe(true);
  });

  it('releases a load completed after its scene was destroyed', async () => {
    let finish!: (value: { id: string }) => void;
    const dispose = vi.fn(); const attach = vi.fn();
    const cache = new AssetCache(() => new Promise(resolve => { finish = resolve; }), dispose);
    const generation = new SceneGeneration(); const token = generation.next();
    const loading = acquireForScene(cache, '/slow.glb', {}, generation, token, attach);
    generation.next(); await Promise.resolve(); finish({ id: 'late' }); await loading;
    expect(attach).not.toHaveBeenCalled(); expect(dispose).toHaveBeenCalledOnce();
  });
});
