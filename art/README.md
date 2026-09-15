# Blender creature assets

## Procedural room prop kit

`tools/blender/create_room_prop.py` creates one original static GLB, editable Blender source, and preview per prop. Run it with `-- --asset <kind>`. The kit covers rubble, pillar, urn, crate, mushroom, bones, decorative coin scatter, scroll, food, weapon, armor, amulet, ring, and stick. These are presentation-only; the room plan and collectible entities remain in the Rogue engine.

`urn` is an original static room decoration: source `art/blender/props/urn.blend`, runtime `public/assets/props/urn.glb`, preview `art/previews/urn.png`.

`crate` is an original static room decoration: source `art/blender/props/crate.blend`, runtime `public/assets/props/crate.glb`, preview `art/previews/crate.png`.

`mushroom` is an original static room decoration: source `art/blender/props/mushroom.blend`, runtime `public/assets/props/mushroom.glb`, preview `art/previews/mushroom.png`.

`bones` is an original static room decoration: source `art/blender/props/bones.blend`, runtime `public/assets/props/bones.glb`, preview `art/previews/bones.png`.

`coinScatter` is an original static room decoration: source `art/blender/props/coinScatter.blend`, runtime `public/assets/props/coinScatter.glb`, preview `art/previews/coinScatter.png`.

`scroll` is an original static visible pickup: source `art/blender/props/scroll.blend`, runtime `public/assets/props/scroll.glb`, preview `art/previews/scroll.png`.

`food` is an original static visible pickup: source `art/blender/props/food.blend`, runtime `public/assets/props/food.glb`, preview `art/previews/food.png`.

`weapon` is an original static visible pickup: source `art/blender/props/weapon.blend`, runtime `public/assets/props/weapon.glb`, preview `art/previews/weapon.png`.

`armor` is an original static visible pickup: source `art/blender/props/armor.blend`, runtime `public/assets/props/armor.glb`, preview `art/previews/armor.png`.

`amulet` is an original static visible pickup: source `art/blender/props/amulet.blend`, runtime `public/assets/props/amulet.glb`, preview `art/previews/amulet.png`.

`ring` is an original static visible pickup: source `art/blender/props/ring.blend`, runtime `public/assets/props/ring.glb`, preview `art/previews/ring.png`.

`stick` is an original static visible pickup: source `art/blender/props/stick.blend`, runtime `public/assets/props/stick.glb`, preview `art/previews/stick.png`.

The first completed member is `rubble`:

`pillar` adds a fluted stone column with a plinth and capital, generated from the same script. Source: `art/blender/props/pillar.blend`; runtime: `public/assets/props/pillar.glb`; preview: `art/previews/pillar.png`.

- Source: `art/blender/props/rubble.blend`
- Runtime: `public/assets/props/rubble.glb`
- Preview: `art/previews/rubble.png`

Regenerate with `blender --background --python tools/blender/create_room_prop.py -- --asset rubble`. A primitive fallback stays visible during loading or failure.

## Potion pickup

An original glass bottle with purple liquid, cork, brass bands, and wax seal for any observed potion. Its color is cosmetic and never identifies the hidden potion effect.

- Generator: `tools/blender/create_potion.py`
- Source: `art/blender/props/potion.blend`
- Runtime: `public/assets/props/potion.glb`
- Preview: `art/previews/potion.png`
- Floor-centered static GLB; no animation clips.

Regenerate with `blender --background --python tools/blender/create_potion.py`. The first-person renderer uses this for disclosed potion pickups with a primitive fallback.

## Gold pickup

An original pouch and five embossed, tilted coins for an observed gold item. Decorative treasure-room coin scatter remains visually separate and cannot be collected.

- Generator: `tools/blender/create_gold.py`
- Source: `art/blender/props/gold.blend`
- Runtime: `public/assets/props/gold.glb`
- Preview: `art/previews/gold.png`
- Floor-centered static GLB; no animation clips.

Regenerate with `blender --background --python tools/blender/create_gold.py`. The first-person renderer uses this asset for visible gold pickups and keeps a primitive fallback until loading succeeds.

The complete creation, export, registration, and validation workflow is documented in [`docs/MONSTER_ASSET_PIPELINE.md`](../docs/MONSTER_ASSET_PIPELINE.md).

## Dragon

Original stylized ancient red dragon with crimson scales, gold belly, broad symmetrical wings, swept horns, dorsal spines, fangs, claws, and a long armored tail. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/dragon.blend`
- Runtime: `public/assets/creatures/dragon.glb`
- Preview: `art/previews/dragon.png`
- Rig: 8 bones (root, body, neck, head, four legs).
- Clips: `idle` (watchful breathing), `move` (heavy bound), `attack` (fire-breath posture), `hurt` (recoil), `death` (side fall).
- Wingspan: approximately 2.4 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_dragon.py`.
Preview on the development server at `/model-preview.html?model=dragon`. Gameplay renderer integration remains pending.

## Jabberwock

Original stylized uncanny dragonkin with green scales, long snout and neck, oversized fangs, sweeping whiskers, horns, dorsal spines, and asymmetric violet wings. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/jabberwock.blend`
- Runtime: `public/assets/creatures/jabberwock.glb`
- Preview: `art/previews/jabberwock.png`
- Rig: 8 bones (root, body, neck, head, four legs).
- Clips: `idle` (head watch), `move` (lurching bound), `attack` (jaw lunge and claw rake), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.65 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_jabberwock.py`.
Preview on the development server at `/model-preview.html?model=jabberwock`. Gameplay renderer integration remains pending.

## Griffin

Original stylized eagle-lion griffin with golden forequarters, tawny hindquarters, broad wings, hooked beak, feathered neck, and long talons. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/griffin.blend`
- Runtime: `public/assets/creatures/griffin.glb`
- Preview: `art/previews/griffin.png`
- Rig: 8 bones (root, body, neck, head, four legs).
- Clips: `idle` (head watch), `move` (predatory bound), `attack` (beak lunge and talon rake), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.6 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_griffin.py`.
Preview on the development server at `/model-preview.html?model=griffin`. Gameplay renderer integration remains pending.

## Vampire

Original stylized aristocratic vampire with pale skin, red eyes, fangs, black formal coat, crimson cravat, and a swept split cape. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/vampire.blend`
- Runtime: `public/assets/creatures/vampire.glb`
- Preview: `art/previews/vampire.png`
- Rig: 8 bones (root, spine, head, jaw, two arms, two legs).
- Clips: `idle` (watchful sway), `move` (predatory stride), `attack` (bite and grasp), `hurt` (recoil), `death` (fall).
- Height: approximately 1.7 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_vampire.py`.
Preview on the development server at `/model-preview.html?model=vampire`. Gameplay renderer integration remains pending.

## Emu

Original stylized flightless bird with a shaggy feather coat, long blue-gray neck and legs, alert amber eyes, small wings, and three-clawed feet. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/emu.blend`
- Runtime: `public/assets/creatures/emu.glb`
- Preview: `art/previews/emu.png`
- Rig: 8 bones (root, body, neck, head, two wings, two legs).
- Clips: `idle` (watchful head sway), `move` (running stride), `attack` (peck and kick), `hurt` (recoil), `death` (side fall).
- Height: approximately 2.05 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_emu.py`.
Preview on the development server at `/model-preview.html?model=emu`. Gameplay renderer integration remains pending.

## Medusa

Original stylized gorgon with green stone skin, serpent dress, pointed ears, gold petrifying eyes, snake-hair locks and heads, and a gaze-focus gem. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/medusa.blend`
- Runtime: `public/assets/creatures/medusa.glb`
- Preview: `art/previews/medusa.png`
- Rig: 7 bones (root, spine, head, two arms, two legs).
- Clips: `idle` (watchful sway), `move` (pursuit), `attack` (petrifying gaze), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.7 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_medusa.py`.
Preview on the development server at `/model-preview.html?model=medusa`. Gameplay renderer integration remains pending.

## Black unicorn

Original stylized ominous unicorn with near-black hide, violet sheen and runes, upright mane, glowing eyes, and a long pale-violet horn. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/black-unicorn.blend`
- Runtime: `public/assets/creatures/black-unicorn.glb`
- Preview: `art/previews/black-unicorn.png`
- Rig: 8 bones (root, body, neck, head, four legs).
- Clips: `idle` (head watch), `move` (diagonal-pair trot), `attack` (horn charge), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.65 m at the horn; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_black_unicorn.py`.
Preview on the development server at `/model-preview.html?model=black-unicorn`. Gameplay renderer integration remains pending.

## Xeroc

Original stylized object mimic disguised as a riveted treasure chest, revealing predatory eyes, interlocking teeth, long tongue, and hidden feet. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/xeroc.blend`
- Runtime: `public/assets/creatures/xeroc.glb`
- Preview: `art/previews/xeroc.png`
- Rig: 6 bones (root, chest base, lid, tongue, two legs).
- Clips: `idle` (barely moving disguise), `move` (hopping scuttle), `attack` (lid snap and tongue strike), `hurt` (recoil), `death` (open side fall).
- Width: approximately 0.9 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_xeroc.py`.
Preview on the development server at `/model-preview.html?model=xeroc`. Gameplay renderer integration remains pending.

## Phantom

Original stylized armored apparition with a beaked metal mask, spiked shoulders, violet soul lights, blade-like fingers, and torn floating cloak. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/phantom.blend`
- Runtime: `public/assets/creatures/phantom.glb`
- Preview: `art/previews/phantom.png`
- Rig: 7 bones (root, core, head, two arms, two cloak tails).
- Clips: `idle` (hover), `move` (silent drift), `attack` (ambush reach), `hurt` (displaced recoil), `death` (dissipating sink).
- Hovering height: approximately 0.15 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_phantom.py`.
Preview on the development server at `/model-preview.html?model=phantom`. Gameplay renderer integration remains pending.

## Wraith

Original stylized spectral apparition with a deep hood and faceless void, soul-lit eyes, long skeletal fingers, floating cloak, and torn ethereal tails. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/wraith.blend`
- Runtime: `public/assets/creatures/wraith.glb`
- Preview: `art/previews/wraith.png`
- Rig: 7 bones (root, core, head, two arms, two cloak tails).
- Clips: `idle` (hover), `move` (spectral drift), `attack` (life-draining reach), `hurt` (displaced recoil), `death` (dissipating sink).
- Hovering height: approximately 0.15 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_wraith.py`.
Preview on the development server at `/model-preview.html?model=wraith`. Gameplay renderer integration remains pending.

## Troll

Original stylized cave brute with a massive moss-green frame, stone-gray face and fists, amber eyes, facial warts, long beard, tusks, and black claws. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/troll.blend`
- Runtime: `public/assets/creatures/troll.glb`
- Preview: `art/previews/troll.png`
- Rig: 8 bones (root, core, head, jaw, two arms, two legs).
- Clips: `idle` (breathing), `move` (heavy stride), `attack` (two-handed maul and bite), `hurt` (recoil), `death` (forward collapse).
- Height: approximately 1.85 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_troll.py`.
Preview on the development server at `/model-preview.html?model=troll`. Gameplay renderer integration remains pending.

## Venus flytrap

Original stylized carnivorous plant with a rooted leaf rosette, tall flexible stem, veined trap, red mouth lobes, interlocking teeth, and two animated vines. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/venus-flytrap.blend`
- Runtime: `public/assets/creatures/venus-flytrap.glb`
- Preview: `art/previews/venus-flytrap.png`
- Rig: 7 bones (root, stem, head, upper and lower mouth, two vines).
- Clips: `idle` (trap breathing), `move` (rooted sway), `attack` (snap bite), `hurt` (stem recoil), `death` (wilt).
- Height: approximately 1.2 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_venus_flytrap.py`.
Preview on the development server at `/model-preview.html?model=venus-flytrap`. Gameplay renderer integration remains pending.

## Yeti

Original stylized alpine primate with a massive snow-fur silhouette, blue face and hands, icy eyes, long chin fur, teeth, and black claws. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/yeti.blend`
- Runtime: `public/assets/creatures/yeti.glb`
- Preview: `art/previews/yeti.png`
- Rig: 8 bones (root, core, head, jaw, two arms, two legs).
- Clips: `idle` (breathing), `move` (knuckle-heavy stride), `attack` (two-handed maul and bite), `hurt` (recoil), `death` (forward collapse).
- Height: approximately 1.85 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_yeti.py`.
Preview on the development server at `/model-preview.html?model=yeti`. Gameplay renderer integration remains pending.

## Nymph

Original stylized woodland thief with a layered leaf dress, willow hair, pointed ears, green eyes, and a stolen gold charm. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/nymph.blend`
- Runtime: `public/assets/creatures/nymph.glb`
- Preview: `art/previews/nymph.png`
- Rig: 7 bones (root, spine, head, two arms, two legs).
- Clips: `idle` (watchful sway), `move` (quick retreat), `attack` (charm-hand steal), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.7 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_nymph.py`.
Preview on the development server at `/model-preview.html?model=nymph`. Gameplay renderer integration remains pending.

## Aquator

Original stylized amphibious armor-ruster with teal scales, pale belly plates, dorsal fin crest, webbed claws, and rust-colored corrosive palms. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/aquator.blend`
- Runtime: `public/assets/creatures/aquator.glb`
- Preview: `art/previews/aquator.png`
- Rig: 8 bones (root, core, head, jaw, two arms, two legs).
- Clips: `idle` (watchful breathing), `move` (heavy wade), `attack` (two-handed corrosive touch), `hurt` (recoil), `death` (forward collapse).
- Height: approximately 1.5 m; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_aquator.py`.
Preview on the development server at `/model-preview.html?model=aquator`. Gameplay renderer integration remains pending.

## Quagga

Original stylized extinct equid with striped cream forequarters fading into a chestnut rump, upright mane, dark muzzle, tail, and four articulated legs. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/quagga.blend`
- Runtime: `public/assets/creatures/quagga.glb`
- Preview: `art/previews/quagga.png`
- Rig: 8 bones (root, body, neck, head, four legs).
- Clips: `idle` (head watch), `move` (diagonal-pair trot), `attack` (double rear kick), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.6 m at the ears; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_quagga.py`.
Preview on the development server at `/model-preview.html?model=quagga`. Gameplay renderer integration remains pending.

## Centaur

Original stylized chestnut centaur with four articulated horse legs, armored human torso, bronze helmet and breastplate, tail, and spear. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/centaur.blend`
- Runtime: `public/assets/creatures/centaur.glb`
- Preview: `art/previews/centaur.png`
- Rig: 10 bones (root, horse body, spine, head, two arms, four legs).
- Clips: `idle` (watchful stance), `move` (diagonal-pair trot), `attack` (spear thrust), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.95 m including the crest; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_centaur.py`.
Preview on the development server at `/model-preview.html?model=centaur`. Gameplay renderer integration remains pending.

## Leprechaun

Original stylized small rogue with a green coat, tall buckled hat, copper beard, pointed shoes, coin pouch, and loose coins. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/leprechaun.blend`
- Runtime: `public/assets/creatures/leprechaun.glb`
- Preview: `art/previews/leprechaun.png`
- Rig: 7 bones (root, spine, head, two arms, two legs).
- Clips: `idle` (watchful sway), `move` (quick scamper), `attack` (pouch-hand swipe), `hurt` (sidestep recoil), `death` (side fall).
- Height: approximately 1.3 m including the hat; Blender -Y / glTF +Z forward.

Regenerate with `blender --background --python tools/blender/create_leprechaun.py`.
Preview on the development server at `/model-preview.html?model=leprechaun`. Gameplay renderer integration remains pending.

## Zombie

Original stylized shambling corpse with asymmetric decay, a missing eye, exposed ribs and shin bone, torn clothing, broken teeth, and clawed hands. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/zombie.blend`
- Runtime: `public/assets/creatures/zombie.glb`
- Preview: `art/previews/zombie.png`
- Rig: 8 bones (root, spine, head, jaw, two arms, two legs).
- Clips: `idle` (crooked sway), `move` (asymmetric shamble), `attack` (two-handed grab and bite), `hurt` (recoil), `death` (forward collapse).
- Height: approximately 1.65 m; Blender -Y / glTF +Z forward. Animation translation is cosmetic.

Regenerate with `blender --background --python tools/blender/create_zombie.py`.
Preview on the development server at `/model-preview.html?model=zombie`. Gameplay renderer integration remains pending.

## Orc

Original stylized armored raider with olive skin, iron helmet and chest plate, round riveted shield, heavy cleaver, tusks, and oversized boots. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/orc.blend`
- Runtime: `public/assets/creatures/orc.glb`
- Preview: `art/previews/orc.png`
- Rig: 7 bones (root, spine, head, two arms, two legs).
- Clips: `idle` (look/breathe), `move` (armored walk), `attack` (cleaver strike), `hurt` (recoil), `death` (side fall).
- Height: approximately 1.75 m; Blender -Y / glTF +Z forward. Animation translation is cosmetic.

Regenerate with `blender --background --python tools/blender/create_orc.py`.
Preview on the development server at `/model-preview.html?model=orc`. Gameplay renderer integration remains pending.

## Ice monster

Original stylized crystalline elemental with a deep-blue core, frost plates, glowing eyes, crown and back spikes, heavy fists, and ice claws. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/ice-monster.blend`
- Runtime: `public/assets/creatures/ice-monster.glb`
- Preview: `art/previews/ice-monster.png`
- Rig: 8 bones (root, core, head, jaw, two arms, two legs).
- Clips: `idle` (crystalline pulse), `move` (heavy walk), `attack` (freezing lunge), `hurt` (recoil), `death` (forward collapse).
- Height: approximately 1.6 m; Blender -Y / glTF +Z forward. Animation translation is cosmetic.

Regenerate with `blender --background --python tools/blender/create_ice_monster.py`.
Preview on the development server at `/model-preview.html?model=ice-monster`. Gameplay renderer integration remains pending.

## Snake

Original stylized hooded snake with a lean green body, transverse bands, broad threat hood, eye markings, fangs, and forked tongue. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/snake.blend`
- Runtime: `public/assets/creatures/snake.glb`
- Preview: `art/previews/snake.png`
- Rig: 17 bones (root, 13 body controls, head, jaw, tongue).
- Clips: `idle` (sway/tongue), `move` (slither), `attack` (raised bite strike), `hurt` (recoil), `death` (collapse).
- Facing: Blender -Y / glTF +Z. Animation translation is cosmetic; engine movement remains separate.

Regenerate with `blender --background --python tools/blender/create_snake.py`.
Preview on the development server at `/model-preview.html?model=snake`. Gameplay renderer integration remains pending.

## Bat

Original stylized bat with solid scalloped wing membranes, long ears, fangs, and claws. Generated with Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/bat.blend`
- Runtime: `public/assets/creatures/bat.glb`
- Preview: `art/previews/bat.png`
- Rig: 10 bones (root, body, head, tail, two wings, two finger controls, two legs). Membrane seam vertices share finger-control weights.
- Clips: `idle` (gentle hover), `move` (strong wingbeats), `attack` (bite lunge), `hurt` (recoil), `death` (fall and roll).
- Rest wingspan: approximately 1.38 m; Blender -Y / glTF +Z forward. Clip translation is cosmetic.

Regenerate with `blender --background --python tools/blender/create_bat.py`.
Open `/model-preview.html?model=bat` on the development server to inspect the animations. Gameplay renderer integration remains pending.


## Rattlesnake

Original stylized rattlesnake with a diamond-patterned, smoothly weighted body, raised head, forked tongue, fangs, and segmented rattle. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/rattlesnake.blend`
- Runtime: `public/assets/creatures/rattlesnake.glb`
- Preview: `art/previews/rattlesnake.png`
- Rig: 18 bones (root, 13 body controls, head, jaw, tongue, rattle).
- Clips: `idle` (breathing/rattle/tongue), `move` (slither), `attack` (forward strike), `hurt` (recoil), `death` (collapse).
- Facing: Blender -Y / glTF +Z. Animation translation is cosmetic; engine movement remains separate.

Regenerate with `blender --background --python tools/blender/create_rattlesnake.py`.
Preview on the development server at `/model-preview.html?model=rattlesnake`. This asset is available in the standalone viewer; gameplay renderer integration remains pending.

## Kestrel

Original stylized bird of prey with layered solid feathers, russet coverts, a slate head, hooked beak, and talons. Generated using Blender 4.5 LTS; no external models or textures.

- Source: `art/blender/creatures/kestrel.blend`
- Runtime: `public/assets/creatures/kestrel.glb`
- Preview: `art/previews/kestrel.png`
- Rig: 10 bones (root, body, head, tail, two wings, two wingtips, two legs).
- Clips: `idle` (hover/look), `move` (wingbeat flight), `attack` (dive/talon reach), `hurt` (recoil), `death` (fall and roll).
- Flying rest pose: approximately 1.14 m wingspan at 0.8 m height; Blender -Y forward / glTF +Z forward.
- Animation translation is cosmetic; no clip is intended to advance engine movement.

Regenerate with `blender --background --python tools/blender/create_kestrel.py`.
Preview on the development server at `/model-preview.html?model=kestrel`. The model selector switches between completed assets.

## Hobgoblin

Original procedural low-poly model generated by `tools/blender/create_hobgoblin.py` using Blender 4.5 LTS. No external models or textures are used.

- Source: `art/blender/creatures/hobgoblin.blend`
- Runtime: `public/assets/creatures/hobgoblin.glb`
- Preview: `art/previews/hobgoblin.png`
- Rig: root, spine, head, two arms, two legs; rigid segment weights for a stylized first pass.
- Clips: idle, move, attack, hurt, death. Idle/move loop; other clips play once and hold their last pose.
- Dimensions: approximately 1.45 meters tall; foot origins rest at ground level.
- Facing: Blender -Y, exported glTF +Z.

Generate with Blender 4.5 LTS:

```text
blender --background --python tools/blender/create_hobgoblin.py
```

Run the usual development server and open `/model-preview.html` to orbit the model and inspect every animation. This is a standalone asset study; the gameplay renderer still uses its existing procedural fallback until explicit asset integration.

The source file keeps the animation tracks muted for a clean rest-pose editing view. Enable a single NLA track to inspect it in Blender. The export script exports all five tracks as independent glTF animation clips.
