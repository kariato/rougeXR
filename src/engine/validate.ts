import { buildIndexes } from './entities';
import { GRID_HEIGHT, GRID_WIDTH, inBounds, isPlayable, supportsOccupant, tileAt } from './grid';
import type { CombatStats, WorldState } from './model/state';
import { KNOWN_EFFECT_IDS } from './scheduler';

export interface ValidationIssue { path: string; message: string }
/** Initial structural validator, not the future versioned save parser. */
export function validateWorld(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string): void => { issues.push({ path, message }); };
  const check = (ok: boolean, path: string, message: string): void => { if (!ok) fail(path, message); };
  const integer = (value: number, minimum = 0): boolean => Number.isSafeInteger(value) && value >= minimum;
  const ancestors = new Set<object>();
  function json(value: unknown, path: string): void {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') { check(Number.isFinite(value), path, 'Nonfinite number'); return; }
    if (typeof value !== 'object') { fail(path, 'Not JSON data'); return; }
    if (ancestors.has(value)) { fail(path, 'Cyclic data'); return; }
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      fail(path, 'Expected plain object'); return;
    }
    ancestors.add(value);
    for (const [key, child] of Object.entries(value)) json(child, `${path}.${key}`);
    ancestors.delete(value);
  }
  json(input, 'world');
  if (issues.length) return issues;
  try {
    const s = input as WorldState;
    const level = s.level;
    check(integer(s.seed) && s.seed <= 0xffffffff, 'seed', 'Expected uint32');
    check(s.rng.algorithm === 'xorshift32-v1' && integer(s.rng.word, 1) && s.rng.word <= 0xffffffff && integer(s.rng.draws), 'rng', 'Invalid random state');
    check(integer(s.nextEntitySerial, 1) && s.nextEntitySerial < Number.MAX_SAFE_INTEGER, 'nextEntitySerial', 'Invalid serial');
    const timing = s.timing;
    check([timing.revision, timing.actionSequence, timing.tick, timing.noCommand, timing.noMove]
      .every(value => integer(value)), 'timing', 'Invalid timing counter');
    check(typeof timing.hasted === 'boolean' && ['playing', 'dead', 'won'].includes(timing.status), 'timing', 'Invalid timing state');
    check(['begin', 'input', 'after', 'terminal'].includes(timing.cycle.phase)
      && integer(timing.cycle.slotsRemaining) && timing.cycle.slotsRemaining <= 2, 'timing.cycle', 'Invalid cycle');
    check(timing.status === 'playing' ? timing.cycle.phase !== 'terminal'
      : timing.cycle.phase === 'terminal' && timing.cycle.slotsRemaining === 0, 'timing.cycle', 'Cycle does not match game status');
    check(timing.scheduler.slots.length === 20, 'timing.scheduler', 'Expected 20 scheduler slots');
    for (const entry of timing.scheduler.slots) if (entry !== null) {
      check(typeof entry.effect === 'string' && KNOWN_EFFECT_IDS.has(entry.effect) && Number.isSafeInteger(entry.arg)
        && ['before', 'after'].includes(entry.phase) && Number.isSafeInteger(entry.remaining) && entry.remaining >= -1,
      'timing.scheduler', 'Invalid scheduled entry');
    }
    check(s.knowledge.levelId === level.id && s.knowledge.remembered.length === level.tiles.length,
      'knowledge', 'Knowledge does not match level');
    for (const memory of s.knowledge.remembered) if (memory !== null) {
      check(typeof memory.glyph === 'string' && typeof memory.terrainLabel === 'string'
        && (memory.featureLabel === null || typeof memory.featureLabel === 'string'), 'knowledge', 'Invalid remembered appearance');
    }
    check(level.width === GRID_WIDTH && level.height === GRID_HEIGHT, 'level', 'Expected 80 by 24 grid');
    check(integer(level.id, 1) && integer(level.depth, 1), 'level', 'Invalid level identity');
    check(level.tiles.length === GRID_WIDTH * GRID_HEIGHT, 'level.tiles', 'Incorrect tile count');
    check(level.rooms.length === 9 && new Set(level.rooms.map(r => r.id)).size === 9, 'level.rooms', 'Expected nine unique room slots');
    for (const room of level.rooms) {
      check(integer(room.id) && room.id < 9 && ['room', 'gone', 'maze'].includes(room.kind) && typeof room.dark === 'boolean', 'level.rooms', 'Invalid room');
      check(integer(room.width, 1) && integer(room.height, 1) && inBounds(level, room.origin)
        && inBounds(level, { x: room.origin.x + room.width - 1, y: room.origin.y + room.height - 1 }), `room.${room.id}`, 'Invalid rectangle');
      check(room.exits.every(p => isPlayable(level, p)) && (room.goldTarget === null || isPlayable(level, room.goldTarget)), `room.${room.id}`, 'Invalid exit/gold target');
    }
    const passageIds = new Set(level.passages.map(p => p.id));
    check(passageIds.size === level.passages.length, 'passages', 'Duplicate passage IDs');
    const terrains = ['void', 'floor', 'wallH', 'wallV', 'door', 'passage'];
    for (const [i, tile] of level.tiles.entries()) {
      check(terrains.includes(tile.terrain) && typeof tile.secret === 'boolean', `tiles.${i}`, 'Invalid terrain');
      check(tile.roomId === null || level.rooms.some(r => r.id === tile.roomId), `tiles.${i}`, 'Unknown room');
      check(tile.passageId === null || passageIds.has(tile.passageId), `tiles.${i}`, 'Unknown passage');
      if (tile.feature !== null) {
        check(tile.feature.kind === 'stairs' || (tile.feature.kind === 'trap'
          && ['trapDoor', 'bear', 'sleep', 'arrow', 'teleport', 'dart', 'rust', 'mystery'].includes(tile.feature.trap)
          && typeof tile.feature.revealed === 'boolean'), `tiles.${i}`, 'Invalid feature');
      }
    }
    for (const passage of level.passages) {
      check(integer(passage.id) && new Set(passage.cells).size === passage.cells.length, 'passages', 'Invalid passage');
      check(passage.cells.every(i => integer(i) && level.tiles[i]?.passageId === passage.id), 'passages', 'Invalid passage cells');
    }
    check(supportsOccupant(level, s.player.at), 'player.at', 'Invalid player position');
    check(s.player.roomId === null || level.rooms.some(r => r.id === s.player.roomId), 'player.roomId', 'Unknown room');
    check(integer(s.player.gold) && integer(s.player.flags), 'player', 'Invalid gold/flags');
    check(isPlayable(level, level.stairs) && tileAt(level, level.stairs).feature?.kind === 'stairs', 'stairs', 'Stairs position mismatch');
    check(level.tiles.filter(t => t.feature?.kind === 'stairs').length === 1, 'stairs', 'Expected one stair tile');
    const stats = (v: CombatStats, path: string): void => {
      check(integer(v.strength) && integer(v.experience) && integer(v.level, 1) && Number.isSafeInteger(v.armorClass)
        && integer(v.hp) && integer(v.maxHp, 1) && v.hp <= v.maxHp, path, 'Invalid combat stats');
      check(v.damage.every(d => integer(d.count) && integer(d.sides)), path, 'Invalid damage groups');
    };
    stats(s.player.stats, 'player.stats');
    check(timing.status === 'dead' ? s.player.stats.hp === 0 : s.player.stats.hp > 0, 'player.stats.hp', 'HP does not match game status');
    const expected = new Map<string, string[]>([['floor', []], ['player', []], ['monsters', []]]);
    for (const entity of Object.values(s.entities)) if (entity.kind === 'monster') expected.set(entity.id, []);
    for (const [id, entity] of Object.entries(s.entities)) {
      const serial = /^e([1-9]\d*)$/.exec(id)?.[1];
      check(serial !== undefined && Number.isSafeInteger(Number(serial)) && Number(serial) < s.nextEntitySerial && entity.id === id, `entities.${id}`, 'Invalid registry ID/serial');
      check(typeof entity.definitionId === 'string' && entity.definitionId.length > 0 && integer(entity.flags), `entities.${id}`, 'Invalid definition/flags');
      if (entity.kind === 'monster') {
        expected.get('monsters')?.push(id);
        stats(entity.stats, `entities.${id}.stats`);
        check(typeof entity.slowTurn === 'boolean' && (entity.disguise === null || typeof entity.disguise === 'string'), id, 'Invalid monster state');
        check(entity.roomId === null || level.rooms.some(room => room.id === entity.roomId), id, 'Invalid monster room');
        if (entity.target !== null) check(entity.target.kind === 'player'
          || (entity.target.kind === 'position' && isPlayable(level, entity.target.at))
          || (entity.target.kind === 'item' && s.entities[entity.target.id]?.kind === 'item'), id, 'Invalid monster target');
      } else if (entity.kind === 'item') {
        check(integer(entity.quantity, 1) && integer(entity.group) && (entity.label === null || typeof entity.label === 'string'), id, 'Invalid item quantity/group/label');
        check(['weapon', 'armor', 'stick', 'ring', 'potion', 'scroll', 'food', 'amulet', 'gold'].includes(entity.category), id, 'Invalid item category');
        if (entity.category === 'weapon') check(Number.isSafeInteger(entity.hitBonus) && Number.isSafeInteger(entity.damageBonus), id, 'Invalid weapon modifiers');
        if (entity.category === 'armor') check(Number.isSafeInteger(entity.armorClass), id, 'Invalid armor');
        if (entity.category === 'stick') check(integer(entity.charges), id, 'Invalid charges');
        if (entity.category === 'ring') check(Number.isSafeInteger(entity.magnitude), id, 'Invalid ring');
        const location = entity.location;
        check(location.kind === 'floor' || location.kind === 'pack', id, 'Invalid location kind');
        const owner = location.kind === 'floor' ? 'floor' : location.owner;
        check(expected.has(owner) && owner !== 'monsters', id, 'Invalid owner');
        expected.get(owner)?.push(id);
      } else fail(id, 'Invalid entity kind');
    }
    const order = (actual: string[], wanted: string[], path: string): void => {
      check(Array.isArray(actual) && actual.length === wanted.length && new Set(actual).size === actual.length
        && actual.every(id => wanted.includes(id)), path, 'Order does not match ownership');
    };
    order(s.player.packOrder, expected.get('player') ?? [], 'player.packOrder');
    order(level.floorObjectOrder, expected.get('floor') ?? [], 'floorObjectOrder');
    order(level.monsterOrder, expected.get('monsters') ?? [], 'monsterOrder');
    for (const e of Object.values(s.entities)) if (e.kind === 'monster') order(e.packOrder, expected.get(e.id) ?? [], `${e.id}.packOrder`);
    const equipped = Object.values(s.player.equipment).filter(id => id !== null);
    check(new Set(equipped).size === equipped.length, 'equipment', 'Duplicate equipment');
    for (const [slot, id] of Object.entries(s.player.equipment)) if (id !== null) {
      const e = s.entities[id];
      const category = slot.endsWith('Ring') ? 'ring' : slot;
      check(e?.kind === 'item' && e.location.kind === 'pack' && e.location.owner === 'player' && e.category === category, 'equipment', 'Invalid equipment ownership/category');
    }
    const indexes = buildIndexes(s);
    check(!indexes.monsters.has(s.player.at.y * level.width + s.player.at.x), 'player.at', 'Player overlaps monster');
  } catch (error) {
    fail('world', error instanceof Error ? error.message : 'Malformed state');
  }
  return issues;
}
