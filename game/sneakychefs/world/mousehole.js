/**
 * world/mousehole.js — the portal between the two rooms.
 *
 * A semicircular arch cut into the kitchen's north wall (the wall the player faces on
 * spawn, so the way home is visible from the first frame). It is both a chute and a door:
 * props only fall through the painted mouth, while the player gets HOLE_ENTER_MARGIN more
 * radius so walking into the arch reads as an obvious doorway. core/areas.js decides which
 * end of the portal the player is crossing.
 */

// The doorway: a semicircular hole cut into the base of the north wall — the wall the
// player faces on spawn, so the way home is visible from the first frame. It doubles as
// the chute: any ingredient pushed inside MOUSE_HOLE.radius drops into the burrow stash,
// and the mouse itself passes through a slightly wider circle (see HOLE_ENTER_MARGIN).
const MOUSE_HOLE = { x: 0, z: -15.35, radius: 0.95, arch: 1.0 };
const HOLE_ENTER_MARGIN = 0.4;
let holeGlowMesh = null;

function buildMouseHole() {
    const arch = new THREE.Mesh(
        new THREE.CircleGeometry(MOUSE_HOLE.arch, 22, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.DoubleSide })
    );
    arch.position.set(MOUSE_HOLE.x, 0.002, -15.44);
    scene.add(arch);

    const rim = new THREE.Mesh(
        new THREE.RingGeometry(MOUSE_HOLE.arch, MOUSE_HOLE.arch + 0.16, 22, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x6e4f30, side: THREE.DoubleSide })
    );
    rim.position.set(MOUSE_HOLE.x, 0.001, -15.42);
    scene.add(rim);

    // Floor marker: a half-annulus bulging into the room, flat edge against the wall.
    holeGlowMesh = new THREE.Mesh(
        new THREE.RingGeometry(MOUSE_HOLE.radius, MOUSE_HOLE.radius + 0.85, 26, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({
            color: 0xffbe00, transparent: true, opacity: 0.18,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    holeGlowMesh.rotation.x = Math.PI / 2;
    holeGlowMesh.position.set(MOUSE_HOLE.x, 0.02, MOUSE_HOLE.z);
    scene.add(holeGlowMesh);
}

function updateMouseHoleGlow(time) {
    if (!holeGlowMesh) return;
    holeGlowMesh.material.opacity = 0.13 + Math.abs(Math.sin(time * 0.0022)) * 0.16;
}


function kitchenHoleDistance(x, z) {
    return Math.hypot(x - MOUSE_HOLE.x, z - MOUSE_HOLE.z);
}

function holeDistance(x, z) {
    return currentArea === 'burrow'
        ? Math.hypot(x - BURROW_EXIT.x, z - BURROW_EXIT.z)
        : kitchenHoleDistance(x, z);
}

// Props only drop through the painted mouth of the hole; the player gets a wider circle
// so walking into the arch reads as an obvious, unmissable doorway.
function holeRadius() {
    const hole = currentArea === 'burrow' ? BURROW_EXIT : MOUSE_HOLE;
    return hole.radius + HOLE_ENTER_MARGIN;
}
