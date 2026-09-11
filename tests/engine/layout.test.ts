import { describe, expect, it } from 'vitest';
import { calculateLayout, hitTest } from '../../src/presentation/grid/layout';

describe('grid layout and hit testing', () => {
  it('centers an integer-sized 80 by 24 map', () => {
    expect(calculateLayout(1000, 500, 80, 24)).toEqual({ cellSize: 12, offsetX: 20, offsetY: 106, cssWidth: 1000, cssHeight: 500 });
  });

  it('maps CSS coordinates to the same cell independently of backing pixel ratio', () => {
    const layout = calculateLayout(1000, 500, 80, 24);
    expect(hitTest(layout, 20 + 12 * 23 + 6, 106 + 12 * 5 + 6, 80, 24)).toEqual({ x: 23, y: 5 });
    expect(hitTest(layout, 19, 120, 80, 24)).toBeNull();
    expect(hitTest(layout, 980, 120, 80, 24)).toBeNull();
  });

  it('supports a one-CSS-pixel minimum for small scrollable layouts', () => {
    const layout = calculateLayout(40, 20, 80, 24);
    expect(layout.cellSize).toBe(1);
    expect(hitTest(layout, 0, 0, 80, 24)).toEqual({ x: 20, y: 2 });
  });

  it('rejects invalid dimensions', () => {
    expect(() => calculateLayout(0, 10, 80, 24)).toThrow();
    expect(() => calculateLayout(10, 10, Number.NaN, 24)).toThrow();
  });
});
