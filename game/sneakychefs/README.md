# Sneaky Chefs: Kitchen Escape

You are a mouse in a chef's kitchen at night. There is no timer and no win screen: shove
ingredients into the mouse hole to build your hoard, then walk into the hole yourself to
visit the base behind it and see what you have stolen. The fridge in the north-west corner
is the prize — it opens as you approach, lights up, and holds the chilled goods. Steal the
kitchen down to a handful of props and the chef restocks it, one delivery at a time, so the
run never dead-ends into an empty floor.

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
| `core/state.js` | every shared global: stage objects, actor rigs, geometry registries, game flags |
| `core/input.js` | keyboard, mouse-drag, wheel and touch buttons → `keys` and camera targets |
| `core/camera.js` | orbit camera, zoom limits, raycast pull-in so it never clips through walls |
| `core/areas.js` | which room the player is in, the fade, the spawn point of each room |
| `core/ui.js` | HUD counters, area label, toasts |
| `core/audio.js` | synthesised sfx (jump, collect, alert, portal, door, thud) |
| `world/scene.js` | renderer, scene, fog, lights, resize |
| `world/physics.js` | floor height, obstacle push-out, area clamps, per-area geometry indirection |
| `world/kitchen.js` | kitchen floor, walls, counters, pedestals, chef patrol route, the three block helpers |
| `world/fridge.js` | the fridge: shell, hinged doors, interior lamp, freezer stock, cold mist |
| `world/mousehole.js` | the portal: arch, floor marker, the two radii (prop drop vs. player walk) |
| `world/ingredients.js` | spawn table, prop physics (push response, roll, gravity, stash drop), the restock loop |
| `world/burrow.js` | the base room: shell, cutaway walls, props, the capped stash pile |
| `world/dust.js` | footstep and landing puffs |
| `actors/mouse.js` | player movement, jump, pushing, body and tail animation |
| `actors/chef.js` | chef brain: patrol, line of sight, chase, smash telegraphs, warning rings |
| `actors/residents.js` | the four mice living in the base |
| `models/mice.js` | mouse rig geometry (player and residents share it) |
| `models/chef.js` | chef geometry only — joints are handed back in `userData` |
| `models/food.js` | ingredient geometry, one builder per type |

### Load order

`index.html` loads `core/state.js` first, then `models/`, `world/`, `actors/`, the rest of
`core/`, and `main.js` last. Only one thing actually depends on that: `AREA_SPAWN` in
`core/areas.js` reads `BURROW_ORIGIN_X` and `BURROW_BOUND` while its file is being
evaluated, so `core/areas.js` must come after `world/burrow.js`.

## Things worth knowing before editing

- **Two rooms, one scene.** The base sits at `x = 400`. `FogExp2` at 0.025 with
  `camera.far = 100` means neither room can ever be seen from the other, which is why there
  is no level teardown path. `world/physics.js` swaps obstacle and camera-collision sets
  from `currentArea`.
- **The obstacle contract.** Anything that should block bodies goes into `kitchenObstacles`
  (or `burrowObstacles`) as `{ x, z, w, d, h }` — use `addKitchenBlock` /
  `addKitchenSolid`. A box only blocks a body whose feet are below `h - STEP_HEIGHT`, which
  is what makes a shelf overhead a walk-under. The same `STEP_HEIGHT` gate is what
  `getFloorY` reports as floor, and `updateMouse` climbs to it — that pair makes the fridge's
  0.1 sole a step rather than a wall the mouse slides through. Note that push-out inflates
  the box by the body's own radius (0.46 for the mouse), so a space you want someone to
  *stand in* needs about that much clearance on every side beyond what it looks like. Use
  `addKitchenVisualBox` for geometry the mouse should walk through but the camera should
  not, and plain `scene.add` meshes for decoration with no collision at all (that is how the
  fridge doors, lid and shelves coexist with a mouse standing inside).
- **Props roll about their own axle.** Each ingredient is `group → carrier → spinner →
  model`: the carrier yaws to face the direction of travel, the spinner accumulates the
  roll. A model that does not contact the ground at its bounding-box centre publishes
  `group.userData.rollPivot = { y, radius }` (the apple and the cheese wheel do).
- **Restarting is a hook, not a poke.** `restartGame()` in `main.js` calls `resetChef()`
  (`actors/chef.js`), `resetMouse()` (`actors/mouse.js`), `clearDust()` (`world/dust.js`)
  and `resetIngredients()` (`world/ingredients.js`). If a module gains new per-run state,
  reset it inside that module's own hook rather than reaching in from `main.js`.
- **The supply is a loop, not a pile.** `updateIngredientProps` ends by calling
  `updateDeliveries`, which re-delivers a hoarded prop every `DELIVERY_GAP` seconds once
  fewer than `DELIVERY_FLOOR` are still in play, dropping it onto its own spawn point from
  above. Delivered props are *reused*, never duplicated, so the scene holds exactly the ten
  ingredient groups it booted with however long the run goes. The base side is capped the
  same way: past `STASH_PILE_CAP` the oldest clone leaves the pile — detach only, because a
  clone shares its source's geometry and material, so disposing would gut the kitchen props.
- **Adding an ingredient type** takes three edits: a builder in `models/food.js` wired into
  `buildIngredientModel`, an entry in `INGREDIENT_SPEC` (`label`, `roll`), and a spawn in
  `INGREDIENT_SPAWNS`. Keep spawns on open floor or on the fridge lip — the mouse's jump
  apex is about 1.6 and a prop on a 2.2 worktop cannot be shoved down from the ground. A
  spawn that sits *under* art needs its own `dropY` below it, or a re-delivery falls through
  that geometry: the chilled trio come in at 1.6, under the freezer shelf, instead of from
  `DELIVERY_DROP_Y`.

## Verifying changes

The game has no test runner — it has one rig inside `index.html`. Opening the page normally
plays the game; adding `?qa` runs two phases after the usual boot and prints the result as a
single `QA{...}` blob into `#qa-out`: an audit of every module (parse errors, expected
functions, expected globals) and 16 behavioural checks over the fridge, push, portal, restart
and restock flows. It finishes in a fraction of a second and reports `simMs` (simulation time
the checks consumed) next to `wallMs`, because it does not use the browser's clock.

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
the checks got (18 means all of them).

Absolute frame rate from a headless or background pane is noise — measure object counts and
state transitions, not milliseconds.
