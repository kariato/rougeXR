import { cellIndex, positionAt } from '../../engine/grid';
import type { DebugSnapshot, PlayerObservation } from '../../engine/model/observation';
import type { Position } from '../../engine/model/state';
import { calculateLayout, hitTest, type GridLayout } from './layout';

export class CanvasGridView {
  private layout: GridLayout | null = null;
  private selected: Position | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(observation: PlayerObservation, debug: DebugSnapshot | null): void {
    const bounds = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(bounds.width));
    const cssHeight = Math.max(1, Math.floor(bounds.height));
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssWidth * ratio);
    this.canvas.height = Math.round(cssHeight * ratio);
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#070b12';
    context.fillRect(0, 0, cssWidth, cssHeight);
    this.layout = calculateLayout(cssWidth, cssHeight, observation.width, observation.height);
    const { cellSize, offsetX, offsetY } = this.layout;
    context.font = `${Math.max(8, Math.floor(cellSize * 0.85))}px ui-monospace, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let index = 0; index < observation.cells.length; index++) {
      const cell = observation.cells[index]!;
      const at = positionAt(observation, index);
      const x = offsetX + at.x * cellSize;
      const y = offsetY + at.y * cellSize;
      if (cell.visibility === 'unknown') continue;
      context.fillStyle = cell.visibility === 'visible' ? '#17263b' : '#101722';
      context.fillRect(x, y, cellSize, cellSize);
      context.fillStyle = cell.visibility === 'visible' ? '#dbeafe' : '#64748b';
      context.fillText(cell.appearance?.glyph ?? ' ', x + cellSize / 2, y + cellSize / 2);
    }
    for (const entity of observation.entities) this.drawGlyph(context, entity.at, entity.appearance, '#fbbf24', observation);
    this.drawGlyph(context, observation.playerAt, '@', '#67e8f9', observation);
    if (debug) this.drawDebug(context, debug, observation);
    if (this.selected) {
      context.strokeStyle = '#ffffff'; context.lineWidth = 2;
      context.strokeRect(offsetX + this.selected.x * cellSize + 1, offsetY + this.selected.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }
  }

  selectFromClient(clientX: number, clientY: number, observation: PlayerObservation): Position | null {
    if (!this.layout) return null;
    this.selected = hitTest(this.layout, clientX, clientY, observation.width, observation.height);
    return this.selected ? { ...this.selected } : null;
  }

  private drawGlyph(context: CanvasRenderingContext2D, at: Position, glyph: string, color: string, observation: PlayerObservation): void {
    if (!this.layout) return;
    const { cellSize, offsetX, offsetY } = this.layout;
    context.fillStyle = color;
    context.fillText(glyph, offsetX + (at.x + 0.5) * cellSize, offsetY + (at.y + 0.5) * cellSize);
  }

  private drawDebug(context: CanvasRenderingContext2D, debug: DebugSnapshot, observation: PlayerObservation): void {
    if (!this.layout) return;
    const { cellSize, offsetX, offsetY } = this.layout;
    context.save(); context.globalAlpha = 0.55;
    for (let index = 0; index < debug.cells.length; index++) {
      if (observation.cells[index]?.visibility !== 'unknown' || debug.cells[index]?.terrain === 'void') continue;
      const at = positionAt(debug, index);
      context.fillStyle = '#7c3aed';
      context.fillRect(offsetX + at.x * cellSize, offsetY + at.y * cellSize, cellSize, cellSize);
    }
    context.restore();
    for (const entity of debug.entities) if (entity.at && observation.cells[cellIndex(observation, entity.at)]?.visibility !== 'visible') {
      this.drawGlyph(context, entity.at, entity.kind === 'monster' ? 'M' : '*', '#fb7185', observation);
    }
  }
}
