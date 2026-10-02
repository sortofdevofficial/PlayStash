/**
 * world/kitchen.js — the kitchen's bespoke parts, and the helpers world/fridge.js is built
 * out of.
 *
 * The room itself — floor, walls, counters, pedestals, doorways, loot — is data in
 * map/rooms.js and world/rooms.js builds it before this hook runs. What is left here is the
 * two things no other room has: the mouse hole in the north wall and the walk-in fridge.
 * Nothing here knows about the player; geometry only.
 */

// Plain box that blocks movement, without the counter overhang addRoomBlock draws.
function addKitchenSolid(w, h, d, x, z, color) {
    return addRoomSolid(roomById('kitchen'), w, h, d, x, z, color);
}

// Geometry the camera must not pass through, but that the mouse walks under freely:
// anything tall enough to be a wall above the step height would otherwise seal an opening.
function addKitchenVisualBox(w, h, d, x, y, z, color) {
    return addRoomVisual(roomById('kitchen'), w, h, d, x, y, z, color);
}

function buildKitchenEnvironment(room) {
    buildMouseHole();
    buildFridge();
    // The lamp belongs to the room's lighting budget, so it goes out with the rest of them
    // when the player leaves; updateFridge still owns its intensity.
    room.lights.push(fridgeLamp);
}
