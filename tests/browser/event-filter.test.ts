import { describe, expect, it } from 'vitest';
import type { PresentationEvent, RawEvent } from '../../src/engine/model/action';
import { filterEvents } from '../../src/app/event-filter';

describe('browser event filters', () => {
  it('filters presentation events without changing their order', () => {
    const events: PresentationEvent[] = [
      { type: 'visibleMovement', token: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { type: 'message', text: 'hit' }, { type: 'inventoryUpdate' },
    ];
    expect(filterEvents(events, 'messages')).toEqual([{ type: 'message', text: 'hit' }]);
    expect(filterEvents(events, 'all')).toEqual(events);
  });

  it('groups raw combat events separately from movement', () => {
    const events: RawEvent[] = [
      { type: 'actorMoved', actorId: 'e1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, ordinal: 0, actionSequence: 1 },
      { type: 'hpChanged', actorId: 'player', from: 12, to: 11, ordinal: 1, actionSequence: 1 },
    ];
    expect(filterEvents(events, 'combat')).toEqual([events[1]]);
  });
});
