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

it('ends a failed session and allows entry to be retried', async () => {
  const first = new FakeSession(); const next = new FakeSession();
  const end = vi.spyOn(first, 'end');
  const attach = vi.fn(async (_session: XrSessionLike | null) => {}).mockRejectedValueOnce(new Error('GPU unavailable'));
  const changed = vi.fn();
  const system: XrSystemLike = { isSessionSupported: async () => true,
    requestSession: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(next) };
  const controller = new XrSessionController(system, attach, changed);
  await controller.detect();
  await expect(controller.toggle()).rejects.toThrow('GPU unavailable');
  expect(end).toHaveBeenCalledOnce(); expect(attach).toHaveBeenLastCalledWith(null);
  expect(controller.status()).toBe('available');
  expect(await controller.toggle()).toBe('active');
});

it('waits for renderer end listeners before detaching after a system exit', async () => {
  const session = new FakeSession(); const events: string[] = [];
  const attach = vi.fn(async (value: XrSessionLike | null) => {
    if (value) value.addEventListener('end', () => events.push('renderer-end'));
    else events.push('detach');
  });
  const changed = vi.fn();
  const controller = new XrSessionController({ isSessionSupported: async () => true, requestSession: async () => session }, attach, changed);
  await controller.detect(); await controller.toggle(); await session.end();
  await vi.waitFor(() => expect(controller.status()).toBe('available'));
  expect(events).toEqual(['renderer-end', 'detach']);
  expect(changed).toHaveBeenLastCalledWith('available');
});

it('ignores a second entry request while attachment is pending', async () => {
  let finish!: () => void;
  const attach = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const requestSession = vi.fn(async () => new FakeSession());
  const controller = new XrSessionController({ isSessionSupported: async () => true, requestSession }, attach);
  await controller.detect();
  const pending = controller.toggle();
  await vi.waitFor(() => expect(attach).toHaveBeenCalledOnce());
  await controller.toggle(); expect(requestSession).toHaveBeenCalledOnce();
  finish(); await pending; expect(controller.status()).toBe('active');
});
