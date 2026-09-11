import { describe, expect, it, vi } from 'vitest';
import { actionForKeyboardEvent } from '../../src/input/desktop';

const keyboard = (key: string, options: { repeat?: boolean; target?: object | null } = {}) => ({
  key, repeat: options.repeat ?? false, target: (options.target ?? null) as EventTarget | null, preventDefault: vi.fn(),
});

describe('desktop input', () => {
  it('maps movement and rest keys to one action', () => {
    expect(actionForKeyboardEvent(keyboard('ArrowUp'))).toEqual({ type: 'move', direction: 'N', pickup: true });
    expect(actionForKeyboardEvent(keyboard('c'))).toEqual({ type: 'move', direction: 'SE', pickup: true });
    expect(actionForKeyboardEvent(keyboard('.'))).toEqual({ type: 'rest' });
  });
  it('ignores repeats, unknown keys, and focused controls (B02)', () => {
    expect(actionForKeyboardEvent(keyboard('w', { repeat: true }))).toBeNull();
    expect(actionForKeyboardEvent(keyboard('x'))).toBeNull();
    expect(actionForKeyboardEvent(keyboard('w', { target: { tagName: 'INPUT' } }))).toBeNull();
    expect(actionForKeyboardEvent(keyboard(' ', { target: { tagName: 'BUTTON' } }))).toBeNull();
  });
});
