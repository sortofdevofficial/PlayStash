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

// Geometry registries. world/kitchen.js and world/fridge.js fill the kitchen lists;
// world/burrow.js keeps the base's own lists. world/physics.js reads whichever pair
// belongs to the area the player is standing in.
let kitchenObstacles = [];        // { x, z, w, d, h } boxes bodies and props collide with
let cameraCollisionMeshes = [];   // meshes the orbit camera must not pass through

// The hoard — spawned and driven by world/ingredients.js
let ingredients = [];

// Paws — actors/mouse.js hoists exactly one prop at a time; world/ingredients.js leaves a
// carried prop alone instead of running its physics.
let carriedItem = null;

// Game flow — core/areas.js and main.js
let currentArea = 'kitchen';   // 'kitchen' | 'burrow'
let isGameOver = false;
let isTraveling = false;
