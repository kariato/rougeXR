export type MovementMode = 'comfort' | 'glide';
export interface LocomotionOptions { movement: MovementMode; vignette: boolean }
export interface GroundPoint { x: number; z: number }
export interface LocomotionSample extends GroundPoint { fade: number; vignette: number; moving: boolean }
export const DEFAULT_LOCOMOTION: LocomotionOptions = { movement: 'comfort', vignette: true };
const smooth = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Visual movement only. Gameplay positions, turns, and native head tracking are never interpolated here. */
export class XrLocomotion {
  private options: LocomotionOptions = { ...DEFAULT_LOCOMOTION };
  private initialized = false;
  private from: GroundPoint = { x: 0, z: 0 };
  private target: GroundPoint = { x: 0, z: 0 };
  private started = -Infinity;
  private mode: MovementMode = 'comfort';
  private fromFade = 0;
  private coveredAt: number | null = null;

  configure(options: LocomotionOptions): void { this.options = { ...options }; }
  reset(point?: GroundPoint): void {
    this.initialized = point !== undefined;
    this.from = this.target = { ...(point ?? { x: 0, z: 0 }) };
    this.started = -Infinity; this.fromFade = 0; this.coveredAt = null;
  }
  moveTo(point: GroundPoint, now: number, teleport = false): void {
    if (!this.initialized) { this.reset(point); return; }
    if (!teleport && point.x === this.target.x && point.z === this.target.z) return;
    const current = this.sample(now);
    this.from = { x: current.x, z: current.z }; this.target = { ...point };
    // Never glide through undisclosed terrain or across a level transition.
    this.mode = teleport || Math.hypot(point.x - current.x, point.z - current.z) > Math.SQRT2 + .01 ? 'comfort' : this.options.movement;
    this.fromFade = teleport ? 1 : current.fade; this.started = now; this.coveredAt = null;
  }
  sample(now: number): LocomotionSample {
    const settled = (): LocomotionSample => ({ ...this.target, fade: 0, vignette: 0, moving: false });
    if (!Number.isFinite(this.started)) return settled();
    const elapsed = Math.max(0, now - this.started);
    if (this.mode === 'comfort') {
      if (elapsed < 75) return { ...this.from, fade: this.fromFade + (1 - this.fromFade) * smooth(elapsed / 75), vignette: 0, moving: true };
      // Keep a fully covered frame even if shader compilation or a dropped frame skipped the fade-in.
      this.coveredAt ??= now;
      const afterCover = Math.max(0, now - this.coveredAt);
      if (afterCover < 30) return { ...this.target, fade: 1, vignette: 0, moving: true };
      const progress = (afterCover - 30) / 75;
      if (progress >= 1) return settled();
      return { ...this.target, fade: 1 - smooth(progress), vignette: 0, moving: true };
    }
    if (elapsed >= 300) return settled();
    const t = elapsed / 300;
    const progress = smooth(t);
    return { x: this.from.x + (this.target.x - this.from.x) * progress,
      z: this.from.z + (this.target.z - this.from.z) * progress, fade: 0,
      vignette: this.options.vignette ? .85 * Math.min(smooth(t / .15), smooth((1 - t) / .15)) : 0, moving: true };
  }
}

export function parseLocomotionPreferences(text: string | null): LocomotionOptions {
  try {
    const value = JSON.parse(text ?? 'null');
    if (value && (value.movement === 'comfort' || value.movement === 'glide') && typeof value.vignette === 'boolean')
      return { movement: value.movement, vignette: value.vignette };
  } catch { /* Unavailable or corrupt preferences use the comfort default. */ }
  return { ...DEFAULT_LOCOMOTION };
}
