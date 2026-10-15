import { observedStatusEffects } from './status-effects';
import * as THREE from 'three';
import type { PlayerObservation } from '../../engine/model/observation';
import type { PresentationEvent } from '../../engine/model/action';

function readable(label: string): string { return label.replace(/^(weapon|armor|food|amulet)\./, '').replaceAll('-', ' '); }
export function spatialStatusLines(observation: PlayerObservation): string[] {
  const { hp, maxHp, depth, gold, hungerStage, conditions } = observation.status;
  const weapon = observation.inventory.find(item => item.equippedSlot === 'weapon');
  const returning = observation.inventory.some(item => item.category === 'amulet');
  return [`HP ${hp}/${maxHp}   Level ${depth}   Gold ${gold}   ${['Fed', 'Hungry', 'Weak', 'Faint'][hungerStage] ?? 'Hungry'}`,
    `${weapon ? readable(weapon.label) : 'Unarmed'}${returning ? '   Amulet: return upstairs' : ''}${conditions?.length ? `   ${conditions.join(' · ')}` : ''}`];
}

/** Persistent, headset-visible status and recent messages, independent of HTML HUD. */
export class SpatialStatus {
  readonly root = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly messageCanvas = document.createElement('canvas');
  private readonly messageTexture: THREE.CanvasTexture;
  private readonly messageMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly effectsCanvas = document.createElement('canvas');
  private readonly effectsTexture: THREE.CanvasTexture;
  private readonly effectsMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private messages: string[] = [];
  private signature = '';
  private effectsAvailable = false;
  private modalOpen = false;
  constructor(private readonly openEffects: () => void = () => {}) {
    this.root.position.z = -1.25;
    this.canvas.width = this.messageCanvas.width = 1536;
    this.canvas.height = 160; this.messageCanvas.height = 192;
    this.effectsCanvas.width = 1536; this.effectsCanvas.height = 112;
    this.effectsTexture = new THREE.CanvasTexture(this.effectsCanvas); this.effectsTexture.colorSpace = THREE.SRGBColorSpace;
    this.effectsMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, .106), new THREE.MeshBasicMaterial({ map: this.effectsTexture, depthTest: false, depthWrite: false, toneMapped: false }));
    this.effectsMesh.position.y = .535; this.effectsMesh.renderOrder = 225; this.effectsMesh.visible = false;
    this.root.add(this.effectsMesh);
    this.texture = new THREE.CanvasTexture(this.canvas); this.messageTexture = new THREE.CanvasTexture(this.messageCanvas);
    this.texture.colorSpace = this.messageTexture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, .151), new THREE.MeshBasicMaterial({ map: this.texture, depthTest: false, depthWrite: false, toneMapped: false }));
    this.messageMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, .181), new THREE.MeshBasicMaterial({ map: this.messageTexture, depthTest: false, depthWrite: false, toneMapped: false }));
    this.mesh.position.y = .68; this.messageMesh.position.y = -.67;
    this.mesh.renderOrder = this.messageMesh.renderOrder = 220; this.root.add(this.mesh, this.messageMesh);
  }
  update(observation: PlayerObservation, events: readonly PresentationEvent[]): void {
    if (observation.revision === 0) this.messages = [];
    for (const event of events) if (event.type === 'message') this.messages.push(event.text);
    this.messages = this.messages.slice(-12);
    const lines = spatialStatusLines(observation);
    const effects = observedStatusEffects(observation);
    const signature = JSON.stringify([lines, this.messages, effects]); if (signature === this.signature) return;
    this.signature = signature;
    this.effectsAvailable = effects.length > 0;
    this.effectsMesh.visible = this.effectsAvailable && !this.modalOpen;
    const ctx = this.effectsCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 1536, 112); ctx.fillStyle = '#07111d'; ctx.fillRect(0, 0, 1536, 112);
    const badges = effects.slice(0, 6), width = 1536 / Math.max(1, badges.length);
    badges.forEach((effect, index) => {
      const x = index * width;
      ctx.strokeStyle = effect.color; ctx.lineWidth = 3; ctx.strokeRect(x + 3, 3, width - 6, 106);
      ctx.fillStyle = effect.color; ctx.font = '38px sans-serif'; ctx.fillText(effect.icon, x + 14, 44);
      ctx.fillStyle = '#ffffff'; ctx.font = '27px sans-serif';
      ctx.fillText(effect.label, x + 14, 80, width - 28);
    });
    this.effectsTexture.needsUpdate = true;
    this.paint(this.canvas, lines, 'STATUS'); this.texture.needsUpdate = true;
    this.paint(this.messageCanvas, this.messages.slice(-3), 'MESSAGES'); this.messageTexture.needsUpdate = true;
  }
  private paint(canvas: HTMLCanvasElement, lines: string[], title: string): void {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#07111d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#7396b5'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.font = 'bold 25px sans-serif'; ctx.fillStyle = '#8dd9e7'; ctx.fillText(title, 24, 33);
    ctx.font = '34px sans-serif'; ctx.fillStyle = '#ffffff';
    lines.forEach((line, index) => {
      let text = line;
      while (ctx.measureText(text).width > canvas.width - 48 && text.length > 1) text = text.slice(0, -2) + '…';
      ctx.fillText(text, 24, 80 + index * 43);
    });
  }
  setModalOpen(open: boolean): void { this.modalOpen = open; this.effectsMesh.visible = this.effectsAvailable && !open; }
  select(ray: THREE.Raycaster): boolean {
    if (!this.effectsMesh.visible || !ray.intersectObject(this.effectsMesh).length) return false;
    this.openEffects(); return true;
  }
  reset(): void { this.messages = []; this.signature = ''; }
  dispose(): void {
    this.effectsTexture.dispose(); this.effectsMesh.geometry.dispose(); this.effectsMesh.material.dispose();
    this.texture.dispose(); this.messageTexture.dispose();
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.messageMesh.geometry.dispose(); this.messageMesh.material.dispose();
  }
}
