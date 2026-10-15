import type { PlayerObservation } from '../../engine/model/observation';
export interface StatusEffect { id: string; label: string; icon: string; color: string; description: string }
const definitions: Record<string, Omit<StatusEffect, 'id'>> = {
  Poisoned: { label: 'Poison weakened', icon: '☠', color: '#9be078', description: 'Poison reduced your strength. Restore strength to recover; this is not damage each turn.' },
  Confused: { label: 'Confused', icon: '↝', color: '#d6a6ff', description: 'Your movement may go in a random direction. Wait for the effect to wear off.' },
  Blind: { label: 'Blind', icon: '⊘', color: '#c5d3e0', description: 'You cannot see nearby creatures or newly explored terrain. Wait or restore your sight.' },
  Held: { label: 'Held', icon: '⛓', color: '#ffb580', description: 'A monster is holding you in place. Defeat or disable it to escape.' },
  Trapped: { label: 'Trapped', icon: '⛓', color: '#ffb580', description: 'A bear trap prevents movement. Keep trying to move until you break free.' },
  Levitating: { label: 'Levitating', icon: '↑', color: '#8ae5ed', description: 'You are floating. Stairs and floor pickups are unavailable until you land.' },
  Hallucinating: { label: 'Hallucinating', icon: '✧', color: '#dfa4ff', description: 'Creature and item appearances are unreliable until the effect wears off.' },
  Hasted: { label: 'Hasted', icon: '»', color: '#8ce8da', description: 'You can take extra actions before the dungeon advances.' },
};
export function observedStatusEffects(observation: PlayerObservation): StatusEffect[] {
  const effects = (observation.status.conditions ?? []).flatMap(id => definitions[id] ? [{ id, ...definitions[id]! }] : []);
  if (!effects.some(effect => effect.id === 'Poisoned') && observation.status.strength !== undefined
    && observation.status.maximumStrength !== undefined && observation.status.strength < observation.status.maximumStrength)
    effects.push({ id: 'Weakened', label: 'Reduced strength', icon: '↓', color: '#d1db88', description: 'Your strength is below normal, reducing combat ability. Restore strength may help.' });
  const stage = observation.status.hungerStage;
  if (stage > 0) effects.push({ id: 'Hunger', label: ['Fed', 'Hungry', 'Weak from hunger', 'Faint from hunger'][stage] ?? 'Hungry',
    icon: '◒', color: stage > 1 ? '#ffad80' : '#ecd28a', description: stage > 1
      ? 'Eat food now. Severe hunger can make you faint, lose turns, and eventually starve.' : 'Your food is running low. Eat a ration or other food from inventory.' });
  for (const item of observation.inventory) if (item.knownCursed && item.equippedSlot)
    effects.push({ id: `curse-${item.token}`, label: 'Cursed equipment', icon: '🔒', color: '#f3a0b8',
      description: `${item.label.replace(/^(weapon|armor)\./, '')} is stuck on you. Remove curse magic is needed before you can take it off.` });
  return effects;
}
