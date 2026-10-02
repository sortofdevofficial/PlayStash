/**
 * core/areas.js — which room the player is in, and what happens when he gets home.
 *
 * Rooms tile one continuous floorplan, so every opening in the house is a gap in the masonry you
 * simply walk through: `updateAreaFromPosition` asks the registry which rect the mouse's feet are
 * in, and when that changes it re-labels the HUD and swaps the lamps over. Nothing is
 * repositioned, nothing fades, and there is no gate left that moves him — the only thing that
 * still teleports is a restart, which calls `enterArea` directly.
 *
 * The mouse hole is where the kitchen's north wall meets the den behind it, so it is an ordinary
 * doorway and he crosses it on foot like any other. What is special about it is what it does to
 * his paws: walking into the base with a load puts the load in the pile.
 */

// Claim a room the mouse has walked into. His own feet put him here, so nothing is
// repositioned: the HUD relabels, the lamps swap over, and the one key light starts walking
// toward the new room instead of being dropped on it.
function setArea(room) {
    currentArea = room.id;
    document.getElementById('hud-area').textContent = room.label;
    lightActiveRoom();
}

// Only an entry once the point is clear of the masonry on that edge: walls are built ON the
// rect boundary and straddle it, so the threshold is half a wall's thickness inside it. Without
// the dead band, standing mid-doorway would flip the label and the lamps every few frames — and
// each lamp switch recompiles every material in the scene.
function roomEntered(room, x, z) {
    const t = room.spec.wall ? room.spec.wall.thickness : 0;
    return Math.abs(x - room.ox) <= room.hx - t / 2 && Math.abs(z - room.oz) <= room.hz - t / 2;
}

function updateAreaFromPosition() {
    if (isGameOver) return;
    const pos = mouseGroup.position;
    const here = roomAt(pos.x, pos.z, pos.y);
    if (here.id === currentArea) return;
    if (!roomEntered(here, pos.x, pos.z)) return;
    setArea(here);
}

// Restart only: put him back in the kitchen, on the floor, still, with the camera already in its
// orbit rather than lerping across the house to get there.
function enterArea(area) {
    currentArea = area;
    const room = activeRoom();
    const at = room.spawn;

    mouseGroup.position.set(at.x, (room.oy || 0) + getFloorY(at.x, at.z), at.z);
    mouseVel.set(0, 0, 0);
    jumpVelocity = 0;
    isGrounded = true;

    // Snap the camera straight to its orbit position: lerping from the last room would
    // spend most of a second flying through empty space hundreds of units away.
    const dir = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch),
        Math.sin(camPitch),
        Math.cos(camYaw) * Math.cos(camPitch)
    ).normalize();
    camera.position.copy(mouseGroup.position).add(new THREE.Vector3(0, 0.5, 0)).addScaledVector(dir, camDist);
    camera.lookAt(at.x, mouseGroup.position.y + 0.5, at.z);

    document.getElementById('hud-area').textContent = room.label;
    lightActiveRoom(true);
}

// The payoff for the trip home. `stowCarried` goes through `onIngredientStashed`, the same path a
// shoved prop takes, so the cap and the HUD stay honest whichever way the food gets in.
function checkBaseDeposit() {
    if (carriedItem && currentArea === 'burrow') stowCarried();
}
