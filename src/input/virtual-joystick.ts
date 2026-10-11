export type StickVector = { horizontal: number; vertical: number };

/** Bind one captured pointer to a four-direction, repeating turn-based control. */
export function bindVirtualJoystick(button: HTMLButtonElement, knob: HTMLElement,
  move: (vector: StickVector) => void): () => void {
  let pointerId: number | null = null;
  let active: StickVector | null = null;
  let octant: number | null = null;
  let timer: number | null = null;

  const clearTimer = (): void => { if (timer !== null) window.clearTimeout(timer); timer = null; };
  const repeat = (): void => {
    clearTimer();
    if (active === null || pointerId === null || button.disabled) return;
    timer = window.setTimeout(() => {
      if (active !== null && pointerId !== null && !button.disabled) move(active);
      repeat();
    }, 260);
  };
  const stop = (): void => {
    clearTimer(); pointerId = null; active = null; octant = null;
    knob.style.transform = '';
    button.removeAttribute('data-direction');
  };
  const update = (event: PointerEvent): void => {
    const box = button.getBoundingClientRect();
    const radius = box.width / 2;
    const horizontal = (event.clientX - box.left - radius) / radius;
    const vertical = (box.top + box.height / 2 - event.clientY) / radius;
    const distance = Math.hypot(horizontal, vertical);
    if (distance < .28) {
      active = null; octant = null; clearTimer();
      knob.style.transform = '';
      button.removeAttribute('data-direction');
      return;
    }
    const nextOctant = Math.abs(horizontal) > Math.abs(vertical)
      ? horizontal > 0 ? 0 : 4
      : vertical > 0 ? 2 : 6;
    const travel = Math.min(distance, 1) * radius * .43;
    knob.style.transform = `translate(${nextOctant === 0 ? travel : nextOctant === 4 ? -travel : 0}px, ${nextOctant === 2 ? -travel : nextOctant === 6 ? travel : 0}px)`;
    if (nextOctant === octant) return;
    octant = nextOctant;
    active = { horizontal: nextOctant === 0 ? 1 : nextOctant === 4 ? -1 : 0,
      vertical: nextOctant === 2 ? 1 : nextOctant === 6 ? -1 : 0 };
    button.dataset.direction = String(nextOctant);
    if (!button.disabled) move(active);
    repeat();
  };
  const down = (event: PointerEvent): void => {
    if (button.disabled || pointerId !== null) return;
    event.preventDefault(); pointerId = event.pointerId;
    button.setPointerCapture(event.pointerId);
    update(event);
  };
  const drag = (event: PointerEvent): void => { if (event.pointerId === pointerId) { event.preventDefault(); update(event); } };
  const up = (event: PointerEvent): void => { if (event.pointerId === pointerId) stop(); };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointermove', drag);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('lostpointercapture', up);
  window.addEventListener('blur', stop);
  return stop;
}
