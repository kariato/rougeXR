import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { GameView } from '../game-view';
import { buildCorridorWalls, buildPrimitiveCells, selectLitTorches } from './scene-plan';
import { nearestVisibleHit, smoothToward, type CameraMode } from './camera-model';
import { createActorVisual, createDecorationVisual, createItemVisual, type ActorVisual } from './entity-visual';
import { SceneGeneration } from './asset-cache';
import { loadPropInto } from './prop-asset';
import { equippedWeaponAsset, type WeaponAsset } from './weapon-asset';
import { loadMonsterInto, observedMonsterAsset, type MonsterCue } from './monster-asset';
import { ROOM_LOOKS, RoomMaterialCatalog } from './room-materials';
import { roomFacingForDoor, doorOpenProgress } from './door-model';
import { createDoorFallback, loadDoorInto } from './door-asset';
import type { XrSessionLike } from '../xr/session-controller';
import { DebouncedXrIntent, directionFromForward } from '../xr/input';
import type { ActionRequest } from '../../engine/model/action';

const TILE = 1;
type ActorCue = MonsterCue | 'gesture';
type CameraCue = 'attack' | 'hurt' | 'interact' | 'consume' | 'cast' | 'rest';
interface CorpseRecord {
  token: string; at: { x: number; y: number }; assetId: string | null; facing: number;
  holder: THREE.Group | null; actor: ActorVisual | null; mixer: THREE.AnimationMixer | null; settlingUntil: number;
}
interface DoorVisual { holder: THREE.Group; hinge: THREE.Group; modelHinge: THREE.Object3D | null; openedAt: number | null; mixer: THREE.AnimationMixer | null }

function createFirstPersonHand(): THREE.Group {
  const hand=new THREE.Group();
  const leather=new THREE.MeshStandardMaterial({color:0x765641,roughness:.9,depthTest:false});
  const sleeve=new THREE.MeshStandardMaterial({color:0x303945,roughness:.95,depthTest:false});
  const fist=new THREE.Mesh(new THREE.IcosahedronGeometry(.105,1),leather);fist.position.set(0,.045,-.035);
  const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.065,.085,.27,8),sleeve);forearm.rotation.x=Math.PI/2;forearm.position.set(0,-.04,.13);
  hand.add(forearm,fist);hand.renderOrder=10;return hand;
}

/** Primitive first-person desktop view built solely from the safe player observation. */
export class ThreeGameView implements GameView {
  readonly canvas = document.createElement('canvas');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.05, 120);
  private readonly hand = createFirstPersonHand();
  private readonly weaponMount = new THREE.Group();
  private readonly world = new THREE.Group();
  private readonly corpseWorld = new THREE.Group();
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
  private doorVisuals: DoorVisual[] = [];
  private readonly openedDoors = new Map<string, number>();
  private actorFacings = new Map<string, number>();
  private readonly corpses = new Map<string, CorpseRecord>();
  private cameraActions: Array<{ start: number; duration: number; kind: CameraCue }> = [];
  private animationUntil = 0;
  private lastAnimatedRevision = -1;
  private readonly generation = new SceneGeneration();
  private readonly corpseGeneration = new SceneGeneration();
  private readonly weaponGeneration = new SceneGeneration();
  private corpseToken = this.corpseGeneration.next();
  private weaponToken = this.weaponGeneration.next();
  private equippedWeaponId: string | null = null;
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
    this.world.add(this.corpseWorld);
    this.scene.add(this.ambient);
    this.lamp.position.set(0, 1.3, 0);
    this.camera.add(this.lamp);
    this.weaponMount.name = 'first-person-weapon';
    this.weaponMount.position.set(0, 0.045, -0.055);
    // Blender exports the weapon's long axis as Three.js +Y. Raise it into view
    // while canting it forward, rather than aiming it edge-on down the camera axis.
    this.weaponMount.rotation.set(-0.9, 0, -0.12);
    this.hand.add(this.weaponMount);
    this.camera.add(this.hand);
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
    const freshEvents = observation.revision === this.lastAnimatedRevision ? [] : _events;
    if (observation.revision === 0 || freshEvents.some(event => event.type === 'levelViewReset')) {this.actorFacings.clear();this.cameraActions=[];}
    const actorCues = new Map<string, ActorCue[]>();
    const addCue=(token:string,cue:ActorCue):void=>{const sequence=actorCues.get(token) ?? [];sequence.push(cue);actorCues.set(token,sequence);};
    for (const event of freshEvents) {
      if (event.type === 'visibleMovement') {
        this.actorFacings.set(event.token, Math.atan2(event.to.x-event.from.x,event.to.y-event.from.y));
        addCue(event.token,'move');
      } else if (event.type === 'visibleAttack') {
        const towardDefender = Math.atan2(event.defenderAt.x-event.attackerAt.x,event.defenderAt.y-event.attackerAt.y);
        this.actorFacings.set(event.attackerToken,towardDefender);
        this.actorFacings.set(event.defenderToken,Math.atan2(event.attackerAt.x-event.defenderAt.x,event.attackerAt.y-event.defenderAt.y));
        addCue(event.attackerToken,'attack');
        if (event.hit) addCue(event.defenderToken,'hurt');
        if (event.attackerToken === 'player') { this.targetYaw=towardDefender;this.enqueueCameraAction('attack'); }
        else if (event.defenderToken === 'player' && event.hit) this.enqueueCameraAction('hurt');
      } else if (event.type === 'visibleDefeat') addCue(event.token,'death');
      else if (event.type === 'visiblePlayerAction') {
        addCue('player','gesture');
        this.enqueueCameraAction(event.action==='rest' ? 'rest' : ['eat','drink','read'].includes(event.action) ? 'consume'
          : ['throw','zap'].includes(event.action) ? 'cast' : 'interact');
      }
    }
    this.rememberDoors(freshEvents, observation);
    this.rememberDefeats(freshEvents);
    for (const event of freshEvents) if (event.type === 'visibleDefeat') {
      const corpse = this.corpses.get(event.token);
      if (corpse) { corpse.facing = this.actorFacings.get(event.token) ?? corpse.facing; if (corpse.holder) corpse.holder.rotation.y = corpse.facing; }
    }
    this.observation = observation;
    this.updateHandWeapon(observation);
    this.canvas.dataset.playerAt = `${observation.playerAt.x},${observation.playerAt.y}`;
    this.canvas.dataset.povDirection = directionFromForward(Math.sin(this.targetYaw), Math.cos(this.targetYaw));
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
          const facing = roomFacingForDoor(observation, cell.x, cell.z);
          if (facing) {
            const holder = new THREE.Group(); holder.position.set(cell.x, 0, cell.z); holder.rotation.y = facing.yaw;
            const openedAt = this.openedDoors.get(`${cell.x},${cell.z}`) ?? null;
            holder.userData = { cell: { x: cell.x, y: cell.z }, eligible: false, occludes: openedAt === null };
            const fallback = createDoorFallback(); holder.add(fallback.root); this.world.add(holder);
            fallback.hinge.rotation.y = -Math.PI / 2 * doorOpenProgress(openedAt, performance.now());
            const visual: DoorVisual = { holder, hinge: fallback.hinge, modelHinge: null, openedAt, mixer: null };
            this.doorVisuals.push(visual);
            void loadDoorInto(holder, fallback.root, this.generation, sceneToken, openedAt, (mixer, modelHinge) => {
              visual.mixer = mixer; visual.modelHinge = modelHinge; this.ensureAnimation();
            });
          }
        }
      }
    }
    const corridorWalls = buildCorridorWalls(primitiveCells);
    for (const wall of corridorWalls) {
      const geometry = new THREE.BoxGeometry(wall.axis === 'x' ? 1 : .10, 1.8, wall.axis === 'z' ? 1 : .10);
      const mesh = new THREE.Mesh(geometry, this.roomMaterials.material(wall.theme, 'wall', wall.condition,
        wall.remembered, wall.dark, Math.round(wall.x * 2), Math.round(wall.z * 2)));
      mesh.position.set(wall.x, .9, wall.z); mesh.userData = { eligible: false, occludes: true }; this.world.add(mesh);
    }
    this.canvas.dataset.corridorWalls = String(corridorWalls.length);
    this.canvas.dataset.visibleDoors = String(this.doorVisuals.length);
    this.canvas.dataset.openDoors = String(this.doorVisuals.filter(door => door.openedAt !== null).length);

    const reserved = new Set([`${observation.playerAt.x},${observation.playerAt.y}`,
      ...observation.entities.map(entity => `${entity.at.x},${entity.at.y}`),
      ...[...this.corpses.values()].map(corpse => `${corpse.at.x},${corpse.at.y}`)]);
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
      if (decoration.kind === 'bones') void loadPropInto('/assets/props/bones.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
      if (decoration.kind === 'mushroom') void loadPropInto('/assets/props/mushroom.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
      if (decoration.kind === 'crate') void loadPropInto('/assets/props/crate.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
      if (decoration.kind === 'urn') void loadPropInto('/assets/props/urn.glb', holder, fallback, this.generation, sceneToken);
    }

    this.lastAnimatedRevision = observation.revision;
    const playerVisual = createActorVisual(0x43c7e8); const playerHolder = new THREE.Group();
    playerHolder.position.set(observation.playerAt.x, 0, observation.playerAt.y);
    playerHolder.rotation.y=this.actorFacings.get('player') ?? this.yaw; playerHolder.visible = this.mode !== 'firstPerson';
    playerHolder.add(playerVisual.root); this.world.add(playerHolder); this.actorVisuals.push(playerVisual);
    const playerCues = actorCues.get('player') ?? [];
    if (playerCues.length) playerVisual.playSequence(playerCues);
    void loadMonsterInto('rogue', playerHolder, playerVisual.root, this.generation, sceneToken,
      playerCues.filter((cue):cue is MonsterCue=>cue!=='gesture'), mixer => {
        this.monsterMixers.push(mixer); this.canvas.dataset.playerModel = 'rogue'; this.ensureAnimation();
      });
    for (const entity of observation.entities) {
      if (entity.token.startsWith('monster-')) {
        const actor = createActorVisual(0xc65353); const holder = new THREE.Group(); holder.position.set(entity.at.x, 0, entity.at.y);
        holder.rotation.y=this.actorFacings.get(entity.token) ?? 0;
        holder.userData = { cell: { ...entity.at }, eligible: true, occludes: false }; holder.add(actor.root); this.world.add(holder); this.actorVisuals.push(actor);
        const cues=actorCues.get(entity.token) ?? [];
        if (cues.length) actor.playSequence(cues);
        const assetId = observedMonsterAsset(entity);
        if (assetId) void loadMonsterInto(assetId, holder, actor.root, this.generation, sceneToken,
          cues.filter((cue):cue is MonsterCue=>cue!=='gesture'), mixer => { this.monsterMixers.push(mixer); this.ensureAnimation(); });
      } else {
        const holder = new THREE.Group(); holder.position.set(entity.at.x, 0, entity.at.y);
        const fallback = createItemVisual(); fallback.position.y = 0.23; holder.add(fallback);
        holder.userData = { cell: { ...entity.at }, eligible: true, occludes: false }; this.world.add(holder);
        if (entity.appearance === '*') void loadPropInto('/assets/props/gold.glb?v=3', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === '/') void loadPropInto('/assets/props/stick.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '=') void loadPropInto('/assets/props/ring.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ',') void loadPropInto('/assets/props/amulet.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ']') void loadPropInto('/assets/props/armor.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === ')') void loadPropInto('/assets/props/weapon.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ':') void loadPropInto('/assets/props/food.glb?v=2', holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === '?') void loadPropInto('/assets/props/scroll.glb', holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '!') void loadPropInto('/assets/props/potion.glb', holder, fallback, this.generation, sceneToken);
      }
    }
    for (const corpse of this.corpses.values()) {
      const key = `${corpse.at.x},${corpse.at.y}`;
      const cell = observation.cells[corpse.at.y * observation.width + corpse.at.x];
      if (!activeCells.has(key) || cell?.visibility !== 'visible') { if (corpse.holder) corpse.holder.visible = false; continue; }
      if (!corpse.holder) this.attachCorpse(corpse);
      if (corpse.holder) corpse.holder.visible = true;
    }
    this.canvas.dataset.visibleCorpses = String([...this.corpses.values()].filter(corpse => corpse.holder?.visible).length);
    if (actorCues.size) { this.animationUntil = performance.now() + 1100; this.ensureAnimation(); }

    this.placeCamera();
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  /** Retain only appearance disclosed by a visible defeat, even while the map is open. */
  rememberDefeats(events: PresentationEvent[]): void {
    if (events.some(event => event.type === 'levelViewReset')) this.clearCorpses();
    for (const event of events) {
      if (event.type !== 'visibleDefeat' || event.token === 'player' || this.corpses.has(event.token)) continue;
      const assetId = event.label && event.appearance ? observedMonsterAsset({ token: event.token, at: event.at, appearance: event.appearance, label: event.label }) : null;
      this.corpses.set(event.token, { token: event.token, at: { ...event.at }, assetId,
        facing: this.actorFacings.get(event.token) ?? 0, holder: null, actor: null, mixer: null,
        settlingUntil: performance.now() + 1100 });
    }
  }

  /** Crossing a disclosed door opens its presentation leaf without changing engine terrain. */
  rememberDoors(events: PresentationEvent[], observation: PlayerObservation): void {
    if (events.some(event => event.type === 'levelViewReset')) this.openedDoors.clear();
    const isDoor = (x: number, y: number): boolean =>
      observation.cells[y * observation.width + x]?.appearance?.terrainLabel === 'door';
    for (const event of events) {
      if (event.type !== 'visibleMovement' || event.token !== 'player') continue;
      for (const at of [event.from, event.to]) if (isDoor(at.x, at.y)) {
        const key = `${at.x},${at.y}`;
        if (!this.openedDoors.has(key)) this.openedDoors.set(key, performance.now());
      }
    }
  }

  resetPresentation(): void {
    this.clearCorpses();
    this.openedDoors.clear();
    this.actorFacings.clear(); this.cameraActions = []; this.lastAnimatedRevision = -1;
    this.canvas.dataset.visibleCorpses = '0';
    this.canvas.dataset.visibleDoors = '0'; this.canvas.dataset.openDoors = '0';
  }

  private attachCorpse(corpse: CorpseRecord): void {
    const holder = new THREE.Group(); holder.position.set(corpse.at.x, 0, corpse.at.y);
    holder.rotation.y = corpse.facing;
    holder.userData = { cell: { ...corpse.at }, eligible: false, occludes: false };
    const actor = createActorVisual(0xc65353);
    holder.add(actor.root); this.corpseWorld.add(holder);
    corpse.holder = holder; corpse.actor = actor;
    actor.playDeath();
    if (corpse.settlingUntil <= performance.now()) this.finishCorpse(corpse);
    else this.ensureAnimation();
    if (corpse.assetId) void loadMonsterInto(corpse.assetId, holder, actor.root,
      this.corpseGeneration, this.corpseToken, ['death'], mixer => {
        corpse.mixer = mixer;
        if (corpse.settlingUntil <= performance.now()) this.finishCorpse(corpse);
        else this.ensureAnimation();
      });
  }

  private finishCorpse(corpse: CorpseRecord): void {
    corpse.actor?.mixer.update(5);
    corpse.mixer?.update(5);
    corpse.settlingUntil = 0;
  }

  private clearCorpses(): void {
    this.corpseToken = this.corpseGeneration.next();
    for (const corpse of this.corpses.values()) {
      corpse.actor?.mixer.stopAllAction(); corpse.mixer?.stopAllAction();
      if (corpse.holder) { this.corpseWorld.remove(corpse.holder); disposeObjectTree(corpse.holder); }
    }
    this.corpses.clear();
  }

  dispose(): void {
    this.generation.next();
    this.weaponGeneration.next();
    this.canvas.hidden = true;
    this.clearWorld();
    for (const corpse of this.corpses.values()) this.finishCorpse(corpse);
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
    this.hand.visible = mode === 'firstPerson';
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
    this.actorFacings.set('player', this.targetYaw);
    this.canvas.dataset.povDirection = directionFromForward(Math.sin(this.targetYaw), Math.cos(this.targetYaw));
    this.ensureAnimation();
  }

  /** Resolve forward/backward against the camera heading without adding facing to Rogue state. */
  movementDirectionForPov(forward: boolean): ActionRequest['action'] & { type: 'move' } {
    const sign = forward ? 1 : -1;
    return { type: 'move', direction: directionFromForward(Math.sin(this.targetYaw) * sign, Math.cos(this.targetYaw) * sign), pickup: true };
  }

  private enqueueCameraAction(kind: CameraCue): void {
    const last=this.cameraActions.at(-1);const now=performance.now();
    this.cameraActions.push({start:last ? Math.max(now,last.start+last.duration) : now,duration:kind==='hurt' ? 320 : 380,kind});
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
    for (const door of this.doorVisuals) {
      if (door.openedAt === null) continue;
      door.hinge.rotation.y = -Math.PI / 2 * doorOpenProgress(door.openedAt, now);
      door.mixer?.update(elapsed);
    }
    this.canvas.dataset.doorSwing = String(this.doorVisuals.find(door => door.openedAt !== null)?.modelHinge?.rotation.y ?? 'fallback');
    for (const corpse of this.corpses.values()) if (corpse.settlingUntil > 0) {
      if (now >= corpse.settlingUntil) this.finishCorpse(corpse);
      else { corpse.actor?.mixer.update(elapsed); corpse.mixer?.update(elapsed); }
    }
    this.placeCamera();
    const moving = this.cameraActions.length>0 || this.doorVisuals.some(door => door.openedAt !== null && now < door.openedAt + 750) || [...this.corpses.values()].some(corpse => corpse.settlingUntil > 0) || Math.abs(this.yaw - this.targetYaw) > 0.0001 || Math.abs(this.pitch - this.targetPitch) > 0.0001 || Math.abs(this.distance - this.targetDistance) > 0.001 || Math.abs(this.worldScale - this.targetWorldScale) > 0.0001 || now < this.animationUntil;
    this.frame = moving ? requestAnimationFrame(this.animate) : null;
  };

  private placeCamera(): void {
    const observation = this.observation;
    if (!observation) return;
    const player = observation.playerAt;
    if (this.mode === 'firstPerson') {
      while (this.cameraActions[0] && performance.now()>=this.cameraActions[0].start+this.cameraActions[0].duration) this.cameraActions.shift();
      const action=this.cameraActions[0];const progress=action ? (performance.now()-action.start)/action.duration : 1;
      const pulse=action && progress>=0 && progress<1 ? Math.sin(Math.PI*progress) : 0;
      const bob=pulse*(action?.kind==='hurt' ? -.11 : action?.kind==='rest' ? .015 : action?.kind==='interact' ? -.025 : -.06);
      this.hand.position.set(.36-pulse*(action?.kind==='consume' ? .15 : 0),-.34+pulse*(action?.kind==='consume' ? .12 : 0),
        -.63-pulse*(action?.kind==='attack' ? .28 : action?.kind==='cast' ? .25 : action?.kind==='interact' ? .16 : action?.kind==='consume' ? -.17 : 0));
      this.hand.rotation.x=pulse*(action?.kind==='attack' ? -.95 : action?.kind==='cast' ? -.7 : action?.kind==='interact' ? -.42 : action?.kind==='consume' ? .4 : action?.kind==='hurt' ? .2 : 0);
      this.hand.rotation.y=pulse*(action?.kind==='attack' || action?.kind==='cast' ? -.35 : 0);
      this.camera.position.set(player.x, 0.72+bob, player.y);
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
    for (const door of this.doorVisuals) door.mixer?.stopAllAction();
    this.doorVisuals = [];
    for (const child of [...this.world.children]) {
      if (child === this.corpseWorld) continue;
      this.world.remove(child);
      disposeObjectTree(child);
    }
  }

  private updateHandWeapon(observation: PlayerObservation): void {
    const asset = equippedWeaponAsset(observation);
    if (asset?.id === this.equippedWeaponId) return;
    this.equippedWeaponId = asset?.id ?? null;
    this.weaponToken = this.weaponGeneration.next();
    for (const child of [...this.weaponMount.children]) {
      this.weaponMount.remove(child);
      disposeObjectTree(child);
    }
    this.canvas.dataset.equippedWeapon = asset?.id ?? 'none';
    delete this.canvas.dataset.equippedWeaponModel;
    if (!asset) return;
    this.weaponMount.scale.setScalar(asset.scale);
    const fallback = createWeaponFallback(asset);
    this.weaponMount.add(fallback);
    void loadPropInto(asset.url, this.weaponMount, fallback, this.weaponGeneration, this.weaponToken, () => {
      this.canvas.dataset.equippedWeaponModel = 'loaded';
      this.ensureAnimation();
    });
  }
}

function createWeaponFallback(asset: WeaponAsset): THREE.Object3D {
  const holder = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x4a2d1b, roughness: 0.9, depthTest: false }));
  const head = new THREE.Mesh(asset.id.includes('sword') || asset.id === 'dagger'
    ? new THREE.BoxGeometry(0.055, 0.5, 0.015) : new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xa7adb3, metalness: 0.75, roughness: 0.35, depthTest: false }));
  grip.position.y = 0.1; head.position.y = asset.id.includes('sword') || asset.id === 'dagger' ? 0.46 : 0.25;
  holder.add(grip, head); return holder;
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
