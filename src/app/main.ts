import { cellIndex } from '../engine/grid';
import { debugFixtureSnapshot, describeDebugCell, describeObservedCell } from '../engine/perception/fixture-observation';
import { observe } from '../engine/perception/knowledge';
import { validateWorld } from '../engine/validate';
import { GameSession } from '../engine/session';
import { CanvasGridView } from '../presentation/grid/canvas-view';
import type { GameView } from '../presentation/game-view';
import { ThreeGameView } from '../presentation/three/three-view';
import { XrSessionController, type XrSystemLike } from '../presentation/xr/session-controller';
import { bindDesktopInput } from '../input/desktop';
import type { PresentationEvent } from '../engine/model/action';
import type { GameAction } from '../engine/model/action';
import { parseSave, restoreGame, serializeSave } from '../persistence/save';
import { parseReplay, ReplayRecorder } from '../persistence/replay';
import { ReplayPlayer, type ReplayStepResult } from '../persistence/replay-player';
import { IndexedDbSaveStore, storeLatestSafely } from '../persistence/indexed-db-save-store';
import { createSelectedWorld, parseSeed, type WorldMode } from './world-selection';
import { filterEvents, type EventFilter } from './event-filter';

const initialWorld = createSelectedWorld('generated', 12345);
const issues = validateWorld(initialWorld);
if (issues.length) throw new Error(`Initial world validation failed: ${JSON.stringify(issues)}`);

const canvas = required<HTMLCanvasElement>('#dungeon');
const viewHost = required<HTMLElement>('#view-host');
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
let view: GameView = threeView;
const xrSystem = (navigator as Navigator & { xr?: XrSystemLike }).xr ?? null;
const xrController = new XrSessionController(xrSystem, session => threeView.setXrSession(session));
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

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function render(): void {
  const state = session.exportState();
  const observation = observe(state);
  const debugSnapshot = debugFixtureSnapshot(state);
  const detections = latestEvents.flatMap(event => event.type === 'magicDetected' ? event.positions.map(at => ({ at, glyph: '*' }))
    : event.type === 'itemsDetected' ? event.positions.map(at => ({ at, glyph: event.glyph })) : []);
  if (view === gridView) gridView.render(observation, reveal.checked ? debugSnapshot : null, detections);
  else view.update(observation, latestEvents);
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
}

canvas.addEventListener('click', event => {
  if (view !== gridView) return;
  const observation = observe(session.exportState());
  const bounds = canvas.getBoundingClientRect();
  const position = gridView.selectFromClient(event.clientX - bounds.left, event.clientY - bounds.top, observation);
  selectedIndex = position ? cellIndex(observation, position) : null;
  render();
});
viewMode.addEventListener('change', () => {
  view.dispose();
  view = viewMode.value === '2d' ? gridView : threeView;
  view.mount(viewHost);
  selectedIndex = null;
  render();
});
cameraMode.addEventListener('change', () => { threeView.setMode(cameraMode.value as 'firstPerson' | 'orbit' | 'tabletop'); render(); });
xrToggle.addEventListener('click', () => { void xrController.toggle().then(updateXrControls).catch(error => { xrStatus.textContent = `XR failed: ${error instanceof Error ? error.message : String(error)}`; }); });
threeView.canvas.addEventListener('rougexr-select-cell', event => {
  const position = (event as CustomEvent<{ x: number; y: number }>).detail;
  const observation = observe(session.exportState());
  selectedIndex = cellIndex(observation, position);
  render();
});
threeView.canvas.addEventListener('rougexr-xr-action', event => {
  const request = (event as CustomEvent<{ expectedRevision: number; action: GameAction }>).detail;
  if (replayPlayer) return;
  enqueue(request.action, request.expectedRevision);
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
newGame.addEventListener('click', () => {
  actionQueue = actionQueue.then(async () => {
    leaveReplayMode();
    const seed = parseSeed(seedInput.value);
    const mode = worldMode.value as WorldMode;
    const state = createSelectedWorld(mode, seed);
    const validation = validateWorld(state);
    if (validation.length) throw new Error(`New world validation failed: ${JSON.stringify(validation)}`);
    session = new GameSession(state); recorder = new ReplayRecorder(state); selectedIndex = null; latestEvents = []; resetDiagnostics();
    saveStatus.textContent = `Started ${mode} world with seed ${seed}.`; render();
    await autosave(state);
  }).catch(error => { saveStatus.textContent = error instanceof Error ? error.message : String(error); });
});
replayRestart.addEventListener('click', () => {
  pauseReplay();
  actionQueue = actionQueue.then(() => {
    if (!replayPlayer) return;
    session = replayPlayer.restart(); latestEvents = []; selectedIndex = null; resetDiagnostics();
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
bindDesktopInput(window, action => {
  if (replayPlayer) { replayStatus.textContent = 'Live input is locked during replay. Start a New Game to exit.'; return; }
  enqueue(action);
});
function submit(action: GameAction): void {
  if (replayPlayer) { replayStatus.textContent = 'Live input is locked during replay. Start a New Game to exit.'; return; }
  enqueue(action);
}
function enqueue(action: GameAction, capturedRevision?: number): void {
  actionQueue = actionQueue.then(async () => {
    const expectedRevision = capturedRevision ?? session.exportState().timing.revision;
    const started = performance.now();
    const resolution = session.submit({ expectedRevision, action }); latestEvents = resolution.events;
    if (capturedRevision !== undefined) xrStatus.textContent = resolution.status === 'rejected'
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
saveButton.addEventListener('click', () => download('rougexr-save.json', serializeSave(session.exportState())));
loadButton.addEventListener('click', () => loadFile.click());
loadFile.addEventListener('change', () => {
  const file = loadFile.files?.[0]; if (!file) return;
  actionQueue = actionQueue.then(async () => {
    const text = await file.text();
    const report = parseReplay(text);
    if (report.ok) {
      pauseReplay(); replayPlayer = new ReplayPlayer(report.value); session = replayPlayer.session();
      recorder = new ReplayRecorder(session.exportState()); selectedIndex = null; latestEvents = []; resetDiagnostics(); seedInput.value = String(session.exportState().seed);
      replayStatus.textContent = `Replay loaded · 0/${replayPlayer.total()}. Live input locked.`;
      saveStatus.textContent = 'Replay ready.'; render(); return;
    }
    const parsed = parseSave(text);
    if (!parsed.ok) { saveStatus.textContent = parsed.errors.map(error => `${error.path}: ${error.message}`).join('; '); return; }
    leaveReplayMode(); const candidate = restoreGame(parsed.value.state);
    session = candidate; recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = []; resetDiagnostics(); seedInput.value = String(candidate.exportState().seed);
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
function resetDiagnostics(): void { latestActionTiming = 'No action measured.'; replayDetails.textContent = 'No divergence.'; }
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
async function restoreLatestAutosave(): Promise<void> {
  try {
    const text = await saveStore.loadLatest();
    if (text === null) { saveStatus.textContent = 'No autosave found. Ready for manual save.'; return; }
    const parsed = parseSave(text);
    if (!parsed.ok) { saveStatus.textContent = `Autosave rejected: ${parsed.errors[0]?.message ?? 'invalid save'}. Started a new game.`; return; }
    const candidate = restoreGame(parsed.value.state);
    session = candidate; recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = []; resetDiagnostics();
    seedInput.value = String(candidate.exportState().seed);
    saveStatus.textContent = `Restored autosave at revision ${candidate.exportState().timing.revision}.`; render();
  } catch (error) {
    saveStatus.textContent = `Autosave unavailable: ${error instanceof Error ? error.message : String(error)} Manual save remains available.`;
  }
}
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
actionQueue = actionQueue.then(restoreLatestAutosave);

function updateXrControls(status: ReturnType<XrSessionController['status']>): void {
  xrToggle.disabled = status === 'checking' || status === 'unavailable';
  xrToggle.textContent = status === 'active' ? 'Exit XR' : status === 'available' ? 'Enter XR' : 'XR unavailable';
  xrStatus.textContent = status === 'active' ? 'Immersive session active.' : status === 'available' ? 'Immersive VR is available.' : 'Desktop mode is fully available; immersive VR is not supported here.';
}
