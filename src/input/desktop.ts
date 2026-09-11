import type { GameAction } from '../engine/model/action';
import type { Direction } from '../engine/model/state';

const MOVEMENT_KEYS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'N', w: 'N', k: 'N', ArrowRight: 'E', d: 'E', l: 'E', ArrowDown: 'S', s: 'S', j: 'S',
  ArrowLeft: 'W', a: 'W', h: 'W', q: 'NW', y: 'NW', e: 'NE', u: 'NE', z: 'SW', b: 'SW', c: 'SE', n: 'SE',
};

export interface KeyboardInput {
  key: string; repeat: boolean; target: EventTarget | null;
  preventDefault(): void;
}

export function actionForKeyboardEvent(event: KeyboardInput): GameAction | null {
  if (event.repeat || isEditable(event.target)) return null;
  const direction = MOVEMENT_KEYS[event.key];
  if (direction) return { type: 'move', direction, pickup: true };
  if (event.key === '.' || event.key === ' ') return { type: 'rest' };
  if (event.key === 'f') return { type: 'search' };
  if (event.key === ',') return { type: 'pickup' };
  return null;
}

export function bindDesktopInput(target: Window, submit: (action: GameAction) => void): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const action = actionForKeyboardEvent(event);
    if (!action) return;
    event.preventDefault(); submit(action);
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

function isEditable(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { isContentEditable?: boolean; tagName?: string };
  return element.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName ?? '');
}
