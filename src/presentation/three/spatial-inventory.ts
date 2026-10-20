import type { MovementMode } from '../xr/locomotion';
import { observedStatusEffects } from './status-effects';
import { assetUrl } from '../../asset-url';
import { SceneGeneration } from './asset-cache';
import { loadPropInto } from './prop-asset';
import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
import type { GameAction } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { Direction, EquipmentSlot } from '../../engine/model/state';

export interface SpatialMenuState { names: string[]; saveName: string; sound: boolean; volume: number; movement: MovementMode; vignette: boolean }
export type SpatialMenuCommand = { type: 'save' | 'restart' | 'sound' | 'map' | 'exitXR' } | { type: 'load' | 'name'; name: string } | { type: 'volume'; value: number } | { type: 'movement'; value: MovementMode } | { type: 'vignette'; value: boolean };
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
  private menuMode: 'inventory' | 'menu' | 'keyboard' | 'load' | 'restart' | 'effects' | 'discoveries' | 'ending' | 'settings' | 'controls' | 'actions' | 'history' | 'target' | 'movement' = 'inventory';
  private settings: SpatialMenuState = { names: [], saveName: 'My adventure', sound: true, volume: .35, movement: 'comfort', vignette: true };
  private draftName = '';
  private selected: string | null = null;
  private page = 0;
  private direction: Direction = 'N';
  private pendingTarget: 'throw' | 'zap' | null = null;
  private history: string[] = [];
  private immersive = false;
  setImmersive(active: boolean): void { this.immersive = active; this.draw(); }
  private observation: PlayerObservation | null = null;
  constructor(private readonly changed: () => void, private readonly submit: (action: GameAction) => void, private readonly command: (command: SpatialMenuCommand) => void = () => {}) {
    this.root.position.z = -1.3;
  }
  update(observation: PlayerObservation, events: readonly PresentationEvent[] = []): void {
    this.history.push(...events.flatMap(event => event.type === 'message' ? [event.text] : []));
    this.history = this.history.slice(-40);
    const newEnding = observation.ending && !this.observation?.ending;
    this.observation = observation;
    if (newEnding) { this.open = true; this.menuMode = 'ending'; this.page = 0; this.changed(); }
    if (observation.status.hp <= 0 && this.menuMode === 'inventory') { this.open = false; this.menuMode = 'menu'; }
    this.draw();
  }
  toggle(): void { if (!this.observation || this.observation.ending || this.observation.status.hp <= 0) return; this.open = !(this.open && this.menuMode === 'inventory'); this.menuMode = 'inventory'; this.draw(); this.changed(); }
  showEffects(): void { this.open = true; this.navigate('effects'); }
  recordMessage(text: string): void { this.history.push(text); this.history = this.history.slice(-40); }
  configure(settings: SpatialMenuState): void { this.settings = settings; if (this.open && this.menuMode !== 'inventory') this.draw(); }
  toggleMenu(): void { this.open = !(this.open && (this.menuMode === 'menu' || this.menuMode === 'ending')); this.menuMode = this.observation?.ending ? 'ending' : 'menu'; this.page = 0; this.draw(); this.changed(); }
  close(): void { this.open = false; this.draw(); this.changed(); }
  private navigate(mode: typeof this.menuMode): void { this.menuMode = mode; this.page = 0; this.draw(); this.changed(); }
  private act(action: GameAction): void { this.open = false; this.draw(); this.changed(); this.submit(action); }
  reset(): void { this.open = false; this.selected = null; this.page = 0; this.menuMode = 'inventory'; this.observation = null; this.history = []; this.pendingTarget = null; this.draw(); }
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
    const celebration = text.includes('VICTORY');
    ctx.fillStyle = celebration ? '#6b4a10' : selected ? '#514126' : run ? '#172332' : '#101925'; ctx.fillRect(0, 0, canvas.width, 96);
    ctx.strokeStyle = celebration || selected ? '#e4c17d' : '#88724e'; ctx.lineWidth = 3; if (run || celebration) ctx.strokeRect(2, 2, canvas.width - 4, 92);
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
    } else if (text === 'DEAD' || celebration) {
      ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, canvas.width / 2, 48);
    } else ctx.fillText(label, 18, 48);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false }));
    mesh.position.set(x, y, 0); mesh.renderOrder = 200; if (run) mesh.userData.spatialAction = run; mesh.userData.label = text;
    this.root.add(mesh);
  }
  private draw(): void {
    this.clear(); const generationToken = this.generation.next(); const observation = this.observation; if (!observation) return;
    if (!this.open) {
      if (!observation.ending && observation.status.hp > 0) {
        this.button('Inventory', -.49, -.48, .38, .11, () => this.toggle());
        this.button('Actions', 0, -.48, .38, .11, () => { this.open = true; this.navigate('actions'); });
      }
      this.button('Menu', .49, -.48, .38, .11, () => this.toggleMenu());
      return;
    }
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 1.44), new THREE.MeshBasicMaterial({ color: 0x101925, depthTest: false, depthWrite: false }));
    backdrop.position.set(0, .015, -.015); backdrop.renderOrder = 190; this.root.add(backdrop);
    if (this.menuMode !== 'inventory') { this.drawMenu(); return; }
    this.button('INVENTORY — select an item', 0, .49, 1.4, .09);
    this.button('Close', .52, .61, .32, .1, () => this.close());
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
    if (items.length > 6) {
    this.button('Previous', -.5, -.31, .35, .09, this.page > 0 ? () => { this.page--; this.draw(); this.changed(); } : undefined);
    this.button(`${this.page + 1} / ${Math.max(1, Math.ceil(items.length / 6))}`, 0, -.31, .3, .075);
    this.button('Next', .5, -.31, .35, .09, this.page < Math.ceil(items.length / 6) - 1 ? () => { this.page++; this.draw(); this.changed(); } : undefined);
    }
    if (observation.pendingDecision === 'callItem') {
      this.button('Continue without naming', 0, -.44, 1.2, .1, () => this.submit({ type: 'answerCall', label: null })); return;
    }
    if (!selected) return;
    if (observation.pendingDecision === 'identifyItem') {
      this.button('Identify selected item', 0, -.44, 1.2, .1, () => this.submit({ type: 'answerIdentify', itemId: selected.token })); return;
    }
    const actions = inventoryActions(selected, this.direction);
    actions.forEach(({ label, action }, index) => this.button(label, -.54 + index * .36, -.44, .33, .11, () => {
      if (action.type === 'throw' || action.type === 'zap') { this.pendingTarget = action.type; this.navigate('target'); }
      else this.submit(action);
    }));
  }
  private pagination(total: number, size: number, y: number): void {
    if (total <= size) return;
    if (this.page > 0) this.button('Previous', -.48, y, .43, .1, () => { this.page--; this.draw(); this.changed(); });
    if ((this.page + 1) * size < total) this.button('Next', .48, y, .43, .1, () => { this.page++; this.draw(); this.changed(); });
  }

  private drawMenu(): void {
    const ending = this.observation?.ending;
    if (this.menuMode === 'ending' && ending) {
      const won = ending.outcome === 'won';
      this.button(won ? '★ VICTORY! ★' : 'DEAD', 0, .49, 1.4, .15, undefined, won);
      this.button(won ? ending.cause : `Killed by: ${ending.cause}`, 0, .3, 1.4, .12);
      this.button(`Depth reached: ${ending.depth}    Gold: ${ending.gold}`, 0, .14, 1.4, .1);
      this.button(`Experience: ${ending.experience}    Turns: ${ending.turns}`, 0, .01, 1.4, .1);
      this.button(`Score: ${ending.score}\nGold + experience${won ? ' + 1,000 escape bonus' : ''}`, 0, -.15, 1.4, .16);
      this.button('Restart', -.36, -.34, .65, .11, () => this.command({ type: 'restart' }));
      this.button('Load Save', .36, -.34, .65, .11, () => this.navigate('load'));
      this.button('Discoveries', 0, -.49, 1.4, .1, () => this.navigate('discoveries'));
      return;
    }
    const titles: Record<string, string> = { menu: 'ADVENTURE', discoveries: 'DISCOVERIES', effects: 'STATUS EFFECTS', settings: 'SETTINGS', movement: 'MOVEMENT & COMFORT', controls: 'CONTROLS', actions: 'ACTIONS', history: 'MESSAGE HISTORY', target: 'CHOOSE A DIRECTION', keyboard: 'NAME YOUR SAVE', load: 'LOAD ADVENTURE', restart: 'RESTART ADVENTURE' };
    this.button(titles[this.menuMode] ?? 'ADVENTURE', 0, .49, 1.4, .09);
    if (this.menuMode !== 'menu') this.button('Back', -.52, .61, .32, .1, () => this.navigate(ending ? 'ending' : 'menu'));
    this.button('Close', .52, .61, .32, .1, () => this.close());
    if (this.menuMode === 'target') {
      this.button('Directions follow the dungeon compass', 0, .33, 1.4, .1);
      const directions: Direction[] = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'];
      const positions = [[-.4,.15],[0,.15],[.4,.15],[-.4,0],[.4,0],[-.4,-.15],[0,-.15],[.4,-.15]];
      directions.forEach((direction, index) => this.button(direction, positions[index]![0]!, positions[index]![1]!, .3, .12, () => { this.direction = direction; this.draw(); this.changed(); }, direction === this.direction));
      const item = this.observation?.inventory.find(item => item.token === this.selected);
      if (item && this.pendingTarget) this.button(`${this.pendingTarget === 'throw' ? 'Throw' : 'Zap'} ${this.direction}`, 0, -.36, .8, .12, () => { this.act({ type: this.pendingTarget!, itemId: item.token, direction: this.direction }); });
      this.button('Cancel', 0, -.52, .8, .1, () => this.navigate('inventory')); return;
    }
    if (this.menuMode === 'history') {
      const entries = [...this.history].reverse();
      if (!entries.length) this.button('Your adventure has just begun.', 0, .2, 1.4, .14);
      entries.slice(this.page * 3, this.page * 3 + 3).forEach((entry, index) => this.button(`Recent event\n${entry}`, 0, .28 - index * .2, 1.4, .17));
      this.pagination(entries.length, 3, -.47); return;
    }
    if (this.menuMode === 'controls') {
      this.button('VR controllers\nAim the ray and press trigger to select.', 0, .28, 1.4, .16);
      this.button('Movement\nPoint toward a direction and squeeze the grip to move. Actions opens rest and search.', 0, .07, 1.4, .18);
      this.button('Desktop fallback\nArrows move and turn. I: inventory. M: menu. Esc: close.', 0, -.16, 1.4, .18);
      return;
    }
    if (this.menuMode === 'actions') {
      if (this.observation?.pendingDecision) {
        this.button('Finish your item choice before acting.', 0, .25, 1.4, .12);
        this.button('Open Inventory', 0, .02, 1.4, .12, () => this.navigate('inventory')); return;
      }
      this.button('Search', -.36, .28, .65, .12, () => this.act({ type: 'search' }));
      this.button('Rest', .36, .28, .65, .12, () => this.act({ type: 'rest' }));
      const observation = this.observation!;
      const cell = observation.cells[observation.playerAt.y * observation.width + observation.playerAt.x];
      const onStairs = cell?.visibility === 'visible' && cell.appearance?.featureLabel === 'stairs';
      const item = observation.entities.find(entity => entity.at.x === observation.playerAt.x && entity.at.y === observation.playerAt.y);
      if (item) this.button(`Pick up ${item.label}`, 0, .08, 1.4, .12, () => this.act({ type: 'pickup' }));
      if (onStairs) {
        this.button('Descend', 0, -.1, 1.4, .12, () => this.act({ type: 'descend' }));
        if (observation.inventory.some(item => item.category === 'amulet')) this.button('Ascend with Amulet', 0, -.28, 1.4, .12, () => this.act({ type: 'ascend' }));
      }
      if (!item && !onStairs) this.button('No item or stair interaction here.', 0, -.1, 1.4, .12);
      return;
    }
    if (this.menuMode === 'movement') {
      this.button('Comfort — fade between squares', 0, .28, 1.4, .13,
        () => this.command({ type: 'movement', value: 'comfort' }), this.settings.movement === 'comfort');
      this.button('Glide — smooth steps', 0, .08, 1.4, .13,
        () => this.command({ type: 'movement', value: 'glide' }), this.settings.movement === 'glide');
      this.button(`Glide vignette: ${this.settings.vignette ? 'On' : 'Off'}`, 0, -.12, 1.4, .12,
        () => this.command({ type: 'vignette', value: !this.settings.vignette }));
      this.button('VR movement\nHead tracking stays immediate. Turns remain 45° snaps.', 0, -.36, 1.4, .18);
      return;
    }
    if (this.menuMode === 'settings') {
      this.button(this.settings.sound ? 'Sound: On' : 'Sound: Off', 0, .28, 1.4, .12, () => this.command({ type: 'sound' }));
      this.button(`Volume ${Math.round(this.settings.volume * 100)}%`, 0, .1, 1.4, .1);
      this.button('Quieter', -.36, -.06, .65, .12, () => this.command({ type: 'volume', value: Math.max(0, this.settings.volume - .1) }));
      this.button('Louder', .36, -.06, .65, .12, () => this.command({ type: 'volume', value: Math.min(1, this.settings.volume + .1) }));
      this.button('Movement & comfort', 0, -.22, 1.4, .12, () => this.navigate('movement'));
      this.button('Tabletop / first person', 0, -.39, 1.4, .12, () => this.command({ type: 'map' }));
      if (this.immersive) this.button('Exit VR', 0, -.56, 1.4, .12, () => this.command({ type: 'exitXR' }));
      return;
    }
    if (this.menuMode === 'discoveries') {
      const entries = this.observation?.discoveries ?? [];
      if (!entries.length) this.button('No magic identified yet.\nUse or identify items to learn their properties.', 0, .2, 1.4, .16);
      entries.slice(this.page * 4, this.page * 4 + 4).forEach((entry, index) =>
        this.button(`${entry.name}\nAppearance: ${entry.appearance}`, 0, .3 - index * .175, 1.4, .16));
      this.pagination(entries.length, 4, -.47);
      return;
    }
    if (this.menuMode === 'effects') {
      const effects = this.observation ? observedStatusEffects(this.observation) : [];
      if (!effects.length) this.button('No harmful effects. You feel normal.', 0, .25, 1.4, .12);
      effects.slice(this.page * 4, this.page * 4 + 4).forEach((effect, index) =>
        this.button(`${effect.icon} ${effect.label}\n${effect.description}`, 0, .3 - index * .175, 1.4, .16));
      this.pagination(effects.length, 4, -.47);
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
      this.pagination(names.length, 5, -.4); return;
    }
    this.button('Continue adventure', 0, .3, 1.4, .13, () => this.close(), true);
    this.button('Save adventure', -.36, .1, .65, .12, () => this.command({ type: 'save' }));
    this.button('Load adventure', .36, .1, .65, .12, () => this.navigate('load'));
    this.button(`Save name: ${this.settings.saveName}`, 0, -.06, 1.4, .1, () => { this.draftName = this.settings.saveName; this.navigate('keyboard'); });
    this.button('Discoveries', -.36, -.22, .65, .11, () => this.navigate('discoveries'));
    this.button('Effects', .36, -.22, .65, .11, () => this.navigate('effects'));
    this.button('Settings', -.48, -.38, .43, .11, () => this.navigate('settings'));
    this.button('Controls', 0, -.38, .43, .11, () => this.navigate('controls'));
    this.button('Messages', .48, -.38, .43, .11, () => this.navigate('history'));
    this.button('Restart…', 0, -.59, .6, .1, () => this.navigate('restart'));
  }

  get accessibleLabels(): string[] { return this.root.children.flatMap(object => typeof object.userData.label === 'string' ? [object.userData.label] : []); }
  hover(rays: readonly THREE.Raycaster[]): void {
    const targets = new Set(rays.flatMap(ray => {
      const hit = ray.intersectObjects(this.root.children, true).find(hit => typeof hit.object.userData.spatialAction === 'function');
      return hit ? [hit.object] : [];
    }));
    for (const child of this.root.children) if (child instanceof THREE.Mesh && child.userData.spatialAction) {
      (child.material as THREE.MeshBasicMaterial).color.setHex(targets.has(child) ? 0xffd995 : 0xffffff);
    }
  }
  select(ray: THREE.Raycaster): boolean {
    const hit = ray.intersectObjects(this.root.children, true).find(hit => typeof hit.object.userData.spatialAction === 'function');
    if (hit) { (hit.object.userData.spatialAction as () => void)(); return true; }
    return this.open;
  }
  dispose(): void { this.clear(); }
}
