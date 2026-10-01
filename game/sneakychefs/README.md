# Sneaky Chefs: Kitchen Escape

You are a mouse in a chef's kitchen at night. There is no timer and no win screen: shove
ingredients into the mouse hole to build your hoard, or hoist one into your paws with `E` and
carry it home — two arms hold one prop at a time — then walk into the hole yourself to visit
the base behind it and see what you have stolen. The fridge in the north-west corner
is the prize — it opens as you approach, lights up, holds the chilled goods, and is roomy
enough to climb into and walk around. Steal the kitchen down to a handful of props and the
chef restocks it, one delivery at a time, so the run never dead-ends into an empty floor.

And the kitchen is only one room of seven. Glowing doorways lead out into a pantry, a hall,
a dining room, a sitting room and a garden, each with its own furniture to climb, its own
loot to steal and its own restock rule; the minimap in the corner draws the whole house and
keeps track of which room you are standing in. The chef never leaves his kitchen, so every
other room is a free trip — the risk is the walk back.

## Running it

Open `index.html` in a browser. There is no build step, no bundler, and no dependency
besides three.js r128 from a CDN, so the whole game is a folder of text files that runs
from `file://`.

## Module map

Every file starts with a comment saying what it owns. Scripts share one global scope, so a
module writes the globals it owns and only reads the others at runtime. There is exactly one
HTML document: the QA rig is a mode of `index.html`, not a second page.

| Path | Owns |
| --- | --- |
| `index.html` | DOM, HUD, CSS, the script load order, and the `?qa` rig described below |
| `main.js` | boot sequence, the frame loop, capture/restart |
| `map/rooms.js` | the level: every room as plain data — rect, floor, walls, furniture, doors, lights, loot, restock rule |
| `core/state.js` | every shared global: stage objects, actor rigs, geometry registries, game flags |
| `core/input.js` | keyboard, mouse-drag, wheel and touch buttons → `keys` and camera targets |
| `core/camera.js` | orbit camera, zoom limits, raycast pull-in so it never clips through walls |
| `core/areas.js` | which room the player is in, the fade, arrival points read from the registry, stowing a carried load at the way home |
| `core/minimap.js` | the house map in the corner: rooms, door links, the active room's loot, the chef, you |
| `core/ui.js` | HUD counters, area label, paws chip, toasts |
| `core/audio.js` | synthesised sfx (jump, collect, alert, portal, door, thud, grab) |
| `world/scene.js` | renderer, scene, fog, lights, resize, the one key light that follows the player |
| `world/physics.js` | floor height, obstacle push-out (body and prop variants), the per-room clamp, obstacle sets read from the registry |
| `world/rooms.js` | the room registry and the generic builder: floors, walls with door gaps, furniture, door dressing, lights |
| `world/kitchen.js` | the kitchen's own furniture and block helpers, plus the chef's patrol read from the map |
| `world/fridge.js` | the fridge: shell with a walk-in cavity, hinged doors, interior lamp, freezer stock, cold mist |
| `world/mousehole.js` | the portal: arch, floor marker, the two radii (prop drop vs. player walk); registers itself as the kitchen's way home |
| `world/ingredients.js` | prop physics (push response, roll, gravity, stash drop), `stowCarried`, the per-room restock loop; spawns come from each room's authored `loot` |
| `world/burrow.js` | the base room: shell, cutaway walls, props, the capped stash pile |
| `world/dust.js` | footstep and landing puffs |
| `actors/mouse.js` | player movement, jump, pushing, hoisting and carrying, body and tail animation |
| `actors/chef.js` | chef brain: patrol, line of sight, chase, smash telegraphs, warning rings |
| `actors/residents.js` | the four mice living in the base |
| `models/mice.js` | mouse rig geometry (player and residents share it) |
| `models/chef.js` | chef geometry only — joints are handed back in `userData` |
| `models/food.js` | ingredient geometry, one builder per type |

### Load order

`index.html` loads `core/state.js` first, then `models/`, the `world/` modules, `map/rooms.js`,
`world/scene.js`, `actors/`, the rest of `core/`, and `main.js` last. Only one file actually
depends on its position: `map/rooms.js` quotes other modules' globals while it is being
evaluated — `kitchenObstacles` and `cameraCollisionMeshes`, `MOUSE_HOLE`, and the burrow's
`burrowObstacles` / `burrowCollision` / `BURROW_ORIGIN_X` / `BURROW_BOUND` / `BURROW_EXIT` —
so it has to come after the world modules that define them and before anything that builds.

## Things worth knowing before editing

- **Seven rooms, one scene.** Every room is a rectangle placed hundreds of units from every
  other — the kitchen at the origin, the base at `x = 400`, the rest on two rows at `z = 300`
  and beyond. `FogExp2` at 0.025 with `camera.far = 100` means nothing further than about 60
  units is visible, so no room can ever be seen from another and there is no level teardown
  path. `HOUSE_SPACING` is the floor on how close two room centres may come; the `?qa` rig
  measures the nearest pair and fails if it drops. `world/physics.js` reads the obstacle and
  camera-collision sets of whichever room `currentArea` names, and one shared key light moves
  with the player so only the room you are standing in pays for shadows.
- **The level is data.** `map/rooms.js` is the only file you edit to change the house. A room
  spec is a rect (`ox`, `oz`, `hx`, `hz`), a `floor` and `wall` palette, a `spawn`, an `arrive`
  toast, optional `brain` / `build` / `patrol` hooks, `lights`, `furniture`, `doors`, `loot`
  and a `restock` rule — everything but the doors in local coordinates. Furniture kinds are
  `counter` (worktop: blocks bodies and the camera), `solid` (a column from `y` to `y + h`:
  blocks and stops the camera), `visual` (camera geometry only, so the mouse walks under it —
  shelves, mantels, tabletops, chair backs) and `deco` (nothing). Shapes are box by default or
  `shape: 'cyl'` / `'sphere'`. Two heights matter: anything you want climbed must top out under
  the jump apex (~1.69), and anything you want stolen must rest under `y = 1.6` for the same
  reason. A door is `{ side, at, to, label }`; `world/rooms.js` cuts the gap in the wall,
  dresses the opening and computes where you arrive (`ARRIVE_INSET` inside it, clear of its own
  trigger). Give every door a door back or the rig fails the map: `arrivalFor` would otherwise
  drop the player on the far room's spawn. The kitchen and the base predate the registry and
  hand their own global obstacle arrays over instead of being built from data.
- **The obstacle contract.** Anything that should block bodies is an `{ x, z, w, d, h }`
  column on its room's registry record — authored furniture gets there through
  `addRoomBlock` / `addRoomSolid`, camera-only geometry through `addRoomVisual`; the kitchen
  and the base keep their older global arrays (`kitchenObstacles`, `burrowObstacles`) and the
  `addKitchen*` wrappers in `world/kitchen.js` feed the kitchen's. A box only blocks a body
  whose feet are below `h - STEP_HEIGHT`, which
  is what makes a shelf overhead a walk-under. The same `STEP_HEIGHT` gate is what
  `getFloorY` reports as floor, and `updateMouse` climbs to it — that pair makes the fridge's
  0.1 sole a step rather than a wall the mouse slides through. Note that push-out inflates
  the box by the body's own radius — `0.46 * mouseGroup.userData.scaleFactor` for the mouse,
  about 0.16 today, and it changes whenever the model is resized — so a space you want
  someone to *stand in* needs that much clearance on every side beyond what it looks like.
  The fridge cavity is authored around it: 3.6 x 2.5 of shell is roughly 3.3 x 2.3 of floor
  the mouse can actually walk on. Use
  `addKitchenVisualBox` for geometry the mouse should walk through but the camera should
  not, and plain `scene.add` meshes for decoration with no collision at all (that is how the
  fridge doors, lid and shelves coexist with a mouse standing inside).
- **Props roll about their own axle.** Each ingredient is `group → carrier → spinner →
  model`: the carrier yaws to face the direction of travel, the spinner accumulates the
  roll. A model that does not contact the ground at its bounding-box centre publishes
  `group.userData.rollPivot = { y, radius }` (the apple and the cheese wheel do).
- **A prop needs its velocity fixed, not just its position.** Move goods with
  `solvePropCollision(pos, vel, radius, …)` and `clampPropToRect(pos, vel, …)`, never the
  body-only `solveObstacleCollision` / `clampToRect`: relocating a prop out of a counter while
  its speed still points at the counter walks it straight back in next frame, which is what
  read as a shove "sticking". The prop solver reflects the normal component and keeps the
  tangential one, so a wheel skids along a face instead of parking on it. `collideProps()`
  runs *before* the per-item loop in `updateIngredientProps`, at equal mass, so two wheels
  lean on each other instead of overlapping and jamming at the same wall.
- **Paws hold one prop.** `carriedItem` lives in `core/state.js` but only
  `actors/mouse.js` writes it: `pickUp()` takes the nearest thing inside
  `CARRY_REACH` and refuses a second load outright, `toggleCarry()` (bound to `E` and the
  GRAB button) drops what is already held. While a prop is carried, `item.carried` is true —
  every physics path must skip it, because `updateCarry` places the group by hand. The early
  return at the top of the per-item loop in `updateIngredientProps` is what takes it out of
  gravity, roll and the hole chute; `collideProps` and `pushIngredients` test the flag
  themselves. Forget one and the load either falls through the floor or gets
  shoved out of the mouse's own grip. The hold point is *overhead* — the goods are sized for a
  chef's counter, so a cheese wheel stands twice as tall as the mouse and a chest-height carry
  hides him completely. `CARRY_SPEED` is the tradeoff that keeps carrying interesting: a load
  is slower than a shove, but it cannot jam. `carryPoseT` blends the front legs and head into
  the hold pose, and `resetMouse()` clears it with the rest of the animation state.
- **Only the way home stows the load.** `checkPortalCrossing` walks the portals registered on
  the room you are standing in and takes the nearest one whose trigger you are inside; if that
  door leads to the base it calls `stowCarried()` before travelling, so walking home carrying
  something puts it in the pile instead of leaving it at the door. A doorway between two other
  rooms is not the base's front door, so a load rides through it in your paws and belongs to
  whichever room you put it down in (`rehomeIngredient`). The stow goes through
  `onIngredientStashed`, the same path a pushed prop uses, so the pile cap and
  the HUD stay honest — anything new that hoards goods should call that one function.
- **Restarting is a hook, not a poke.** `restartGame()` in `main.js` calls `resetChef()`
  (`actors/chef.js`), `resetMouse()` (`actors/mouse.js`), `clearDust()` (`world/dust.js`)
  and `resetIngredients()` (`world/ingredients.js`). If a module gains new per-run state,
  reset it inside that module's own hook rather than reaching in from `main.js`.
- **The supply is a loop, not a pile.** `updateIngredientProps` ends by calling
  `updateDeliveries`, which looks at the room being stood in: once fewer than that room's
  `restock.floor` props are still in play, one sunk prop from *that room* is re-delivered onto
  its own spawn point every `restock.gap` seconds, dropping in from above (or from its own
  `dropY` when it spawns under art). Delivered props are *reused*, never duplicated, so the
  scene holds exactly the ingredient groups it booted with however long the run goes. Only the
  room you are in counts down — there is no point dropping groceries where nobody can see them
  land — and the base has no restock rule at all, because the pile in there is the score, not
  the supply. The base side is capped the
  same way: past `STASH_PILE_CAP` the oldest clone leaves the pile — detach only, because a
  clone shares its source's geometry and material, so disposing would gut the kitchen props.
- **Adding an ingredient type** takes three edits: a builder in `models/food.js` wired into
  `buildIngredientModel`, an entry in `INGREDIENT_SPEC` (`label`, `roll`), and `loot` lines in
  whichever rooms of `map/rooms.js` should hold it. Keep loot on open floor or on the fridge
  lip — the mouse's jump
  apex is about 1.6 and a prop on a 2.2 worktop cannot be shoved down from the ground. A
  spawn that sits *under* art needs its own `dropY` below it, or a re-delivery falls through
  that geometry: the chilled trio come in at 1.6, under the freezer shelf, instead of from
  `DELIVERY_DROP_Y`.

## Verifying changes

The game has no test runner — it has one rig inside `index.html`. Opening the page normally
plays the game; adding `?qa` runs two phases after the usual boot and prints the result as a
single `QA{...}` blob into `#qa-out`: an audit of every module (parse errors, expected
functions, expected globals) and 24 behavioural checks — the fridge, including walking around
inside it, push, portal, restart, restock, prop collision and carrying flows, plus two over
the house itself: the map in `map/rooms.js` audited against the rules a level has to obey
(doors resolve both ways, rooms stay `HOUSE_SPACING` apart, loot is known and inside its own
room, every spawn and arrival point stands clear of furniture and outside its own door
trigger), and a walk out through three rooms and back proving the doors work in both
directions and that the chef stays in his kitchen. It
finishes in a fraction of a second and reports `simMs` (simulation time the checks consumed)
next to `wallMs`, because it does not use the browser's clock.

```sh
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --user-data-dir="$TEMP/qa-profile" --no-sandbox --disable-gpu \
  --enable-unsafe-swiftshader --window-size=400,300 --virtual-time-budget=5000 \
  --dump-dom "file:///D:/Github/PlayStash/game/sneakychefs/index.html?qa=1" | grep -o 'QA{[^<]*}'
```

The rig owns its clock: it stubs `renderer.render`, stops `animate()` from rescheduling,
re-implements `setTimeout` as a queue keyed to simulated time (so the portal fade and the
auto-restart fire in that clock), and steps the update chain itself at a fixed dt. Two
consequences worth knowing. It verifies behaviour, never pixels — open the page normally to
look at it. And `simFrames()` mirrors `animate()`'s chain by hand, so **a change to the frame
loop has to be made in both places** or the rig quietly stops testing what ships.

Read `audit.errors` first after moving code between files: a duplicated top-level
`let`/`const` across two scripts is a `SyntaxError` that silently kills the whole second
script, and it surfaces there rather than as a missing function later on. `step` is how far
the checks got (24 means all of them — 22 numbered checks, two of which settle in a second
step).

Absolute frame rate from a headless or background pane is noise — measure object counts and
state transitions, not milliseconds.
