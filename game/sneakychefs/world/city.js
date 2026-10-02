/**
 * world/city.js — the night city the house stands in, and the traffic that moves through it.
 *
 * It is a backdrop, not a place. Nothing here joins `worldObstacles` or `worldCollisionMeshes`,
 * so the mouse cannot stand on any of it, lean on it, shove it or be seen through it by anything
 * that reads those lists, and the only way to look at it is through a window or over the garden
 * hedge — both of which the masonry keeps sealed to a body.
 *
 * Two bands, because `FogExp2` at 0.025 finishes a fragment past ~70 units: a street ring close
 * enough to read as somewhere a car is actually driving, and a skyline beyond it whose lit
 * windows are drawn with `fog: false`, which is the whole trick behind city lights punching
 * through a haze the way a real one does. The ring hugs the house's own bounding box, taken from
 * the registry rather than written down here, so moving a room moves the street with it.
 */
let cityGroup = null;
let cityCars = [];

const CITY_STREET_OFFSET = 30;  // centreline of the ring, out from the house's own bounds
const CITY_ROAD_HALF = 17;      // ... and how wide the tarmac is either side of it
const CITY_LANE = 8.5;          // two-way: each direction keeps to its own half
const CITY_CAR_COUNT = 10;
const CITY_LAMP_COUNT = 10;
const CITY_BLOCK_COUNT = 16;

// The house's footprint, read off the registry. Every room is a rect, so this is the outline the
// street has to keep its distance from.
function houseBounds() {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    roomOrder.forEach(r => {
        x0 = Math.min(x0, r.ox - r.hx); x1 = Math.max(x1, r.ox + r.hx);
        z0 = Math.min(z0, r.oz - r.hz); z1 = Math.max(z1, r.oz + r.hz);
    });
    return { x0, x1, z0, z1 };
}

// The ring itself: the house's bounds pushed out by the street offset, walked as a closed loop.
function cityRing() {
    const b = houseBounds();
    const x0 = b.x0 - CITY_STREET_OFFSET, x1 = b.x1 + CITY_STREET_OFFSET;
    const z0 = b.z0 - CITY_STREET_OFFSET, z1 = b.z1 + CITY_STREET_OFFSET;
    const w = x1 - x0, h = z1 - z0;
    return { x0, x1, z0, z1, w, h, len: 2 * (w + h) };
}

// A point `s` along the loop, with the direction of travel and the outward normal. Forward is
// (sin yaw, 0, cos yaw) — the same convention actors/chef.js steers with.
function ringPoint(ring, s) {
    let d = ((s % ring.len) + ring.len) % ring.len;
    if (d < ring.w) return { x: ring.x0 + d, z: ring.z0, yaw: Math.PI / 2, nx: 0, nz: -1 };
    d -= ring.w;
    if (d < ring.h) return { x: ring.x1, z: ring.z0 + d, yaw: 0, nx: 1, nz: 0 };
    d -= ring.h;
    if (d < ring.w) return { x: ring.x1 - d, z: ring.z1, yaw: -Math.PI / 2, nx: 0, nz: 1 };
    d -= ring.w;
    return { x: ring.x0, z: ring.z1 - d, yaw: Math.PI, nx: -1, nz: 0 };
}

// One canvas of lit windows, reused by every block with its own repeat, so the density stays
// constant however tall the building is.
function cityWindowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 64);
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const roll = Math.random();
            if (roll < 0.55) continue;                       // dark: nobody home, or lights out
            ctx.fillStyle = roll > 0.94 ? '#ff7a5a' : roll > 0.82 ? '#bcd8ff' : '#ffd9a0';
            ctx.fillRect(col * 8 + 1.5, row * 8 + 2, 5, 4);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
}

// A block: one mesh. The body is a dark box and the emissive map is the windows, so at a
// distance through the haze it reads as a slab of lit rooms with no edges at all — which is
// exactly what a city looks like from a kitchen window at night.
function buildCityBlock(ring, s, windowTex) {
    const p = ringPoint(ring, s);
    const outward = CITY_ROAD_HALF + 16 + Math.random() * 26;
    const w = 16 + Math.random() * 22, d = 16 + Math.random() * 22;
    const h = 26 + Math.random() * 78;
    const tex = windowTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(2, Math.round(w / 7)), Math.max(3, Math.round(h / 7)));
    const mat = new THREE.MeshStandardMaterial({
        color: 0x0c0e14, roughness: 1, metalness: 0,
        emissive: 0xffffff, emissiveMap: tex, fog: false
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const x = p.x + p.nx * outward, z = p.z + p.nz * outward;
    mesh.position.set(x, h / 2 - 0.6, z);
    // Turn the block so its lit face looks back at the house rather than along the loop.
    mesh.rotation.y = Math.atan2((ring.x0 + ring.x1) / 2 - x, (ring.z0 + ring.z1) / 2 - z);
    cityGroup.add(mesh);
    return mesh;
}

// A car: body, cabin, and the two bars of light that actually identify it at night. The shells
// are fogged like everything else in the world; the lights are not, so a car far down the ring
// arrives as four dots and a rumour before it arrives as a vehicle.
function buildCityCar(bodyMat, glassMat, headMat, tailMat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.1, 12.5), bodyMat);
    body.position.y = 1.5;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 1.9, 5.6), glassMat);
    cabin.position.set(0, 3.4, -0.6);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.7, 0.4), headMat);
    head.position.set(0, 1.7, 6.3);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.6, 0.4), tailMat);
    tail.position.set(0, 1.9, -6.3);
    g.add(body, cabin, head, tail);
    cityGroup.add(g);
    return g;
}

function buildCity() {
    cityGroup = new THREE.Group();
    cityGroup.name = 'city';
    scene.add(cityGroup);
    const ring = cityRing();

    // Tarmac and the ground it sits on. One sheet each: the ring is four strips, laid over a
    // plain that goes on past the fog so there is never a visible edge to the world.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
        new THREE.MeshStandardMaterial({ color: 0x0e1015, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((ring.x0 + ring.x1) / 2, -0.08, (ring.z0 + ring.z1) / 2);
    cityGroup.add(ground);

    const asphalt = new THREE.MeshStandardMaterial({ color: 0x191c24, roughness: 0.85 });
    const strip = (alongX, line, from, to) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(
            alongX ? to - from : CITY_ROAD_HALF * 2, alongX ? CITY_ROAD_HALF * 2 : to - from), asphalt);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(alongX ? (from + to) / 2 : line, -0.03, alongX ? line : (from + to) / 2);
        cityGroup.add(mesh);
    };
    strip(true, ring.z0, ring.x0 - CITY_ROAD_HALF, ring.x1 + CITY_ROAD_HALF);
    strip(true, ring.z1, ring.x0 - CITY_ROAD_HALF, ring.x1 + CITY_ROAD_HALF);
    strip(false, ring.x0, ring.z0, ring.z1);
    strip(false, ring.x1, ring.z0, ring.z1);

    // The centre line, as dashes rather than a painted strip: one shared texture, four meshes,
    // and it catches the eye as "road" from any window without costing a shader.
    const dashCanvas = document.createElement('canvas');
    dashCanvas.width = dashCanvas.height = 32;
    const dctx = dashCanvas.getContext('2d');
    dctx.clearRect(0, 0, 32, 32);
    dctx.fillStyle = '#6b6446';
    dctx.fillRect(14, 4, 4, 16);
    const dashTex = new THREE.CanvasTexture(dashCanvas);
    dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
    const marking = (alongX, line, from, to) => {
        const len = to - from;
        const tex = dashTex.clone();
        tex.needsUpdate = true;
        // The dash is drawn down the canvas, so it has to tile along the axis the road runs on.
        if (alongX) tex.repeat.set(len / 14, 1); else tex.repeat.set(1, len / 14);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? len : 3, alongX ? 3 : len),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(alongX ? (from + to) / 2 : line, -0.01, alongX ? line : (from + to) / 2);
        cityGroup.add(mesh);
    };
    marking(true, ring.z0, ring.x0 - CITY_ROAD_HALF, ring.x1 + CITY_ROAD_HALF);
    marking(true, ring.z1, ring.x0 - CITY_ROAD_HALF, ring.x1 + CITY_ROAD_HALF);
    marking(false, ring.x0, ring.z0, ring.z1);
    marking(false, ring.x1, ring.z0, ring.z1);

    // Street lamps along the outer kerb: a pole and a head, and no light. Seven rooms of point
    // lights is what the house already spends; these are drawn, not lit.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.9 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false });
    for (let i = 0; i < CITY_LAMP_COUNT; i++) {
        const p = ringPoint(ring, (i + 0.5) * ring.len / CITY_LAMP_COUNT);
        const x = p.x + p.nx * (CITY_ROAD_HALF + 2.5), z = p.z + p.nz * (CITY_ROAD_HALF + 2.5);
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.7, 13, 0.7), poleMat);
        pole.position.set(x, 6.5, z);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.2), lampMat);
        head.position.set(x, 13.2, z);
        cityGroup.add(pole, head);
    }

    // The skyline: blocks pushed out beyond the road on every side, so whichever way a window
    // faces there is a city behind it.
    const windowBase = cityWindowTexture();
    for (let i = 0; i < CITY_BLOCK_COUNT; i++) {
        buildCityBlock(ring, (i + 0.35 + Math.random() * 0.3) * ring.len / CITY_BLOCK_COUNT, windowBase);
    }

    // A moon, because a night sky with nothing in it is a black rectangle. It has to sit inside
    // camera.far to render at all, which is why it is 130 units off the middle of the plan and
    // not on a sky dome.
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xdde6ff, fog: false }));
    moon.position.set((ring.x0 + ring.x1) / 2 + 55, 95, (ring.z0 + ring.z1) / 2 - 70);
    cityGroup.add(moon);

    // Traffic: half the cars run one way on the outer half of the road, half the other way on
    // the inner half, so they pass each other instead of convoying.
    const paint = [0x8a2f36, 0x2f4a7a, 0xb9b2a4, 0x3a5f48, 0x5a5148].map(c =>
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.2 }));
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x11141c, roughness: 0.25, metalness: 0.4 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3d2, fog: false });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d1e, fog: false });
    for (let i = 0; i < CITY_CAR_COUNT; i++) {
        const eastward = i % 2 === 0;
        cityCars.push({
            group: buildCityCar(paint[i % paint.length], glassMat, headMat, tailMat),
            s: (i / CITY_CAR_COUNT) * ring.len,
            speed: 16 + Math.random() * 10,
            dir: eastward ? 1 : -1,
            lane: eastward ? CITY_LANE : -CITY_LANE,
            ring
        });
    }
    updateCity(0);
}

// Called every frame from main.js. The loop is long enough that a car only crosses any one
// window's view for a couple of seconds, which is the point: traffic is something that keeps
// going while you are not looking at it.
function updateCity(dt) {
    if (!cityGroup) return;
    for (let i = 0; i < cityCars.length; i++) {
        const c = cityCars[i];
        c.s = (c.s + c.speed * dt * c.dir + c.ring.len) % c.ring.len;
        const p = ringPoint(c.ring, c.s);
        c.group.position.set(p.x + p.nx * c.lane, 0, p.z + p.nz * c.lane);
        c.group.rotation.y = c.dir > 0 ? p.yaw : p.yaw + Math.PI;
    }
}
