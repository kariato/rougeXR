import type { PresentationEvent, RawEvent } from '../engine/model/action';

export type EventFilter = 'all' | 'messages' | 'movement' | 'combat' | 'inventory' | 'world';

export function filterEvents<T extends PresentationEvent | RawEvent>(events: readonly T[], filter: EventFilter): T[] {
  return filter === 'all' ? [...events] : events.filter(event => categoryOf(event) === filter);
}

function categoryOf(event: PresentationEvent | RawEvent): Exclude<EventFilter, 'all'> {
  switch (event.type) {
    case 'message': case 'sourceMessage': return 'messages';
    case 'visibleMovement': case 'actorMoved': return 'movement';
    case 'attackResolved': case 'hpChanged': case 'actorDefeated': return 'combat';
    case 'inventoryUpdate': case 'itemCollected': case 'itemDropped': case 'equipmentChanged': case 'itemConsumed': return 'inventory';
    case 'levelViewReset': case 'levelChanged': case 'featureRevealed': return 'world';
  }
}
