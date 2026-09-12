import { cellIndex } from '../engine/grid';
import { debugFixtureSnapshot, describeDebugCell, describeObservedCell } from '../engine/perception/fixture-observation';
import { observe } from '../engine/perception/knowledge';
import { validateWorld } from '../engine/validate';
import { GameSession } from '../engine/session';
import { CanvasGridView } from '../presentation/grid/canvas-view';
import { bindDesktopInput } from '../input/desktop';
import type { PresentationEvent } from '../engine/model/action';
import type { GameAction } from '../engine/model/action';
import { parseSave, restoreGame, serializeSave } from '../persistence/save';
import { parseReplay, ReplayRecorder } from '../persistence/replay';
import { ReplayPlayer, type ReplayStepResult } from '../persistence/replay-player';
import { IndexedDbSaveStore, storeLatestSafely } from '../persistence/indexed-db-save-store';
import { createSelectedWorld, parseSeed, type WorldMode } from './world-selection';

const initialWorld = createSelectedWorld('generated', 12345);
const issues = validateWorld(initialWorld);
if (issues.length) throw new Error(`Initial world validation failed: ${JSON.stringify(issues)}`);

const canvas = required<HTMLCanvasElement>('#dungeon');
const inspector = required<HTMLElement>('#inspector');
const reveal = required<HTMLInputElement>('#reveal');
const stateSummary = required<HTMLElement>('#state-summary');
const phaseTrace = required<HTMLElement>('#phase-trace');
const rest = required<HTMLButtonElement>('#rest');
const search = required<HTMLButtonElement>('#search');
const pickup = required<HTMLButtonElement>('#pickup');
const descend = required<HTMLButtonElement>('#descend');
const worldMode = required<HTMLSelectElement>('#world-mode');
const seedInput = required<HTMLInputElement>('#seed');
const newGame = required<HTMLButtonElement>('#new-game');
const replayRestart = required<HTMLButtonElement>('#replay-restart');
const replayStep = required<HTMLButtonElement>('#replay-step');
const replayPlay = required<HTMLButtonElement>('#replay-play');
const replayPause = required<HTMLButtonElement>('#replay-pause');
const replaySpeed = required<HTMLSelectElement>('#replay-speed');
const replayStatus = required<HTMLElement>('#replay-status');
const messages = required<HTMLElement>('#messages');
const rawEvents = required<HTMLElement>('#raw-events');
const inventory = required<HTMLElement>('#inventory');
const saveButton = required<HTMLButtonElement>('#save');
const loadButton = required<HTMLButtonElement>('#load');
const exportReport = required<HTMLButtonElement>('#export-report');
const loadFile = required<HTMLInputElement>('#load-file');
const saveStatus = required<HTMLElement>('#save-status');
const view = new CanvasGridView(canvas);
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

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function render(): void {
  const state = session.exportState();
  const observation = observe(state);
  const debugSnapshot = debugFixtureSnapshot(state);
  view.render(observation, reveal.checked ? debugSnapshot : null);
  const lines = selectedIndex === null
    ? ['Click a cell to inspect it.']
    : [...describeObservedCell(observation, selectedIndex), ...(reveal.checked ? describeDebugCell(debugSnapshot, selectedIndex) : [])];
  inspector.textContent = lines.join('\n');
  const hunger = ['Fed', 'Hungry', 'Weak', 'Faint'][state.timing.hungerStage] ?? 'Unknown';
  stateSummary.textContent = `HP ${state.player.stats.hp}/${state.player.stats.maxHp} · ${hunger} · Seed ${state.seed} · Tick ${state.timing.tick} · Revision ${state.timing.revision} · ${state.timing.status}`;
  phaseTrace.textContent = session.trace().map(entry => `[${entry.tick}] ${entry.kind}: ${entry.detail}`).join('\n') || 'Input ready.';
  messages.textContent = latestEvents.map(event => event.type === 'message' ? event.text : event.type === 'visibleMovement' ? 'You move.' : event.type).join('\n') || 'No messages.';
  inventory.replaceChildren(...observation.inventory.map(item => {
    const row = document.createElement('div'); row.append(`${item.label} ×${item.quantity} `);
    if (item.category === 'weapon' || item.category === 'armor') {
      const equipment = document.createElement('button'); equipment.type = 'button'; equipment.textContent = item.equippedSlot ? 'Remove' : 'Equip';
      equipment.disabled = replayPlayer !== null; equipment.addEventListener('click', () => submit(item.equippedSlot
        ? { type: 'unequip', slot: item.equippedSlot as 'weapon' | 'armor' }
        : { type: 'equip', itemId: item.token, slot: item.category as 'weapon' | 'armor' })); row.append(equipment);
    }
    if (item.category === 'food') {
      const eat = document.createElement('button'); eat.type = 'button'; eat.textContent = 'Eat'; eat.disabled = replayPlayer !== null;
      eat.addEventListener('click', () => submit({ type: 'eat', itemId: item.token })); row.append(eat);
    }
    const drop = document.createElement('button'); drop.type = 'button'; drop.textContent = 'Drop'; drop.disabled = replayPlayer !== null;
    drop.addEventListener('click', () => submit({ type: 'drop', itemId: item.token })); row.append(drop); return row;
  }));
  if (!observation.inventory.length) inventory.textContent = 'Pack is empty.';
  rawEvents.textContent = reveal.checked ? JSON.stringify(session.debugEvents(), null, 2) : '';
  document.body.classList.toggle('debug-reveal', reveal.checked);
  const replayMode = replayPlayer !== null;
  for (const control of [rest, search, pickup, descend]) control.disabled = replayMode;
  replayRestart.disabled = !replayMode;
  replayStep.disabled = !replayMode || replayPlaying || !replayPlayer?.canStep();
  replayPlay.disabled = !replayMode || replayPlaying || !replayPlayer?.canStep();
  replayPause.disabled = !replayMode || !replayPlaying;
  replaySpeed.disabled = !replayMode;
}

canvas.addEventListener('click', event => {
  const observation = observe(session.exportState());
  const bounds = canvas.getBoundingClientRect();
  const position = view.selectFromClient(event.clientX - bounds.left, event.clientY - bounds.top, observation);
  selectedIndex = position ? cellIndex(observation, position) : null;
  render();
});
reveal.addEventListener('change', render);
rest.addEventListener('click', () => {
  submit({ type: 'rest' });
});
search.addEventListener('click', () => submit({ type: 'search' }));
pickup.addEventListener('click', () => submit({ type: 'pickup' }));
descend.addEventListener('click', () => submit({ type: 'descend' }));
newGame.addEventListener('click', () => {
  actionQueue = actionQueue.then(async () => {
    leaveReplayMode();
    const seed = parseSeed(seedInput.value);
    const mode = worldMode.value as WorldMode;
    const state = createSelectedWorld(mode, seed);
    const validation = validateWorld(state);
    if (validation.length) throw new Error(`New world validation failed: ${JSON.stringify(validation)}`);
    session = new GameSession(state); recorder = new ReplayRecorder(state); selectedIndex = null; latestEvents = [];
    saveStatus.textContent = `Started ${mode} world with seed ${seed}.`; render();
    await autosave(state);
  }).catch(error => { saveStatus.textContent = error instanceof Error ? error.message : String(error); });
});
replayRestart.addEventListener('click', () => {
  pauseReplay();
  actionQueue = actionQueue.then(() => {
    if (!replayPlayer) return;
    session = replayPlayer.restart(); latestEvents = []; selectedIndex = null;
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
function enqueue(action: GameAction): void {
  actionQueue = actionQueue.then(async () => {
    const expectedRevision = session.exportState().timing.revision;
    latestEvents = session.submit({ expectedRevision, action }).events;
    const snapshot = session.exportState();
    await recorder.record(action, expectedRevision, snapshot);
    saveStatus.textContent = `Recorded revision ${snapshot.timing.revision}.`; await autosave(snapshot);
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
      recorder = new ReplayRecorder(session.exportState()); selectedIndex = null; latestEvents = []; seedInput.value = String(session.exportState().seed);
      replayStatus.textContent = `Replay loaded · 0/${replayPlayer.total()}. Live input locked.`;
      saveStatus.textContent = 'Replay ready.'; render(); return;
    }
    const parsed = parseSave(text);
    if (!parsed.ok) { saveStatus.textContent = parsed.errors.map(error => `${error.path}: ${error.message}`).join('; '); return; }
    leaveReplayMode(); const candidate = restoreGame(parsed.value.state);
    session = candidate; recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = []; seedInput.value = String(candidate.exportState().seed);
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
    const result = await player.step(); session = player.session(); latestEvents = result.resolution.events;
    updateReplayStatus(result); render();
    if (continuePlaying && replayPlaying && result.status === 'advanced') scheduleReplayStep();
    else if (result.status !== 'advanced') pauseReplay();
  }).catch(error => { pauseReplay(); replayStatus.textContent = error instanceof Error ? error.message : String(error); render(); });
}
function updateReplayStatus(result: ReplayStepResult): void {
  if (result.status === 'diverged') {
    replayStatus.textContent = `Replay diverged at action ${result.index + 1}/${result.total}.`;
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
    session = candidate; recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = [];
    seedInput.value = String(candidate.exportState().seed);
    saveStatus.textContent = `Restored autosave at revision ${candidate.exportState().timing.revision}.`; render();
  } catch (error) {
    saveStatus.textContent = `Autosave unavailable: ${error instanceof Error ? error.message : String(error)} Manual save remains available.`;
  }
}
let resizeFrame: number | null = null;
new ResizeObserver(() => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { resizeFrame = null; render(); });
}).observe(canvas.parentElement ?? canvas);
render();
actionQueue = actionQueue.then(restoreLatestAutosave);
