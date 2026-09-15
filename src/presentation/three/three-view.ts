import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { GameView } from '../game-view';
import { buildPrimitiveCells, selectLitTorches } from './scene-plan';
import { nearestVisibleHit, smoothToward, type CameraMode } from './camera-model';
import { createActorVisual, createDecorationVisual, createItemVisual, type ActorVisual } from './entity-visual';
import { SceneGeneration } from './asset-cache';
import { loadPropInto } from './prop-asset';
import { loadMonsterInto, observedMonsterAsset } from './monster-asset';
import { ROOM_LOOKS, RoomMaterialCatalog } from './room-materials';
import type { XrSessionLike } from '../xr/session-controller';
import { DebouncedXrIntent, directionFromForward } from '../xr/input';
import type { ActionRequest } from '../../engine/model/action';

const TILE = 1;

/** Primitive first-person desktop view built solely from the safe player observation. */
export class ThreeGameView implements GameView {
  readonly canvas = document.createElement('canvas');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.05, 120);
  private readonly world = new THREE.Group();
  private readonly roomMaterials = new RoomMaterialCatalog();
  private readonly ambient = new THREE.HemisphereLight(0xa9c8e8, 0x18202a, 1.7);
  private readonly lamp = new THREE.PointLight(0xffd7a0, 12, 9, 1.7);
  private width = 1;
  private height = 1;
  private mode: CameraMode = 'firstPerson';
  private observation: PlayerObservation | null = null;
  private yaw = Math.PI;
  private targetYaw = Math.PI;
  private pitch = 0;
  private targetPitch = 0;
  private distance = 8;
  private targetDistance = 8;
  private worldScale = 1;
  private targetWorldScale = 1;
  private dragging = false;
  private pointerId: number | null = null;
  private frame: number | null = null;
  private lastFrame = 0;
  private actorVisuals: ActorVisual[] = [];
  private monsterMixers: THREE.AnimationMixer[] = [];
  private animationUntil = 0;
  private lastAnimatedRevision = -1;
  private readonly generation = new SceneGeneration();
  private readonly xrIntent = new DebouncedXrIntent();
  private readonly xrControllers: THREE.Group[] = [];

  constructor() {
    this.canvas.id = 'dungeon-3d';
    this.canvas.setAttribute('aria-label', 'First-person dungeon view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x05080d);
    this.scene.background = new THREE.Color(0x05080d);
    this.scene.fog = new THREE.FogExp2(0x05080d, 0.055);
    this.scene.add(this.world);
    this.scene.add(this.ambient);
    this.lamp.position.set(0, 1.3, 0);
    this.camera.add(this.lamp);
    this.scene.add(this.camera);
    for (let index = 0; index < 2; index++) {
      const controller = this.renderer.xr.getController(index);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x67e8f9 }));
      ray.scale.z = 2; controller.add(ray); controller.visible = false;
      controller.addEventListener('select', () => this.commitXrIntent(controller, true));
      controller.addEventListener('squeeze', () => this.commitXrIntent(controller, false));
      this.xrControllers.push(controller); this.scene.add(controller);
    }
  }

  mount(host: HTMLElement): void {
    this.canvas.hidden = false;
    if (this.canvas.parentElement !== host) host.append(this.canvas);
    const bounds = host.getBoundingClientRect();
    this.resize(bounds.width, bounds.height);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('click', this.onClick);
    window.addEventListener('blur', this.clearCapturedInput);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.lastFrame = performance.now();
  }

  update(observation: PlayerObservation, _events: PresentationEvent[]): void {
    const sceneToken = this.generation.next();
    this.observation = observation;
    this.clearWorld();
    this.roomMaterials.beginFrame();
    const currentRegion = observation.cells[observation.playerAt.y * observation.width + observation.playerAt.x]?.visualRegion;
    const look = ROOM_LOOKS[currentRegion?.theme ?? 'none'];
    this.ambient.color.setHex(look.sky); this.ambient.groundColor.setHex(look.ground);
    this.ambient.intensity = 1.25;
    this.lamp.color.setHex(look.lamp);
    this.lamp.intensity = 5;
    this.scene.background = new THREE.Color(look.fog);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(look.fog);
    const floorGeometry = new THREE.PlaneGeometry(TILE, TILE);
    floorGeometry.rotateX(-Math.PI / 2);
    const wallGeometry = new THREE.BoxGeometry(TILE, 1.8, TILE);
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x7d4d2f, roughness: 0.85 });

    const primitiveCells = buildPrimitiveCells(observation, this.mode === 'tabletop' ? Number.POSITIVE_INFINITY : 14);
    const activeCells = new Set(primitiveCells.map(cell => `${cell.x},${cell.z}`));
    for (const cell of primitiveCells) {
      if (cell.kind === 'wall') {
        const geometry = cell.theme === 'cave' ? new THREE.DodecahedronGeometry(0.68, 0) : wallGeometry;
        const mesh = new THREE.Mesh(geometry, this.roomMaterials.material(cell.theme, 'wall', cell.condition, cell.visibility === 'remembered', cell.dark, cell.x, cell.z));
        if (cell.theme === 'cave') mesh.scale.set(0.9, 1.35 + cell.condition * 0.08, 0.9);
        mesh.position.set(cell.x, 0.9, cell.z); mesh.userData = { cell: { x: cell.x, y: cell.z }, eligible: false, occludes: true }; this.world.add(mesh);
      } else {
        const floor = new THREE.Mesh(floorGeometry, this.roomMaterials.material(cell.theme, 'floor', cell.condition, cell.visibility === 'remembered', cell.dark, cell.x, cell.z));
        floor.position.set(cell.x, 0, cell.z); floor.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: false }; this.world.add(floor);
        if (cell.kind === 'door') {
          const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.65, 0.16), doorMaterial);
          door.position.set(cell.x, 0.825, cell.z); door.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: true }; this.world.add(door);
        }
      }
    }

    const reserved = new Set([`${observation.playerAt.x},${observation.playerAt.y}`,
      ...observation.entities.map(entity => `${entity.at.x},${entity.at.y}`)]);
    for (let index = 0; index < observation.cells.length; index++) if (observation.cells[index]?.appearance?.featureLabel) reserved.add(`${index % observation.width},${Math.floor(index / observation.width)}`);
    const litTorches = selectLitTorches(observation, activeCells, reserved);
    for (const decoration of observation.decorations) {
      const key = `${decoration.at.x},${decoration.at.y}`;
      if (!activeCells.has(key) || reserved.has(key)) continue;
      const holder = new THREE.Group(); const fallback = createDecorationVisual(decoration.kind, decoration.theme, decoration.variant);
      holder.position.x = decoration.at.x; holder.position.z = decoration.at.y; holder.rotation.y = decoration.rotation * Math.PI / 2; holder.scale.multiplyScalar(decoration.scale);
      holder.userData = { cell: { ...decoration.at }, eligible: false, occludes: false };
      if (decoration.kind === 'torch') {
        const mount = new THREE.Group(); mount.position.set(0, 1.10, .54); mount.add(fallback); holder.add(mount);
        if (litTorches.has(decoration.token)) {
          const light = new THREE.PointLight(0xffa45b, 5, 4.5, 2); light.position.set(0, .22, .22); mount.add(light);
        }
        this.world.add(holder);
        void loadPropInto('/assets/props/torch.glb?v=2', mount, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        continue;
      }
      holder.add(fallback); this.world.add(holder);
      if (decoration.kind === 'rubble') void loadPropInto('/assets/props/rubble.glb', holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'pillar') void loadPropInto('/assets/props/pillar.glb', holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'coinScatter') void loadPropInto('/assets/props/coinScatter.glb', holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'bones') void loadPropInto('/assets/props/bones.glb', holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'mushroom') void loadPropInto('/assets/props/mushroom.glb', holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'crate') void loadPropInto('/assets/props/crate.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
      if (decoration.kind === 'urn') void loadPropInto('/assets/props/urn.glb', holder, fallback, this.generation, sceneToken);
    }

    const movementTokens = new Set(observation.revision === this.lastAnimatedRevision ? []
      : _events.filter(event => event.type === 'visibleMovement').map(event => event.token));
    this.lastAnimatedRevision = observation.revision;
    const playerVisual = createActorVisual(0x43c7e8); playerVisual.root.position.set(observation.playerAt.x, 0, observation.playerAt.y);
    playerVisual.root.visible = this.mode !== 'firstPerson'; this.world.add(playerVisual.root); this.actorVisuals.push(playerVisual);
    if (movementTokens.has('player')) playerVisual.playMove();
    for (const entity of observation.entities) {
      if (entity.token.startsWith('monster-')) {
        const actor = createActorVisual(0xc65353); const holder = new THREE.Group(); holder.position.set(entity.at.x, 0, entity.at.y);
        holder.userData = { cell: { ...entity.at }, eligible: true, occludes: false }; holder.add(actor.root); this.world.add(holder); this.actorVisuals.push(actor);
        if (movementTokens.has(entity.token)) actor.playMove();
        const assetId = observedMonsterAsset(entity);
        if (assetId) void loadMonsterInto(assetId, holder, actor.root, this.generation, sceneToken,
          movementTokens.has(entity.token), mixer => { this.monsterMixers.push(mixer); this.ensureAnimation(); });
      } else {
        const holder = new THREE.Group(); holder.position.set(entity.at.x, 0, entity.at.y);
        const fallback = createItemVisual(); fallback.position.y = 0.23; holder.add(fallback);
        holder.userData = { cell: { ...entity.at }, eligible: true, occludes: false }; this.world.add(holder);
        if (entity.appearance === '*') void loadPropInto('/assets/props/gold.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '/') void loadPropInto('/assets/props/stick.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '=') void loadPropInto('/assets/props/ring.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ',') void loadPropInto('/assets/props/amulet.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ']') void loadPropInto('/assets/props/armor.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ')') void loadPropInto('/assets/props/weapon.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ':') void loadPropInto('/assets/props/food.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === '?') void loadPropInto('/assets/props/scroll.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '!') void loadPropInto('/assets/props/potion.glb', holder, fallback, this.generation, sceneToken);
      }
    }
    if (movementTokens.size) { this.animationUntil = performance.now() + 280; this.ensureAnimation(); }

    this.placeCamera();
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  dispose(): void {
    this.generation.next();
    this.canvas.hidden = true;
    this.clearWorld();
    this.roomMaterials.dispose();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('click', this.onClick);
    window.removeEventListener('blur', this.clearCapturedInput);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.clearCapturedInput();
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (this.actorVisuals[0]) this.actorVisuals[0].root.visible = mode !== 'firstPerson';
    this.targetPitch = mode === 'tabletop' ? -0.9 : mode === 'orbit' ? -0.2 : 0;
    this.targetDistance = mode === 'tabletop' ? 7 : 8;
    this.targetWorldScale = mode === 'tabletop' ? 0.12 : 1;
    this.ensureAnimation();
  }

  /** Rotate the first-person camera without changing player position or engine time. */
  rotatePov(degrees: number): void {
    if (this.mode !== 'firstPerson' || !Number.isFinite(degrees)) return;
    this.targetYaw -= degrees * Math.PI / 180;
    this.ensureAnimation();
  }

  async setXrSession(session: XrSessionLike | null): Promise<void> {
    this.renderer.xr.enabled = session !== null;
    await this.renderer.xr.setSession(session as XRSession | null);
    for (const controller of this.xrControllers) controller.visible = session !== null;
    if (session) this.renderer.setAnimationLoop(() => this.renderer.render(this.scene, this.camera));
    else { this.renderer.setAnimationLoop(null); this.xrIntent.reset(); this.placeCamera(); }
  }

  private readonly animate = (now: number): void => {
    const elapsed = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.yaw = smoothToward(this.yaw, this.targetYaw, 14, elapsed);
    this.pitch = smoothToward(this.pitch, this.targetPitch, 14, elapsed);
    this.distance = smoothToward(this.distance, this.targetDistance, 12, elapsed);
    this.worldScale = smoothToward(this.worldScale, this.targetWorldScale, 12, elapsed);
    this.world.scale.setScalar(this.worldScale);
    for (const visual of this.actorVisuals) visual.mixer.update(elapsed);
    for (const mixer of this.monsterMixers) mixer.update(elapsed);
    this.placeCamera();
    const moving = this.monsterMixers.length > 0 || Math.abs(this.yaw - this.targetYaw) > 0.0001 || Math.abs(this.pitch - this.targetPitch) > 0.0001 || Math.abs(this.distance - this.targetDistance) > 0.001 || Math.abs(this.worldScale - this.targetWorldScale) > 0.0001 || now < this.animationUntil;
    this.frame = moving ? requestAnimationFrame(this.animate) : null;
  };

  private placeCamera(): void {
    const observation = this.observation;
    if (!observation) return;
    const player = observation.playerAt;
    if (this.mode === 'firstPerson') {
      this.camera.position.set(player.x, 0.72, player.y);
      const horizontal = Math.cos(this.pitch);
      this.camera.lookAt(player.x + Math.sin(this.yaw) * horizontal, 0.72 + Math.sin(this.pitch), player.y + Math.cos(this.yaw) * horizontal);
    } else {
      const targetX = (this.mode === 'tabletop' ? observation.width / 2 : player.x) * this.worldScale;
      const targetZ = (this.mode === 'tabletop' ? observation.height / 2 : player.y) * this.worldScale;
      const horizontal = Math.cos(this.pitch) * this.distance;
      this.camera.position.set(targetX - Math.sin(this.yaw) * horizontal, 1.2 - Math.sin(this.pitch) * this.distance, targetZ - Math.cos(this.yaw) * horizontal);
      this.camera.lookAt(targetX, 0, targetZ);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true; this.pointerId = event.pointerId; this.canvas.setPointerCapture(event.pointerId);
  };
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    this.targetYaw -= event.movementX * 0.006;
    this.targetPitch = Math.max(-1.35, Math.min(1.1, this.targetPitch - event.movementY * 0.004));
    this.ensureAnimation();
  };
  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.clearCapturedInput();
  };
  private readonly onWheel = (event: WheelEvent): void => {
    if (this.mode === 'firstPerson') return;
    event.preventDefault();
    this.targetDistance = Math.max(3, Math.min(40, this.targetDistance + event.deltaY * 0.015));
    this.ensureAnimation();
  };
  private readonly onClick = (event: MouseEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera);
    const selected = nearestVisibleHit(ray.intersectObjects(this.world.children, true).map(hit => {
      const data = inheritedUserData(hit.object);
      return { distance: hit.distance, eligible: data.eligible === true, occludes: data.occludes === true,
        value: data.cell as { x: number; y: number } };
    }));
    if (selected) this.canvas.dispatchEvent(new CustomEvent('rougexr-select-cell', { detail: selected }));
  };
  private readonly clearCapturedInput = (): void => {
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) this.canvas.releasePointerCapture(this.pointerId);
    this.dragging = false; this.pointerId = null;
  };
  private readonly onVisibilityChange = (): void => { if (document.hidden) this.clearCapturedInput(); };

  private ensureAnimation(): void {
    if (this.frame !== null) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.animate);
  }

  private commitXrIntent(controller: THREE.Object3D, select: boolean): void {
    const observation = this.observation; if (!observation) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    if (select) {
      const origin = controller.getWorldPosition(new THREE.Vector3()); const ray = new THREE.Raycaster(origin, forward.clone().normalize());
      const selected = nearestVisibleHit(ray.intersectObjects(this.world.children, true).map(hit => {
        const data = inheritedUserData(hit.object);
        return { distance: hit.distance, eligible: data.eligible === true, occludes: data.occludes === true,
          value: data.cell as { x: number; y: number } };
      }));
      if (selected) this.canvas.dispatchEvent(new CustomEvent('rougexr-select-cell', { detail: selected }));
    }
    const request = this.xrIntent.commit(directionFromForward(forward.x, forward.z), observation.revision, performance.now());
    if (request) this.canvas.dispatchEvent(new CustomEvent<ActionRequest>('rougexr-xr-action', { detail: request }));
  }

  private clearWorld(): void {
    for (const visual of this.actorVisuals) visual.mixer.stopAllAction();
    this.actorVisuals = [];
    for (const mixer of this.monsterMixers) mixer.stopAllAction();
    this.monsterMixers = [];
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      disposeObjectTree(child);
    }
  }
}

function inheritedUserData(object: THREE.Object3D): Record<string, unknown> {
  let current: THREE.Object3D | null = object;
  while (current) { if (current.userData.cell) return current.userData as Record<string, unknown>; current = current.parent; }
  return {};
}

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse(descendant => {
    if (!(descendant instanceof THREE.Mesh)) return;
    descendant.geometry.dispose();
    const materials = Array.isArray(descendant.material) ? descendant.material : [descendant.material];
    for (const material of materials) material.dispose();
  });
}
