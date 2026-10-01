/**
 * core/areas.js — which room the player is in, and how they change it.
 *
 * Walking into either end of the portal flips `currentArea`, fades the screen, and
 * re-spawns the mouse at the far room's entry point. AREA_SPAWN reads BURROW_ORIGIN_X and
 * BURROW_BOUND at load time, so this file must load after world/burrow.js — the only
 * cross-file top-level read in the game.
 */
const AREA_SPAWN = {
    kitchen: { x: 0, z: 9, label: 'KITCHEN' },
    burrow: { x: BURROW_ORIGIN_X, z: BURROW_BOUND - 2.2, label: 'MOUSE BASE' }
};

function enterArea(area) {
    currentArea = area;
    const spawn = AREA_SPAWN[area];

    mouseGroup.position.set(spawn.x, getFloorY(spawn.x, spawn.z), spawn.z);
    mouseVel.set(0, 0, 0);
    jumpVelocity = 0;
    isGrounded = true;

    // Snap the camera straight to its orbit position: lerping from the kitchen would
    // spend most of a second flying through empty space 400 units away.
    const dir = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch),
        Math.sin(camPitch),
        Math.cos(camYaw) * Math.cos(camPitch)
    ).normalize();
    camera.position.copy(mouseGroup.position).add(new THREE.Vector3(0, 0.5, 0)).addScaledVector(dir, camDist);
    camera.lookAt(spawn.x, mouseGroup.position.y + 0.5, spawn.z);

    document.getElementById('hud-area').textContent = spawn.label;
}

function travelTo(area) {
    if (isTraveling || isGameOver || currentArea === area) return;
    isTraveling = true;
    keys.forward = keys.backward = keys.left = keys.right = false;

    const fade = document.getElementById('fade');
    fade.classList.add('on');
    playSound('portal');

    setTimeout(() => {
        enterArea(area);
        fade.classList.remove('on');
        showToast(area === 'burrow'
            ? 'Home sweet home — the chef cannot follow in here'
            : 'Back to the kitchen — keep foraging');
        setTimeout(() => { isTraveling = false; }, 450);
    }, 450);
}

// The hole works both ways: walk into it and you are in the base, walk back out and you
// are in the kitchen. Anything in the paws goes into the pile at the door.
function checkHoleCrossing() {
    if (isTraveling) return;
    const pos = mouseGroup.position;
    if (holeDistance(pos.x, pos.z) >= holeRadius()) return;
    if (currentArea !== 'burrow') stowCarried();
    travelTo(currentArea === 'burrow' ? 'kitchen' : 'burrow');
}
