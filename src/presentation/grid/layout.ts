import type { Position } from '../../engine/model/state';

export interface GridLayout {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
}

export function calculateLayout(cssWidth: number, cssHeight: number, columns: number, rows: number): GridLayout {
  if (![cssWidth, cssHeight, columns, rows].every(Number.isFinite) || cssWidth <= 0 || cssHeight <= 0 || columns <= 0 || rows <= 0) {
    throw new RangeError('Invalid grid layout dimensions');
  }
  const cellSize = Math.max(1, Math.floor(Math.min(cssWidth / columns, cssHeight / rows)));
  return {
    cellSize,
    offsetX: Math.floor((cssWidth - columns * cellSize) / 2),
    offsetY: Math.floor((cssHeight - rows * cellSize) / 2),
    cssWidth,
    cssHeight,
  };
}

/** Coordinates and layout are in CSS pixels; devicePixelRatio is not involved. */
export function hitTest(layout: GridLayout, clientX: number, clientY: number, columns: number, rows: number): Position | null {
  const x = Math.floor((clientX - layout.offsetX) / layout.cellSize);
  const y = Math.floor((clientY - layout.offsetY) / layout.cellSize);
  return x >= 0 && x < columns && y >= 0 && y < rows ? { x, y } : null;
}
