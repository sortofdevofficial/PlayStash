/**
 * core/areas.js — which room the player is in, and how they change it.
 *
 * Walking into any doorway registered for the room flips `currentArea`, fades the screen,
 * and re-spawns the mouse just inside the door it came through. Everything it needs — the
 * spawn points, the labels, the arrival toasts, the doors themselves — comes from the room
 * records that world/rooms.js built out of map/rooms.js, so nothing here knows the layout.
 */

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

// Every door in the room the player is standing in is live at once, and the nearest one
// within its own trigger radius wins. Only the way home takes the load off your back:
// a doorway between two rooms upstairs is not the base's front door, so carrying a wheel
// through it has to keep working.
function checkPortalCrossing() {
    if (isTraveling) return;
    const room = activeRoom();
    const pos = mouseGroup.position;

    for (const p of room.portals) {
        if (Math.hypot(pos.x - p.x, pos.z - p.z) >= p.radius + PORTAL_ENTER_MARGIN) continue;
        if (p.to === 'burrow') stowCarried();
        travelTo(p.to, room.id);
        return;
    }
}
