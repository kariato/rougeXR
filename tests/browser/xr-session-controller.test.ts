import { describe, expect, it, vi } from 'vitest';
import { XrSessionController, type XrSessionLike, type XrSystemLike } from '../../src/presentation/xr/session-controller';

class FakeSession extends EventTarget implements XrSessionLike {
  async end(): Promise<void> { this.dispatchEvent(new Event('end')); }
}

describe('XR session controller', () => {
  it('keeps unsupported browsers operational without requesting a session', async () => {
    const attach = vi.fn(async () => {}); const controller = new XrSessionController(null, attach);
    expect(await controller.detect()).toBe('unavailable'); expect(await controller.toggle()).toBe('unavailable'); expect(attach).not.toHaveBeenCalled();
  });

  it('attaches and detaches an optional immersive session', async () => {
    const session = new FakeSession(); const attach = vi.fn(async () => {});
    const system: XrSystemLike = { isSessionSupported: vi.fn(async () => true), requestSession: vi.fn(async () => session) };
    const controller = new XrSessionController(system, attach);
    expect(await controller.detect()).toBe('available'); expect(await controller.toggle()).toBe('active'); expect(attach).toHaveBeenLastCalledWith(session);
    await controller.toggle(); expect(controller.status()).toBe('available'); expect(attach).toHaveBeenLastCalledWith(null);
  });
});
