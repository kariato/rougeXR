export type StickCommand = { type: 'turn'; degrees: number } | { type: 'move'; forward: boolean };
export interface StickSource { gamepad?: { axes: readonly number[] } | null | undefined }
interface StickState { axis: 'x' | 'y' | null; nextMove: number; blocked: boolean }

/** Standard XR thumbsticks occupy axes 2/3; two-axis controllers use 0/1. */
export class XrThumbsticks {
  private states = new WeakMap<StickSource, StickState>();
  private requireNeutral = false;
  reset(requireNeutral = false): void { this.states = new WeakMap(); this.requireNeutral = requireNeutral; }
  sample(source: StickSource, now: number, enabled: boolean): StickCommand | null {
    const axes = source.gamepad?.axes;
    if (!axes || axes.length < 2) return null;
    const index = axes.length >= 4 ? 2 : 0;
    const x = axes[index] ?? 0, y = axes[index + 1] ?? 0;
    let state = this.states.get(source);
    if (!state) { state = { axis: null, nextMove: 0, blocked: this.requireNeutral }; this.states.set(source, state); }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !enabled) { state.blocked = true; return null; }
    if (Math.max(Math.abs(x), Math.abs(y)) < .25) { state.axis = null; state.blocked = false; return null; }
    if (state.blocked) return null;
    if (!state.axis) {
      if (Math.max(Math.abs(x), Math.abs(y)) < .6) return null;
      state.axis = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
      state.nextMove = now;
      if (state.axis === 'x') return { type: 'turn', degrees: Math.sign(x) * 45 };
    }
    // A sideways hold turns once; return to centre before changing direction.
    if (state.axis !== 'y' || Math.abs(y) < .6 || now < state.nextMove) return null;
    state.nextMove = now + 400;
    return { type: 'move', forward: y < 0 };
  }
}
