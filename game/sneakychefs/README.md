# Sneaky Chefs: Kitchen Escape

You are a mouse in a chef's kitchen at night. There is no timer and no win screen: shove
ingredients through the mouse hole to build your hoard, or hoist one into your paws with `E` and
carry it through yourself — two arms hold one prop at a time. Behind that hole is the base, where
the mice live and where everything you have stolen sits. The fridge in the north-west corner
is the prize — it opens as you approach, lights up, holds the chilled goods, and is roomy
enough to climb into and walk around. Steal the kitchen down to a handful of props and the
chef restocks it, one delivery at a time, so the run never dead-ends into an empty floor.

And the kitchen is only one room of seven. The house is a single floorplan: the pantry, the
hall, the dining room, the sitting room and the garden are built edge to edge against each
other, and their doorways are real gaps in real walls you walk through — no fade, no loading,
no jump. The mouse hole is one of them: the den sits on the other side of the kitchen's north
wall, so the way home is a short walk through a gap in the masonry. Each room has its own
furniture to
climb, its own loot to steal and its own restock rule. The only thing in the game that still
moves you is being caught: a restart puts you back on the kitchen's spawn. The chef does
not stay in his own room either: his beat walks out of the kitchen, down the hall and into the
dining room and back — about a minute round the loop, with the masonry the only thing that decides
where he can go. An open doorway is a line of sight *and* a way to reach you, and the hole is no
different: nothing in the masonry bars him from following you into the base.

And the house stands in a city. It is a backdrop and not a place: a ring road with traffic
running both ways, street lamps, and a skyline of lit windows behind them, all of it seen
through six windows you can walk up to and never out of — the hall's, two in the dining room,
two in the sitting room, and one high in the den. Every one of them is a hole in the masonry
that the builder has sealed to a body.

And the house has a roof. Six of the seven rooms are capped at the top of their own walls —
the garden is the outside and stays open to the sky — so the plan reads as a house from the
street rather than a pit with walls built around it. The ceilings come off as the camera climbs
through them: a slab is dropped when the line from the mouse's feet to the lens passes over it
*and* the lens has risen above its underside. At the pose the game opens at the lens is still
under the kitchen's ceiling, so you start indoors; pull up and out and the house opens into the
same look-down view it has always had.

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
| `map/rooms.js` | the level: every room as plain data — rect, floor, walls, roof, furniture, doors, windows, lights, loot, restock rule — plus the chef's beat |
| `core/state.js` | every shared global: stage objects, actor rigs, geometry registries, game flags |
| `core/input.js` | keyboard, mouse-drag, wheel and touch buttons → `keys` and camera targets |
| `core/camera.js` | orbit camera, zoom limits, raycast pull-in so it never clips through walls |
| `core/areas.js` | which room the player is standing in, read from his position; the HUD label and the lamp swap that follow from it, and stowing a carried load once he is in the base |
| `core/ui.js` | HUD counters, area label, paws chip |
| `core/audio.js` | synthesised sfx (jump, collect, alert, door, thud, grab) |
| `world/scene.js` | renderer, scene, fog, lights, the one key light that follows the player |
| `world/physics.js` | floor height and obstacle push-out (body and prop variants) against the whole house's merged sets |
| `world/rooms.js` | the room registry and the generic builder: floors, the house's merged masonry with door gaps and window bands cut through it, thresholds, roofs and the cutaway that drops the ones in the camera's way, furniture, lights, and the chef's beat turned into waypoints |
| `world/city.js` | the outside: ring road, traffic, street lamps, skyline and moon, laid out around the house's own bounds — drawn, never registered, so nothing in it is solid |
| `world/kitchen.js` | the kitchen's block helpers and its `build` hook, whose only job is to put the walk-in fridge in the north-west corner |
| `world/fridge.js` | the fridge: shell with a walk-in cavity, hinged doors, interior lamp, freezer stock, cold mist |
| `world/ingredients.js` | prop physics (push response, roll, gravity, stash), `stowCarried`, the per-room restock loop; spawns come from each room's authored `loot` |
| `world/burrow.js` | the hoard: the capped stash pile and the group every delivered ingredient is cloned into |
| `world/dust.js` | footstep and landing puffs |
| `actors/mouse.js` | player movement, jump, pushing, hoisting and carrying, body and tail animation |
| `actors/chef.js` | chef brain: his beat, line of sight, chase, smash telegraphs, warning rings |
| `actors/residents.js` | the four mice living in the base |
| `models/mice.js` | mouse rig geometry (player and residents share it) |
| `models/chef.js` | chef geometry only — joints are handed back in `userData` |
| `models/food.js` | ingredient geometry, one builder per type |

### Load order

`index.html` loads `core/state.js` first, then `models/`, the `world/` modules, `map/rooms.js`,
`world/scene.js`, `actors/`, the rest of `core/`, and `main.js` last. Only one file actually
depends on its position: `map/rooms.js` quotes other modules' globals while it is being
evaluated — `core/state.js`'s `kitchenObstacles` / `cameraCollisionMeshes` and `world/burrow.js`'s
`burrowObstacles` / `burrowCollision`, which the kitchen's spec and the den's hand to the registry
as their own collision arrays — so it has to come after the modules that define them and before
anything that builds. `world/city.js` reads the registry too, but only when `main.js` calls
`buildCity()` after `buildHouse()`, so nothing about its position matters beyond coming before
`main.js`.

## Things worth knowing before editing

- **Seven rooms, one floorplan.** Every room is a rectangle tiled edge to edge against its
  neighbours — the pantry is west of the kitchen, the hall runs along the south side of both, the
  dining room west of the hall, the sitting room east of it, the garden east of that, and the den
  sits directly behind the kitchen's north wall. That last one is why the mouse hole is not
  special: the base is in the plan like every other room, so the registry gives it a real floor,
  real walls that stop the camera and the chef's sight, and one 2-unit gap to walk through.
  `world/rooms.js` lays every room edge onto the line it
  falls on, merges the copies and builds each run **once**, as an obstacle with a gap cut
  wherever two doors face each other: two rooms describing the same wall from opposite sides
  used to leave a hairline the mouse wedged into and a camera raycast that got two hits at the
  same distance. `collectSolidGeometry()` then folds every room's furniture plus the masonry
  into `worldObstacles` / `worldCollisionMeshes`, and `world/physics.js`, `core/camera.js` and
  `actors/chef.js` all read those, so nothing asks "which room is this" before it decides
  whether a body fits. `FogExp2` and `camera.far` still hide the far end of the house, and one
  shared key light follows the player so only the room you are standing in pays for shadows.
  It travels rather than cuts: it used to be dropped on the new room's centre the instant a
  doorway flipped, 23 units in one frame, and everything it left behind stopped casting — which
  read as the room behind you letting go of its shadows. `lightActiveRoom()` now only sets a
  goal and `updateKeyLight(dt)` walks the lamp, its aim and the shadow frustum to it over about
  half a second. Nothing snaps it, because nothing cuts: crossing a doorway is the only way the
  room changes and the mouse is still where he was when it happened.
  Two rules replace the old spacing floor, and the `?qa` rig checks both: no two rects may
  overlap (abutting is fine, sharing a floor is not — and now sharing a ceiling too, since every
  room's roof slab is built from the same rect), and a pair of doors that name each other
  must land on the same point on a wall line each of them actually owns.
- **The level is data.** `map/rooms.js` is the only file you edit to change the house. A room
  spec is a rect (`ox`, `oz`, `hx`, `hz`), a `floor`, `wall` and `roof` palette, a `spawn`, an optional
  `build` hook, `lights`, `furniture`, `doors`, `windows`, `loot`
  and a `restock` rule — everything but the doors in local coordinates. Furniture kinds are
  `counter` (worktop: blocks bodies and the camera), `solid` (a column from `y` to `y + h`:
  blocks and stops the camera), `visual` (camera geometry only, so the mouse walks under it —
  shelves, mantels, tabletops, chair backs) and `deco` (nothing). Shapes are box by default or
  `shape: 'cyl'` / `'sphere'`. Two heights matter: anything you want climbed must top out under
  the jump apex (~1.69), and anything you want stolen must rest under `y = 1.6` for the same
  reason. A door is `{ side, at, to }` plus an optional `gap`, and that is all of it:
  `world/rooms.js` cuts the gap in the wall on that edge, dresses the opening and lays a
  threshold slab across the band of masonry it punches. A door never moves the player — there is
  no arrival point, no trigger radius and no fade left anywhere in the registry, and the rig fails
  the map if a portal record grows a field beyond `id, side, to, width, x, z`. Give every door a
  door back or the plan has a cell, because `core/areas.js` only ever reads which rect his feet
  are in. A window is `{ side, at }` with an optional `width`, `sill` and `head`, and it belongs on
  an exterior wall — the line only one room claims — because it is a view and not a way out.
  A roof is one shared palette (`ROOF`) quoted by every room but the garden, which says
  `roof: false` and stays open to the sky; the slab lands on top of that room's own `wall.height`,
  so a room's ceiling is as high as its walls, and its eaves only reach past an edge no other
  roofed room abuts.
  The kitchen and the base predate the registry and hand their own global obstacle arrays
  over instead of being built from data.
- **The hunter's beat is authored, not solved.** `CHEF_BEAT` in `map/rooms.js` is his route: a
  list of `[x, z]` pairs that `world/rooms.js` turns into `chefWaypoints` once, at the end of
  `buildHouse()`. It is written in **world** coordinates and not room-local ones precisely because
  it crosses doorways — two room specs would otherwise have to agree on where the join is. His
  steering is straight-line only, so two rules hold the route together, and the `?qa` rig walks
  the whole beat to check both: every leg that changes rooms is collinear with the doorway it goes
  through, and no sample along any leg comes within his body radius — `0.7`, the one passed to
  `solveObstacleCollision` — of a wall, a counter or the fridge. Rooms he never sets foot in are
  the pantry, the sitting room, the garden and the base. A chase ends wherever it lost you, which
  may not be the room the waypoint he was heading for stands in, so `resumeBeat()` picks him up
  from the nearest point on the route instead of walking him through a wall to reach it.
- **The obstacle contract.** Anything that should block bodies is an `{ x, z, w, d, h }`
  column — authored furniture gets onto its room's registry record through
  `addRoomBlock` / `addRoomSolid`, camera-only geometry through `addRoomVisual`, and the whole
  house's masonry is appended to the same `worldObstacles` list by `collectSolidGeometry`. The
  lintel over a doorway is deliberately the exception: camera geometry only, because an
  obstacle is a column with no underside and registering the block above an opening would seal
  it. The kitchen and the base predate the registry and keep their older global arrays
  (`kitchenObstacles`, `burrowObstacles`), and the `addKitchen*` wrappers in
  `world/kitchen.js` feed the kitchen's. Containment is geometry everywhere: no rect clamp
  survives, and the den's walls are registered like the pantry's rather than drawn as a cutaway
  shell, so a resident standing outside the base has walked out through the hole rather than
  fallen through a wall that was only ever painted. A box only blocks a body whose feet are
  below `h - STEP_HEIGHT`, which
  is what makes a shelf overhead a walk-under. The same `STEP_HEIGHT` gate is what
  `getFloorY` reports as floor, and `updateMouse` climbs to it — that pair makes the fridge's
  0.1 sole a step rather than a wall the mouse slides through. Note that push-out inflates
  the box by the body's own radius — `0.46 * mouseGroup.userData.scaleFactor` for the mouse,
  about 0.16 today, and it changes whenever the model is resized — so a space you want
  someone to *stand in* needs that much clearance on every side beyond what it looks like —
  `0.7` for the chef, which is the gap his beat is authored against.
  The fridge cavity is authored around it: 3.6 x 2.5 of shell is roughly 3.3 x 2.3 of floor
  the mouse can actually walk on. Use
  `addKitchenVisualBox` for geometry the mouse should walk through but the camera should
  not, and plain `scene.add` meshes for decoration with no collision at all (that is how the
  fridge doors, lid and shelves coexist with a mouse standing inside).
- **The city is scenery; the windows are the seal.** `world/city.js` lays a ring road, its
  traffic, street lamps and a skyline around the house's own bounding box, read from the registry
  rather than written down — move a room and the street moves with it. None of it reaches
  `worldObstacles` or `worldCollisionMeshes`, so it cannot be stood on, shoved, blocked against
  or seen through by anything that reads those lists, and the rig asserts both lists still hold
  exactly what the rooms and the masonry account for. A window is cut by `buildMasonry()` the way
  a doorway is — `houseWindows()` folds both halves of a pair onto their wall line — but the band
  between `sill` and `head` is left open to the eye and closed to a body by one **undrawn
  full-height column** across the whole span. That is the single deliberate exception to the rule
  above: an obstacle cannot start at a height, so the only way to keep a window solid is to
  register all of it. The glass and its mullion *are* camera geometry, which is what stops the
  orbit following you out through the window — it still clips the outer face by about a tenth of
  a unit, because `core/camera.js` keeps a 1.5-unit minimum distance however close a wall gets.
  The rig walks a mouse into every window in the house and fails if one of them lets him past the
  inner face of its own wall.
- **A roof is drawn and registered nowhere.** `buildRoofs()` caps every room whose spec does not
  opt out with a slab set down on top of that room's own walls, so the house is a house when the
  camera pulls back — and `updateRoofs()` drops a slab when the line from the mouse's feet to the
  lens passes over it *and* the lens has climbed above that slab's underside, which is the only
  way a ceiling can coexist with an orbit camera that lives above the wall heads. The height half
  is what keeps a room a room: a lens below an underside cannot be occluded from behind it, since
  the segment starts at his feet, so the ceiling stays exactly where it should. Both registration
  halves matter too: a roof must not be an obstacle (a column has no underside, so registering one
  would fill the room it caps), and it must not be camera geometry either, because `core/camera.js`
  raycasts the mesh list and three.js does not skip a mesh that is currently hidden — a registered
  roof would go on pulling the lens in after the cutaway had already made it invisible. The rig
  sweeps every roofed room's spawn against three camera poses at four yaws, re-deriving the
  crossing by sampling points along the segment rather than by calling the registry's own maths,
  and fails if a slab between him and a lens above it is still on, if the lens comes to rest
  inside one, if *every* roof went off, or if a ceiling dropped while the lens was still under it
  — the cutaway takes the lid off a room, it does not remove the roof.
- **Props roll about their own axle.** Each ingredient is `group → carrier → spinner →
  model`: the carrier yaws to face the direction of travel, the spinner accumulates the
  roll. A model that does not contact the ground at its bounding-box centre publishes
  `group.userData.rollPivot = { y, radius }` (the apple and the cheese wheel do).
- **A prop needs its velocity fixed, not just its position.** Move goods with
  `solvePropCollision(pos, vel, radius, …)` and never the body-only `solveObstacleCollision`:
  relocating a prop out of a counter while its speed still points at the counter walks it
  straight back in next frame, which is what read as a shove "sticking". The prop solver
  reflects the normal component and keeps the
  tangential one, so a wheel skids along a face instead of parking on it. Props are contained by
  the same merged masonry the bodies are — there is no per-room rect left to clamp them to, so
  a prop that reaches the den goes through the hole and is counted by `roomAt`.
  `collideProps()`
  runs *before* the per-item loop in `updateIngredientProps`, at equal mass, so two wheels
  lean on each other instead of overlapping and jamming at the same wall.
- **Paws hold one prop.** `carriedItem` lives in `core/state.js` but only
  `actors/mouse.js` writes it: `pickUp()` takes the nearest thing inside
  `CARRY_REACH` and refuses a second load outright, `toggleCarry()` (bound to `E` and the
  GRAB button) drops what is already held. While a prop is carried, `item.carried` is true —
  every physics path must skip it, because `updateCarry` places the group by hand. The early
  return at the top of the per-item loop in `updateIngredientProps` is what takes it out of
  gravity, roll and the stash check; `collideProps` and `pushIngredients` test the flag
  themselves. Forget one and the load either falls through the floor or gets
  shoved out of the mouse's own grip. The hold point is *overhead* — the goods are sized for a
  chef's counter, so a cheese wheel stands twice as tall as the mouse and a chest-height carry
  hides him completely. `CARRY_SPEED` is the tradeoff that keeps carrying interesting: a load
  is slower than a shove, but it cannot jam. `carryPoseT` blends the front legs and head into
  the hold pose, and `resetMouse()` clears it with the rest of the animation state.
- **Only the base stows the load.** Two paths put food in the pile and neither of them is a
  gate: `updateIngredientProps` marks a prop the frame `roomAt` says it is standing in the den,
  and `checkBaseDeposit` (`core/areas.js`) calls `stowCarried()` when the mouse's own feet get
  him there with something held, so walking home carrying a wheel puts it in the pile instead of
  leaving it at the door. Every other doorway in the house is just a gap — a load rides through
  it in your paws and belongs to whichever room you put it down in (`rehomeIngredient`). Both
  paths go through
  `onIngredientStashed`, the same one a shoved prop uses, so the pile cap and
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
functions, expected globals) and the behavioural checks — the fridge, including walking around
inside it, push, restart, restock, prop collision and carrying flows, plus five over
the house itself: the map in `map/rooms.js` audited against the rules a connected floorplan has
to obey (doors resolve both ways, no two rects share a floor, every doorway pair meets on a wall
line with the gap clear of furniture, every portal record still holds only the fields a walked
gap has, loot is known and inside its own room, every standing point is clear of furniture and
past its own door's dead band, the chef's beat clears every wall, counter and fridge he walks
past, and the den is a walled room the player's feet can reach from the kitchen and `roomAt`
claims); a walk out through four rooms and back — which caps the largest single-frame position
change at well under a step, so the only thing that can have moved him is his own feet crossing a
wall line, and asserts that on the frame a doorway flips the key light is still over the room he
left and has to walk the rest of the way; and the hunter himself: his sight ray fired twice from
six units apart,
once through the masonry and once through the open door, with the blocker named so the check is
measuring a wall and not a crate; his beat walked on paper at a finer step than he moves, so a leg
that changes rooms is caught if it misses its doorway; and then a lap and a bit of him running
for real with the mouse parked out of sight in the garden, reporting the rooms he entered in order
as `lapRooms`, how many waypoints he passed as `lapAdvances`, the tightest clearance he ever
stood in as `lapMinClearance`, and how many of his samples landed outside the plan at all; and
the outside: the city required to be registered as nothing at all, ten cars run for a second and
required to stay on their own tarmac and off every room's floor, and a mouse walked into each of
the six windows, which is where `windowSealFaults`, `windowViewFaults` and `windowEscapes` come
from — the last of them naming any pane that let him past the face of its own wall; and the
roofs, required to be registered as nothing either, then every roofed room's spawn held while the
camera is put at three pitches and four yaws — poses chosen because their lens heights straddle the
six ceiling heights, so the one sweep proves both halves of the cutaway — with the crossing
re-derived by sampling the segment rather than by trusting `segmentCrossesRect`. That is where
`roofFaults` comes from, why `roofSomeStayOn` has to be true as well as `roofAllClear`, and what
`roofCeilingsHeld` counts: how many of those 72 samples left a ceiling standing over his head
because the lens was still under it. It
finishes in a few seconds of wall clock and reports `simMs`
(simulation time the checks consumed) next to `wallMs`, because it does not use the browser's
clock.

```sh
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --user-data-dir="$TEMP/qa-profile" --no-sandbox --disable-gpu \
  --enable-unsafe-swiftshader --window-size=400,300 --virtual-time-budget=300000 \
  --dump-dom "file:///D:/Github/PlayStash/game/sneakychefs/index.html?qa=1" | grep -o 'QA{[^<]*}'
```

The rig owns its clock: it stubs `renderer.render`, stops `animate()` from rescheduling,
re-implements `setTimeout` as a queue keyed to simulated time (so the stash animation and the
auto-restart fire in that clock), and steps the update chain itself at a fixed dt. Two
consequences worth knowing. It verifies behaviour, never pixels — open the page normally to
look at it. And `simFrames()` mirrors `animate()`'s chain by hand, so **a change to the frame
loop has to be made in both places** or the rig quietly stops testing what ships.

Read `audit.errors` first after moving code between files: a duplicated top-level
`let`/`const` across two scripts is a `SyntaxError` that silently kills the whole second
script, and it surfaces there rather than as a missing function later on. `step` is how far
the checks got (27 means all of them — 25 numbered checks, a few of which settle in a second
step).

Absolute frame rate from a headless or background pane is noise — measure object counts and
state transitions, not milliseconds.
