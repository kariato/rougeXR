# Blender creature assets

The complete creation, export, registration, and validation workflow is documented in [`docs/MONSTER_ASSET_PIPELINE.md`](../docs/MONSTER_ASSET_PIPELINE.md).

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
