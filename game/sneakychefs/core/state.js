/**
 * core/state.js — every shared global in the game, in one place.
 *
 * These are classic scripts in one global scope, so a module WRITES the fields it owns
 * and READS the others at runtime only (never while the file is being evaluated).
 * Load order in index.html therefore only matters for top-level initialisers.
 */

// Stage — created by world/scene.js
let scene, camera, renderer;

// Actor rigs — built by models/, driven by actors/
let mouseGroup, chefGroup, chefSpotlight;

// Geometry registries. These two are the kitchen's own lists, under the names its bespoke
// builders (world/kitchen.js, world/fridge.js, world/mousehole.js) have always used; map/rooms.js
// hands them to the room registry, and world/rooms.js merges them onto the world lists below.
let kitchenObstacles = [];        // { x, z, w, d, h } boxes bodies and props collide with
let cameraCollisionMeshes = [];   // meshes the orbit camera must not pass through

// Everything solid in the house: every room's lists above plus the walls that join them.
// Written once by world/rooms.js at the end of buildHouse (nothing adds geometry while the game
// runs), and read by world/physics.js and core/camera.js. Rooms are connected now, so a wheel
// shoved out of the pantry has to stop against the kitchen's doorway rather than roll through
// the wall it came out of — which means the whole house is the thing to test against.
let worldObstacles = [];
let worldCollisionMeshes = [];

// The hoard — spawned and driven by world/ingredients.js
let ingredients = [];

// Paws — actors/mouse.js hoists exactly one prop at a time; world/ingredients.js leaves a
// carried prop alone instead of running its physics.
let carriedItem = null;

// Game flow — core/areas.js and main.js
let currentArea = 'kitchen';   // whichever room the mouse is standing in — core/areas.js owns it
let isGameOver = false;
let isTraveling = false;
