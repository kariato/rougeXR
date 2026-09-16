# First-person facing and action presentation

Rogue stores a cell for each actor and resolves combat by bumping an adjacent occupied cell. It has no actor facing or position within a cell. RougeXR therefore treats facing and short action motion as presentation state. The engine still determines the legal move, attack result, damage, and turn cost.

First-person arrow controls use that presentation facing. Left and right rotate the POV and player model by the configured turn angle without advancing engine time. Up submits a normal Rogue move in the nearest eight-way direction to the POV; down submits the opposite direction. Letter movement keys retain the source-style absolute compass controls for debugging and experienced Rogue players.

## Data boundary

`GameSession` projects raw `attackResolved` events to `visibleAttack` only when both participants' cell positions are visible and any monster token is disclosed by the player observation. It carries the two cell positions and hit flag, not a hidden AI target. `visibleDefeat` uses a position captured before the monster is removed from engine state. Resolved non-movement actions project `visiblePlayerAction`. These cues are transient and do not enter saves or replay state; replay still produces them from the same resolved actions.

## Facing and clips

The 3D view keeps a facing angle per observed actor token. Visible movement faces the destination. A visible attack turns the attacker toward the defender and the defender toward the attacker. The first-person camera turns toward the target when the player attacks; an enemy attack does not forcibly rotate the player's camera. Blender creatures are authored facing Blender `-Y`, exported facing glTF `+Z`, so their holder yaw follows the horizontal vector to the other actor.

A primary mouse click in first-person mode checks only the adjacent grid cell in the current POV direction. If that disclosed cell contains a monster, the view submits the same `move` request used by Rogue bump combat with the observation revision captured at click time. `GameSession` remains responsible for hit rolls, damage, monster response, and defeat. Only its resulting `visibleAttack` event starts the hand-and-weapon swing, so a stale or rejected click cannot fabricate an attack animation. Mouse drags rotate the view and suppress the following click.

Each actor receives its visible cues in order. A turn with a player strike, a monster hurt, and a monster reply plays those clips as a sequence rather than choosing only the last event. Exported `move`, `attack`, `hurt`, and `death` clips play once and return to `idle`, except death holds its final pose. The procedural fallback has corresponding clips. A defeated monster plays its death animation, then remains in the room in its final pose for the current level. Corpses appear only in currently visible cells; they remain remembered when the player opens the map or walks away and reappear on return. A new level or new game clears them. The logical monster disappears at the engine's original time, and the corpse never blocks movement or acts. Save files do not currently persist corpse presentation history.

The player model is hidden in first person, so a small camera-attached glove shows attack and interaction gestures. Camera motion reinforces the strike and impact. Search, pickup, equipment changes, and stairs use a reach; food, potion, and scroll use a gesture toward the face; throwing and zapping use a forward cast; rest uses a breathing motion. This is an initial visual vocabulary; item-specific held props and distinct timings can be added without changing Rogue actions.

## Remaining spatial work

Actors still jump between cell centers on a resolved move. Smooth travel between centers and short within-cell combat lunges belong to a later presentation step. Those motions must return to the authoritative cell and must not change range, collision, or the number of turns. True within-cell tactical positions would be a separate gameplay rules change.
