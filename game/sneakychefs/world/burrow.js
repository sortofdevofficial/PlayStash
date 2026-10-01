/**
 * world/burrow.js — the mouse base: the room behind the hole.
 *
 * Parked at x = BURROW_ORIGIN_X in the same scene as the kitchen, and invisible from it
 * because the fog and camera.far never reach that far. Owns its own obstacle and camera
 * lists (burrowObstacles / burrowCollision) so world/physics.js can swap by area, the
 * cutaway shell that lets the orbit camera look in, and the stash pile every stashed
 * ingredient lands on. The residents themselves live in actors/residents.js.
 */
/**
 * Sneaky Chefs: Kitchen Escape - Mouse Base (the burrow behind the kitchen hole)
 */

// The burrow is parked far along +X in the same scene rather than in its own level: the
// exponential fog plus its own walls mean neither area can ever be seen from the other,
// which avoids needing a scene-teardown path. Keeping it at y = 0 also means floor
// heights and gravity behave exactly as they do in the kitchen.
const BURROW_ORIGIN_X = 400;
const BURROW_BOUND = 9.4;
const BURROW_EXIT = { x: BURROW_ORIGIN_X, z: BURROW_BOUND, radius: 1.1 };
const STASH_ANCHOR = { x: BURROW_ORIGIN_X - 4.5, z: -3.5 };
// The hoard is decoration, and the kitchen restocks forever, so the pile is capped: past
// this many the oldest item leaves it rather than the base growing without end.
const STASH_PILE_CAP = 26;

let burrowGroup = null;
let burrowObstacles = [];
let burrowCollision = [];
let burrowGlowMesh = null;
// Shell sides keyed by the direction they face outward, so the view code can hide the
// ones standing between the orbit camera and the room.
let burrowWalls = { posZ: [], negZ: [], posX: [], negX: [] };
const stashedIngredients = [];   // the hoard: one entry per ingredient pushed down the hole

function addBurrowBox(w, h, d, x, z, color, y = 0) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 })
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    burrowGroup.add(mesh);
    return mesh;
}

function buildBurrow() {
    burrowGroup = new THREE.Group();
    scene.add(burrowGroup);
    burrowObstacles = [];
    burrowCollision = [];

    // Packed-earth floor, warmer than the kitchen tiles. Deliberately much wider than the
    // room: the orbit camera ends up outside the shell (see burrowWalls), and a floor that
    // stopped at the walls would show its own edge through the frame.
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = dirtCanvas.height = 64;
    const dctx = dirtCanvas.getContext('2d');
    dctx.fillStyle = '#5a4535'; dctx.fillRect(0, 0, 64, 64);
    dctx.fillStyle = '#634c3b'; dctx.fillRect(0, 0, 32, 32); dctx.fillRect(32, 32, 32, 32);
    const dirtTex = new THREE.CanvasTexture(dirtCanvas);
    dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
    dirtTex.repeat.set(18, 18);
    dirtTex.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.9, flatShading: true })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(BURROW_ORIGIN_X, 0, 0);
    floor.receiveShadow = true;
    burrowGroup.add(floor);

    // Walls: the +Z one carries the way back to the kitchen, so it is built in two
    // leaves with a gap in the middle instead of one solid run. They are NOT camera
    // obstacles — see the cutaway note on burrowWalls.
    const wallW = 22, wallH = 7, wallT = 1;
    burrowWalls = { posZ: [], negZ: [], posX: [], negX: [] };
    const wall = (side, w, d, x, z) => {
        burrowWalls[side].push(addBurrowBox(w, wallH, d, x, z, 0x4a3728));
    };
    wall('negZ', wallW, wallT, BURROW_ORIGIN_X, -BURROW_BOUND - wallT / 2);
    wall('negX', wallT, wallW, BURROW_ORIGIN_X - BURROW_BOUND - wallT / 2, 0);
    wall('posX', wallT, wallW, BURROW_ORIGIN_X + BURROW_BOUND + wallT / 2, 0);
    wall('posZ', BURROW_BOUND - 1.4, wallT, BURROW_ORIGIN_X - (BURROW_BOUND + 1.4) / 2, BURROW_BOUND + wallT / 2);
    wall('posZ', BURROW_BOUND - 1.4, wallT, BURROW_ORIGIN_X + (BURROW_BOUND + 1.4) / 2, BURROW_BOUND + wallT / 2);

    // The way back: a matching arch on the inside face of the +Z wall.
    const arch = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 22, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x0d0a08, side: THREE.DoubleSide })
    );
    arch.position.set(BURROW_EXIT.x, 0.002, BURROW_BOUND - 0.06);
    burrowGroup.add(arch);

    burrowGlowMesh = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.85, 26, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
    );
    burrowGlowMesh.rotation.x = -Math.PI / 2;
    burrowGlowMesh.position.set(BURROW_EXIT.x, 0.02, BURROW_EXIT.z);
    burrowGroup.add(burrowGlowMesh);

    buildBurrowProps();
    spawnBurrowMice();
}

function buildBurrowProps() {
    const O = BURROW_ORIGIN_X;

    // A cheese wheel pressed into service as the family table
    const table = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.5, 0.7, 8),
        new THREE.MeshStandardMaterial({ color: 0xffbe00, flatShading: true, roughness: 0.45 })
    );
    table.position.set(O + 3.5, 0.35, 2.5);
    table.castShadow = table.receiveShadow = true;
    burrowGroup.add(table);
    burrowObstacles.push({ x: O + 3.5, z: 2.5, w: 3, d: 3, h: 0.7 });
    burrowCollision.push(table);

    // Matchbox bed with a crumb pillow
    const bed = addBurrowBox(2.4, 0.5, 1.5, O - 5.5, 4, 0xb5651d);
    burrowObstacles.push({ x: O - 5.5, z: 4, w: 2.4, d: 1.5, h: 0.5 });
    burrowCollision.push(bed);
    const pillow = addBurrowBox(0.7, 0.28, 1.1, O - 6.3, 4, 0xf0e2c0);
    burrowCollision.push(pillow);

    // Acorn stool and a jar-lamp that lights the room
    const stool = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0x8b6b3d, flatShading: true, roughness: 0.6 })
    );
    stool.position.set(O + 1, 0.5, -1.5);
    stool.scale.set(1, 0.85, 1);
    stool.castShadow = true;
    burrowGroup.add(stool);
    burrowObstacles.push({ x: O + 1, z: -1.5, w: 1.2, d: 1.2, h: 1 });
    burrowCollision.push(stool);

    const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4326, flatShading: true })
    );
    post.position.set(O - 1.5, 1.7, -6);
    burrowGroup.add(post);
    const lamp = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.45, 0),
        new THREE.MeshBasicMaterial({ color: 0xffd98a })
    );
    lamp.position.set(O - 1.5, 3.5, -6);
    burrowGroup.add(lamp);

    // Warm fill so the base reads as somewhere safe to be
    const glow = new THREE.PointLight(0xffc178, 1.15, 26, 2);
    glow.position.set(O - 1.5, 3.4, -5);
    burrowGroup.add(glow);
    const fill = new THREE.PointLight(0xffb066, 0.55, 30, 2);
    fill.position.set(O + 3, 4.5, 4);
    burrowGroup.add(fill);
}


function updateBurrowView(time) {
    if (burrowGlowMesh) {
        burrowGlowMesh.material.opacity = 0.14 + Math.abs(Math.sin(time * 0.0018)) * 0.14;
    }
    if (!burrowWalls) return;

    const inside = currentArea === 'burrow';
    const beyond = {
        posZ: inside && camera.position.z > BURROW_BOUND,
        negZ: inside && camera.position.z < -BURROW_BOUND,
        posX: inside && camera.position.x > BURROW_ORIGIN_X + BURROW_BOUND,
        negX: inside && camera.position.x < BURROW_ORIGIN_X - BURROW_BOUND
    };
    Object.keys(burrowWalls).forEach(side => {
        burrowWalls[side].forEach(mesh => { mesh.visible = !beyond[side]; });
    });
}

// Delivered ingredients reappear here so the hoard you have built is visible.
function addToStash(ingredient) {
    const slot = stashedIngredients.length;
    const angle = slot * 2.39996; // golden angle, so the pile spreads instead of lining up
    const radius = 0.85 + Math.sqrt(slot) * 0.62;
    const x = STASH_ANCHOR.x + Math.cos(angle) * radius;
    const z = STASH_ANCHOR.z + Math.sin(angle) * radius;

    const prop = ingredient.group.clone(true);
    prop.visible = true;
    prop.scale.set(1, 1, 1);
    prop.position.set(x, getFloorY(x, z, Infinity, burrowObstacles) + 0.02, z);
    prop.rotation.set(0, Math.random() * Math.PI * 2, 0);
    burrowGroup.add(prop);
    stashedIngredients.push(prop);
    if (stashedIngredients.length > STASH_PILE_CAP) {
        // Detach only: a clone shares its source's geometry and material, so disposing here
        // would gut the very props still sitting on the kitchen floor.
        burrowGroup.remove(stashedIngredients.shift());
    }
}
