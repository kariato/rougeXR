import { observedStatusEffects } from './status-effects';
import { assetUrl } from '../../asset-url';
import { SceneGeneration } from './asset-cache';
import { loadPropInto } from './prop-asset';
import * as THREE from 'three';
import type { GameAction } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { Direction, EquipmentSlot } from '../../engine/model/state';

export interface SpatialMenuState { names: string[]; saveName: string; sound: boolean; volume: number }
export type SpatialMenuCommand = { type: 'save' | 'restart' | 'sound' | 'map' } | { type: 'load' | 'name'; name: string } | { type: 'volume'; value: number };
type Item = PlayerObservation['inventory'][number];
export function inventoryActions(item: Item, direction: Direction): Array<{ label: string; action: GameAction }> {
  const actions: Array<{ label: string; action: GameAction }> = [];
  if (item.equippedSlot) actions.push({ label: 'Remove', action: { type: 'unequip', slot: item.equippedSlot as EquipmentSlot } });
  else if (item.category === 'weapon' || item.category === 'armor') actions.push({ label: 'Equip', action: { type: 'equip', slot: item.category, itemId: item.token } });
  else if (item.category === 'ring') for (const slot of ['leftRing', 'rightRing'] as const)
    actions.push({ label: slot === 'leftRing' ? 'Wear left' : 'Wear right', action: { type: 'equip', slot, itemId: item.token } });
  if (item.category === 'food' || item.category === 'potion' || item.category === 'scroll')
    actions.push({ label: { food: 'Eat', potion: 'Drink', scroll: 'Read' }[item.category]!, action: { type: ({ food: 'eat', potion: 'drink', scroll: 'read' } as const)[item.category as 'food' | 'potion' | 'scroll'], itemId: item.token } });
  if (item.category === 'weapon' || item.category === 'stick') actions.push({ label: item.category === 'weapon' ? 'Throw' : 'Zap', action: { type: item.category === 'weapon' ? 'throw' : 'zap', itemId: item.token, direction } });
  actions.push({ label: 'Drop', action: { type: 'drop', itemId: item.token } });
  return actions;
}

/** Ray-selectable meshes, shared by desktop pointers and tracked VR controllers. */
export class SpatialInventory {
  readonly root = new THREE.Group();
  open = false;
  private readonly generation = new SceneGeneration();
  private menuMode: 'inventory' | 'menu' | 'keyboard' | 'load' | 'restart' | 'effects' = 'inventory';
  private settings: SpatialMenuState = { names: [], saveName: 'My adventure', sound: true, volume: .35 };
  private draftName = '';
  private selected: string | null = null;
  private page = 0;
  private direction: Direction = 'N';
  private observation: PlayerObservation | null = null;
  constructor(private readonly changed: () => void, private readonly submit: (action: GameAction) => void, private readonly command: (command: SpatialMenuCommand) => void = () => {}) {
    this.root.position.z = -1.3;
  }
  update(observation: PlayerObservation): void {
    this.observation = observation;
    if (observation.status.hp <= 0 && this.menuMode === 'inventory') { this.open = false; this.menuMode = 'menu'; }
    this.draw();
  }
  toggle(): void { if (!this.observation || this.observation.status.hp <= 0) return; this.open = !this.open; this.menuMode = 'inventory'; this.draw(); this.changed(); }
  showEffects(): void { this.open = true; this.navigate('effects'); }
  configure(settings: SpatialMenuState): void { this.settings = settings; if (this.open && this.menuMode !== 'inventory') this.draw(); }
  toggleMenu(): void { this.open = !this.open; this.menuMode = 'menu'; this.page = 0; this.draw(); this.changed(); }
  private navigate(mode: typeof this.menuMode): void { this.menuMode = mode; this.page = 0; this.draw(); this.changed(); }
  private act(action: GameAction): void { this.open = false; this.draw(); this.changed(); this.submit(action); }
  reset(): void { this.open = false; this.selected = null; this.page = 0; this.menuMode = 'inventory'; this.draw(); }
  private clear(): void {
    this.generation.next();
    for (const child of [...this.root.children]) {
      this.root.remove(child); child.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material.map instanceof THREE.CanvasTexture) material.map.dispose();
            material.dispose();
          }
        }
      });
    }
  }
  private button(text: string, x: number, y: number, width: number, height: number, run?: () => void, selected = false): void {
    const canvas = document.createElement('canvas'); canvas.width = Math.round(width / height * 96); canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = selected ? '#235b70' : '#101c2c'; ctx.fillRect(0, 0, canvas.width, 96);
    ctx.strokeStyle = selected ? '#a5f3fc' : '#6a8ca8'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, canvas.width - 4, 92);
    ctx.fillStyle = '#ffffff'; ctx.font = '32px sans-serif'; ctx.textBaseline = 'middle';
    let label = text; while (ctx.measureText(label).width > canvas.width - 36 && label.length > 1) label = label.slice(0, -2) + '…';
    if (text.includes('\n')) {
      ctx.font = '28px sans-serif'; ctx.textBaseline = 'top';
      const [title, body = ''] = text.split('\n'); ctx.fillText(title!, 18, 7);
      const words = body.split(' '); const lines: string[] = []; let line = '';
      for (const word of words) {
        if (line && ctx.measureText(line + ' ' + word).width > canvas.width - 36) { lines.push(line); line = word; }
        else line += (line ? ' ' : '') + word;
      }
      lines.push(line); lines.slice(0, 2).forEach((value, index) => ctx.fillText(value, 18, 37 + index * 28));
    } else ctx.fillText(label, 18, 48);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
    mesh.position.set(x, y, 0); mesh.renderOrder = 200; mesh.userData.spatialAction = run ?? (() => {}); mesh.userData.label = text;
    this.root.add(mesh);
  }
  private draw(): void {
    this.clear(); const generationToken = this.generation.next(); const observation = this.observation; if (!observation) return;
    if (!this.open) {
      if (observation.status.hp > 0) this.button('Inventory [I]', -.53, -.48, .34, .095, () => this.toggle());
      this.button('Menu [M]', .53, -.48, .34, .095, () => this.toggleMenu()); return;
    }
    if (this.menuMode !== 'inventory') { this.drawMenu(); return; }
    this.button('INVENTORY — select an item', 0, .49, 1.4, .09);
    this.button('Close', .57, .59, .26, .075, () => this.toggle());
    const items = observation.inventory;
    this.page = Math.min(this.page, Math.max(0, Math.ceil(items.length / 6) - 1));
    const selected = items.find(item => item.token === this.selected);
    items.slice(this.page * 6, this.page * 6 + 6).forEach((item, index) => {
      this.button(`${item.label} ×${item.quantity}${item.equippedSlot ? ' [equipped]' : ''}${item.knownCursed ? ' [CURSED]' : ''}`, 0, .36 - index * .105, 1.4, .095,
        () => { this.selected = item.token; this.draw(); this.changed(); }, item.token === this.selected);
      // Raised category tokens give the contents depth rather than a DOM-only list.
      const token = new THREE.Mesh(new THREE.IcosahedronGeometry(.025, 0), new THREE.MeshBasicMaterial({ color: item.equippedSlot ? 0x80e8ab : 0xe6c17e, depthTest: false }));
      token.renderOrder = 201;
      const holder = new THREE.Group(); holder.position.set(-.75, .36 - index * .105, .045);
      holder.add(token); this.root.add(holder);
      const key = item.category === 'weapon' && item.assetKey ? `weapons/${item.assetKey.replace('weapon.', '')}` : `props/${item.category}`;
      void loadPropInto(assetUrl(`assets/${key}.glb`), holder, token, this.generation, generationToken, () => {
        const model = holder.children[0]!;
        holder.remove(model);
        const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
        const scale = .075 / Math.max(size.x, size.y, size.z, .001);
        model.scale.multiplyScalar(scale);
        model.position.sub(bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale));
        holder.add(model);
        model.traverse(object => {
          object.renderOrder = 201;
          if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            material.depthTest = false; material.depthWrite = false;
          }
        });
        this.changed();
      });
    });
    if (!items.length) this.button('Your pack is empty.', 0, .2, 1.4, .1);
    this.button('Previous', -.5, -.31, .35, .075, () => { this.page = Math.max(0, this.page - 1); this.draw(); this.changed(); });
    this.button(`${this.page + 1} / ${Math.max(1, Math.ceil(items.length / 6))}`, 0, -.31, .3, .075);
    this.button('Next', .5, -.31, .35, .075, () => { this.page = Math.min(Math.ceil(items.length / 6) - 1, this.page + 1); this.draw(); this.changed(); });
    if (observation.pendingDecision === 'callItem') {
      this.button('Continue without naming', 0, -.44, 1.2, .1, () => this.submit({ type: 'answerCall', label: null })); return;
    }
    if (!selected) return;
    if (observation.pendingDecision === 'identifyItem') {
      this.button('Identify selected item', 0, -.44, 1.2, .1, () => this.submit({ type: 'answerIdentify', itemId: selected.token })); return;
    }
    const actions = inventoryActions(selected, this.direction);
    actions.forEach(({ label, action }, index) => this.button(label, -.54 + index * .36, -.44, .33, .09, () => this.submit(action)));
    if (selected.category === 'weapon' || selected.category === 'stick') {
      const directions: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      directions.forEach((direction, index) => this.button(direction, -.61 + index * .175, -.56, .16, .075,
        () => { this.direction = direction; this.draw(); this.changed(); }, direction === this.direction));
    }
  }
  private drawMenu(): void {
    this.button('GAME MENU', 0, .49, 1.4, .09);
    this.button('Effects', .55, .59, .3, .075, () => this.showEffects());
    if (this.menuMode === 'effects') {
      const effects = this.observation ? observedStatusEffects(this.observation) : [];
      if (!effects.length) this.button('No harmful effects. You feel normal.', 0, .25, 1.4, .12);
      effects.slice(this.page * 4, this.page * 4 + 4).forEach((effect, index) =>
        this.button(`${effect.icon} ${effect.label}\n${effect.description}`, 0, .3 - index * .175, 1.4, .16));
      this.button('Previous', -.48, -.47, .43, .09, () => { this.page = Math.max(0, this.page - 1); this.draw(); this.changed(); });
      this.button('Back', 0, -.47, .43, .09, () => this.navigate('menu'));
      this.button('Next', .48, -.47, .43, .09, () => { this.page = Math.min(Math.max(0, Math.ceil(effects.length / 4) - 1), this.page + 1); this.draw(); this.changed(); });
      return;
    }
    if (this.menuMode === 'restart') {
      this.button('Restart this adventure from the beginning?', 0, .23, 1.4, .11);
      this.button('Restart', -.36, 0, .65, .11, () => this.command({ type: 'restart' }));
      this.button('Cancel', .36, 0, .65, .11, () => this.navigate('menu')); return;
    }
    if (this.menuMode === 'keyboard') {
      this.button(this.draftName || 'Enter save name', 0, .37, 1.4, .1);
      for (const [index, char] of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].entries())
        this.button(char, -.6 + index % 6 * .24, .22 - Math.floor(index / 6) * .095, .21, .08,
          () => { this.draftName = (this.draftName + char).slice(0, 80); this.draw(); this.changed(); });
      this.button('Space', -.48, -.4, .43, .085, () => { this.draftName = (this.draftName + ' ').slice(0, 80); this.draw(); this.changed(); });
      this.button('Backspace', 0, -.4, .43, .085, () => { this.draftName = this.draftName.slice(0, -1); this.draw(); this.changed(); });
      this.button('Clear', .48, -.4, .43, .085, () => { this.draftName = ''; this.draw(); this.changed(); });
      this.button('Done', -.36, -.52, .65, .09, () => { if (!this.draftName.trim()) return; this.command({ type: 'name', name: this.draftName.trim() }); this.navigate('menu'); });
      this.button('Cancel', .36, -.52, .65, .09, () => this.navigate('menu')); return;
    }
    if (this.menuMode === 'load') {
      const names = this.settings.names;
      if (!names.length) this.button('No saved games in this browser', 0, .25, 1.4, .11);
      names.slice(this.page * 5, this.page * 5 + 5).forEach((name, index) =>
        this.button(name || 'Previous checkpoint', 0, .34 - index * .13, 1.4, .11, () => this.command({ type: 'load', name })));
      this.button('Previous', -.48, -.4, .43, .09, () => { this.page = Math.max(0, this.page - 1); this.draw(); this.changed(); });
      this.button('Back', 0, -.4, .43, .09, () => this.navigate('menu'));
      this.button('Next', .48, -.4, .43, .09, () => { this.page = Math.min(Math.max(0, Math.ceil(names.length / 5) - 1), this.page + 1); this.draw(); this.changed(); }); return;
    }
    const alive = (this.observation?.status.hp ?? 0) > 0;
    if (alive) {
      this.button('Search', -.36, .34, .65, .1, () => this.act({ type: 'search' }));
      this.button('Rest', .36, .34, .65, .1, () => this.act({ type: 'rest' }));
      this.button('Pick up', -.36, .21, .65, .1, () => this.act({ type: 'pickup' }));
      this.button('Inventory', .36, .21, .65, .1, () => this.navigate('inventory'));
    }
    this.button(`Save name: ${this.settings.saveName}`, 0, .06, 1.4, .1, () => { this.draftName = this.settings.saveName; this.navigate('keyboard'); });
    this.button('Save Game', -.36, -.08, .65, .1, () => this.command({ type: 'save' }));
    this.button('Load Save', .36, -.08, .65, .1, () => this.navigate('load'));
    this.button(this.settings.sound ? 'Sound: On' : 'Sound: Off', -.48, -.22, .43, .09, () => this.command({ type: 'sound' }));
    this.button('Volume −', 0, -.22, .43, .09, () => this.command({ type: 'volume', value: Math.max(0, this.settings.volume - .1) }));
    this.button('Volume +', .48, -.22, .43, .09, () => this.command({ type: 'volume', value: Math.min(1, this.settings.volume + .1) }));
    this.button('Restart', -.48, -.36, .43, .1, () => this.navigate('restart'));
    this.button('Map / POV', 0, -.36, .43, .1, () => { this.command({ type: 'map' }); });
    this.button('Close', .48, -.36, .43, .1, () => this.toggleMenu());
    if (alive) {
      this.button('Ascend', -.36, -.5, .65, .09, () => this.act({ type: 'ascend' }));
      this.button('Descend', .36, -.5, .65, .09, () => this.act({ type: 'descend' }));
    }
  }
  get accessibleLabels(): string[] { return this.root.children.flatMap(object => typeof object.userData.label === 'string' ? [object.userData.label] : []); }
  select(ray: THREE.Raycaster): boolean {
    const hit = ray.intersectObjects(this.root.children, true).find(hit => typeof hit.object.userData.spatialAction === 'function');
    if (hit) { (hit.object.userData.spatialAction as () => void)(); return true; }
    return this.open;
  }
  dispose(): void { this.clear(); }
}
