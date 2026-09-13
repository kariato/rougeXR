import type { IdentificationEntry, ItemState, RandomState, WorldState } from './model/state';
import { rnd } from './random';

/** Potion subtype order from rogue.h; names from extern.c's pot_info table. */
export const POTION_DEFINITIONS = [
  ['potion.confuse', 'confusion'],
  ['potion.hallucinate', 'hallucination'],
  ['potion.poison', 'poison'],
  ['potion.strength', 'gain strength'],
  ['potion.see-invisible', 'see invisible'],
  ['potion.healing', 'healing'],
  ['potion.monster-detection', 'monster detection'],
  ['potion.treasure-detection', 'magic detection'],
  ['potion.raise-level', 'raise level'],
  ['potion.extra-healing', 'extra healing'],
  ['potion.haste', 'haste self'],
  ['potion.restore-strength', 'restore strength'],
  ['potion.blindness', 'blindness'],
  ['potion.levitation', 'levitation'],
] as const;

/** The rainbow[] table in init.c, in source order. */
export const POTION_COLORS = [
  'amber', 'aquamarine', 'black', 'blue', 'brown', 'clear', 'crimson', 'cyan', 'ecru',
  'gold', 'green', 'grey', 'magenta', 'orange', 'pink', 'plaid', 'purple', 'red', 'silver',
  'tan', 'tangerine', 'topaz', 'turquoise', 'vermilion', 'violet', 'white', 'yellow',
] as const;

/** Port of init.c init_colors(): rejection sampling is intentional and preserves draw order. */
export function initializePotionIdentification(rng: RandomState): IdentificationEntry[] {
  const used = new Set<number>();
  return POTION_DEFINITIONS.map(([definitionId]) => {
    let color: number;
    do color = rnd(rng, POTION_COLORS.length); while (used.has(color));
    used.add(color);
    return { definitionId, appearanceId: POTION_COLORS[color]!, known: false, called: null, worth: null };
  });
}

export function observedItemLabel(state: WorldState, item: ItemState): string {
  if (item.category !== 'potion') return item.label ?? item.definitionId;
  const entry = state.identification.find(candidate => candidate.definitionId === item.definitionId);
  if (!entry) throw new Error(`Missing identification entry for ${item.definitionId}`);
  const sourceName = POTION_DEFINITIONS.find(([id]) => id === item.definitionId)?.[1];
  if (!sourceName) throw new Error(`Unknown potion definition ${item.definitionId}`);
  if (entry.known) return `potion of ${sourceName} (${entry.appearanceId})`;
  if (entry.called !== null) return `potion called ${entry.called} (${entry.appearanceId})`;
  return `${entry.appearanceId} potion`;
}
