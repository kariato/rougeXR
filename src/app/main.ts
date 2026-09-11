import { createTwoRoomFixture } from '../debug/fixtures';
import { cellIndex } from '../engine/grid';
import { debugFixtureSnapshot, describeDebugCell, describeObservedCell, observeFixture } from '../engine/perception/fixture-observation';
import { validateWorld } from '../engine/validate';
import { GameSession } from '../engine/session';
import { CanvasGridView } from '../presentation/grid/canvas-view';
import { bindDesktopInput } from '../input/desktop';

const fixture = createTwoRoomFixture();
const issues = validateWorld(fixture);
if (issues.length) throw new Error(`Fixture validation failed: ${JSON.stringify(issues)}`);

const canvas = required<HTMLCanvasElement>('#dungeon');
const inspector = required<HTMLElement>('#inspector');
const reveal = required<HTMLInputElement>('#reveal');
const stateSummary = required<HTMLElement>('#state-summary');
const phaseTrace = required<HTMLElement>('#phase-trace');
const rest = required<HTMLButtonElement>('#rest');
const view = new CanvasGridView(canvas);
const session = new GameSession(fixture);
let selectedIndex: number | null = null;

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
}

function render(): void {
  const state = session.exportState();
  const observation = observeFixture(state);
  const debugSnapshot = debugFixtureSnapshot(state);
  view.render(observation, reveal.checked ? debugSnapshot : null);
  const lines = selectedIndex === null
    ? ['Click a cell to inspect it.']
    : [...describeObservedCell(observation, selectedIndex), ...(reveal.checked ? describeDebugCell(debugSnapshot, selectedIndex) : [])];
  inspector.textContent = lines.join('\n');
  stateSummary.textContent = `Seed ${state.seed} · Tick ${state.timing.tick} · Revision ${state.timing.revision} · ${state.timing.cycle.slotsRemaining} slot ready`;
  phaseTrace.textContent = session.trace().map(entry => `[${entry.tick}] ${entry.kind}: ${entry.detail}`).join('\n') || 'Input ready.';
  document.body.classList.toggle('debug-reveal', reveal.checked);
}

canvas.addEventListener('click', event => {
  const observation = observeFixture(session.exportState());
  const bounds = canvas.getBoundingClientRect();
  const position = view.selectFromClient(event.clientX - bounds.left, event.clientY - bounds.top, observation);
  selectedIndex = position ? cellIndex(observation, position) : null;
  render();
});
reveal.addEventListener('change', render);
rest.addEventListener('click', () => {
  submit({ type: 'rest' });
});
bindDesktopInput(window, submit);
function submit(action: Parameters<GameSession['submit']>[0]['action']): void {
  session.submit({ expectedRevision: session.exportState().timing.revision, action });
  render();
}
new ResizeObserver(render).observe(canvas);
render();
