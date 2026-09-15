# First-person facing and action presentation

Rogue stores a cell for each actor and resolves combat by bumping an adjacent occupied cell. It has no actor facing or position within a cell. RougeXR therefore treats facing and short action motion as presentation state. The engine still determines the legal move, attack result, damage, and turn cost.

## Data boundary

`GameSession` projects raw `attackResolved` events to `visibleAttack` only when both participants' cell positions are visible and any monster token is disclosed by the player observation. It carries the two cell positions and hit flag, not a hidden AI target. `visibleDefeat` uses a position captured before the monster is removed from engine state. Resolved non-movement actions project `visiblePlayerAction`. These cues are transient and do not enter saves or replay state; replay still produces them from the same resolved actions.

## Facing and clips

The 3D view keeps a facing angle per observed actor token. Visible movement faces the destination. A visible attack turns the attacker toward the defender and the defender toward the attacker. The first-person camera turns toward the target when the player attacks; an enemy attack does not forcibly rotate the player's camera. Blender creatures are authored facing Blender `-Y`, exported facing glTF `+Z`, so their holder yaw follows the horizontal vector to the other actor.

Each actor receives its visible cues in order. A turn with a player strike, a monster hurt, and a monster reply plays those clips as a sequence rather than choosing only the last event. Exported `move`, `attack`, `hurt`, and `death` clips play once and return to `idle`, except death holds its final pose. The procedural fallback has corresponding clips. A defeated monster that appeared in the previous observation remains as a visual for about one second, then its meshes and mixers are disposed. The logical monster disappears at the engine's original time.

The player model is hidden in first person, so a small camera-attached glove shows attack and interaction gestures. Camera motion reinforces the strike and impact. Search, pickup, equipment changes, and stairs use a reach; food, potion, and scroll use a gesture toward the face; throwing and zapping use a forward cast; rest uses a breathing motion. This is an initial visual vocabulary; item-specific held props and distinct timings can be added without changing Rogue actions.

## Remaining spatial work

Actors still jump between cell centers on a resolved move. Smooth travel between centers and short within-cell combat lunges belong to a later presentation step. Those motions must return to the authoritative cell and must not change range, collision, or the number of turns. True within-cell tactical positions would be a separate gameplay rules change.
