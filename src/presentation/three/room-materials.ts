import * as THREE from 'three';
import type { RoomTheme } from '../../engine/model/state';

export const ROOM_MATERIAL_VERSION = 1;
export type Surface = 'floor' | 'wall';
export interface RoomLook {
  floor: number; wall: number; grout: number; accent: number;
  sky: number; ground: number; lamp: number; fog: number;
}

export const ROOM_LOOKS: Readonly<Record<RoomTheme, RoomLook>> = {
  dungeon: { floor: 0x665d52, wall: 0x8a8275, grout: 0x262a2d, accent: 0xb7a380, sky: 0xb4bdc6, ground: 0x252831, lamp: 0xffdb9e, fog: 0x0d1017 },
  cave: { floor: 0x435647, wall: 0x5c6b5c, grout: 0x26392e, accent: 0x94a174, sky: 0xa9c3ba, ground: 0x172b22, lamp: 0xd4e7a1, fog: 0x08140f },
  crypt: { floor: 0x615c68, wall: 0x85808c, grout: 0x2e2935, accent: 0xb0a4b7, sky: 0xb9adca, ground: 0x28212f, lamp: 0xd6c3ff, fog: 0x10101b },
  store: { floor: 0x79553a, wall: 0x9a7350, grout: 0x3b2b22, accent: 0xb99060, sky: 0xe3c8a3, ground: 0x3b2619, lamp: 0xffc47e, fog: 0x19100c },
  treasure: { floor: 0x79704d, wall: 0xa09869, grout: 0x343326, accent: 0xe1c677, sky: 0xffdfaa, ground: 0x483b20, lamp: 0xffcf69, fog: 0x18140a },
  none: { floor: 0x40464b, wall: 0x62676b, grout: 0x242a30, accent: 0x888f95, sky: 0xa9c8e8, ground: 0x18202a, lamp: 0xffd7a0, fog: 0x05080d },
};

/** Cosmetic variation only: fixed inputs, no engine RNG or undisclosed room metadata. */
export function surfaceVariant(theme: RoomTheme, surface: Surface, x: number, y: number): number {
  let hash = 2166136261;
  for (const code of `${ROOM_MATERIAL_VERSION}:${theme}:${surface}:${x}:${y}`) {
    hash ^= code.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 4;
}

function color(value: number): string { return `#${value.toString(16).padStart(6, '0')}`; }

function drawPattern(ctx: CanvasRenderingContext2D, theme: RoomTheme, surface: Surface, variant: number): void {
  const look = ROOM_LOOKS[theme];
  ctx.fillStyle = color(surface === 'floor' ? look.floor : look.wall); ctx.fillRect(0, 0, 128, 128);
  ctx.lineWidth = 3; ctx.strokeStyle = color(look.grout);
  if (theme === 'store') {
    const horizontal = surface === 'floor';
    for (let i = 1; i < 4; i++) { ctx.beginPath(); if (horizontal) { ctx.moveTo(0, i * 32); ctx.lineTo(128, i * 32); } else { ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 128); } ctx.stroke(); }
    ctx.strokeStyle = color(look.accent); ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const offset = (i * 29 + variant * 17) % 128; ctx.beginPath(); if (horizontal) { ctx.moveTo(8, offset); ctx.bezierCurveTo(36, offset + 5, 72, offset - 5, 120, offset); } else { ctx.moveTo(offset, 8); ctx.bezierCurveTo(offset + 5, 36, offset - 5, 72, offset, 120); } ctx.stroke(); }
  } else if (theme === 'cave') {
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const x = (i * 43 + variant * 31) % 128; const y = (i * 67 + variant * 19) % 128;
      ctx.fillStyle = color(i % 3 === 0 ? look.accent : look.grout); ctx.beginPath(); ctx.ellipse(x, y, 8 + i % 4 * 5, 3 + i % 3 * 4, i * .43, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = color(look.accent);
    for (let i = 0; i < 3; i++) { const y = (i * 41 + variant * 13) % 128; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(29, y - 15, 73, y + 12, 128, y - 7); ctx.stroke(); }
  } else {
    const rows = theme === 'crypt' ? 4 : 3;
    for (let row = 1; row < rows; row++) { const y = Math.round(row * 128 / rows); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    for (let row = 0; row < rows; row++) { const offset = ((row + variant) % 2) * 24; const y0 = row * 128 / rows; const y1 = (row + 1) * 128 / rows;
      for (let x = offset; x < 128; x += theme === 'crypt' ? 48 : 64) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); } }
    ctx.strokeStyle = color(look.accent); ctx.lineWidth = theme === 'treasure' ? 3 : 1;
    for (let i = 0; i < 4; i++) { const x = (i * 53 + variant * 23) % 128; const y = (i * 37 + variant * 41) % 128;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y + (i % 2 ? -5 : 7)); ctx.lineTo(x + 15, y + 3); ctx.stroke(); }
    if (theme === 'crypt') { ctx.strokeStyle = color(look.accent); ctx.strokeRect(48, 43, 32, 40); ctx.beginPath(); ctx.moveTo(64, 50); ctx.lineTo(64, 76); ctx.moveTo(53, 63); ctx.lineTo(75, 63); ctx.stroke(); }
    if (theme === 'treasure') { ctx.strokeStyle = color(look.accent); ctx.strokeRect(46, 46, 36, 36); ctx.strokeRect(54, 54, 20, 20); }
  }
}

export class RoomMaterialCatalog {
  private readonly textures = new Map<string, THREE.CanvasTexture>();
  private readonly frameMaterials = new Map<string, THREE.MeshStandardMaterial>();

  /** Old world materials have been disposed by the scene before starting a new frame. */
  beginFrame(): void { this.frameMaterials.clear(); }

  material(theme: RoomTheme, surface: Surface, condition: number, remembered: boolean, dark: boolean, x: number, y: number): THREE.MeshStandardMaterial {
    const variant = surfaceVariant(theme, surface, x, y);
    const key = `${ROOM_MATERIAL_VERSION}:${theme}:${surface}:${variant}`;
    const frameKey = `${key}:${condition}:${remembered}:${dark}`;
    const existing = this.frameMaterials.get(frameKey);
    if (existing) return existing;
    let texture = this.textures.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallback = new THREE.Color(surface === 'floor' ? ROOM_LOOKS[theme].floor : ROOM_LOOKS[theme].wall);
        const brightness = (remembered ? .62 : 1) * (dark ? .76 : 1) * (1 - Math.min(2, condition) * .06);
        fallback.multiplyScalar(brightness);
        const material = new THREE.MeshStandardMaterial({ color: fallback, roughness: .95 });
        this.frameMaterials.set(frameKey, material);
        return material;
      }
      drawPattern(ctx, theme, surface, variant);
      texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 2;
      this.textures.set(key, texture);
    }
    const brightness = (remembered ? .62 : 1) * (dark ? .76 : 1) * (1 - Math.min(2, condition) * .06);
    const material = new THREE.MeshStandardMaterial({ map: texture, color: new THREE.Color().setRGB(brightness, brightness, brightness), roughness: theme === 'treasure' ? .82 : .95 });
    this.frameMaterials.set(frameKey, material);
    return material;
  }

  dispose(): void { for (const material of this.frameMaterials.values()) material.dispose(); this.frameMaterials.clear(); for (const texture of this.textures.values()) texture.dispose(); this.textures.clear(); }
  textureCount(): number { return this.textures.size; }
}
