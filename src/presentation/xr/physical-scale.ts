/** Dungeon models use compact desktop units; XR tracking remains in real metres. */
export const XR_METRES_PER_TILE = 1.5;
export const XR_EYE_HEIGHT = 1.65;

/** Local tracking can start at zero or report a seated/standing offset. Calibrate once, retain subsequent physical motion. */
export class XrEyeHeight {
  private originY: number | null = null;
  reset(): void { this.originY = null; }
  offset(trackedY: number): number {
    if (Number.isFinite(trackedY)) this.originY ??= trackedY;
    return XR_EYE_HEIGHT - (this.originY ?? 0);
  }
}
