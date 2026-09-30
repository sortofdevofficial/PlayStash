/**
 * world/fridge.js — the fridge: the one object in the kitchen you can loot, enter and
 * light up, so it gets its own module.
 *
 * It is a real appliance rather than a painted bay: a walkable cavity behind two hinged
 * doors, a freezer stacked with goods above it, an interior lamp that fades up as the
 * doors swing, and cold air that spills onto the floor while it stands open.
 *
 * Collision contract: the shell uses world/kitchen.js's helpers, so the side and back
 * panels block bodies while the lid, shelves and doors are visual boxes the mouse walks
 * through. The doors open on approach, so a closed door never blocks anything.
 */

const FRIDGE = {
    x: -12.5,              // centre of the cavity
    mouthZ: -13.5,         // front plane the doors hang on
    backZ: -15.1,          // interior back wall, hard against the kitchen wall
    depth: 1.6,            // usable interior depth behind the doors (mouthZ - backZ)
    panel: 0.4,            // thickness of the shell panels
    cavityW: 2.8,          // interior width between the side panels
    height: 5.2,
    freezerY: 2.15,        // underside of the freezer compartment
    doorMax: 1.55,         // radians each door swings outward
    openRange: 2.45,       // mouse/prop distance at which the doors start to swing
    lipY: 0.1              // the interior floor stands this proud of the kitchen tiles
};

const COLD_TINT = 0xbfe0ff;
const SHELL_TINT = 0xdfe6ec;

let fridgeDoorL = null;
let fridgeDoorR = null;
let fridgeLamp = null;
let fridgeOpenK = 0;        // 0 = shut, 1 = wide open
let fridgeWasOpen = false;
const coldPuffs = [];
const coldGeo = new THREE.SphereGeometry(0.09, 4, 4);

function buildFridge() {
    const halfW = FRIDGE.cavityW / 2;          // 1.4
    const midZ = FRIDGE.mouthZ - FRIDGE.depth / 2;              // interior centre
    const shellD = FRIDGE.depth + FRIDGE.panel;                 // mouth to wall
    const shellZ = FRIDGE.mouthZ - shellD / 2;

    // Shell: sides and back are obstacles; the lip is a low platform you can step onto.
    addKitchenSolid(0.5, FRIDGE.height, shellD, FRIDGE.x - halfW - 0.25, shellZ, SHELL_TINT);
    addKitchenSolid(0.5, FRIDGE.height, shellD, FRIDGE.x + halfW + 0.25, shellZ, SHELL_TINT);
    addKitchenSolid(FRIDGE.cavityW + 1.0, FRIDGE.height, FRIDGE.panel, FRIDGE.x, FRIDGE.backZ - FRIDGE.panel / 2, SHELL_TINT);
    addKitchenSolid(FRIDGE.cavityW, FRIDGE.lipY, FRIDGE.depth, FRIDGE.x, midZ, 0xf2f7fb);

    // Everything above the walkable compartment is a visual box: a shelf that registered
    // as an obstacle would seal the fridge from the doorway inwards.
    addKitchenVisualBox(FRIDGE.cavityW + 1.2, 0.22, shellD, FRIDGE.x, FRIDGE.height + 0.1, shellZ, 0xc8d3db);
    addKitchenVisualBox(FRIDGE.cavityW, 0.08, FRIDGE.depth, FRIDGE.x, FRIDGE.freezerY, midZ, 0xe9f1f7);
    addKitchenVisualBox(FRIDGE.cavityW, 0.08, FRIDGE.depth, FRIDGE.x, FRIDGE.freezerY + 1.05, midZ, 0xe9f1f7);
    addKitchenVisualBox(FRIDGE.cavityW - 0.1, 0.06, FRIDGE.depth - 0.1, FRIDGE.x, FRIDGE.height - 0.05, midZ, 0x9fb0bd);

    // Interior lamp housing plus the light itself.
    addKitchenVisualBox(1.1, 0.09, 0.16, FRIDGE.x, FRIDGE.height - 0.2, FRIDGE.backZ + 0.35, 0xf7fbff);
    fridgeLamp = new THREE.PointLight(COLD_TINT, 0, 7.5, 2.0);
    fridgeLamp.position.set(FRIDGE.x, FRIDGE.freezerY - 0.35, midZ);
    scene.add(fridgeLamp);

    buildFreezerGoods();
    fridgeDoorL = buildFridgeDoor(FRIDGE.x - halfW, 1);
    fridgeDoorR = buildFridgeDoor(FRIDGE.x + halfW, -1);
    buildDoorRack(fridgeDoorL);
    buildDoorPocket(fridgeDoorR);
}

// Each door hangs from a hinge at one edge of the cavity and turns about that hinge, so
// the panel can be authored in door-local space with +x pointing at the free edge.
function buildFridgeDoor(hingeX, side) {
    const door = new THREE.Group();
    door.position.set(hingeX, 0, FRIDGE.mouthZ - 0.06);
    scene.add(door);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, FRIDGE.height - 0.35, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xeef3f7, flatShading: true, roughness: 0.35, metalness: 0.25 }));
    panel.position.set(side * 0.7, (FRIDGE.height - 0.35) / 2 + 0.1, 0);
    panel.castShadow = panel.receiveShadow = true;
    door.add(panel);

    // Dark gasket along the free edge reads as the seal when the doors are shut.
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.07, FRIDGE.height - 0.35, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x2b3138, flatShading: true, roughness: 0.8 }));
    edge.position.set(side * 1.37, panel.position.y, 0);
    door.add(edge);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x9aa7b3, flatShading: true, roughness: 0.3, metalness: 0.6 }));
    handle.position.set(side * 1.2, panel.position.y + 0.3, 0.16);
    door.add(handle);

    return door;
}

// Door-mounted racks on the left leaf: an egg carton and two bottles, out of reach of the
// mouse but the reason the door has a face at all.
function buildDoorRack(door) {
    const rack = (y, w) => {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.34),
            new THREE.MeshStandardMaterial({ color: 0xdce7ef, flatShading: true, roughness: 0.4 }));
        shelf.position.set(0.72, y, -0.2);
        door.add(shelf);
        return shelf;
    };
    const r1 = rack(1.5, 1.2);
    const carton = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xcbb894, flatShading: true, roughness: 0.7 }));
    carton.position.set(r1.position.x, 1.63, r1.position.z);
    door.add(carton);

    const r2 = rack(2.5, 1.2);
    [0.0, 0.3].forEach((dx, i) => {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.46, 8),
            new THREE.MeshStandardMaterial({ color: i ? 0x7fc8e8 : 0xf2f2ea, flatShading: true, roughness: 0.2 }));
        bottle.position.set(r2.position.x - 0.2 + dx, 2.76, r2.position.z);
        door.add(bottle);
    });
}

// A chilled jar and a knob of butter ride in the right door.
function buildDoorPocket(door) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xdce7ef, flatShading: true, roughness: 0.4 }));
    shelf.position.set(-0.72, 1.9, -0.2);
    door.add(shelf);

    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 10),
        new THREE.MeshStandardMaterial({ color: 0x4f9d5a, flatShading: true, roughness: 0.3 }));
    jar.position.set(-0.9, 2.14, shelf.position.z);
    door.add(jar);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 10),
        new THREE.MeshStandardMaterial({ color: 0xd4af37, flatShading: true, roughness: 0.4, metalness: 0.5 }));
    lid.position.set(-0.9, 2.38, shelf.position.z);
    door.add(lid);
}

// Stacked in the freezer: reachable-looking, never pushable, all the reward for opening it.
function buildFreezerGoods() {
    const z = FRIDGE.mouthZ - FRIDGE.depth / 2;
    const goods = [
        { geo: new THREE.CylinderGeometry(0.34, 0.3, 0.44, 10), color: 0xf0f4f8, x: FRIDGE.x - 0.8, y: FRIDGE.freezerY + 0.26, label: 'tub' },
        { geo: new THREE.BoxGeometry(0.66, 0.5, 0.24), color: 0x3d7fbf, x: FRIDGE.x + 0.7, y: FRIDGE.freezerY + 0.29, label: 'bag' },
        { geo: new THREE.BoxGeometry(1.5, 0.14, 1.1), color: 0xd8542f, x: FRIDGE.x - 0.5, y: FRIDGE.freezerY + 1.15, label: 'pizza' },
        { geo: new THREE.BoxGeometry(0.7, 0.24, 0.9), color: 0x8fd4ef, x: FRIDGE.x + 0.8, y: FRIDGE.freezerY + 1.2, label: 'ice' }
    ];
    goods.forEach(g => {
        const mesh = new THREE.Mesh(g.geo,
            new THREE.MeshStandardMaterial({ color: g.color, flatShading: true, roughness: 0.5 }));
        mesh.position.set(g.x, g.y, z);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
    });

    // Frost rim along the lip: pale enough to read as cold without being an obstacle.
    const frost = new THREE.Mesh(new THREE.BoxGeometry(FRIDGE.cavityW, 0.05, 0.16),
        new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.5 }));
    frost.position.set(FRIDGE.x, FRIDGE.lipY + 0.03, FRIDGE.mouthZ - 0.1);
    scene.add(frost);
}

function fridgeReach() {
    if (currentArea !== 'kitchen') return false;
    const pos = mouseGroup.position;
    if (Math.hypot(pos.x - FRIDGE.x, pos.z - (FRIDGE.mouthZ - 0.5)) < FRIDGE.openRange) return true;
    // A prop being shoved is as good as a mouse: the doors should already be open by the
    // time it reaches them. Goods merely parked inside must not hold it open all day.
    for (const item of ingredients) {
        if (item.sunk || item.stashing || item.vel.lengthSq() < 0.05) continue;
        const p = item.group.position;
        if (Math.hypot(p.x - FRIDGE.x, p.z - (FRIDGE.mouthZ - 0.5)) < 1.9) return true;
    }
    return false;
}

function spawnColdPuff(strength) {
    const mat = new THREE.MeshBasicMaterial({ color: COLD_TINT, transparent: true, opacity: 0.42 });
    const mesh = new THREE.Mesh(coldGeo, mat);
    mesh.position.set(
        FRIDGE.x + (Math.random() - 0.5) * FRIDGE.cavityW * 0.8,
        FRIDGE.lipY + Math.random() * 0.5,
        FRIDGE.mouthZ + 0.1
    );
    scene.add(mesh);
    coldPuffs.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.1 + Math.random() * 0.2, 0.7 + Math.random() * 0.7),
        life: 1.1,
        max: 1.1 * strength
    });
}

function updateColdPuffs(dt) {
    for (let i = coldPuffs.length - 1; i >= 0; i--) {
        const puff = coldPuffs[i];
        puff.life -= dt;
        if (puff.life <= 0) {
            scene.remove(puff.mesh);
            puff.mesh.material.dispose();
            coldPuffs.splice(i, 1);
            continue;
        }
        // Cold air is heavy: it spills forward and settles on the tiles.
        puff.vel.y -= dt * 0.5;
        puff.mesh.position.addScaledVector(puff.vel, dt);
        if (puff.mesh.position.y < 0.05) { puff.mesh.position.y = 0.05; puff.vel.y = Math.abs(puff.vel.y) * 0.2; }
        const k = puff.life / puff.max;
        puff.mesh.material.opacity = k * 0.42;
        const s = 1 + (1 - k) * 1.8;
        puff.mesh.scale.set(s, s * 0.7, s);
    }
}

function updateFridge(dt) {
    const open = fridgeReach();
    const rate = open ? 2.4 : 1.5;
    fridgeOpenK = THREE.MathUtils.clamp(fridgeOpenK + (open ? dt * rate : -dt * rate), 0, 1);

    if (fridgeDoorL) fridgeDoorL.rotation.y = -fridgeOpenK * FRIDGE.doorMax;
    if (fridgeDoorR) fridgeDoorR.rotation.y = fridgeOpenK * FRIDGE.doorMax;
    if (fridgeLamp) fridgeLamp.intensity = fridgeOpenK * 1.7;

    if (open && !fridgeWasOpen) playSound('door');
    fridgeWasOpen = open;

    if (fridgeOpenK > 0.2 && Math.random() < dt * 6 * fridgeOpenK) spawnColdPuff(1);
    updateColdPuffs(dt);
}
