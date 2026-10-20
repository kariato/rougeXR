import { checkpointStamp, defaultCheckpointName } from '../persistence/checkpoint-name';
import { randomWorldSeed } from '../input/random-seed';
import { parseLocomotionPreferences } from '../presentation/xr/locomotion';
import type { SpatialMenuCommand } from '../presentation/three/spatial-inventory';
import { GameAudio } from '../presentation/audio/game-audio';
import { cellIndex } from '../engine/grid';
import { debugFixtureSnapshot, describeDebugCell, describeObservedCell } from '../engine/perception/fixture-observation';
import { observe } from '../engine/perception/knowledge';
import { validateWorld } from '../engine/validate';
import { GameSession } from '../engine/session';
import { CanvasGridView } from '../presentation/grid/canvas-view';
import type { GameView } from '../presentation/game-view';
import { ThreeGameView } from '../presentation/three/three-view';
import { frontMonsterAttackRequest } from '../presentation/three/camera-model';
import type { PlayerObservation } from '../engine/model/observation';
import { XrSessionController, type XrSystemLike } from '../presentation/xr/session-controller';
import { bindDesktopInput, bindPovArrowInput, bindViewTurnInput } from '../input/desktop';
import { bindVirtualJoystick } from '../input/virtual-joystick';
import { directionFromForward } from '../presentation/xr/input';
import type { PresentationEvent } from '../engine/model/action';
import type { GameAction } from '../engine/model/action';
import { parseSave, restoreGame, serializeSave } from '../persistence/save';
import { parseReplay, ReplayRecorder } from '../persistence/replay';
import { ReplayPlayer, type ReplayStepResult } from '../persistence/replay-player';
import { IndexedDbSaveStore, storeLatestSafely } from '../persistence/indexed-db-save-store';
import { createSelectedWorld, parseSeed, type WorldMode } from './world-selection';
import { filterEvents, type EventFilter } from './event-filter';

const welcome = document.querySelector<HTMLDialogElement>('#welcome')!;
welcome.addEventListener('cancel', event => event.preventDefault());
function closeWelcome(): void { if (welcome.open) { welcome.close(); required<HTMLElement>('h1').focus(); } }
const gameAudio = new GameAudio();
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-toggle')!;
const soundVolume = document.querySelector<HTMLInputElement>('#sound-volume')!;
function refreshAudioControls(): void {
  soundToggle.textContent = gameAudio.enabled ? 'Sound: On' : 'Sound: Off';
  soundToggle.setAttribute('aria-pressed', String(gameAudio.enabled)); soundVolume.value = String(Math.round(gameAudio.volume * 100));
}
refreshAudioControls();
soundToggle.addEventListener('click', () => { gameAudio.configure(!gameAudio.enabled); refreshAudioControls(); });
soundVolume.addEventListener('input', () => { gameAudio.configure(gameAudio.enabled, Number(soundVolume.value) / 100); refreshAudioControls(); });
window.addEventListener('pointerdown', () => { void gameAudio.unlock(); }, { passive: true });
window.addEventListener('keydown', () => { void gameAudio.unlock(); }, { passive: true });

const initialWorld = createSelectedWorld('generated', 12345);
const issues = validateWorld(initialWorld);
if (issues.length) throw new Error(`Initial world validation failed: ${JSON.stringify(issues)}`);

const canvas = required<HTMLCanvasElement>('#dungeon');
const viewHost = required<HTMLElement>('#view-host');
const toolsToggle = required<HTMLButtonElement>('#tools-toggle');
const toolsPanel = required<HTMLElement>('#tools-panel');
const hudHp = required<HTMLElement>('#hud-hp');
const hudDepth = required<HTMLElement>('#hud-depth');
const hudGold = required<HTMLElement>('#hud-gold');
const hudHunger = required<HTMLElement>('#hud-hunger');
const hudWeapon = required<HTMLElement>('#hud-weapon');
const hudMessage = required<HTMLElement>('#hud-message');
const crosshair = required<HTMLElement>('#crosshair');
const contextPrompt = required<HTMLElement>('#context-prompt');
const turnLeft = required<HTMLButtonElement>('#turn-left');
const turnRight = required<HTMLButtonElement>('#turn-right');
const movementStick = required<HTMLButtonElement>('#movement-stick');
const movementStickKnob = required<HTMLElement>('#movement-stick-knob');
const attackFront = required<HTMLButtonElement>('#attack-front');
const mobileSearch = required<HTMLButtonElement>('#mobile-search');
const turnAngle = required<HTMLSelectElement>('#turn-angle');
const viewMode = required<HTMLSelectElement>('#view-mode');
const cameraMode = required<HTMLSelectElement>('#camera-mode');
const xrToggle = required<HTMLButtonElement>('#xr-toggle');
const xrStatus = required<HTMLElement>('#xr-status');
const inspector = required<HTMLElement>('#inspector');
const reveal = required<HTMLInputElement>('#reveal');
const stateSummary = required<HTMLElement>('#state-summary');
const phaseTrace = required<HTMLElement>('#phase-trace');
const rest = required<HTMLButtonElement>('#rest');
const search = required<HTMLButtonElement>('#search');
const pickup = required<HTMLButtonElement>('#pickup');
const descend = required<HTMLButtonElement>('#descend');
const ascend = required<HTMLButtonElement>('#ascend');
const worldMode = required<HTMLSelectElement>('#world-mode');
const seedInput = required<HTMLInputElement>('#seed');
const newGame = required<HTMLButtonElement>('#new-game');
const replayRestart = required<HTMLButtonElement>('#replay-restart');
const replayStep = required<HTMLButtonElement>('#replay-step');
const replayPlay = required<HTMLButtonElement>('#replay-play');
const replayPause = required<HTMLButtonElement>('#replay-pause');
const replaySpeed = required<HTMLSelectElement>('#replay-speed');
const replayStatus = required<HTMLElement>('#replay-status');
const replayDetails = required<HTMLElement>('#replay-details');
const actionTiming = required<HTMLElement>('#action-timing');
const eventFilter = required<HTMLSelectElement>('#event-filter');
const messages = required<HTMLElement>('#messages');
const rawEvents = required<HTMLElement>('#raw-events');
const inventory = required<HTMLElement>('#inventory');
const saveButton = required<HTMLButtonElement>('#save');
const loadButton = required<HTMLButtonElement>('#load');
const exportReport = required<HTMLButtonElement>('#export-report');
const loadFile = required<HTMLInputElement>('#load-file');
const saveStatus = required<HTMLElement>('#save-status');
const gridView = new CanvasGridView(canvas);
const threeView = new ThreeGameView();
const LOCOMOTION_KEY = 'rougexr.locomotion.v1';
let locomotionSettings = parseLocomotionPreferences(null);
try { locomotionSettings = parseLocomotionPreferences(localStorage.getItem(LOCOMOTION_KEY)); } catch { /* Preferences remain usable without storage. */ }
threeView.configureLocomotion(locomotionSettings);
let view: GameView = threeView;
const xrSystem = (navigator as Navigator & { xr?: XrSystemLike }).xr ?? null;
const xrController = new XrSessionController(xrSystem, session => threeView.setXrSession(session), updateXrControls,
  error => checkpointMessage(`VR could not close cleanly: ${error instanceof Error ? error.message : String(error)}`));
required<HTMLButtonElement>('#ending-restart').addEventListener('click', () => newGame.click());
required<HTMLButtonElement>('#ending-load').addEventListener('click', () => {
  required<HTMLSelectElement>('#saved-games').value = required<HTMLSelectElement>('#ending-saves').value;
  required<HTMLButtonElement>('#restore-local').click();
});
const saveStore = new IndexedDbSaveStore();
let session = new GameSession(initialWorld);
let recorder = new ReplayRecorder(session.exportState());
let actionQueue = Promise.resolve();
let selectedIndex: number | null = null;
let latestEvents: PresentationEvent[] = [];
let replayPlayer: ReplayPlayer | null = null;
let replayPlaying = false;
let replayTimer: number | null = null;
let replaySchedule = 0;
let latestActionTiming = 'No action measured.';
let lastHudMessage = '';
const stopMovementStick = bindVirtualJoystick(movementStick, movementStickKnob, ({ horizontal, vertical, repeat }) => {
  if (view === threeView && cameraMode.value === 'firstPerson') {
    if (!repeat && Math.abs(horizontal) > .38) turnCamera(Math.sign(horizontal) * Number(turnAngle.value));
    if (Math.abs(vertical) > .38) submit(threeView.movementDirectionForPov(vertical > 0));
    return;
  }
  submit({ type: 'move', direction: directionFromForward(horizontal, -vertical), pickup: true });
});

function setToolsOpen(open: boolean): void {
  toolsPanel.hidden = !open;
  toolsToggle.setAttribute('aria-expanded', String(open));
  if (!open && toolsPanel.contains(document.activeElement)) required<HTMLElement>('.desktop-menu > summary').focus();
}

toolsToggle.addEventListener('click', () => { setToolsOpen(toolsPanel.hidden === true); toolsToggle.closest('details')?.removeAttribute('open'); });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !toolsPanel.hidden && xrController.status() !== 'active') {
    setToolsOpen(false);
    event.preventDefault();
  }
});

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function frontAttackRequest(observation: PlayerObservation) {
  if (view !== threeView || cameraMode.value !== 'firstPerson') return null;
  return frontMonsterAttackRequest(observation, threeView.movementDirectionForPov(true).direction);
}

function refreshAttackButton(observation: PlayerObservation = observe(session.exportState())): void {
  attackFront.hidden = view !== threeView || cameraMode.value !== 'firstPerson';
  const attacking = frontAttackRequest(observation) !== null;
  attackFront.textContent = attacking ? 'Attack' : 'Forward';
  attackFront.dataset.action = attacking ? 'attack' : 'move';
  attackFront.setAttribute('aria-label', attacking ? 'Attack monster in front' : 'Move forward');
  attackFront.disabled = attackFront.hidden || replayPlayer !== null || observation.pendingDecision !== null ||
    observation.status.hp <= 0 || observation.ending !== undefined || xrController.status() === 'active';
  mobileSearch.hidden = attackFront.hidden;
  mobileSearch.disabled = attackFront.disabled;
}

function render(): void {
  const state = session.exportState();
  const observation = observe(state);
  syncSpatialMenu();
  const endingPanel = required<HTMLElement>('#ending-panel');
  endingPanel.hidden = !observation.ending || view === threeView;
  if (observation.ending) {
    const ending = observation.ending;
    endingPanel.dataset.outcome = ending.outcome;
    required<HTMLElement>('#ending-title').textContent = ending.outcome === 'won' ? '★ VICTORY! ★' : 'DEAD';
    required<HTMLElement>('#ending-cause').textContent = ending.outcome === 'won' ? ending.cause : `Killed by: ${ending.cause}`;
    required<HTMLElement>('#ending-stats').textContent = `Depth reached: ${ending.depth} · Gold: ${ending.gold} · Experience: ${ending.experience} · Turns: ${ending.turns}`;
    required<HTMLElement>('#ending-score').textContent = `Score: ${ending.score} (gold + experience${ending.outcome === 'won' ? ' + 1,000 escape bonus' : ''})`;
    const choices = required<HTMLSelectElement>('#ending-saves');
    const previous = choices.value;
    choices.replaceChildren(...Array.from(required<HTMLSelectElement>('#saved-games').options, option => option.cloneNode(true)));
    if (Array.from(choices.options).some(option => option.value === previous)) choices.value = previous;
    required<HTMLButtonElement>('#ending-load').disabled = required<HTMLButtonElement>('#restore-local').disabled;
  }
  const discoveries = required<HTMLElement>('#discoveries');
  discoveries.replaceChildren(...(observation.discoveries ?? []).map(entry => {
    const row = document.createElement('p'); row.textContent = `${entry.name} — ${entry.appearance}`; return row;
  }));
  if (!discoveries.children.length) discoveries.textContent = 'No magic identified yet. Use or identify items to learn their properties.';
  const playedCues = gameAudio.update(observation, latestEvents);
  if (playedCues.length) document.body.dataset.soundCues = playedCues.join(',');
  if (observation.status.hp <= 0) setToolsOpen(false);
  const debugSnapshot = debugFixtureSnapshot(state);
  const detections = latestEvents.flatMap(event => event.type === 'magicDetected' ? event.positions.map(at => ({ at, glyph: '*' }))
    : event.type === 'itemsDetected' ? event.positions.map(at => ({ at, glyph: event.glyph })) : []);
  if (view === gridView) { threeView.rememberDoors(latestEvents, observation); threeView.rememberDefeats(latestEvents); gridView.render(observation, reveal.checked ? debugSnapshot : null, detections); }
  else view.update(observation, latestEvents);
  hudHp.textContent = `${observation.status.hp}/${observation.status.maxHp}`;
  hudDepth.textContent = String(observation.status.depth);
  hudGold.textContent = String(observation.status.gold);
  hudHunger.textContent = ['Fed', 'Hungry', 'Weak', 'Faint'][observation.status.hungerStage] ?? 'Unknown';
  const weapon = observation.inventory.find(item => item.equippedSlot === 'weapon');
  hudWeapon.textContent = weapon ? weapon.label : 'Unarmed';
  const newestMessage = latestEvents.filter(event => event.type === 'message').at(-1);
  if (latestEvents.some(event => event.type === 'levelViewReset')) {
    lastHudMessage = latestEvents.flatMap(event => event.type === 'message' ? [event.text] : []).join(' ');
  } else if (newestMessage?.type === 'message') lastHudMessage = newestMessage.text;
  hudMessage.textContent = lastHudMessage;
  required<HTMLElement>('.hud').hidden = view === threeView;
  hudMessage.hidden = view === threeView;
  viewHost.dataset.spatialOpen = String(threeView.inventoryOpen);
  viewHost.dataset.view = view === threeView ? '3d' : '2d';
  required<HTMLSelectElement>('#display-view').value = view === gridView ? 'map' : cameraMode.value;
  crosshair.hidden = view === gridView || cameraMode.value !== 'firstPerson';
  const currentCell = observation.cells[cellIndex(observation, observation.playerAt)];
  const currentFeature = currentCell?.visibility === 'visible' ? currentCell.appearance?.featureLabel : null;
  const currentItem = observation.entities.find(entity => entity.at.x === observation.playerAt.x && entity.at.y === observation.playerAt.y);
  const nearbyStairs = observation.cells.some((cell, index) => cell.visibility === 'visible'
    && cell.appearance?.featureLabel === 'stairs'
    && Math.hypot(index % observation.width - observation.playerAt.x, Math.floor(index / observation.width) - observation.playerAt.y) <= 2);
  const stairsUp = observation.inventory.some(item => item.category === 'amulet');
  contextPrompt.textContent = currentFeature === 'stairs' ? `Stairs ${stairsUp ? 'up' : 'down'}`
    : nearbyStairs ? `Spiral stairs ${stairsUp ? 'up — step onto them to ascend' : 'down — step onto them to descend'}`
    : currentItem ? `Pick up ${currentItem.label}` : '';
  const lines = selectedIndex === null
    ? ['Click a cell to inspect it.']
    : [...describeObservedCell(observation, selectedIndex), ...(reveal.checked ? describeDebugCell(debugSnapshot, selectedIndex) : [])];
  inspector.textContent = lines.join('\n');
  const hunger = ['Fed', 'Hungry', 'Weak', 'Faint'][state.timing.hungerStage] ?? 'Unknown';
  stateSummary.textContent = `HP ${state.player.stats.hp}/${state.player.stats.maxHp} · ${hunger} · Seed ${state.seed} · Tick ${state.timing.tick} · Revision ${state.timing.revision} · ${state.timing.status}`;
  phaseTrace.textContent = session.trace().map(entry => `[${entry.tick}] ${entry.kind}: ${entry.detail}`).join('\n') || 'Input ready.';
  const filter = eventFilter.value as EventFilter;
  messages.textContent = filterEvents(latestEvents, filter).map(event => event.type === 'message' ? event.text : event.type === 'visibleMovement' ? 'You move.' : event.type).join('\n') || 'No matching events.';
  const decisionPending = observation.pendingDecision !== null;
  refreshAttackButton(observation);
  movementStick.disabled = replayPlayer !== null || decisionPending || state.timing.status !== 'playing' || xrController.status() === 'active';
  if (movementStick.disabled) stopMovementStick();
  inventory.replaceChildren(...observation.inventory.map(item => {
    const row = document.createElement('div'); row.append(`${item.label} ×${item.quantity} `);
    if (item.category === 'weapon' || item.category === 'armor') {
      const equipment = document.createElement('button'); equipment.type = 'button'; equipment.textContent = item.equippedSlot ? 'Remove' : 'Equip';
      equipment.disabled = replayPlayer !== null || decisionPending; equipment.addEventListener('click', () => submit(item.equippedSlot
        ? { type: 'unequip', slot: item.equippedSlot as 'weapon' | 'armor' }
        : { type: 'equip', itemId: item.token, slot: item.category as 'weapon' | 'armor' })); row.append(equipment);
    }
    if (item.category === 'ring') {
      if (item.equippedSlot) { const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = replayPlayer !== null || decisionPending;
        remove.addEventListener('click', () => submit({ type: 'unequip', slot: item.equippedSlot as 'leftRing' | 'rightRing' })); row.append(remove); }
      else for (const [slot, text] of [['leftRing','Wear left'],['rightRing','Wear right']] as const) { const wear = document.createElement('button'); wear.type = 'button'; wear.textContent = text;
        wear.disabled = replayPlayer !== null || decisionPending; wear.addEventListener('click', () => submit({ type: 'equip', itemId: item.token, slot })); row.append(wear); }
    }
    if (item.category === 'weapon') {
      const direction = document.createElement('select'); direction.setAttribute('aria-label', 'Throw direction');
      for (const value of ['N','NE','E','SE','S','SW','W','NW'] as const) { const option=document.createElement('option'); option.value=value; option.textContent=value; direction.append(option); }
      direction.value='E'; direction.disabled=replayPlayer!==null||decisionPending;
      const throwButton=document.createElement('button'); throwButton.type='button'; throwButton.textContent='Throw'; throwButton.disabled=replayPlayer!==null||decisionPending;
      throwButton.addEventListener('click',()=>submit({type:'throw',itemId:item.token,direction:direction.value as 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'})); row.append(direction,throwButton);
    }
    if (item.category === 'stick') {
      const direction=document.createElement('select');direction.setAttribute('aria-label','Zap direction');
      for(const value of ['N','NE','E','SE','S','SW','W','NW'] as const){const option=document.createElement('option');option.value=value;option.textContent=value;direction.append(option);}direction.value='E';direction.disabled=replayPlayer!==null||decisionPending;
      const zap=document.createElement('button');zap.type='button';zap.textContent='Zap';zap.disabled=replayPlayer!==null||decisionPending;
      zap.addEventListener('click',()=>submit({type:'zap',itemId:item.token,direction:direction.value as 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW'}));row.append(direction,zap);
    }
    if (item.category === 'food') {
      const eat = document.createElement('button'); eat.type = 'button'; eat.textContent = 'Eat'; eat.disabled = replayPlayer !== null || decisionPending;
      eat.addEventListener('click', () => submit({ type: 'eat', itemId: item.token })); row.append(eat);
    }
    if (item.category === 'potion') {
      const drink = document.createElement('button'); drink.type = 'button'; drink.textContent = 'Drink'; drink.disabled = replayPlayer !== null || decisionPending;
      drink.addEventListener('click', () => submit({ type: 'drink', itemId: item.token })); row.append(drink);
    }
    if (item.category === 'scroll') {
      const read = document.createElement('button'); read.type = 'button'; read.textContent = 'Read'; read.disabled = replayPlayer !== null || decisionPending;
      read.addEventListener('click', () => submit({ type: 'read', itemId: item.token })); row.append(read);
    }
    const drop = document.createElement('button'); drop.type = 'button'; drop.textContent = 'Drop'; drop.disabled = replayPlayer !== null || decisionPending;
    if (item.category !== 'food' && item.category !== 'gold') { const call = document.createElement('button'); call.type = 'button'; call.textContent = 'Call'; call.disabled = replayPlayer !== null || decisionPending;
      call.addEventListener('click', () => { const label = window.prompt('What do you want to call it?', ''); if (label !== null) submit({ type: 'nameItem', itemId: item.token, label }); }); row.append(call); }
    if (state.pendingDecision?.kind === 'identifyItem' && state.pendingDecision.categories.some(category => category === item.category)) {
      const identify = document.createElement('button'); identify.type = 'button'; identify.textContent = 'Identify'; identify.disabled = replayPlayer !== null;
      identify.addEventListener('click', () => submit({ type: 'answerIdentify', itemId: item.token })); row.append(identify);
    }
    drop.addEventListener('click', () => submit({ type: 'drop', itemId: item.token })); row.append(drop); return row;
  }));
  if (!observation.inventory.length) inventory.textContent = 'Pack is empty.';
  if (state.pendingDecision?.kind === 'callItem') {
    const decision = document.createElement('div'); decision.append('What do you want to call it? ');
    const label = document.createElement('input'); label.type = 'text'; label.maxLength = 80; label.setAttribute('aria-label', 'Item call name');
    const answer = document.createElement('button'); answer.type = 'button'; answer.textContent = 'Call'; answer.disabled = replayPlayer !== null;
    answer.addEventListener('click', () => submit({ type: 'answerCall', label: label.value }));
    const skip = document.createElement('button'); skip.type = 'button'; skip.textContent = 'Skip'; skip.disabled = replayPlayer !== null;
    skip.addEventListener('click', () => submit({ type: 'answerCall', label: null })); decision.append(label, answer, skip); inventory.prepend(decision);
  }
  if (state.pendingDecision?.kind === 'identifyItem') {
    const decision = document.createElement('div'); decision.textContent = 'Choose an eligible carried item to identify.'; inventory.prepend(decision);
  }
  rawEvents.textContent = reveal.checked ? JSON.stringify(filterEvents(session.debugEvents(), filter), null, 2) : '';
  actionTiming.textContent = latestActionTiming;
  document.body.classList.toggle('debug-reveal', reveal.checked);
  const replayMode = replayPlayer !== null;
  for (const control of [rest, search, pickup, descend, ascend]) control.disabled = replayMode || decisionPending;
  replayRestart.disabled = !replayMode;
  replayStep.disabled = !replayMode || replayPlaying || !replayPlayer?.canStep();
  replayPlay.disabled = !replayMode || replayPlaying || !replayPlayer?.canStep();
  replayPause.disabled = !replayMode || !replayPlaying;
  replaySpeed.disabled = !replayMode;
  cameraMode.disabled = view === gridView;
  turnLeft.disabled = turnRight.disabled = view === gridView || cameraMode.value !== 'firstPerson';
}

function turnCamera(degrees: number): boolean {
  if (view !== threeView || cameraMode.value !== 'firstPerson' || xrController.status() === 'active') return false;
  threeView.rotatePov(degrees);
  refreshAttackButton();
  return true;
}

turnLeft.addEventListener('click', () => turnCamera(-Number(turnAngle.value)));
turnRight.addEventListener('click', () => turnCamera(Number(turnAngle.value)));
attackFront.addEventListener('click', () => {
  if (attackFront.disabled) return;
  const request = frontAttackRequest(observe(session.exportState()));
  if (request) enqueue(request.action, request.expectedRevision);
  else submit(threeView.movementDirectionForPov(true));
});
mobileSearch.addEventListener('click', () => { if (!mobileSearch.disabled) submit({ type: 'search' }); });
bindViewTurnInput(window, () => Number(turnAngle.value), turnCamera);
bindPovArrowInput(window, () => Number(turnAngle.value), turnCamera, forward => {
  if (view !== threeView || cameraMode.value !== 'firstPerson' || xrController.status() === 'active') return false;
  submit(threeView.movementDirectionForPov(forward)); return true;
});

canvas.addEventListener('click', event => {
  if (view !== gridView) return;
  const observation = observe(session.exportState());
  const bounds = canvas.getBoundingClientRect();
  const position = gridView.selectFromClient(event.clientX - bounds.left, event.clientY - bounds.top, observation);
  selectedIndex = position ? cellIndex(observation, position) : null;
  render();
});
required<HTMLSelectElement>('#display-view').addEventListener('change', event => {
  const value = (event.target as HTMLSelectElement).value;
  viewMode.value = value === 'map' ? '2d' : '3d';
  viewMode.dispatchEvent(new Event('change'));
  if (value !== 'map') { cameraMode.value = value; cameraMode.dispatchEvent(new Event('change')); }
});
viewMode.addEventListener('change', () => {
  stopMovementStick();
  view.dispose();
  view = viewMode.value === '2d' ? gridView : threeView;
  view.mount(viewHost);
  selectedIndex = null;
  render();
});
cameraMode.addEventListener('change', () => { stopMovementStick(); threeView.setMode(cameraMode.value as 'firstPerson' | 'orbit' | 'tabletop'); render(); });
xrToggle.addEventListener('click', () => {
  if (xrController.status() === 'available') {
    if (view !== threeView) { viewMode.value = '3d'; viewMode.dispatchEvent(new Event('change')); }
    cameraMode.value = 'firstPerson'; cameraMode.dispatchEvent(new Event('change'));
  }
  void xrController.toggle().catch(error => {
    const message = `Could not enter VR: ${error instanceof Error ? error.message : String(error)}`;
    xrStatus.textContent = message; checkpointMessage(message);
  });
});
threeView.canvas.addEventListener('rougexr-inventory-toggle', event => {
  const open = (event as CustomEvent<{ open: boolean }>).detail.open;
  viewHost.dataset.spatialOpen = String(open);
  if (open) { setToolsOpen(false); required<HTMLElement>('.desktop-menu').removeAttribute('open'); }
});
threeView.canvas.addEventListener('rougexr-select-cell', event => {
  const position = (event as CustomEvent<{ x: number; y: number }>).detail;
  const observation = observe(session.exportState());
  selectedIndex = cellIndex(observation, position);
  render();
});
threeView.canvas.addEventListener('rougexr-xr-action', event => {
  const request = (event as CustomEvent<{ expectedRevision: number; action: GameAction }>).detail;
  if (replayPlayer) return;
  enqueue(request.action, request.expectedRevision, 'xr');
});
threeView.canvas.addEventListener('rougexr-action', event => {
  const request = (event as CustomEvent<{ expectedRevision: number; action: GameAction }>).detail;
  if (replayPlayer) return;
  enqueue(request.action, request.expectedRevision, 'mouse');
});
reveal.addEventListener('change', render);
eventFilter.addEventListener('change', render);
rest.addEventListener('click', () => {
  submit({ type: 'rest' });
});
search.addEventListener('click', () => submit({ type: 'search' }));
pickup.addEventListener('click', () => submit({ type: 'pickup' }));
descend.addEventListener('click', () => submit({ type: 'descend' }));
ascend.addEventListener('click', () => submit({ type: 'ascend' }));
const restartConfirm = required<HTMLDialogElement>('#restart-confirm');
const restartSeed = required<HTMLInputElement>('#restart-seed');
const welcomeSeed = required<HTMLInputElement>('#welcome-seed');
for (const [id, input] of [['#welcome-random', welcomeSeed], ['#restart-random', restartSeed]] as const) {
  required<HTMLButtonElement>(id).addEventListener('click', () => { input.value = String(randomWorldSeed(Number(input.value))); });
}
restartConfirm.addEventListener('close', () => {
  if (restartConfirm.returnValue === 'restart') { seedInput.value = restartSeed.value; newGame.click(); }
});
newGame.addEventListener('click', event => {
  if (event.isTrusted && !welcome.open && !observe(session.exportState()).ending) {
    restartSeed.value = seedInput.value; restartConfirm.returnValue = ''; restartConfirm.showModal(); return;
  }
  actionQueue = actionQueue.then(async () => {
    leaveReplayMode();
    const seed = parseSeed(seedInput.value);
    const mode = worldMode.value as WorldMode;
    const state = createSelectedWorld(mode, seed);
    const validation = validateWorld(state);
    if (validation.length) throw new Error(`New world validation failed: ${JSON.stringify(validation)}`);
    session = new GameSession(state); threeView.resetPresentation(); recorder = new ReplayRecorder(state); selectedIndex = null; latestEvents = []; resetDiagnostics();
    resetSaveName(seed);
    closeWelcome();
    saveStatus.textContent = `Started ${mode} world with seed ${seed}.`; render();
    await autosave(state);
  }).catch(error => { saveStatus.textContent = error instanceof Error ? error.message : String(error); });
});
replayRestart.addEventListener('click', () => {
  pauseReplay();
  actionQueue = actionQueue.then(() => {
    if (!replayPlayer) return;
    session = replayPlayer.restart(); threeView.resetPresentation(); latestEvents = []; selectedIndex = null; resetDiagnostics();
    replayStatus.textContent = `Replay restarted · 0/${replayPlayer.total()}.`; render();
  });
});
replayStep.addEventListener('click', () => { pauseReplay(); queueReplayStep(false); });
replayPlay.addEventListener('click', () => {
  if (!replayPlayer?.canStep()) return;
  replayPlaying = true; replayStatus.textContent = `Playing · ${replayPlayer.index()}/${replayPlayer.total()}.`; render(); queueReplayStep(true);
});
replayPause.addEventListener('click', pauseReplay);
replaySpeed.addEventListener('change', () => {
  if (!replayPlaying) return;
  scheduleReplayStep();
});
window.addEventListener('keydown', event => {
  if (!welcome.open && event.key.toLowerCase() === 'm' && !event.repeat && view === threeView
    && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) {
    event.preventDefault(); threeView.toggleMenu();
  }
  if (!welcome.open && event.key.toLowerCase() === 'i' && !event.repeat && view === threeView
    && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) {
    event.preventDefault(); threeView.toggleInventory();
  }
  if (event.key === 'Escape' && threeView.inventoryOpen) { event.preventDefault(); threeView.closeSpatialMenu(); }
});
bindDesktopInput(window, action => {
  if (threeView.inventoryOpen) return;
  if (replayPlayer) { replayStatus.textContent = 'Live input is locked during replay. Start a New Game to exit.'; return; }
  enqueue(action);
});
function submit(action: GameAction): void {
  if (replayPlayer) { replayStatus.textContent = 'Live input is locked during replay. Start a New Game to exit.'; return; }
  enqueue(action);
}
function enqueue(action: GameAction, capturedRevision?: number, source?: 'xr' | 'mouse'): void {
  actionQueue = actionQueue.then(async () => {
    if (welcome.open) return;
    if (threeView.inventoryOpen && ['move', 'rest', 'search', 'pickup', 'descend', 'ascend'].includes(action.type)) return;
    const expectedRevision = capturedRevision ?? session.exportState().timing.revision;
    const started = performance.now();
    const resolution = session.submit({ expectedRevision, action }); latestEvents = resolution.events;
    if (source === 'xr') xrStatus.textContent = resolution.status === 'rejected'
      ? `XR action rejected: ${resolution.reason ?? 'blocked'}.` : `XR action committed at revision ${resolution.revision}.`;
    const engineMs = performance.now() - started;
    const snapshot = session.exportState();
    await recorder.record(action, expectedRevision, snapshot);
    saveStatus.textContent = `Recorded revision ${snapshot.timing.revision}.`; await autosave(snapshot);
    const persistenceMs = performance.now() - started - engineMs;
    latestActionTiming = `${describeAction(action)} · engine ${formatMs(engineMs)} · record/autosave ${formatMs(persistenceMs)} · tick +${resolution.ticksAdvanced}`;
    render();
  }).catch(error => { saveStatus.textContent = error instanceof Error ? error.message : String(error); });
}
const MANUAL_SAVE_KEY = 'rougexr.manual-save.v1';
const NAMED_SAVES_KEY = 'rougexr.named-saves.v1';
const saveNameInput = required<HTMLInputElement>('#save-name');
let customSaveName = false;
let saveFeedback = '';
let savePending = false;
function resetSaveName(seed: number): void {
  customSaveName = false; saveNameInput.value = defaultCheckpointName(seed); saveFeedback = '';
  required<HTMLElement>('#checkpoint-feedback').textContent = '';
}
resetSaveName(session.exportState().seed);
saveNameInput.addEventListener('input', () => { customSaveName = saveNameInput.value.trim() !== ''; });
const savedGames = required<HTMLSelectElement>('#saved-games');
interface NamedCheckpoint { name: string; json: string }
function readNamedCheckpoints(): NamedCheckpoint[] {
  const text = localStorage.getItem(NAMED_SAVES_KEY);
  if (text === null) return [];
  const entries: unknown = JSON.parse(text);
  if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry.name !== 'string' || typeof entry.json !== 'string'))
    throw new Error('Saved game list is invalid.');
  return entries;
}
function refreshSavedGames(selected?: string): void {
  const entries = readNamedCheckpoints();
  savedGames.replaceChildren(...entries.map(entry => {
    const option = document.createElement('option'); option.value = entry.name; option.textContent = entry.name; return option;
  }));
  if (localStorage.getItem(MANUAL_SAVE_KEY) !== null) {
    const legacy = document.createElement('option'); legacy.value = ''; legacy.textContent = 'Previous checkpoint'; savedGames.append(legacy);
  }
  if (!savedGames.options.length) {
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'No saved games'; savedGames.append(empty);
  }
  if (selected !== undefined) savedGames.value = selected;
}
try { refreshSavedGames(); } catch { /* Storage errors are reported on Save or Load. */ }
savedGames.addEventListener('change', () => { if (savedGames.value) { saveNameInput.value = savedGames.value; customSaveName = true; } });
function syncSpatialMenu(): void {
  let names: string[] = [];
  try { names = readNamedCheckpoints().map(entry => entry.name); if (localStorage.getItem(MANUAL_SAVE_KEY) !== null) names.push(''); } catch { /* Save controls report storage failures. */ }
  threeView.configureMenu({ names, saveName: saveNameInput.value.trim() || defaultCheckpointName(session.exportState().seed), saveStatus: saveFeedback, saving: savePending, seed: session.exportState().seed, sound: gameAudio.enabled, volume: gameAudio.volume, ...locomotionSettings });
}
threeView.canvas.addEventListener('rougexr-menu-command', event => {
  const command = (event as CustomEvent<SpatialMenuCommand>).detail;
  void gameAudio.unlock();
  if (command.type === 'movement' || command.type === 'vignette') {
    if (command.type === 'movement') locomotionSettings.movement = command.value;
    else locomotionSettings.vignette = command.value;
    threeView.configureLocomotion(locomotionSettings);
    try { localStorage.setItem(LOCOMOTION_KEY, JSON.stringify(locomotionSettings)); } catch { /* Keep the current session's settings. */ }
    syncSpatialMenu();
  }
  if (command.type === 'exitXR') { void xrController.toggle().then(updateXrControls); }
  if (command.type === 'name') { saveNameInput.value = command.name; customSaveName = true; syncSpatialMenu(); }
  if (command.type === 'save') required<HTMLButtonElement>('#save-local').click();
  if (command.type === 'load') { refreshSavedGames(command.name); required<HTMLButtonElement>('#restore-local').click(); }
  if (command.type === 'restart') { if (command.seed !== undefined) seedInput.value = String(command.seed); newGame.click(); }
  if (command.type === 'sound') { soundToggle.click(); syncSpatialMenu(); }
  if (command.type === 'volume') { gameAudio.configure(gameAudio.enabled, command.value); refreshAudioControls(); syncSpatialMenu(); }
  if (command.type === 'map') {
    cameraMode.value = cameraMode.value === 'tabletop' ? 'firstPerson' : 'tabletop';
    cameraMode.dispatchEvent(new Event('change')); threeView.closeSpatialMenu();
  }
});
function checkpointMessage(text: string): void {
  lastHudMessage = text; hudMessage.textContent = text; saveStatus.textContent = text;
  threeView.showMessage(text); syncSpatialMenu();
}
required<HTMLButtonElement>('#save-local').addEventListener('click', () => {
  if (savePending) return;
  savePending = true; saveFeedback = 'Saving…';
  required<HTMLButtonElement>('#save-local').disabled = true;
  required<HTMLElement>('#checkpoint-feedback').textContent = saveFeedback; syncSpatialMenu();
  actionQueue = actionQueue.then(() => {
    const state = session.exportState();
    const now = new Date();
    const name = customSaveName && saveNameInput.value.trim() ? saveNameInput.value.trim() : defaultCheckpointName(state.seed, now);
    const entries = readNamedCheckpoints().filter(entry => entry.name !== name);
    entries.unshift({ name, json: serializeSave(state) });
    localStorage.setItem(NAMED_SAVES_KEY, JSON.stringify(entries));
    saveNameInput.value = name; refreshSavedGames(name);
    saveFeedback = `Saved ${checkpointStamp(now)} · seed ${state.seed}`;
    checkpointMessage(`Game saved in this browser as “${name}” at level ${state.level.depth}.`);
  }).catch(error => {
    saveFeedback = 'Save failed — see Messages for details.';
    checkpointMessage(`Could not save game: ${error instanceof Error ? error.message : String(error)}`);
  }).finally(() => {
    savePending = false; required<HTMLButtonElement>('#save-local').disabled = false;
    required<HTMLElement>('#checkpoint-feedback').textContent = saveFeedback; syncSpatialMenu();
  });
});
required<HTMLButtonElement>('#restore-local').addEventListener('click', () => {
  stopMovementStick();
  actionQueue = actionQueue.then(async () => {
    const name = savedGames.value;
    const text = name ? readNamedCheckpoints().find(entry => entry.name === name)?.json ?? null : localStorage.getItem(MANUAL_SAVE_KEY);
    if (text === null) { checkpointMessage('No saved checkpoint in this browser. Use Save Game first.'); return; }
    const parsed = parseSave(text);
    if (!parsed.ok) { checkpointMessage('The saved checkpoint is invalid or incompatible. Your current game was kept.'); return; }
    const candidate = restoreGame(parsed.value.state);
    leaveReplayMode(); session = candidate; threeView.resetPresentation();
    recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = [];
    resetDiagnostics(); seedInput.value = String(candidate.exportState().seed);
    if (name) { saveNameInput.value = name; customSaveName = true; } else resetSaveName(candidate.exportState().seed);
    render(); await autosave(candidate.exportState());
    checkpointMessage(`Restarted from your saved game${name ? ` “${name}”` : ''} on level ${candidate.exportState().level.depth}.`);
  }).catch(error => checkpointMessage(`Could not load saved game: ${error instanceof Error ? error.message : String(error)}`));
});

saveButton.addEventListener('click', () => download('rougexr-save.json', serializeSave(session.exportState())));
loadButton.addEventListener('click', () => loadFile.click());
loadFile.addEventListener('change', () => {
  const file = loadFile.files?.[0]; if (!file) return;
  actionQueue = actionQueue.then(async () => {
    const text = await file.text();
    const report = parseReplay(text);
    if (report.ok) {
      pauseReplay(); replayPlayer = new ReplayPlayer(report.value); session = replayPlayer.session(); threeView.resetPresentation();
      recorder = new ReplayRecorder(session.exportState()); selectedIndex = null; latestEvents = []; resetDiagnostics(); seedInput.value = String(session.exportState().seed);
      replayStatus.textContent = `Replay loaded · 0/${replayPlayer.total()}. Live input locked.`;
      saveStatus.textContent = 'Replay ready.'; render(); return;
    }
    const parsed = parseSave(text);
    if (!parsed.ok) { saveStatus.textContent = parsed.errors.map(error => `${error.path}: ${error.message}`).join('; '); return; }
    leaveReplayMode(); const candidate = restoreGame(parsed.value.state);
    session = candidate; threeView.resetPresentation(); recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = []; resetDiagnostics(); seedInput.value = String(candidate.exportState().seed);
    saveStatus.textContent = `Loaded revision ${candidate.exportState().timing.revision}.`; render(); await autosave(candidate.exportState());
  }).catch(error => { saveStatus.textContent = error instanceof Error ? error.message : String(error); })
    .finally(() => { loadFile.value = ''; });
});
exportReport.addEventListener('click', () => {
  actionQueue = actionQueue.then(() => download('rougexr-bug-report.json', JSON.stringify(recorder.bundle(), null, 2)));
});
function queueReplayStep(continuePlaying: boolean): void {
  replayTimer = null;
  actionQueue = actionQueue.then(async () => {
    const player = replayPlayer;
    if (!player?.canStep()) { pauseReplay(); render(); return; }
    const started = performance.now(); const result = await player.step(); const elapsed = performance.now() - started;
    session = player.session(); latestEvents = result.resolution.events;
    latestActionTiming = `Replay action ${result.index + (result.status === 'diverged' ? 1 : 0)}/${result.total} · submit/hash ${formatMs(elapsed)} · tick +${result.resolution.ticksAdvanced}`;
    updateReplayStatus(result); render();
    if (continuePlaying && replayPlaying && result.status === 'advanced') scheduleReplayStep();
    else if (result.status !== 'advanced') pauseReplay();
  }).catch(error => { pauseReplay(); replayStatus.textContent = error instanceof Error ? error.message : String(error); render(); });
}
function updateReplayStatus(result: ReplayStepResult): void {
  if (result.status === 'diverged') {
    replayStatus.textContent = `Replay diverged at action ${result.index + 1}/${result.total}.`;
    replayDetails.textContent = `Action: ${JSON.stringify(result.action)}\nExpected hash: ${result.expectedHash}\nActual hash:   ${result.actualHash}`;
  } else if (result.status === 'complete') replayStatus.textContent = `Replay complete · ${result.index}/${result.total}.`;
  else replayStatus.textContent = `${replayPlaying ? 'Playing' : 'Paused'} · ${result.index}/${result.total}.`;
}
function replayDelay(): number { return 500 / Number(replaySpeed.value); }
function scheduleReplayStep(): void {
  const schedule = ++replaySchedule;
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  replayTimer = window.setTimeout(() => { if (schedule === replaySchedule) queueReplayStep(true); }, replayDelay());
}
function pauseReplay(): void {
  replayPlaying = false; replaySchedule++;
  if (replayTimer !== null) { window.clearTimeout(replayTimer); replayTimer = null; }
  if (replayPlayer?.canStep()) replayStatus.textContent = `Paused · ${replayPlayer.index()}/${replayPlayer.total()}.`;
  render();
}
function leaveReplayMode(): void {
  pauseReplay(); replayPlayer = null; replayStatus.textContent = 'Live input enabled.';
}
function resetDiagnostics(): void { gameAudio.reset(); latestActionTiming = 'No action measured.'; replayDetails.textContent = 'No divergence.'; lastHudMessage = ''; }
function describeAction(action: GameAction): string {
  if (action.type === 'move') return `move ${action.direction}`;
  if ('itemId' in action) return `${action.type} ${action.itemId}`;
  return action.type;
}
function formatMs(value: number): string { return `${value.toFixed(2)} ms`; }
function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  saveStatus.textContent = `Downloaded ${filename}.`;
}
async function autosave(state: ReturnType<GameSession['exportState']>): Promise<void> {
  const result = await storeLatestSafely(saveStore, serializeSave(state));
  if (!result.ok) saveStatus.textContent = `Autosave unavailable: ${result.error} Manual save remains available.`;
}
interface WelcomeCheckpoint { name: string; json: string }
const welcomeCheckpoints: WelcomeCheckpoint[] = [];
async function prepareWelcome(): Promise<void> {
  const status = required<HTMLElement>('#welcome-status');
  const problems: string[] = [];
  try {
    welcomeCheckpoints.push(...readNamedCheckpoints());
    const legacy = localStorage.getItem(MANUAL_SAVE_KEY);
    if (legacy !== null) welcomeCheckpoints.push({ name: 'Previous checkpoint', json: legacy });
  } catch { problems.push('Named saves could not be read.'); }
  try {
    const json = await saveStore.loadLatest();
    if (json !== null) welcomeCheckpoints.push({ name: 'Latest autosave', json });
  } catch { problems.push('Autosave storage is unavailable.'); }
  const choices = required<HTMLSelectElement>('#welcome-saves');
  choices.replaceChildren(...welcomeCheckpoints.map((entry, index) => {
    const option = document.createElement('option'); option.value = String(index); option.textContent = entry.name; return option;
  }));
  choices.disabled = welcomeCheckpoints.length === 0;
  required<HTMLButtonElement>('#welcome-load').disabled = choices.disabled;
  if (choices.disabled) choices.add(new Option('No saved games in this browser', ''));
  status.textContent = [welcomeCheckpoints.length ? 'Choose a saved adventure, or start a new one.' : 'Your first adventure awaits. Start a new game.', ...problems].join(' ');
}
required<HTMLButtonElement>('#welcome-new').addEventListener('click', () => {
  if (!welcomeSeed.reportValidity()) return;
  seedInput.value = welcomeSeed.value; worldMode.value = 'generated'; newGame.click();
});
required<HTMLButtonElement>('#welcome-load').addEventListener('click', () => {
  actionQueue = actionQueue.then(() => {
    const checkpoint = welcomeCheckpoints[Number(required<HTMLSelectElement>('#welcome-saves').value)];
    if (!checkpoint) return;
    const parsed = parseSave(checkpoint.json);
    if (!parsed.ok) { required<HTMLElement>('#welcome-status').textContent = 'This saved game is invalid or incompatible. Choose another save or start a new game.'; return; }
    const candidate = restoreGame(parsed.value.state);
    leaveReplayMode(); session = candidate; threeView.resetPresentation();
    recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = []; resetDiagnostics();
    seedInput.value = String(candidate.exportState().seed);
    resetSaveName(session.exportState().seed);
    try { if (readNamedCheckpoints().some(entry => entry.name === checkpoint.name)) { saveNameInput.value = checkpoint.name; customSaveName = true; refreshSavedGames(checkpoint.name); } } catch { /* An autosave can still load when named-save storage is unavailable. */ }
    closeWelcome(); render(); checkpointMessage(`Loaded “${checkpoint.name}” on level ${candidate.exportState().level.depth}.`);
  }).catch(error => { required<HTMLElement>('#welcome-status').textContent = `Could not load this adventure: ${error instanceof Error ? error.message : String(error)}`; });
});
let resizeFrame: number | null = null;
new ResizeObserver(entries => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  const bounds = entries[0]?.contentRect;
  if (bounds) view.resize(bounds.width, bounds.height);
  resizeFrame = requestAnimationFrame(() => { resizeFrame = null; render(); });
}).observe(viewHost);
view.mount(viewHost);
render();
void xrController.detect().then(updateXrControls);
welcome.showModal();
actionQueue = actionQueue.then(prepareWelcome);

function updateXrControls(status: ReturnType<XrSessionController['status']>): void {
  if (status === 'active') { setToolsOpen(false); movementStick.disabled = true; stopMovementStick(); }
  refreshAttackButton();
  xrToggle.disabled = status === 'checking' || status === 'unavailable';
  xrToggle.textContent = status === 'active' ? 'Exit XR' : status === 'available' ? 'Enter XR' : 'XR unavailable';
  xrStatus.textContent = status === 'active' ? 'Immersive session active.' : status === 'available' ? 'Immersive VR is available.' : 'Desktop mode is fully available; immersive VR is not supported here.';
}
