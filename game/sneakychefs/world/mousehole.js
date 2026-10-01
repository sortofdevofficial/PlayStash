/**
 * world/mousehole.js — the arch between the kitchen and the base.
 *
 * A real gap in the kitchen's north wall (the wall the player faces on spawn, so the way home
 * is visible from the first frame) with a dark plug at the back of it: you look through the
 * opening and into a shallow recess, and the arch is painted on its end. The plug is a genuine
 * obstacle, which is what makes the chute work — a wheel rolls into the recess and stops there,
 * close enough to the hole's centre to be swallowed instead of continuing out through the wall
 * into the space behind the house.
 *
 * It is both a chute and a door: props fall in within MOUSE_HOLE.radius of the hole's centre,
 * while the player gets PORTAL_ENTER_MARGIN more, so walking into the arch reads as an obvious
 * doorway. core/areas.js owns the crossing; this file only draws it and measures the chute.
 *
 * The hole is a bespoke portal: map/rooms.js hands MOUSE_HOLE to the registry, which both cuts
 * the gap (2 * MOUSE_HOLE.arch across) and takes this arch's position and trigger radius.
 */
const MOUSE_HOLE = { x: 0, z: -15.35, radius: 0.95, arch: 1.0 };
let holeGlowMesh = null;

function buildMouseHole() {
    const t = roomById('kitchen').spec.wall.thickness;
    const outer = MOUSE_HOLE.z - t / 2;        // the outside of the house
    const inner = MOUSE_HOLE.z + t / 2;        // ... and the kitchen's own face
    const back = outer + 0.25;                 // front face of the plug, so the recess is most
    // of the wall's depth

    addKitchenSolid(MOUSE_HOLE.arch * 2, DOOR_H, 0.25, MOUSE_HOLE.x, outer + 0.125, 0x171209);

    const arch = new THREE.Mesh(
        new THREE.CircleGeometry(MOUSE_HOLE.arch, 22, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.DoubleSide })
    );
    arch.position.set(MOUSE_HOLE.x, 0.002, back + 0.012);
    scene.add(arch);

    const rim = new THREE.Mesh(
        new THREE.RingGeometry(MOUSE_HOLE.arch, MOUSE_HOLE.arch + 0.16, 22, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x6e4f30, side: THREE.DoubleSide })
    );
    rim.position.set(MOUSE_HOLE.x, 0.003, back + 0.011);
    scene.add(rim);

    // Floor marker: a half-annulus bulging into the room, flat edge against the wall. It stands
    // proud of the threshold slab so the doorway's stone does not clip the glow away.
    holeGlowMesh = new THREE.Mesh(
        new THREE.RingGeometry(MOUSE_HOLE.radius, MOUSE_HOLE.radius + 0.85, 26, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({
            color: 0xffbe00, transparent: true, opacity: 0.18,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    holeGlowMesh.rotation.x = Math.PI / 2;
    holeGlowMesh.position.set(MOUSE_HOLE.x, 0.05, inner);
    scene.add(holeGlowMesh);
    linkPortalGlow('kitchen', 'burrow', holeGlowMesh);
}

// The chute, not the doorway: a prop is only swallowed once it is inside the painted mouth.
function kitchenHoleDistance(x, z) {
    return Math.hypot(x - MOUSE_HOLE.x, z - MOUSE_HOLE.z);
}
