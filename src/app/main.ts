import { createTwoRoomFixture } from '../debug/fixtures';
import { validateWorld } from '../engine/validate';

const fixture = createTwoRoomFixture();
const issues = validateWorld(fixture);
const status = document.querySelector('#status');
if (status) status.textContent = issues.length
  ? `Fixture validation failed:\n${JSON.stringify(issues, null, 2)}`
  : `Fixture valid\nSeed: ${fixture.seed}\nGrid: ${fixture.level.width} × ${fixture.level.height}\nRooms: 2 (+ 7 empty slots)\nEntities: ${Object.keys(fixture.entities).length}\nRNG draws: ${fixture.rng.draws}\n\nInteractive map arrives in Phase 2.`;
