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

export const SCROLL_DEFINITIONS = [
  ['scroll.monster-confusion', 'monster confusion'], ['scroll.magic-mapping', 'magic mapping'],
  ['scroll.hold-monster', 'hold monster'], ['scroll.sleep', 'sleep'], ['scroll.enchant-armor', 'enchant armor'],
  ['scroll.identify-potion', 'identify potion'], ['scroll.identify-scroll', 'identify scroll'],
  ['scroll.identify-weapon', 'identify weapon'], ['scroll.identify-armor', 'identify armor'],
  ['scroll.identify-ring-stick', 'identify ring, wand or staff'], ['scroll.scare-monster', 'scare monster'],
  ['scroll.food-detection', 'food detection'], ['scroll.teleportation', 'teleportation'],
  ['scroll.enchant-weapon', 'enchant weapon'], ['scroll.create-monster', 'create monster'],
  ['scroll.remove-curse', 'remove curse'], ['scroll.aggravate-monsters', 'aggravate monsters'],
  ['scroll.protect-armor', 'protect armor'],
] as const;
export const STICK_DEFINITIONS = [
  ['stick.light','light'],['stick.invisibility','invisibility'],['stick.lightning','lightning'],['stick.fire','fire'],['stick.cold','cold'],
  ['stick.polymorph','polymorph'],['stick.magic-missile','magic missile'],['stick.haste-monster','haste monster'],
  ['stick.slow-monster','slow monster'],['stick.drain-life','drain life'],['stick.nothing','nothing'],['stick.teleport-away','teleport away'],
  ['stick.teleport-to','teleport to'],['stick.cancellation','cancellation'],
] as const;
const WOODS=['avocado wood','balsa','bamboo','banyan','birch','cedar','cherry','cinnibar','cypress','dogwood','driftwood','ebony','elm','eucalyptus','fall','hemlock','holly','ironwood','kukui wood','mahogany','manzanita','maple','oaken','persimmon wood','pecan','pine','poplar','redwood','rosewood','spruce','teak','walnut','zebrawood'] as const;
const METALS=['aluminum','beryllium','bone','brass','bronze','copper','electrum','gold','iron','lead','magnesium','mercury','nickel','pewter','platinum','steel','silver','silicon','tin','titanium','tungsten','zinc'] as const;

const SCROLL_SYLLABLES = [
  'a','ab','ag','aks','ala','an','app','arg','arze','ash','bek','bie','bit','bjor','blu','bot','bu','byt','comp','con','cos','cre','dalf','dan','den','do','e','eep','el','eng','er','ere','erk','esh','evs','fa','fid','fri','fu','gan','gar','glen','gop','gre','ha','hyd','i','ing','ip','ish','it','ite','iv','jo','kho','kli','klis','la','lech','mar','me','mi','mic','mik','mon','mung','mur','nej','nelg','nep','ner','nes','nes','nih','nin','o','od','ood','org','orn','ox','oxy','pay','ple','plu','po','pot','prok','re','rea','rhov','ri','ro','rog','rok','rol','sa','san','sat','sef','seh','shu','ski','sna','sne','snik','sno','so','sol','sri','sta','sun','ta','tab','tem','ther','ti','tox','trol','tue','turs','u','ulk','um','un','uni','ur','val','viv','vly','vom','wah','wed','werg','wex','whon','wun','xo','y','yot','yu','zant','zeb','zim','zok','zon','zum',
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

/** init.c init_names(), retaining word/syllable draw order and the 40-character append rule. */
export function initializeScrollIdentification(rng: RandomState): IdentificationEntry[] {
  return SCROLL_DEFINITIONS.map(([definitionId]) => {
    const words: string[] = []; const wordCount = rnd(rng, 3) + 2; let length = 0;
    for (let word = 0; word < wordCount; word++) {
      let text = ''; const syllableCount = rnd(rng, 3) + 1;
      for (let syllable = 0; syllable < syllableCount; syllable++) {
        const next = SCROLL_SYLLABLES[rnd(rng, SCROLL_SYLLABLES.length)]!;
        if (length + text.length + next.length > 40) break; text += next;
      }
      words.push(text); length += text.length + 1;
    }
    return { definitionId, appearanceId: words.join(' '), known: false, called: null, worth: null };
  });
}

export function initializeIdentification(rng: RandomState): IdentificationEntry[] {
  return [...initializePotionIdentification(rng), ...initializeScrollIdentification(rng), ...initializeStickIdentification(rng)];
}

export function initializeStickIdentification(rng: RandomState): IdentificationEntry[] {
  const wood=new Set<number>(); const metal=new Set<number>(); return STICK_DEFINITIONS.map(([definitionId])=>{
    while(true){ const wand=rnd(rng,2)===0; const pool=wand?METALS:WOODS; const used=wand?metal:wood; const index=rnd(rng,pool.length);
      if(used.has(index))continue; used.add(index); return {definitionId,appearanceId:`${pool[index]} ${wand?'wand':'staff'}`,known:false,called:null,worth:null}; }
  });
}

export function observedItemLabel(state: WorldState, item: ItemState): string {
  if (item.category !== 'potion' && item.category !== 'scroll' && item.category !== 'stick') return item.label ?? item.definitionId;
  const entry = state.identification.find(candidate => candidate.definitionId === item.definitionId);
  if (!entry) throw new Error(`Missing identification entry for ${item.definitionId}`);
  const definitions = item.category === 'potion' ? POTION_DEFINITIONS : item.category === 'scroll' ? SCROLL_DEFINITIONS : STICK_DEFINITIONS;
  const sourceName = definitions.find(([id]) => id === item.definitionId)?.[1];
  if (!sourceName) throw new Error(`Unknown ${item.category} definition ${item.definitionId}`);
  if (item.category === 'potion') {
    if (entry.known) return `potion of ${sourceName} (${entry.appearanceId})`;
    if (entry.called !== null) return `potion called ${entry.called} (${entry.appearanceId})`;
    return `${entry.appearanceId} potion`;
  }
  if (item.category === 'stick') {
    const charges=item.flags&0o2?` [${item.charges} charges]`:'';
    if(entry.known)return `${entry.appearanceId} of ${sourceName}${charges}`;
    if(entry.called!==null)return `${entry.appearanceId} called ${entry.called}${charges}`;
    return entry.appearanceId;
  }
  if (entry.known) return `scroll of ${sourceName} (titled '${entry.appearanceId}')`;
  if (entry.called !== null) return `scroll called ${entry.called} (titled '${entry.appearanceId}')`;
  return `scroll titled '${entry.appearanceId}'`;
}
