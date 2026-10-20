import { XrLocomotion, type LocomotionOptions } from '../xr/locomotion';
import { LocomotionOverlay } from './locomotion-overlay';
import { createTrapVisual, observedTrapKind } from './trap-asset';
import { DiscoveryFeedback } from './discovery-feedback';
import { observedStatusEffects } from './status-effects';
import { SpatialStatus, spatialStatusLines } from './spatial-status';
import { WEAPON_ATTACK_DURATION, weaponAttackPose } from './weapon-motion';
import { SpatialInventory, type SpatialMenuState } from './spatial-inventory';
import { DeathPresentation } from './death-presentation';
import { HitFeedback } from './hit-feedback';
import { createStaircaseVisual } from './staircase-asset';
import { assetUrl } from "../../asset-url";
import * as THREE from 'three';
import type { PresentationEvent } from '../../engine/model/action';
import type { PlayerObservation } from '../../engine/model/observation';
import type { GameView } from '../game-view';
import { buildCorridorWalls, buildPrimitiveCells, selectLitTorches } from './scene-plan';
import { snapGridYaw, deathFallProgress, frontMonsterAttackRequest, nearestVisibleHit, smoothToward, type CameraMode } from './camera-model';
import { createActorVisual, createDecorationVisual, createItemVisual, setChestFallbackOpen, type ActorVisual } from './entity-visual';
import { SceneGeneration } from './asset-cache';
import { loadPropInto } from './prop-asset';
import { equippedWeaponAsset, type WeaponAsset } from './weapon-asset';
import { loadMonsterInto, observedMonsterAsset, type MonsterCue } from './monster-asset';
import { ROOM_LOOKS, RoomMaterialCatalog } from './room-materials';
import { roomFacingForDoor, doorOpenProgress } from './door-model';
import { createDoorFallback, loadDoorInto } from './door-asset';
import { loadChestInto } from './chest-asset';
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
  private readonly xrRig = new THREE.Group();
  private xrActive = false;
  private readonly locomotion = new XrLocomotion();
  private readonly locomotionOverlay = new LocomotionOverlay();
  private readonly hand = createFirstPersonHand();
  private readonly weaponMount = new THREE.Group();
  private readonly world = new THREE.Group();
  private readonly corpseWorld = new THREE.Group();
  private readonly spatialStatus = new SpatialStatus(() => this.spatialInventory.showEffects(), () => this.ensureAnimation());
  private readonly deathPresentation = new DeathPresentation();
  private readonly spatialInventory = new SpatialInventory(() => {
    this.canvas.dataset.inventoryOpen = String(this.spatialInventory.open);
    this.spatialStatus.setModalOpen(this.spatialInventory.open);
    this.canvas.setAttribute('aria-description', this.spatialInventory.accessibleLabels.join('. '));
    this.canvas.dispatchEvent(new CustomEvent('rougexr-inventory-toggle', { detail: { open: this.spatialInventory.open } }));
    this.ensureAnimation();
  }, action => {
    if (this.observation) this.canvas.dispatchEvent(new CustomEvent<ActionRequest>('rougexr-action', {
      detail: { expectedRevision: this.observation.revision, action },
    }));
  }, command => this.canvas.dispatchEvent(new CustomEvent('rougexr-menu-command', { detail: command })));
  private readonly discoveryFeedback = new DiscoveryFeedback();
  private readonly hitFeedback = new HitFeedback();
  private readonly roomMaterials = new RoomMaterialCatalog();
  private readonly ambient = new THREE.HemisphereLight(0xa9c8e8, 0x18202a, 1.7);
  private readonly lamp = new THREE.PointLight(0xffd7a0, 12, 9, 1.7);
  private width = 1;
  private height = 1;
  private mode: CameraMode = 'firstPerson';
  private observation: PlayerObservation | null = null;
  private yaw = Math.PI;
  private dragYawPixels = 0;
  private targetYaw = Math.PI;
  private pitch = 0;
  private targetPitch = 0;
  private distance = 8;
  private targetDistance = 8;
  private worldScale = 1;
  private targetWorldScale = 1;
  private dragging = false;
  private suppressClick = false;
  private pointerId: number | null = null;
  private frame: number | null = null;
  private lastFrame = 0;
  private actorVisuals: ActorVisual[] = [];
  private monsterMixers: THREE.AnimationMixer[] = [];
  private decorationMixers: THREE.AnimationMixer[] = [];
  private doorVisuals: DoorVisual[] = [];
  private readonly openedDoors = new Map<string, number>();
  private readonly openedChests = new Set<string>();
  private readonly chestOpeners = new Map<string, () => void>();
  private actorFacings = new Map<string, number>();
  private readonly corpses = new Map<string, CorpseRecord>();
  private cameraActions: Array<{ start: number; duration: number; kind: CameraCue }> = [];
  private weaponAttackStarted = -Infinity;
  private animationUntil = 0;
  private deathStartedAt: number | null = null;
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
    this.scene.add(this.locomotionOverlay.root);
    this.scene.add(this.hitFeedback.root);
    this.scene.add(this.discoveryFeedback.root);
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
    this.camera.add(this.spatialInventory.root);
    this.camera.add(this.spatialStatus.root);
    this.camera.add(this.deathPresentation.label);
    this.xrRig.add(this.camera);
    this.scene.add(this.xrRig);
    for (let index = 0; index < 2; index++) {
      const controller = this.renderer.xr.getController(index);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x67e8f9 }));
      ray.scale.z = 2; controller.add(ray); controller.visible = false;
      controller.addEventListener('select', () => this.commitXrIntent(controller, true));
      controller.addEventListener('squeeze', () => this.commitXrIntent(controller, false));
      this.xrControllers.push(controller); this.xrRig.add(controller);
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
    const previousOpened = new Set(this.openedChests);
    this.openedChests.clear();
    for (const decoration of observation.decorations) if (decoration.kind === 'crate' && decoration.opened)
      this.openedChests.add(decoration.token);
    const sceneToken = this.generation.next();
    const freshEvents = observation.revision === this.lastAnimatedRevision ? [] : _events;
    if (observation.revision === 0 || freshEvents.some(event => event.type === 'levelViewReset')) {
      this.hitFeedback.reset();
      this.discoveryFeedback.reset();
      this.actorFacings.clear();this.cameraActions=[];this.deathStartedAt=null;delete this.canvas.dataset.playerDeath;
    }
    const damageTaken = this.observation !== null && observation.revision !== this.lastAnimatedRevision
      && observation.revision > 0 && !freshEvents.some(event => event.type === 'levelViewReset')
      && observation.status.hp < this.observation.status.hp;
    this.hitFeedback.trigger(freshEvents, damageTaken, performance.now());
    this.canvas.dataset.hitFeedback = freshEvents.some(event => event.type === 'visibleAttack' && event.hit && event.attackerToken === 'player') ? 'impact' : 'none';
    this.canvas.dataset.damageFeedback = damageTaken ? 'red-flash' : 'none';
    if (damageTaken || freshEvents.some(event => event.type === 'visibleAttack' && event.hit)) {
      this.animationUntil = Math.max(this.animationUntil, performance.now() + 500);
      this.ensureAnimation();
    }
    this.discoveryFeedback.trigger(freshEvents, performance.now());
    const discoveries = freshEvents.filter(event => event.type === 'visibleDiscovery');
    if (discoveries.length) { this.animationUntil = Math.max(this.animationUntil, performance.now() + 1650); this.ensureAnimation(); }
    this.canvas.dataset.discoveries = discoveries.map(event => `${event.feature}@${event.at.x},${event.at.y}`).join('|');
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
        if (event.attackerToken === 'player') { if (!this.xrActive) this.targetYaw=snapGridYaw(towardDefender);this.enqueueCameraAction('attack'); }
        else if (event.defenderToken === 'player' && event.hit) this.enqueueCameraAction('hurt');
      } else if (event.type === 'visibleDefeat') {
        addCue(event.token,'death');
        if (event.token === 'player' && this.deathStartedAt === null) {
          this.deathStartedAt = performance.now(); this.canvas.dataset.playerDeath = 'falling';
          this.animationUntil = Math.max(this.animationUntil, this.deathStartedAt + 1400); this.ensureAnimation();
        }
      }
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
    const visualTarget = { x: observation.playerAt.x, z: observation.playerAt.y };
    if (this.xrActive && this.mode === 'firstPerson') {
      this.locomotion.moveTo(visualTarget, performance.now(), this.observation?.status.depth !== observation.status.depth
        || freshEvents.some(event => event.type === 'levelViewReset'));
    } else this.locomotion.reset(visualTarget);
    this.observation = observation;
    this.spatialStatus.update(observation, freshEvents);
    this.canvas.dataset.statusEffects = observedStatusEffects(observation).map(effect => `${effect.label}: ${effect.description}`).join(' | ');
    this.canvas.dataset.spatialStatus = spatialStatusLines(observation).join(' | ');
    this.canvas.dataset.spatialMessage = freshEvents.flatMap(event => event.type === 'message' ? [event.text] : []).join(' ');
    this.spatialInventory.update(observation, freshEvents);
    const dead = observation.status.hp <= 0;
    if (dead) this.hitFeedback.reset();
    this.canvas.style.filter = dead ? 'grayscale(1)' : '';
    this.canvas.dataset.dead = String(dead);
    this.canvas.dataset.inventoryOpen = String(this.spatialInventory.open);
    this.canvas.setAttribute('aria-description', this.spatialInventory.accessibleLabels.join('. '));
    this.canvas.setAttribute('aria-label', observation.ending ? `${observation.ending.outcome === 'won' ? 'VICTORY' : 'DEAD'} — ${observation.ending.cause}. Depth ${observation.ending.depth}, Gold ${observation.ending.gold}, Score ${observation.ending.score}` : 'First-person dungeon view');
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
    this.scene.background = new THREE.Color(observation.status.hp <= 0 ? 0x101010 : look.fog);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.setHex(look.fog);
    const floorGeometry = new THREE.PlaneGeometry(TILE, TILE);
    floorGeometry.rotateX(-Math.PI / 2);
    const wallGeometry = new THREE.BoxGeometry(TILE, 1.8, TILE);

    const primitiveCells = buildPrimitiveCells(observation, this.mode === 'tabletop' ? Number.POSITIVE_INFINITY : 14);
    const activeCells = new Set(primitiveCells.map(cell => `${cell.x},${cell.z}`));
    for (const cell of primitiveCells) {
      if (cell.kind === 'void') continue;
      if (cell.kind === 'wall') {
        const geometry = cell.theme === 'cave' ? new THREE.DodecahedronGeometry(0.68, 0) : wallGeometry;
        const mesh = new THREE.Mesh(geometry, this.roomMaterials.material(cell.theme, 'wall', cell.condition, cell.visibility === 'remembered', cell.dark, cell.x, cell.z));
        if (cell.theme === 'cave') mesh.scale.set(0.9, 1.35 + cell.condition * 0.08, 0.9);
        mesh.position.set(cell.x, 0.9, cell.z); mesh.userData = { cell: { x: cell.x, y: cell.z }, eligible: false, occludes: true }; this.world.add(mesh);
      } else {
        const feature = observation.cells[cell.z * observation.width + cell.x]?.appearance?.featureLabel;
        if (feature === 'stairs') {
          const stairs = createStaircaseVisual(observation.inventory.some(item => item.category === 'amulet') ? 'up' : 'down');
          stairs.position.set(cell.x, 0, cell.z);
          stairs.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: false };
          this.world.add(stairs);
          continue;
        }
        const floor = new THREE.Mesh(floorGeometry, this.roomMaterials.material(cell.theme, 'floor', cell.condition, cell.visibility === 'remembered', cell.dark, cell.x, cell.z));
        floor.position.set(cell.x, 0, cell.z); floor.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: false }; this.world.add(floor);
        const trapKind = observedTrapKind(feature);
        if (trapKind) {
          const trap = createTrapVisual(trapKind); trap.position.set(cell.x, 0, cell.z);
          trap.userData = { cell: { x: cell.x, y: cell.z }, eligible: true, occludes: false };
          this.world.add(trap);
        }
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
    // Use the complete disclosed topology before applying the render radius so
    // culling never removes a neighbor and invents a wall or a gap.
    const activePassages = new Set(primitiveCells.filter(cell => cell.kind === 'passage').map(cell => `${cell.x},${cell.z}`));
    const corridorWalls = buildCorridorWalls(buildPrimitiveCells(observation)).filter(wall =>
      activePassages.has(`${Math.round(wall.x)},${Math.round(wall.z)}`));
    for (const wall of corridorWalls) {
      const geometry = new THREE.BoxGeometry(wall.axis === 'x' ? (wall.length ?? 1) : .10, 1.8, wall.axis === 'z' ? (wall.length ?? 1) : .10);
      const mesh = new THREE.Mesh(geometry, this.roomMaterials.material(wall.theme, wall.deadEnd ? 'deadEnd' : 'wall', wall.condition,
        wall.remembered, wall.dark, Math.round(wall.x * 2), Math.round(wall.z * 2)));
      mesh.position.set(wall.x, .9, wall.z); mesh.userData = { eligible: false, occludes: true }; this.world.add(mesh);
    }
    this.canvas.dataset.visibleTraps = primitiveCells.flatMap(cell => { const kind = observedTrapKind(observation.cells[cell.z * observation.width + cell.x]?.appearance?.featureLabel); return kind ? [kind] : []; }).join(',');
    this.canvas.dataset.visibleStairs = String(primitiveCells.filter(cell => observation.cells[cell.z * observation.width + cell.x]?.appearance?.featureLabel === 'stairs').length);
    this.canvas.dataset.deadEndWalls = String(corridorWalls.filter(wall => wall.deadEnd).length);
    this.canvas.dataset.corridorWalls = String(corridorWalls.length);
    this.canvas.dataset.visibleDoors = String(this.doorVisuals.length);
    this.canvas.dataset.openDoors = String(this.doorVisuals.filter(door => door.openedAt !== null).length);
    this.canvas.dataset.openChests = String(this.openedChests.size);
    this.canvas.dataset.chestAnimation = this.openedChests.size ? 'open' : 'closed';

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
      holder.userData = { cell: { ...decoration.at }, eligible: false, occludes: false,
        ...(decoration.kind === 'crate' ? { chestToken: decoration.token } : {}) };
      if (decoration.kind === 'torch') {
        const mount = new THREE.Group(); mount.position.set(0, 1.10, .54); mount.add(fallback); holder.add(mount);
        if (litTorches.has(decoration.token)) {
          const light = new THREE.PointLight(0xffa45b, 5, 4.5, 2); light.position.set(0, .22, .22); mount.add(light);
        }
        this.world.add(holder);
        void loadPropInto(assetUrl('assets/props/torch.glb?v=2'), mount, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        continue;
      }
      holder.add(fallback); this.world.add(holder);
      if (decoration.kind === 'rubble') void loadPropInto(assetUrl('assets/props/rubble.glb'), holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'pillar') void loadPropInto(assetUrl('assets/props/pillar.glb'), holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'coinScatter') void loadPropInto(assetUrl('assets/props/coinScatter.glb'), holder, fallback, this.generation, sceneToken);
      if (decoration.kind === 'bones') void loadPropInto(assetUrl('assets/props/bones.glb?v=2'), holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
      if (decoration.kind === 'mushroom') void loadPropInto(assetUrl('assets/props/mushroom.glb?v=2'), holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
      if (decoration.kind === 'crate') {
        const opened = this.openedChests.has(decoration.token) && previousOpened.has(decoration.token);
        if (this.openedChests.has(decoration.token)) setChestFallbackOpen(fallback);
        this.chestOpeners.set(decoration.token, () => setChestFallbackOpen(fallback));
        void loadChestInto(holder, fallback, this.generation, sceneToken, opened, open => {
          this.chestOpeners.set(decoration.token, () => {
            const { mixer, duration } = open();
            this.decorationMixers.push(mixer);
            this.animationUntil = Math.max(this.animationUntil, performance.now() + duration * 1000);
            this.ensureAnimation();
          });
          if (!opened && this.openedChests.has(decoration.token)) this.chestOpeners.get(decoration.token)?.();
          this.ensureAnimation();
        });
      }
      if (decoration.kind === 'urn') void loadPropInto(assetUrl('assets/props/urn.glb'), holder, fallback, this.generation, sceneToken);
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
        if (entity.appearance === '*') void loadPropInto(assetUrl('assets/props/gold.glb?v=3'), holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === '/') void loadPropInto(assetUrl('assets/props/stick.glb'), holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '=') void loadPropInto(assetUrl('assets/props/ring.glb'), holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ',') void loadPropInto(assetUrl('assets/props/amulet.glb'), holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ']') void loadPropInto(assetUrl('assets/props/armor.glb?v=2'), holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === ')') void loadPropInto(assetUrl('assets/props/weapon.glb'), holder, fallback, this.generation, sceneToken);
        if (entity.appearance === ':') void loadPropInto(assetUrl('assets/props/food.glb?v=2'), holder, fallback, this.generation, sceneToken, () => this.ensureAnimation());
        if (entity.appearance === '?') void loadPropInto(assetUrl('assets/props/scroll.glb'), holder, fallback, this.generation, sceneToken);
        if (entity.appearance === '!') void loadPropInto(assetUrl('assets/props/potion.glb'), holder, fallback, this.generation, sceneToken);
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
    if (actorCues.size) { this.animationUntil = Math.max(this.animationUntil, performance.now() + 1100); this.ensureAnimation(); }

    this.placeCamera();
  }

  closeSpatialMenu(): void { this.spatialInventory.close(); }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    // Fit the entire panel, including vertical extents; immersive sizing is independent of the mirror window.
    const immersive = this.xrActive;
    const aspect = this.width / this.height;
    const half = Math.tan(34 * Math.PI / 180);
    this.spatialStatus.root.scale.setScalar(immersive ? 1 : Math.min(1, aspect * 1.25 * half / .82, 1.25 * half / .83));
    this.spatialInventory.root.scale.setScalar(immersive ? 1 : Math.min(1, aspect * 1.3 * half / .83, 1.3 * half / .78));
    this.deathPresentation.label.scale.setScalar(immersive ? 1 : Math.min(1, aspect * .9 * half / .53));
    if (immersive) return; // WebXR owns the projection and framebuffer dimensions.
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
    this.locomotion.reset(); this.locomotionOverlay.reset();
    this.spatialInventory.reset();
    this.spatialStatus.reset();
    this.discoveryFeedback.reset();
    this.clearCorpses();
    this.openedDoors.clear();
    this.openedChests.clear();
    this.weaponAttackStarted = -Infinity;
    this.actorFacings.clear(); this.cameraActions = []; this.deathStartedAt = null; this.lastAnimatedRevision = -1;
    delete this.canvas.dataset.playerDeath;
    this.canvas.dataset.visibleCorpses = '0';
    this.canvas.dataset.visibleDoors = '0'; this.canvas.dataset.openDoors = '0';
    this.canvas.dataset.openChests = '0';
    this.canvas.dataset.chestAnimation = 'closed';
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
    this.hitFeedback.dispose();
    this.discoveryFeedback.reset();
    this.spatialInventory.dispose();
    this.deathPresentation.dispose();
    this.spatialStatus.dispose();
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

  configureLocomotion(options: LocomotionOptions): void {
    this.locomotion.configure(options);
    this.canvas.dataset.movementMode = options.movement;
    this.canvas.dataset.comfortVignette = String(options.vignette);
  }

  setMode(mode: CameraMode): void {
    this.locomotion.reset(this.observation ? { x: this.observation.playerAt.x, z: this.observation.playerAt.y } : undefined);
    this.locomotionOverlay.reset();
    this.mode = mode;
    if (mode === 'firstPerson') this.targetYaw = snapGridYaw(this.targetYaw);
    this.hand.visible = mode === 'firstPerson';
    if (this.actorVisuals[0]) this.actorVisuals[0].root.visible = mode !== 'firstPerson';
    this.targetPitch = mode === 'tabletop' ? -0.9 : mode === 'orbit' ? -0.2 : 0;
    this.targetDistance = mode === 'tabletop' ? 7 : 8;
    this.targetWorldScale = mode === 'tabletop' ? 0.12 : 1;
    this.ensureAnimation();
  }

  /** Rotate the first-person camera without changing player position or engine time. */
  rotatePov(degrees: number): void {
    if (this.spatialInventory.open || this.mode !== 'firstPerson' || !Number.isFinite(degrees)) return;
    if (degrees === 0) return;
    this.targetYaw = snapGridYaw(this.targetYaw - degrees * Math.PI / 180);
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
    if (kind === 'attack') {
      this.canvas.dataset.weaponAction = 'attack';
      this.weaponAttackStarted = now;
      this.animationUntil = Math.max(this.animationUntil, now + WEAPON_ATTACK_DURATION);
      this.ensureAnimation();
    }
    this.cameraActions.push({start:last ? Math.max(now,last.start+last.duration) : now,duration:kind==='hurt' ? 320 : 380,kind});
  }

  async setXrSession(session: XrSessionLike | null): Promise<void> {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.locomotion.reset(this.observation ? { x: this.observation.playerAt.x, z: this.observation.playerAt.y } : undefined);
    this.locomotionOverlay.reset();
    this.xrActive = session !== null;
    this.canvas.dataset.xrActive = String(this.xrActive);
    if (session) {
      // Phone/3DoF runtimes may support local tracking without local-floor tracking.
      this.renderer.xr.setReferenceSpaceType('local');
      this.renderer.xr.enabled = true;
      this.updateXrRig();
      this.camera.position.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.lastFrame = performance.now();
      await this.renderer.xr.setSession(session as XRSession);
      this.renderer.setAnimationLoop(this.onXrFrame);
    } else {
      // Three.js already tears down the native session in its own end listener.
      this.renderer.setAnimationLoop(null);
      this.renderer.xr.enabled = false;
      this.xrRig.position.set(0, 0, 0);
      this.xrRig.quaternion.identity();
      this.xrIntent.reset();
    }
    for (const controller of this.xrControllers) controller.visible = session !== null;
    this.spatialInventory.setImmersive(session !== null);
    this.resize(this.width, this.height);
    if (!session) { this.placeCamera(); this.ensureAnimation(); }
  }

  private updateXrRig(now = performance.now()): void {
    const observation = this.observation;
    if (!observation) return;
    if (this.mode === 'firstPerson') {
      const visual = this.locomotion.sample(now);
      this.xrRig.position.set(visual.x, .72, visual.z);
      this.xrRig.rotation.set(0, this.targetYaw - Math.PI, 0);
    } else {
      const target = new THREE.Vector3(
        (this.mode === 'tabletop' ? observation.width / 2 : observation.playerAt.x) * this.worldScale, 0,
        (this.mode === 'tabletop' ? observation.height / 2 : observation.playerAt.y) * this.worldScale);
      const horizontal = Math.cos(this.pitch) * this.distance;
      this.xrRig.position.set(target.x - Math.sin(this.yaw) * horizontal,
        1.2 - Math.sin(this.pitch) * this.distance, target.z - Math.cos(this.yaw) * horizontal);
      this.xrRig.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.xrRig.position, target, new THREE.Vector3(0, 1, 0)));
    }
    this.xrRig.updateMatrixWorld(true);
  }

  private readonly onXrFrame = (now: number): void => {
    this.animate(now);
    if (this.mode === 'firstPerson') this.locomotionOverlay.update(this.locomotion.sample(now));
    else this.locomotionOverlay.reset();
    this.renderer.xr.updateCamera(this.camera);
    this.spatialInventory.hover(this.xrControllers.filter(controller => controller.visible).map(controller =>
      new THREE.Raycaster(controller.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion())))));
    this.updateFirstPersonHand(now);
    this.deathPresentation.update((this.observation?.status.hp ?? 1) <= 0, this.scene, !this.spatialInventory.open);
    this.discoveryFeedback.update(now);
    this.hitFeedback.update(now, this.camera);
    this.world.traverse(object => { if (object.userData.faceCamera) object.quaternion.copy(this.camera.quaternion); });
    this.renderer.render(this.scene, this.camera);
  };

  private readonly animate = (now: number): void => {
    this.spatialStatus.tick(now);
    const elapsed = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.yaw = smoothToward(this.yaw, this.targetYaw, 14, elapsed);
    this.pitch = smoothToward(this.pitch, this.targetPitch, 14, elapsed);
    this.distance = smoothToward(this.distance, this.targetDistance, 12, elapsed);
    this.worldScale = smoothToward(this.worldScale, this.targetWorldScale, 12, elapsed);
    this.world.scale.setScalar(this.worldScale);
    for (const visual of this.actorVisuals) visual.mixer.update(elapsed);
    for (const mixer of this.monsterMixers) mixer.update(elapsed);
    for (const mixer of this.decorationMixers) mixer.update(elapsed);
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
    this.placeCamera(now);
    const moving = this.cameraActions.length>0 || this.doorVisuals.some(door => door.openedAt !== null && now < door.openedAt + 750) || [...this.corpses.values()].some(corpse => corpse.settlingUntil > 0) || Math.abs(this.yaw - this.targetYaw) > 0.0001 || Math.abs(this.pitch - this.targetPitch) > 0.0001 || Math.abs(this.distance - this.targetDistance) > 0.001 || Math.abs(this.worldScale - this.targetWorldScale) > 0.0001 || now < this.animationUntil;
    this.frame = !this.xrActive && moving ? requestAnimationFrame(this.animate) : null;
  };

  private placeCamera(now = performance.now()): void {
    const observation = this.observation;
    if (!observation) return;
    if (this.xrActive) { this.updateXrRig(now); return; }
    const player = observation.playerAt;
    if (this.mode === 'firstPerson') {
      const { bob, death } = this.updateFirstPersonHand(performance.now());
      this.camera.position.set(player.x, 0.72+bob-death*.60, player.y);
      const horizontal = Math.cos(this.pitch);
      this.camera.lookAt(player.x + Math.sin(this.yaw) * horizontal, 0.72 + Math.sin(this.pitch)+death*.72, player.y + Math.cos(this.yaw) * horizontal);
      this.camera.rotateZ(death*.42);
      if (death >= 1) this.canvas.dataset.playerDeath = 'grounded-looking-up';
    } else {
      const targetX = (this.mode === 'tabletop' ? observation.width / 2 : player.x) * this.worldScale;
      const targetZ = (this.mode === 'tabletop' ? observation.height / 2 : player.y) * this.worldScale;
      const horizontal = Math.cos(this.pitch) * this.distance;
      this.camera.position.set(targetX - Math.sin(this.yaw) * horizontal, 1.2 - Math.sin(this.pitch) * this.distance, targetZ - Math.cos(this.yaw) * horizontal);
      this.camera.lookAt(targetX, 0, targetZ);
    }
    this.deathPresentation.update((this.observation?.status.hp ?? 1) <= 0, this.scene, !this.spatialInventory.open);
    this.discoveryFeedback.root.scale.setScalar(this.worldScale);
    this.discoveryFeedback.update(performance.now());
    this.world.traverse(object => { if (object.userData.faceCamera) object.quaternion.copy(this.camera.quaternion); });
    this.hitFeedback.update(performance.now(), this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private updateFirstPersonHand(now: number): { bob: number; death: number } {
    this.hand.visible = this.mode === 'firstPerson' && !this.spatialInventory.open && (this.observation?.status.hp ?? 1) > 0;
    while (this.cameraActions[0] && performance.now()>=this.cameraActions[0].start+this.cameraActions[0].duration) this.cameraActions.shift();
    const action=this.cameraActions[0];const progress=action ? (performance.now()-action.start)/action.duration : 1;
    const pulse=action && progress>=0 && progress<1 ? Math.sin(Math.PI*progress) : 0;
    const bob=pulse*(action?.kind==='hurt' ? -.11 : action?.kind==='rest' ? .015 : action?.kind==='interact' ? -.025 : -.06);
    const death = deathFallProgress(this.deathStartedAt, performance.now());
    this.hand.position.set(.36-pulse*(action?.kind==='consume' ? .15 : 0)+death*.22,-.34+pulse*(action?.kind==='consume' ? .12 : 0)-death*.72,
      -.63-pulse*(action?.kind==='attack' ? .28 : action?.kind==='cast' ? .25 : action?.kind==='interact' ? .16 : action?.kind==='consume' ? -.17 : 0));
    this.hand.rotation.x=pulse*(action?.kind==='attack' ? -.95 : action?.kind==='cast' ? -.7 : action?.kind==='interact' ? -.42 : action?.kind==='consume' ? .4 : action?.kind==='hurt' ? .2 : 0)+death*.85;
    this.hand.rotation.y=pulse*(action?.kind==='attack' || action?.kind==='cast' ? -.35 : 0)+death*.4;
    this.hand.rotation.z = 0;
    const attackProgress = (now - this.weaponAttackStarted) / WEAPON_ATTACK_DURATION;
    if (attackProgress >= 0 && attackProgress < 1 && death === 0) {
      const pose = weaponAttackPose(attackProgress, this.equippedWeaponId);
      this.hand.position.set(pose.x, pose.y, pose.z);
      this.hand.rotation.set(pose.pitch, pose.yaw, pose.roll);
    }
    this.canvas.dataset.weaponPose = `${this.hand.position.x.toFixed(3)},${this.hand.position.y.toFixed(3)},${this.hand.position.z.toFixed(3)},${this.hand.rotation.z.toFixed(3)}`;
    return { bob, death };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.suppressClick = false;
    this.dragYawPixels = 0;
    this.dragging = true; this.pointerId = event.pointerId; this.canvas.setPointerCapture(event.pointerId);
  };
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.spatialInventory.open || !this.dragging || event.pointerId !== this.pointerId) return;
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 1) this.suppressClick = true;
    if (this.mode === 'firstPerson') {
      this.dragYawPixels += event.movementX;
      if (Math.abs(this.dragYawPixels) >= 40) {
        this.rotatePov(Math.sign(this.dragYawPixels) * 45);
        this.dragYawPixels = 0;
      }
    } else this.targetYaw -= event.movementX * 0.006;
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
    if (this.suppressClick) { this.suppressClick = false; return; }
    const uiBounds = this.canvas.getBoundingClientRect();
    const uiRay = new THREE.Raycaster(); uiRay.setFromCamera(new THREE.Vector2(
      (event.clientX - uiBounds.left) / uiBounds.width * 2 - 1, -((event.clientY - uiBounds.top) / uiBounds.height) * 2 + 1), this.camera);
    if (this.spatialStatus.select(uiRay)) return;
    if (this.spatialInventory.select(uiRay) || (this.observation?.status.hp ?? 1) <= 0) return;
    if (event.button === 0 && this.tryOpenChest(event.clientX, event.clientY)) return;
    if (event.button === 0 && this.mode === 'firstPerson' && this.observation) {
      const forward = this.movementDirectionForPov(true);
      const attack = frontMonsterAttackRequest(this.observation, forward.direction);
      if (attack) {
        this.canvas.dispatchEvent(new CustomEvent<ActionRequest>('rougexr-action', { detail: attack }));
        return;
      }
    }
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
  private tryOpenChest(clientX: number, clientY: number): boolean {
    if (this.mode !== 'firstPerson' || !this.observation) return false;
    const bounds = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((clientX - bounds.left) / bounds.width * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera);
    for (const hit of ray.intersectObjects(this.world.children, true)) {
      const data = inheritedUserData(hit.object);
      const token = data.chestToken;
      if (typeof token === 'string' && hit.distance < 2.5) {
        this.canvas.dispatchEvent(new CustomEvent<ActionRequest>('rougexr-action', {
          detail: { expectedRevision: this.observation.revision, action: { type: 'openChest', chestId: token } },
        }));
        return true;
      }
      if (data.occludes === true) break;
    }
    return false;
  }
  private readonly clearCapturedInput = (): void => {
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) this.canvas.releasePointerCapture(this.pointerId);
    this.dragging = false; this.pointerId = null;
  };
  private readonly onVisibilityChange = (): void => { if (document.hidden) this.clearCapturedInput(); };

  private ensureAnimation(): void {
    if (this.xrActive || this.frame !== null) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.animate);
  }

  private commitXrIntent(controller: THREE.Object3D, select: boolean): void {
    const observation = this.observation; if (!observation) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    if (select) {
      const uiRay = new THREE.Raycaster(controller.getWorldPosition(new THREE.Vector3()), forward.clone().normalize());
      if (this.spatialStatus.select(uiRay) || this.spatialInventory.select(uiRay)) return;
    }
    if (this.spatialInventory.open || observation.ending || observation.status.hp <= 0) return;
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

  get inventoryOpen(): boolean { return this.spatialInventory.open; }
  configureMenu(state: SpatialMenuState): void { this.spatialInventory.configure(state); this.ensureAnimation(); }
  toggleMenu(): void { this.spatialInventory.toggleMenu(); }
  showMessage(text: string): void {
    this.spatialInventory.recordMessage(text);
    if (this.observation) this.spatialStatus.update(this.observation, [{ type: 'message', text }]);
    this.canvas.dataset.spatialMessage = text; this.ensureAnimation();
  }
  toggleInventory(): void { this.spatialInventory.toggle(); }

  private clearWorld(): void {
    for (const visual of this.actorVisuals) visual.mixer.stopAllAction();
    this.actorVisuals = [];
    for (const mixer of this.monsterMixers) mixer.stopAllAction();
    this.monsterMixers = [];
    for (const mixer of this.decorationMixers) mixer.stopAllAction();
    this.decorationMixers = [];
    this.chestOpeners.clear();
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
      this.weaponMount.traverse(object => {
        object.renderOrder = 11;
        if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.depthTest = false; material.depthWrite = false;
        }
      });
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
  while (current) { if (current.userData.cell || current.userData.occludes === true) return current.userData as Record<string, unknown>; current = current.parent; }
  return {};
}

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse(descendant => {
    if (!(descendant instanceof THREE.Mesh)) return;
    descendant.geometry.dispose();
    const materials = Array.isArray(descendant.material) ? descendant.material : [descendant.material];
    for (const material of materials) { if (material.userData.ownedMap) (material as THREE.MeshBasicMaterial).map?.dispose(); material.dispose(); }
  });
}
