/**
 * map/rooms.js — the house. Every room, every doorway, every piece of furniture and every
 * scrap of loot on the floor lives in this one array of plain data.
 *
 * To change the level you edit this file and nothing else. To add a room, append a spec; to
 * connect two rooms, give each of them a door naming the other. world/rooms.js reads the
 * array and builds it.
 *
 * A room is a rectangle: centre (ox, oz) in the shared scene, half-extents hx and hz. Rooms
 * live in one THREE.Scene, so they hide from each other by distance alone — fog and
 * camera.far (100) mean nothing further than ~60 units is visible. Keep every pair at least
 * HOUSE_SPACING apart or the player will see the next room through the wall.
 *
 * Everything except doors is in LOCAL coordinates, relative to the room's centre:
 *   spawn     where a restart or a room with no door back drops the player
 *   arrive    the toast shown on entry
 *   brain     which actor module runs here: 'chef' (hunter) or 'residents' (family)
 *   build     a global function for the parts only this room has (fridge, burrow shell)
 *   patrol    the chef's route, as local [x, z] pairs
 *   floor     { a, b, tile, rough } — a two-tone checker, `tile` units per tile
 *   wall      { color, height, thickness, trim } — doorways are cut automatically
 *   furniture pieces, see below
 *   lights    { color, intensity, distance, x, y, z } — only the active room's are lit
 *   loot      { type, x, z } — where the hoard starts
 *   restock   { floor, gap } — refill to `floor` live props, one drop every `gap` seconds
 *
 * Furniture kinds:
 *   counter   a worktop: box plus a lighter overhanging slab. Blocks, and stops the camera.
 *   solid     a block or column from `y` up to `y + h`. Blocks, and stops the camera.
 *   visual    camera geometry only — the mouse walks straight under it. Use this for
 *             anything overhead (shelves, mantels, tabletops, chair backs) because an
 *             obstacle is a column with no underside and would seal the space below.
 *   deco      neither. Rugs, books, flowers.
 * Shapes: box by default (w/h/d), or `shape: 'cyl'` (rt/rb/h/segments), or
 * `shape: 'sphere'` (r).
 *
 * `y` is always the BASE of a piece, not its centre. Anything you want the mouse to be able
 * to climb must top out below its jump apex (~1.69); anything you want it to be able to
 * steal must rest below y = 1.6 for the same reason.
 *
 * This file is evaluated after the world modules, because a spec quotes their globals:
 * kitchenObstacles and cameraCollisionMeshes (core/state.js), MOUSE_HOLE (world/mousehole.js),
 * and burrowObstacles, burrowCollision, BURROW_ORIGIN_X, BURROW_BOUND and BURROW_EXIT
 * (world/burrow.js). DELIVERY_FLOOR and DELIVERY_GAP are defined here, below.
 */

// The kitchen has always been 15.35 half-units; the clamp rect and the walls are built off it.
const KITCHEN_BOUND = 15.35;
// The minimum gap between two room centres. Fog hides a room past ~60 units, and the largest
// room reaches ~22 from its centre, so 150 leaves nothing but wall-to-wall darkness between.
const HOUSE_SPACING = 150;

// Restock defaults, quoted by the `restock` rule below. `floor` is how many props a room
// keeps in play before it starts refilling; `gap` is the seconds between two deliveries.
// The kitchen keeps a full ten in play because it is where the chef is; the other rooms are
// quieter larders that only need a few things on the floor to be worth a trip.
const DELIVERY_FLOOR = 5;
const DELIVERY_GAP = 9.0;

const ROOMS = [
    // ---------------------------------------------------------------- the heist happens here
    {
        id: 'kitchen',
        label: 'KITCHEN',
        ox: 0, oz: 0, hx: KITCHEN_BOUND, hz: KITCHEN_BOUND,
        // The kitchen predates the registry and half the game reads these two arrays by name.
        obstacles: kitchenObstacles,
        collision: cameraCollisionMeshes,
        spawn: { x: 0, z: 9 },
        arrive: 'Back to the kitchen — keep foraging',
        brain: 'chef',
        build: 'buildKitchenEnvironment',
        patrol: [[-9, -10], [10, -10], [10, 8], [-10, 8]],
        floor: { a: '#454558', b: '#34344a', tile: 4, rough: 0.5 },
        wall: { color: 0x222230, height: 8, thickness: 1, trim: 0x4a5568 },
        furniture: [
            // The island and the two runs the chef patrols between.
            { kind: 'counter', w: 8, h: 2.2, d: 3, x: 0, z: 0, color: 0x4a5568 },
            { kind: 'counter', w: 3, h: 2.2, d: 7, x: -8, z: -2, color: 0x4a5568 },
            { kind: 'counter', w: 3, h: 2.2, d: 7, x: 8, z: -2, color: 0x4a5568 },
            // Four stepping pedestals: climbable, and the only high ground in the room.
            { kind: 'counter', w: 1.6, h: 0.8, d: 1.6, x: -3.5, z: 5, color: 0x8b5a2b },
            { kind: 'counter', w: 1.6, h: 1.5, d: 1.6, x: -1.8, z: 3.5, color: 0x8b5a2b },
            { kind: 'counter', w: 1.6, h: 0.9, d: 1.6, x: 3.5, z: 5, color: 0x8b5a2b },
            { kind: 'counter', w: 1.6, h: 1.6, d: 1.6, x: 1.8, z: 3.5, color: 0x8b5a2b }
        ],
        doors: [
            // The mouse hole is drawn by world/mousehole.js, so it is handed over rather than
            // built: `hole` says take the position and radius from there and leave the wall solid.
            { side: 'north', at: 0, to: 'burrow', label: 'HOME', hole: MOUSE_HOLE },
            { side: 'south', at: -3, to: 'hall', label: 'HALL' },
            { side: 'west', at: 4, to: 'pantry', label: 'PANTRY' }
        ],
        // Everything on open floor or inside the fridge: the mouse's jump apex can't clear a
        // 2.2 counter and a prop up there can't be shoved down, so a worktop spawn would be
        // unobtainable. The chilled trio stands on the fridge's interior lip and has to be
        // shoved out through the doorway — `dropY` keeps a re-delivery below the freezer shelf.
        loot: [
            { type: 'cheese', x: 0, z: -6 },
            { type: 'cheese', x: 6, z: -8 },
            { type: 'cheese', x: -6, z: -8 },
            { type: 'apple', x: 0, z: 6.5 },
            { type: 'banana', x: -11, z: 2 },
            { type: 'banana', x: 11, z: 4 },
            { type: 'carrot', x: 4, z: 11 },
            { type: 'apple', x: -13.5, z: -13.6, dropY: 1.6 },
            { type: 'butter', x: -12.5, z: -14.5, dropY: 1.6 },
            { type: 'milk', x: -11.5, z: -13.6, dropY: 1.6 }
        ],
        restock: { floor: DELIVERY_FLOOR, gap: DELIVERY_GAP }
    },

    // ------------------------------------------------------------------ dry goods, and a way up
    {
        id: 'pantry',
        label: 'PANTRY',
        ox: -300, oz: 0, hx: 10, hz: 12,
        spawn: { x: 0, z: 8 },
        arrive: 'The pantry — shelves, sacks and a crate staircase',
        floor: { a: '#4a4438', b: '#3e382c', tile: 3, rough: 0.85 },
        wall: { color: 0x3a3327, height: 6, thickness: 1, trim: 0x7a5c3a },
        lights: [{ color: 0xffd9a0, intensity: 0.9, distance: 24, x: 0, y: 4.2, z: 0 }],
        furniture: [
            { kind: 'counter', w: 8, h: 1.0, d: 1.8, x: 0, z: -10.4, color: 0x7a5c3a },
            { kind: 'counter', w: 8, h: 1.0, d: 1.8, x: 0, z: 10.4, color: 0x7a5c3a },
            { kind: 'counter', w: 1.8, h: 1.0, d: 9, x: -8.6, z: -2, color: 0x7a5c3a },
            // Two tall cupboards: too high to climb, so they are landmarks rather than routes.
            { kind: 'solid', w: 1.4, h: 2.8, d: 1.4, x: 8.4, z: 10.2, color: 0x5f472c },
            { kind: 'solid', w: 1.4, h: 2.8, d: 1.4, x: 8.4, z: -10.2, color: 0x5f472c },
            // A crate staircase up the west shelving: 0.55, 1.05, 1.45 — three climbs to a vantage.
            { kind: 'solid', w: 1.7, h: 0.55, d: 1.7, x: -3, z: -3, color: 0x8a6a3a },
            { kind: 'solid', w: 1.7, h: 1.05, d: 1.7, x: -3, z: -5.4, color: 0x8a6a3a },
            { kind: 'solid', w: 1.5, h: 1.45, d: 1.5, x: 2.5, z: 4.5, color: 0x8a6a3a },
            { kind: 'solid', shape: 'cyl', rt: 0.7, rb: 0.6, h: 1.15, segments: 10, x: 5.5, z: -6.5, color: 0x6b4a2a, rough: 0.8 },
            { kind: 'solid', shape: 'cyl', rt: 0.7, rb: 0.6, h: 1.15, segments: 10, x: 7.2, z: -5.4, color: 0x7a5730, rough: 0.8 },
            // Slumped sacks: decoration, because a body would walk through the visual anyway.
            { kind: 'deco', shape: 'sphere', r: 0.6, x: -6.5, z: 6.5, color: 0x9a8a63, rough: 0.95 },
            { kind: 'deco', shape: 'sphere', r: 0.5, x: -5.4, z: 7.2, color: 0x8d7c58, rough: 0.95 }
        ],
        doors: [{ side: 'east', at: 0, to: 'kitchen', label: 'KITCHEN' }],
        loot: [
            { type: 'milk', x: -2, z: -10.4 },
            { type: 'butter', x: 1.5, z: -10.4 },
            { type: 'jam', x: -8.6, z: -3 },
            { type: 'bread', x: 0, z: 10.4 },
            { type: 'cheese', x: 2.5, z: 4.5 },     // on top of the tallest crate
            { type: 'carrot', x: -3, z: -5.4 },
            { type: 'apple', x: 6, z: 2 },
            { type: 'tomato', x: -1, z: 6 },
            { type: 'tomato', x: 7.5, z: 8 }
        ],
        restock: { floor: 3, gap: DELIVERY_GAP }
    },

    // ---------------------------------------------------------- the corridor everything opens on
    {
        id: 'hall',
        label: 'HALL',
        ox: 0, oz: 300, hx: 20, hz: 8,
        spawn: { x: 0, z: 0 },
        arrive: 'The hall — three doors and a long runner',
        floor: { a: '#5b4636', b: '#4d3a2b', tile: 4, rough: 0.75 },
        wall: { color: 0x3b2f28, height: 6.5, thickness: 1, trim: 0x8a6a45 },
        lights: [
            { color: 0xffc98a, intensity: 0.85, distance: 26, x: -9, y: 4.4, z: 0 },
            { color: 0xffc98a, intensity: 0.85, distance: 26, x: 9, y: 4.4, z: 0 }
        ],
        furniture: [
            { kind: 'deco', w: 30, h: 0.05, d: 3.2, x: 0, y: 0.01, z: 0, color: 0x7a2f3a, rough: 0.95 },
            { kind: 'counter', w: 5.5, h: 1.1, d: 1.4, x: -11, z: -6.6, color: 0x6b4a2f },
            // Grandfather clock: the case blocks, the face floats on it.
            { kind: 'solid', w: 1.0, h: 2.5, d: 0.7, x: 13, z: -7.0, color: 0x4a3524 },
            { kind: 'visual', w: 0.7, h: 0.7, d: 0.12, x: 13, y: 1.9, z: -6.6, color: 0xd8c39a, rough: 0.3 },
            { kind: 'solid', w: 4.2, h: 0.55, d: 1.3, x: 5, z: 6.6, color: 0x6b4a2f },
            // A stack by the east door, climbable to the top crate.
            { kind: 'solid', w: 1.7, h: 0.95, d: 1.7, x: 17.6, z: -5.4, color: 0x8a6a3a },
            { kind: 'solid', w: 1.4, h: 1.45, d: 1.4, x: 17.6, z: -3.0, color: 0x8a6a3a },
            { kind: 'solid', shape: 'cyl', rt: 0.16, rb: 0.22, h: 2.2, segments: 8, x: -16.5, z: 6.6, color: 0x5a4632 },
            { kind: 'solid', shape: 'sphere', r: 0.55, x: -18.6, z: -6.4, color: 0x3f5f3a, rough: 0.9 },
            { kind: 'visual', w: 1.4, h: 0.9, d: 0.12, x: -4, y: 2.4, z: 7.9, color: 0x8fa0b8, rough: 0.4 },
            { kind: 'visual', w: 1.4, h: 0.9, d: 0.12, x: 4, y: 2.4, z: 7.9, color: 0xa88f6a, rough: 0.4 }
        ],
        doors: [
            { side: 'north', at: 0, to: 'kitchen', label: 'KITCHEN' },
            { side: 'west', at: 0, to: 'dining', label: 'DINING' },
            { side: 'east', at: 0, to: 'living', label: 'SITTING ROOM' }
        ],
        loot: [
            { type: 'banana', x: -11, z: -6.6 },
            { type: 'apple', x: 5, z: 6.6 },
            { type: 'cheese', x: -6, z: 2.5 },
            { type: 'jam', x: 17.6, z: -3.0 },      // on top of the upper crate
            { type: 'milk', x: 16, z: 5.5 }
        ],
        restock: { floor: 3, gap: DELIVERY_GAP }
    },

    // ------------------------------------------------------------------ a long table to hide under
    {
        id: 'dining',
        label: 'DINING ROOM',
        ox: -300, oz: 300, hx: 16, hz: 15,
        spawn: { x: 0, z: 10 },
        arrive: 'The dining room — eight chairs and one long table',
        floor: { a: '#6a4a30', b: '#5b3f28', tile: 4.5, rough: 0.7 },
        wall: { color: 0x43312a, height: 7, thickness: 1, trim: 0x9a7a4f },
        lights: [{ color: 0xffdca8, intensity: 1.0, distance: 30, x: 0, y: 5.0, z: 0 }],
        furniture: [
            { kind: 'deco', w: 17, h: 0.05, d: 9.5, x: 0, y: 0.01, z: 0, color: 0x6d3b3b, rough: 0.95 },
            // 1.4 high: low enough to jump onto, and low enough that loot on it stays reachable.
            { kind: 'counter', w: 12, h: 1.4, d: 3.6, x: 0, z: 0, color: 0x7a5230 },
            // Chairs: the seat blocks, the back is visual so the mouse can slip underneath.
            ...[-4.2, -1.4, 1.4, 4.2].flatMap(x => [
                { kind: 'solid', w: 1.15, h: 0.85, d: 1.15, x, z: -3.3, color: 0x5d4433 },
                { kind: 'solid', w: 1.15, h: 0.85, d: 1.15, x, z: 3.3, color: 0x5d4433 },
                { kind: 'visual', w: 1.15, h: 1.25, d: 0.16, x, y: 0.85, z: -3.85, color: 0x5d4433 },
                { kind: 'visual', w: 1.15, h: 1.25, d: 0.16, x, y: 0.85, z: 3.85, color: 0x5d4433 }
            ]),
            { kind: 'counter', w: 7, h: 1.2, d: 1.8, x: -11, z: -13, color: 0x6b4a2f },
            { kind: 'solid', w: 4, h: 2.7, d: 1.6, x: 11.5, z: -13.2, color: 0x4a3524 },
            { kind: 'visual', w: 3.4, h: 1.6, d: 0.2, x: 11.5, y: 1.9, z: -12.3, color: 0xbfd4e0, rough: 0.15 },
            { kind: 'solid', w: 2.4, h: 0.9, d: 1.4, x: 8, z: 7, color: 0x8a8f96, metal: 0.5, rough: 0.3 },
            { kind: 'solid', shape: 'cyl', rt: 0.5, rb: 0.5, h: 0.9, segments: 10, x: -13.5, z: 9, color: 0x6b4a2f },
            { kind: 'visual', shape: 'cyl', rt: 1.1, rb: 1.1, h: 0.14, segments: 12, x: 0, y: 5.6, z: 0, color: 0xd4af37, metal: 0.6, rough: 0.3 },
            // Steps up to the china cabinet: a short climb with a view of the whole room.
            { kind: 'solid', w: 1.6, h: 0.6, d: 1.6, x: 13.4, z: 11.4, color: 0x8a6a3a },
            { kind: 'solid', w: 1.5, h: 1.15, d: 1.5, x: 13.4, z: 9.2, color: 0x8a6a3a }
        ],
        doors: [{ side: 'north', at: 0, to: 'hall', label: 'HALL' }],
        loot: [
            { type: 'cheese', x: -2.5, z: 0 },      // both of these stand on the table
            { type: 'bread', x: 2.5, z: 0.6 },
            { type: 'milk', x: -11, z: -13 },
            { type: 'apple', x: -6, z: 8 },
            { type: 'banana', x: 8, z: 7 },
            { type: 'jam', x: 13.4, z: 9.2 },
            { type: 'tomato', x: 6, z: -9 },
            { type: 'carrot', x: -13, z: -4 }
        ],
        restock: { floor: 3, gap: DELIVERY_GAP }
    },

    // ------------------------------------------------------- the fireplace, and a table with a drape
    {
        id: 'living',
        label: 'SITTING ROOM',
        ox: 300, oz: 300, hx: 17, hz: 16,
        spawn: { x: 0, z: 0 },
        arrive: 'The sitting room — check the hearth and under the drape',
        floor: { a: '#4d4038', b: '#42372f', tile: 4, rough: 0.8 },
        wall: { color: 0x33303f, height: 7, thickness: 1, trim: 0x8a7a5f },
        lights: [
            { color: 0xffc98a, intensity: 0.9, distance: 28, x: -4, y: 4.6, z: 2 },
            { color: 0xff9a4a, intensity: 0.8, distance: 14, x: -11.5, y: 1.2, z: -13.6 }
        ],
        furniture: [
            // Sofa: the seat is a climbable 0.45, the arms are walls, the back is visual.
            { kind: 'solid', w: 7.5, h: 0.45, d: 2.8, x: 2, z: 12.4, color: 0x3f5f7a, rough: 0.9 },
            { kind: 'visual', w: 7.5, h: 1.3, d: 0.7, x: 2, y: 0.45, z: 13.9, color: 0x37536b, rough: 0.9 },
            { kind: 'solid', w: 0.7, h: 0.85, d: 2.8, x: -1.9, z: 12.4, color: 0x37536b, rough: 0.9 },
            { kind: 'solid', w: 0.7, h: 0.85, d: 2.8, x: 5.9, z: 12.4, color: 0x37536b, rough: 0.9 },
            // A table under a floor-length cloth: only the pedestal blocks, so the whole
            // space beneath the top is a room of its own with loot in it.
            { kind: 'solid', w: 1.2, h: 0.92, d: 1.2, x: -4, z: 4, color: 0x6b4a2f },
            { kind: 'visual', w: 4.4, h: 0.18, d: 3.4, x: -4, y: 0.92, z: 4, color: 0x8a3b46, rough: 0.95 },
            { kind: 'solid', w: 5.2, h: 0.6, d: 1.5, x: 4, z: -14.4, color: 0x4a3524 },
            { kind: 'visual', w: 4.2, h: 2.3, d: 0.22, x: 4, y: 0.6, z: -14.6, color: 0x1b2430, rough: 0.2 },
            // Fireplace: two jambs with a hearth between them, a mantel overhead and a fire.
            { kind: 'solid', w: 1.3, h: 2.4, d: 1.6, x: -13.2, z: -14.2, color: 0x5a4a44 },
            { kind: 'solid', w: 1.3, h: 2.4, d: 1.6, x: -9.6, z: -14.2, color: 0x5a4a44 },
            { kind: 'visual', w: 5.4, h: 0.35, d: 1.9, x: -11.4, y: 2.4, z: -14.2, color: 0x6b5a52 },
            { kind: 'deco', w: 2.4, h: 0.1, d: 1.4, x: -11.4, y: 0.01, z: -14.3, color: 0x201a18, rough: 1 },
            { kind: 'deco', shape: 'cyl', rt: 0.13, rb: 0.13, h: 1.1, segments: 6, x: -11.4, y: 0.1, z: -14.4, color: 0x4a3221, rough: 0.95 },
            // Bookcase with a crate staircase up its face.
            { kind: 'solid', w: 6.5, h: 3.4, d: 1.5, x: 12.5, z: -14, color: 0x4a3524 },
            { kind: 'deco', w: 5.6, h: 0.5, d: 0.3, x: 12.5, y: 1.2, z: -13.1, color: 0x8a4a3a, rough: 0.9 },
            { kind: 'deco', w: 5.6, h: 0.5, d: 0.3, x: 12.5, y: 2.1, z: -13.1, color: 0x3a6a8a, rough: 0.9 },
            { kind: 'deco', w: 5.6, h: 0.5, d: 0.3, x: 12.5, y: 3.0, z: -13.1, color: 0x6a8a3a, rough: 0.9 },
            { kind: 'solid', w: 1.7, h: 0.8, d: 1.7, x: 8.2, z: -14, color: 0x8a6a3a },
            { kind: 'solid', w: 1.6, h: 1.45, d: 1.6, x: 8.2, z: -11.6, color: 0x8a6a3a },
            { kind: 'solid', w: 2.4, h: 0.7, d: 2.4, x: 10, z: 6, color: 0x6a4a5a, rough: 0.9 },
            { kind: 'visual', w: 2.4, h: 1.1, d: 0.6, x: 10, y: 0.7, z: 7.0, color: 0x5a3f4d, rough: 0.9 },
            { kind: 'solid', shape: 'cyl', rt: 0.55, rb: 0.45, h: 0.7, segments: 10, x: -14.5, z: 8, color: 0x8a5a3a },
            { kind: 'deco', shape: 'sphere', r: 1.15, x: -14.5, y: 0.7, z: 8, color: 0x3f6a3a, rough: 0.95 },
            { kind: 'solid', shape: 'cyl', rt: 0.09, rb: 0.14, h: 2.0, segments: 8, x: 14.5, z: 11, color: 0x2f2f38, metal: 0.5 },
            { kind: 'visual', shape: 'cyl', rt: 0.55, rb: 0.35, h: 0.5, segments: 10, x: 14.5, y: 2.0, z: 11, color: 0xf0dca8, rough: 0.9 }
        ],
        doors: [
            { side: 'west', at: 0, to: 'hall', label: 'HALL' },
            { side: 'east', at: -4, to: 'garden', label: 'GARDEN' }
        ],
        loot: [
            { type: 'cheese', x: -11.4, z: -13.9 }, // in the hearth, behind the log
            { type: 'jam', x: -5.4, z: 4 },         // under the draped table
            { type: 'milk', x: 4, z: -14.4 },
            { type: 'apple', x: -2.5, z: 12.4 },
            { type: 'bread', x: 8.2, z: -11.6 },    // on the upper crate by the bookcase
            { type: 'tomato', x: 10, z: 6 },
            { type: 'carrot', x: -8, z: 9 }
        ],
        restock: { floor: 3, gap: DELIVERY_GAP }
    },

    // ------------------------------------------------------------------------ outside, at last
    {
        id: 'garden',
        label: 'GARDEN',
        ox: 600, oz: 300, hx: 22, hz: 20,
        spawn: { x: -14, z: 0 },
        arrive: 'The garden — a shed, a pond and somewhere to hide',
        floor: { a: '#3c5a30', b: '#354f2a', tile: 2.8, rough: 0.95 },
        // A hedge, not a wall: low enough to read as a boundary from the outside world.
        wall: { color: 0x2c4423, height: 2.6, thickness: 1.4, trim: 0x6b4a2f, rough: 0.95 },
        lights: [
            { color: 0xbfd4ff, intensity: 0.55, distance: 44, x: 0, y: 9, z: 0 },
            { color: 0xffb066, intensity: 0.7, distance: 16, x: 12, y: 2.4, z: -10.4 }
        ],
        furniture: [
            // The shed: four walls and a doorway, with a roof the mouse walks under. Loot on
            // the shelf inside is the reward for finding the gap in the front.
            { kind: 'solid', w: 6.4, h: 3.0, d: 0.4, x: 12, z: -12.8, color: 0x6b4a2f, rough: 0.9 },
            { kind: 'solid', w: 0.4, h: 3.0, d: 5.2, x: 8.9, z: -10.4, color: 0x6b4a2f, rough: 0.9 },
            { kind: 'solid', w: 0.4, h: 3.0, d: 5.2, x: 15.1, z: -10.4, color: 0x6b4a2f, rough: 0.9 },
            { kind: 'solid', w: 1.9, h: 3.0, d: 0.4, x: 9.95, z: -8.0, color: 0x6b4a2f, rough: 0.9 },
            { kind: 'solid', w: 1.9, h: 3.0, d: 0.4, x: 14.05, z: -8.0, color: 0x6b4a2f, rough: 0.9 },
            { kind: 'visual', w: 7.0, h: 0.35, d: 5.8, x: 12, y: 3.0, z: -10.4, color: 0x4a3524, rough: 0.9 },
            { kind: 'solid', w: 3.2, h: 0.8, d: 1.2, x: 12, z: -12.0, color: 0x8a6a3a },
            { kind: 'solid', w: 5, h: 0.75, d: 5, x: -14, z: -8, color: 0x4a4438, rough: 1 },
            { kind: 'solid', w: 1.8, h: 0.95, d: 1.8, x: -6, z: -12, color: 0x8a6a3a },
            { kind: 'solid', w: 1.6, h: 1.45, d: 1.6, x: -6, z: -9.6, color: 0x8a6a3a },
            { kind: 'solid', shape: 'cyl', rt: 0.8, rb: 0.8, h: 1.5, segments: 12, x: -18, z: 6, color: 0x3a4a55, rough: 0.7 },
            // The pond is 0.06 high — under STEP_HEIGHT, so it is a floor you walk across
            // rather than a wall. A little sheen reads as water; a mirror finish turns every
            // lamp in the garden into a blown-out blob, so the roughness stays well up.
            { kind: 'solid', w: 9, h: 0.06, d: 6, x: 4, z: 12, color: 0x2f6f8f, rough: 0.45, metal: 0.05, flat: false },
            { kind: 'solid', w: 2.2, h: 0.6, d: 1.3, x: -2, z: 4, color: 0x5a6a4a, rough: 0.8 },
            { kind: 'visual', w: 0.14, h: 0.14, d: 1.6, x: -2, y: 0.6, z: 3.0, color: 0x4a3524 },
            { kind: 'solid', shape: 'cyl', rt: 1.1, rb: 1.25, h: 1.5, segments: 9, x: 18, z: 14, color: 0x2f4a26, rough: 0.95 },
            { kind: 'solid', shape: 'cyl', rt: 1.0, rb: 1.2, h: 1.6, segments: 9, x: -19, z: -15, color: 0x35522b, rough: 0.95 },
            { kind: 'solid', w: 9, h: 0.35, d: 2.4, x: -6, z: 17, color: 0x4a3a2a, rough: 1 },
            ...[-9, -7.5, -6, -4.5, -3].map((x, i) => ({
                kind: 'deco', shape: 'sphere', r: 0.22, x, y: 0.35, z: 17 + (i % 2 ? 0.5 : -0.5),
                color: [0xd4553f, 0xe0a83f, 0xd46a9f, 0xe8e0a0, 0x8a5fd4][i], rough: 0.8
            })),
            { kind: 'deco', shape: 'sphere', r: 0.7, x: 12, y: 0.02, z: 4, color: 0x6a7a5a, rough: 1 },
            { kind: 'deco', shape: 'sphere', r: 0.7, x: 15, y: 0.02, z: 1, color: 0x6a7a5a, rough: 1 },
            // A gnome by the flower bed, because a garden without one is just a field.
            { kind: 'deco', shape: 'cyl', rt: 0.28, rb: 0.4, h: 0.9, segments: 8, x: -12, z: 15, color: 0x3a5fa0, rough: 0.8 },
            { kind: 'deco', shape: 'sphere', r: 0.3, x: -12, y: 0.9, z: 15, color: 0xe0b48a, rough: 0.8 },
            { kind: 'deco', shape: 'cyl', rt: 0.02, rb: 0.34, h: 0.42, segments: 8, x: -12, y: 1.2, z: 15, color: 0xc0392b, rough: 0.8 }
        ],
        doors: [{ side: 'west', at: -4, to: 'living', label: 'SITTING ROOM' }],
        loot: [
            { type: 'carrot', x: -14, z: -8 },      // on the compost heap
            { type: 'carrot', x: -8, z: 2 },
            { type: 'tomato', x: -6, z: -12 },
            { type: 'tomato', x: -6, z: -9.6 },     // on the upper crate
            { type: 'cheese', x: 12, z: -12.0 },    // on the shed shelf
            { type: 'milk', x: 10.6, z: -10.6 },    // on the shed floor
            { type: 'apple', x: 16, z: 2 },
            { type: 'bread', x: -2, z: 4 },         // in the wheelbarrow
            { type: 'jam', x: -6, z: 17 }           // on the flower bed
        ],
        restock: { floor: 3, gap: DELIVERY_GAP }
    },

    // ------------------------------------------------------------------------ where it all goes
    {
        id: 'burrow',
        label: 'MOUSE BASE',
        ox: BURROW_ORIGIN_X, oz: 0, hx: BURROW_BOUND, hz: BURROW_BOUND,
        obstacles: burrowObstacles,
        collision: burrowCollision,
        spawn: { x: 0, z: BURROW_BOUND - 2.2 },
        arrive: 'Home sweet home — the chef cannot follow in here',
        brain: 'residents',
        build: 'buildBurrow',
        // The whole den — floor, walls, props, residents — is bespoke, so this spec carries
        // no floor, wall or furniture of its own; only the exit arch is registered here.
        doors: [{ side: 'south', at: 0, to: 'kitchen', label: 'KITCHEN', exit: BURROW_EXIT }]
    }
];
