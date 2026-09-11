import { createTwoRoomFixture } from '../debug/fixtures';
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
import { parseReplay, ReplayRecorder, reproduceReplay } from '../persistence/replay';

const fixture = createTwoRoomFixture();
const issues = validateWorld(fixture);
if (issues.length) throw new Error(`Fixture validation failed: ${JSON.stringify(issues)}`);

const canvas = required<HTMLCanvasElement>('#dungeon');
const inspector = required<HTMLElement>('#inspector');
const reveal = required<HTMLInputElement>('#reveal');
const stateSummary = required<HTMLElement>('#state-summary');
const phaseTrace = required<HTMLElement>('#phase-trace');
const rest = required<HTMLButtonElement>('#rest');
const search = required<HTMLButtonElement>('#search');
const messages = required<HTMLElement>('#messages');
const rawEvents = required<HTMLElement>('#raw-events');
const saveButton = required<HTMLButtonElement>('#save');
const loadButton = required<HTMLButtonElement>('#load');
const exportReport = required<HTMLButtonElement>('#export-report');
const loadFile = required<HTMLInputElement>('#load-file');
const saveStatus = required<HTMLElement>('#save-status');
const view = new CanvasGridView(canvas);
let session = new GameSession(fixture);
let recorder = new ReplayRecorder(session.exportState());
let actionQueue = Promise.resolve();
let selectedIndex: number | null = null;
let latestEvents: PresentationEvent[] = [];

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
  stateSummary.textContent = `Seed ${state.seed} · Tick ${state.timing.tick} · Revision ${state.timing.revision} · ${state.timing.cycle.slotsRemaining} slot ready`;
  phaseTrace.textContent = session.trace().map(entry => `[${entry.tick}] ${entry.kind}: ${entry.detail}`).join('\n') || 'Input ready.';
  messages.textContent = latestEvents.map(event => event.type === 'message' ? event.text : event.type === 'visibleMovement' ? 'You move.' : event.type).join('\n') || 'No messages.';
  rawEvents.textContent = reveal.checked ? JSON.stringify(session.debugEvents(), null, 2) : '';
  document.body.classList.toggle('debug-reveal', reveal.checked);
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
bindDesktopInput(window, enqueue);
function submit(action: GameAction): void {
  enqueue(action);
}
function enqueue(action: GameAction): void {
  actionQueue = actionQueue.then(async () => {
    const expectedRevision = session.exportState().timing.revision;
    latestEvents = session.submit({ expectedRevision, action }).events;
    const snapshot = session.exportState();
    await recorder.record(action, expectedRevision, snapshot);
    saveStatus.textContent = `Recorded revision ${snapshot.timing.revision}.`;
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
      const reproduced = await reproduceReplay(report.value);
      if (!reproduced.result.ok) { saveStatus.textContent = `Replay diverged at action ${reproduced.result.completed}.`; return; }
      const candidate = restoreGame(reproduced.state);
      session = candidate; recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = [];
      saveStatus.textContent = `Reproduced ${reproduced.result.completed} actions.`; render(); return;
    }
    const parsed = parseSave(text);
    if (!parsed.ok) { saveStatus.textContent = parsed.errors.map(error => `${error.path}: ${error.message}`).join('; '); return; }
    const candidate = restoreGame(parsed.value.state);
    session = candidate; recorder = new ReplayRecorder(candidate.exportState()); selectedIndex = null; latestEvents = [];
    saveStatus.textContent = `Loaded revision ${candidate.exportState().timing.revision}.`; render();
  }).catch(error => { saveStatus.textContent = error instanceof Error ? error.message : String(error); })
    .finally(() => { loadFile.value = ''; });
});
exportReport.addEventListener('click', () => {
  actionQueue = actionQueue.then(() => download('rougexr-bug-report.json', JSON.stringify(recorder.bundle(), null, 2)));
});
function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  saveStatus.textContent = `Downloaded ${filename}.`;
}
let resizeFrame: number | null = null;
new ResizeObserver(() => {
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { resizeFrame = null; render(); });
}).observe(canvas.parentElement ?? canvas);
render();
