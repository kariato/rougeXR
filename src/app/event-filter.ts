import type { PresentationEvent, RawEvent } from '../engine/model/action';

export type EventFilter = 'all' | 'messages' | 'movement' | 'combat' | 'inventory' | 'world';

export function filterEvents<T extends PresentationEvent | RawEvent>(events: readonly T[], filter: EventFilter): T[] {
  return filter === 'all' ? [...events] : events.filter(event => categoryOf(event) === filter);
}

function categoryOf(event: PresentationEvent | RawEvent): Exclude<EventFilter, 'all'> {
  switch (event.type) {
    case 'message': case 'sourceMessage': return 'messages';
    case 'visibleMovement': case 'actorMoved': return 'movement';
    case 'visibleAttack': case 'visibleDefeat': case 'attackResolved': case 'hpChanged': case 'actorDefeated': return 'combat';
    case 'visiblePlayerAction': return 'movement';
    case 'inventoryUpdate': case 'itemCollected': case 'itemDropped': case 'equipmentChanged': case 'itemConsumed': case 'itemChargesChanged': case 'identityLearned': return 'inventory';
    case 'levelViewReset': case 'levelChanged': case 'featureRevealed': case 'magicDetected': case 'itemsDetected': return 'world';
  }
}
