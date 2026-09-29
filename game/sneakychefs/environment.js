/**
 * Sneaky Chefs: Kitchen Escape - Scene, Kitchen Environment, Cheese, Dust
 */

// Graphics quality: LOW mode stacks several cuts, biggest first:
//  - render resolution scale (pixelRatio 0.55): fewer pixels to shade is the single
//    biggest lever for GPU-bound lag, far more than shadows/antialiasing alone
//  - shadows off entirely (skips a whole extra scene render from the light's view)
//  - antialiasing off (needs the WebGL context recreated — can't be flipped live)
//  - the fill light removed (one less light every lit fragment has to be shaded against)
//  - fog removed and dust particles skipped entirely
// This is in-memory only for the current page load — no localStorage, so it always
// starts back at normal quality on refresh.
let lowGraphics = false;
let fillLight = null;

function applyGraphicsQuality() {
    if (!renderer) return;
    renderer.shadowMap.enabled = !lowGraphics;
    renderer.setPixelRatio(lowGraphics ? 0.55 : Math.min(window.devicePixelRatio, 2));
    scene.fog = lowGraphics ? null : new THREE.FogExp2(0x1a1a24, 0.025);
    if (fillLight) fillLight.visible = !lowGraphics;
    if (typeof chefSpotlight !== 'undefined' && chefSpotlight) chefSpotlight.visible = !lowGraphics;
}

// Antialiasing can only be set when the WebGL context is created, so switching it
// means building a brand new renderer on the same canvas and re-applying everything
// initScene originally set up on it.
function recreateRenderer() {
    const canvas = renderer.domElement;
    renderer.dispose();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowGraphics, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    applyGraphicsQuality();
}

function setLowGraphics(enabled) {
    lowGraphics = enabled;
    recreateRenderer();
}

function initScene() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 10, 14);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowGraphics, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    applyGraphicsQuality();

    // Lighting: sky/ground hemisphere gives faces facing up vs down different tints (what makes
    // flat-shaded facets read), a low ambient stops shadows going black, a warm key light casts
    // the shadows, and a cool fill from the opposite side lifts the shaded facets.
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x4a3b34, 0.5));
    scene.add(new THREE.AmbientLight(0xffeedd, 0.22));

    fillLight = new THREE.DirectionalLight(0x8fa4ff, 0.3);
    fillLight.position.set(-14, 10, -12);
    scene.add(fillLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dc, 1.0);
    dirLight.position.set(12, 20, 10);
    dirLight.castShadow = true;
    const shadowRes = lowGraphics ? 512 : 2048;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;
    const d = 18;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.03;
    scene.add(dirLight);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function buildKitchenEnvironment() {
    kitchenObstacles = [];
    cameraCollisionMeshes = [];

    // Checkerboard kitchen tiles: a tiny 2x2 canvas texture with NEAREST magnification, so the tile
    // edges stay crisp and blocky (fits the low-poly look) and it costs nothing in geometry.
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileCanvas.height = 64;
    const tctx = tileCanvas.getContext('2d');
    tctx.fillStyle = '#454558'; tctx.fillRect(0, 0, 64, 64);
    tctx.fillStyle = '#34344a'; tctx.fillRect(0, 0, 32, 32); tctx.fillRect(32, 32, 32, 32);
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(8, 8); // 2 tiles per repeat -> 16 x 16 tiles of 2 units
    tileTex.magFilter = THREE.NearestFilter;
    tileTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const floorTileMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.5, flatShading: true });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), floorTileMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.8 });
    const createWall = (w, h, d, x, y, z) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, y, z);
        wall.receiveShadow = true;
        scene.add(wall);
        cameraCollisionMeshes.push(wall);
    };
    createWall(32, 8, 1, 0, 4, -16);
    createWall(32, 8, 1, 0, 4, 16);
    createWall(1, 8, 32, -16, 4, 0);
    createWall(1, 8, 32, 16, 4, 0);

    const addObstacle = (w, h, d, x, z, color) => {
        const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 });
        // Body stops 0.02 short of the top so the lighter counter slab's top face is the only
        // surface at height h (no coplanar z-fighting); collision still uses the full h.
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.02, d), mat);
        mesh.position.set(x, (h - 0.02) / 2, z);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);

        // Lighter overhanging top: makes every platform's edge and standing surface easy to read
        const slabMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), flatShading: true, roughness: 0.4 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.12, d + 0.12), slabMat);
        slab.position.set(x, h - 0.06, z);
        slab.castShadow = slab.receiveShadow = true;
        scene.add(slab);

        kitchenObstacles.push({ x, z, w, d, h });
        cameraCollisionMeshes.push(mesh, slab);
    };

    addObstacle(8, 2.2, 3, 0, 0, 0x4a5568);
    addObstacle(3, 2.2, 7, -8, -2, 0x4a5568);
    addObstacle(3, 2.2, 7, 8, -2, 0x4a5568);
    addObstacle(3, 5.5, 3, -12, -12, 0xbdc3c7);

    addObstacle(1.6, 0.8, 1.6, -3.5, 5, 0x8b5a2b);
    addObstacle(1.6, 1.5, 1.6, -1.8, 3.5, 0x8b5a2b);
    addObstacle(1.6, 0.9, 1.6, 3.5, 5, 0x8b5a2b);
    addObstacle(1.6, 1.6, 1.6, 1.8, 3.5, 0x8b5a2b);

    chefWaypoints = [
        new THREE.Vector3(-10, 0, -10),
        new THREE.Vector3(10, 0, -10),
        new THREE.Vector3(10, 0, 8),
        new THREE.Vector3(-10, 0, 8)
    ];
}

// Cheese wheels are physical props: they rest on the actual floor/counter surface,
// fall with gravity, collide with walls and obstacles, and roll when the mouse's own
// body weight (its momentum) bumps into them. There is no pickup — rolling them around
// IS the interaction.
const CHEESE_RADIUS = 0.4;
const CHEESE_HEIGHT = 0.28;
const CHEESE_FRICTION = 1.6;   // per-second velocity decay while grounded
const CHEESE_MAX_SPEED = 9.0;
const KITCHEN_BOUND = 15.35;   // inner play area edge (walls sit just outside this)

function spawnCheeseCollectibles() {
    cheeseCollectibles = [];
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffbe00, flatShading: true });

    const positions = [
        { x: 0, z: 0 },
        { x: -1.8, z: 3.5 },
        { x: 8, z: -2 }
    ];

    positions.forEach((pos, idx) => {
        const group = new THREE.Group();
        // Wedge mesh is the child that actually spins as the wheel rolls; the group only
        // ever translates, so rotation and position never fight each other.
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(CHEESE_RADIUS, CHEESE_RADIUS, CHEESE_HEIGHT, 3), cheeseMat);
        mesh.rotation.y = Math.PI / 4;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        const floorY = getFloorY(pos.x, pos.z);
        group.position.set(pos.x, floorY + CHEESE_HEIGHT / 2, pos.z);
        scene.add(group);

        cheeseCollectibles.push({
            group, mesh,
            vel: new THREE.Vector3(),
            velY: 0,
            grounded: true,
            spawnPos: { x: pos.x, z: pos.z }
        });
    });
}

// Physics step for every cheese wheel: gravity/floor snap (mirrors the mouse's own
// grounding logic), wall/obstacle collision, friction, and a roll rotation driven by
// how far it actually moved this frame (distance / radius = rotation angle), so the
// spin always visually matches the motion regardless of speed.
function updateCheeseProps(dt) {
    cheeseCollectibles.forEach(c => {
        const pos = c.group.position;

        // Horizontal motion + friction (only while resting on a surface)
        if (c.grounded) {
            const speed = c.vel.length();
            if (speed > 0.001) {
                const decay = Math.max(0, 1 - CHEESE_FRICTION * dt);
                c.vel.multiplyScalar(decay);
                if (c.vel.length() < 0.03) c.vel.set(0, 0, 0);
            }
        }
        if (c.vel.lengthSq() > CHEESE_MAX_SPEED * CHEESE_MAX_SPEED) {
            c.vel.setLength(CHEESE_MAX_SPEED);
        }

        const prevX = pos.x, prevZ = pos.z;
        pos.x += c.vel.x * dt;
        pos.z += c.vel.z * dt;

        // Keep inside the room
        if (pos.x < -KITCHEN_BOUND) { pos.x = -KITCHEN_BOUND; c.vel.x = 0; }
        if (pos.x > KITCHEN_BOUND) { pos.x = KITCHEN_BOUND; c.vel.x = 0; }
        if (pos.z < -KITCHEN_BOUND) { pos.z = -KITCHEN_BOUND; c.vel.z = 0; }
        if (pos.z > KITCHEN_BOUND) { pos.z = KITCHEN_BOUND; c.vel.z = 0; }

        // Obstacle side-walls: same rule as the mouse (below the step height a box is a
        // wall, at/above it it's a floor), so cheese can roll UP onto a low counter's
        // edge but bounces off a tall obstacle's side.
        solveObstacleCollision(pos, CHEESE_RADIUS);

        // Vertical: gravity toward whatever surface is under its current resting height,
        // exactly like the mouse's own ground-snap.
        const floorY = getFloorY(pos.x, pos.z, pos.y - CHEESE_HEIGHT / 2 + 0.05);
        const restY = floorY + CHEESE_HEIGHT / 2;
        if (pos.y > restY + 0.001) {
            c.grounded = false;
            c.velY -= 28.0 * dt; // matches GRAVITY in index.js
            pos.y += c.velY * dt;
            if (pos.y <= restY) { pos.y = restY; c.velY = 0; c.grounded = true; }
        } else {
            pos.y = restY;
            c.velY = 0;
            c.grounded = true;
        }

        // Roll: rotate the child mesh around the horizontal axis perpendicular to the
        // direction actually travelled, by distance/radius — a true rolling rotation
        // rather than a spin that doesn't match the motion.
        const dx = pos.x - prevX, dz = pos.z - prevZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.0001) {
            const axis = new THREE.Vector3(dz, 0, -dx).normalize();
            c.mesh.rotateOnWorldAxis(axis, dist / CHEESE_RADIUS);
        }
    });
}

// An obstacle is a WALL to anything whose feet are more than STEP_HEIGHT below its top,
// and a FLOOR once the feet are within STEP_HEIGHT of it. getFloorY and
// solveObstacleCollision both use this same threshold, so there's no height band where
// neither applies (that gap is what let spam-jumping against a box slide you inside it
// and snap you onto the top).
const STEP_HEIGHT = 0.12;

// feetY: the caller's current height. Omit it to get the highest surface under (px, pz)
// regardless of height (used by the chef AI for placing smash rings).
function getFloorY(px, pz, feetY = Infinity) {
    let maxY = 0;
    for (const obs of kitchenObstacles) {
        if (Math.abs(px - obs.x) < obs.w / 2 && Math.abs(pz - obs.z) < obs.d / 2) {
            if (feetY >= obs.h - STEP_HEIGHT && obs.h > maxY) maxY = obs.h;
        }
    }
    return maxY;
}

function solveObstacleCollision(pos, radius) {
    for (const obs of kitchenObstacles) {
        const minX = obs.x - obs.w / 2 - radius;
        const maxX = obs.x + obs.w / 2 + radius;
        const minZ = obs.z - obs.d / 2 - radius;
        const maxZ = obs.z + obs.d / 2 + radius;

        // Side wall while the feet are below the top lip; at/above the lip it's a floor
        // (see STEP_HEIGHT), so it must not push sideways.
        if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ && pos.y < obs.h - STEP_HEIGHT) {
            const dxMin = Math.abs(pos.x - minX);
            const dxMax = Math.abs(pos.x - maxX);
            const dzMin = Math.abs(pos.z - minZ);
            const dzMax = Math.abs(pos.z - maxZ);
            const minDist = Math.min(dxMin, dxMax, dzMin, dzMax);

            if (minDist === dxMin) pos.x = minX;
            else if (minDist === dxMax) pos.x = maxX;
            else if (minDist === dzMin) pos.z = minZ;
            else if (minDist === dzMax) pos.z = maxZ;
        }
    }
}

// Simple particle dust puffs for landings/footsteps (cheap, pooled)
const dustMat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0.55 });
function spawnDust(pos, scale = 1.0) {
    if (lowGraphics) return; // dust is purely decorative — skip entirely in low graphics
    const count = Math.ceil(3 * scale);
    for (let i = 0; i < count; i++) {
        const geo = new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 4, 4);
        const mesh = new THREE.Mesh(geo, dustMat.clone());
        mesh.position.set(
            pos.x + (Math.random() - 0.5) * 0.3,
            pos.y + 0.05,
            pos.z + (Math.random() - 0.5) * 0.3
        );
        scene.add(mesh);
        footstepDust.push({
            mesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6),
            life: 0.5
        });
    }
}
function updateDust(dt) {
    for (let i = footstepDust.length - 1; i >= 0; i--) {
        const d = footstepDust[i];
        d.life -= dt;
        if (d.life <= 0) {
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            d.mesh.material.dispose();
            footstepDust.splice(i, 1);
            continue;
        }
        d.vel.y -= dt * 1.2;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.material.opacity = Math.max(0, d.life / 0.5) * 0.55;
        const s = 1 + (0.5 - d.life) * 1.5;
        d.mesh.scale.set(s, s, s);
    }
}
let lastDustTick = -1;