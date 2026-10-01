/**
 * core/areas.js — which room the player is in, and how they change it.
 *
 * Rooms tile one continuous floorplan, so an ordinary doorway is a gap in the masonry you
 * simply walk through: `updateAreaFromPosition` asks the registry which rect the mouse's feet
 * are in, and when that changes it re-labels the HUD, switches the lamps and shows the
 * arrival toast. Nothing is repositioned and the screen never fades.
 *
 * Two gates still jump, because they lead somewhere that is not next door: the mouse hole's
 * chute and the base's exit arch, with the den sitting 400 units away in the same scene. Those
 * are the `bespoke` portals, they keep a trigger radius and the fade, and `travelTo`/
 * `enterArea` below exist only for them.
 */

// Claim a room the mouse has walked into. His own walking put him here, so this moves nothing.
function setArea(room) {
    currentArea = room.id;
    document.getElementById('hud-area').textContent = room.label;
    lightActiveRoom();
    showToast(room.arrive);
}

// Only an entry once the point is clear of the masonry on that edge: walls are built ON the
// rect boundary and straddle it, so the threshold is half a wall's thickness inside it. Without
// the dead band, standing mid-doorway would flip the label, the lamps and the minimap's
// highlight every few frames — and each lamp switch recompiles every material in the scene.
function roomEntered(room, x, z) {
    const t = room.spec.wall ? room.spec.wall.thickness : 0;
    return Math.abs(x - room.ox) <= room.hx - t / 2 && Math.abs(z - room.oz) <= room.hz - t / 2;
}

function updateAreaFromPosition() {
    if (isTraveling || isGameOver) return;
    const pos = mouseGroup.position;
    const here = roomAt(pos.x, pos.z);
    if (here.id === currentArea) return;
    if (!roomEntered(here, pos.x, pos.z)) return;
    setArea(here);
}

function enterArea(area, fromId) {
    currentArea = area;
    const room = activeRoom();
    // Coming through a door puts you inside it, facing in; anything else (a restart) uses
    // the room's own spawn. The inset is wider than the door's trigger, so arriving never
    // walks you straight back out again.
    const at = (fromId && arrivalFor(room, fromId)) || room.spawn;

    mouseGroup.position.set(at.x, getFloorY(at.x, at.z), at.z);
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
    lightActiveRoom();
}

function travelTo(area, fromId) {
    if (isTraveling || isGameOver || currentArea === area) return;
    isTraveling = true;
    keys.forward = keys.backward = keys.left = keys.right = false;

    const fade = document.getElementById('fade');
    fade.classList.add('on');
    playSound('portal');

    setTimeout(() => {
        enterArea(area, fromId);
        fade.classList.remove('on');
        showToast(activeRoom().arrive);
        setTimeout(() => { isTraveling = false; }, 450);
    }, 450);
}

// The two gates that jump. An ordinary doorway has no trigger radius at all — you cross it by
// walking, and updateAreaFromPosition notices — so only the bespoke portals are checked here.
// Taking the load off your back belongs to the way home alone: a doorway between two rooms
// upstairs is not the base's front door, so carrying a wheel through one must keep working.
function checkPortalCrossing() {
    if (isTraveling) return;
    const room = activeRoom();
    const pos = mouseGroup.position;

    for (const p of room.portals) {
        if (!p.bespoke) continue;
        if (Math.hypot(pos.x - p.x, pos.z - p.z) >= p.radius + PORTAL_ENTER_MARGIN) continue;
        if (p.to === 'burrow') stowCarried();
        travelTo(p.to, room.id);
        return;
    }
}
