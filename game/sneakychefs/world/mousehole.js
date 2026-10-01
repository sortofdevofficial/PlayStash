/**
 * world/mousehole.js — the arch between the kitchen and the base.
 *
 * A semicircular hole cut into the kitchen's north wall (the wall the player faces on
 * spawn, so the way home is visible from the first frame). It is both a chute and a door:
 * props only fall through the painted mouth, which is MOUSE_HOLE.radius, while the player
 * gets PORTAL_ENTER_MARGIN more so walking into the arch reads as an obvious doorway.
 * core/areas.js owns the crossing; this file only draws the arch and measures the chute.
 *
 * The hole is a bespoke portal: map/rooms.js hands MOUSE_HOLE to the registry so the
 * doorway's position and trigger radius come from here, and no gap is cut in the wall —
 * the arch is painted onto it instead.
 */
const MOUSE_HOLE = { x: 0, z: -15.35, radius: 0.95, arch: 1.0 };
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
    linkPortalGlow('kitchen', 'burrow', holeGlowMesh);
}

// The chute, not the doorway: a prop is only swallowed once it is inside the painted mouth.
function kitchenHoleDistance(x, z) {
    return Math.hypot(x - MOUSE_HOLE.x, z - MOUSE_HOLE.z);
}
