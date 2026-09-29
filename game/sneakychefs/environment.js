/**
 * Sneaky Chefs: Kitchen Escape - Scene, Kitchen Environment, Cheese, Dust
 */

let fillLight = null;
const dustGeo = new THREE.SphereGeometry(0.06, 4, 4);

function initScene() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    scene.fog = new THREE.FogExp2(0x1a1a24, 0.025);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 10, 14);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // Lighting
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x4a3b34, 0.5));
    scene.add(new THREE.AmbientLight(0xffeedd, 0.22));

    fillLight = new THREE.DirectionalLight(0x8fa4ff, 0.3);
    fillLight.position.set(-14, 10, -12);
    scene.add(fillLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dc, 1.0);
    dirLight.position.set(12, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
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

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileCanvas.height = 64;
    const tctx = tileCanvas.getContext('2d');
    tctx.fillStyle = '#454558'; tctx.fillRect(0, 0, 64, 64);
    tctx.fillStyle = '#34344a'; tctx.fillRect(0, 0, 32, 32); tctx.fillRect(32, 32, 32, 32);
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(8, 8);
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

    buildMouseHole();

    const addObstacle = (w, h, d, x, z, color) => {
        const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.02, d), mat);
        mesh.position.set(x, (h - 0.02) / 2, z);
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);

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

// The escape target: a semicircular hole cut into the base of the north wall — the wall
// the player faces on spawn, so the objective is visible from the first frame. Its centre
// sits on the floor line at the wall's inner face, and MOUSE_HOLE.radius is the capture
// radius, deliberately equal to the inner edge of the floor glow below so the painted
// marker and the real trigger line up.
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
}

function updateMouseHoleGlow(time, allDelivered) {
    if (!holeGlowMesh) return;
    holeGlowMesh.material.opacity = allDelivered ? 0 : 0.13 + Math.abs(Math.sin(time * 0.0022)) * 0.16;
}

const CHEESE_RADIUS = 0.4;
const CHEESE_HEIGHT = 0.28;
const CHEESE_FRICTION = 1.6;
const CHEESE_MAX_SPEED = 9.0;
const KITCHEN_BOUND = 15.35;

function spawnCheeseCollectibles() {
    cheeseCollectibles = [];
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffbe00, flatShading: true });

    const positions = [
        { x: 0, z: 0 },
        { x: -1.8, z: 3.5 },
        { x: 8, z: -2 }
    ];

    positions.forEach((pos) => {
        const group = new THREE.Group();
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
            spawnPos: { x: pos.x, z: pos.z },
            escaping: false,
            sunk: false,
            escapeT: 0,
            escapeFrom: new THREE.Vector3()
        });
    });
}

const CHEESE_ESCAPE_TIME = 0.45;

function updateCheeseProps(dt) {
    cheeseCollectibles.forEach(c => {
        const pos = c.group.position;

        if (c.escaping || c.sunk) { animateCheeseEscape(c, dt); return; }

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

        if (pos.x < -KITCHEN_BOUND) { pos.x = -KITCHEN_BOUND; c.vel.x = 0; }
        if (pos.x > KITCHEN_BOUND) { pos.x = KITCHEN_BOUND; c.vel.x = 0; }
        if (pos.z < -KITCHEN_BOUND) { pos.z = -KITCHEN_BOUND; c.vel.z = 0; }
        if (pos.z > KITCHEN_BOUND) { pos.z = KITCHEN_BOUND; c.vel.z = 0; }

        solveObstacleCollision(pos, CHEESE_RADIUS);

        const floorY = getFloorY(pos.x, pos.z, pos.y - CHEESE_HEIGHT / 2 + 0.05);
        const restY = floorY + CHEESE_HEIGHT / 2;
        if (pos.y > restY + 0.001) {
            c.grounded = false;
            c.velY -= 28.0 * dt;
            pos.y += c.velY * dt;
            if (pos.y <= restY) { pos.y = restY; c.velY = 0; c.grounded = true; }
        } else {
            pos.y = restY;
            c.velY = 0;
            c.grounded = true;
        }

        const dx = pos.x - prevX, dz = pos.z - prevZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.0001) {
            const axis = new THREE.Vector3(dz, 0, -dx).normalize();
            c.mesh.rotateOnWorldAxis(axis, dist / CHEESE_RADIUS);
        }

        if (c.grounded && Math.hypot(pos.x - MOUSE_HOLE.x, pos.z - MOUSE_HOLE.z) < MOUSE_HOLE.radius) {
            c.escaping = true;
            c.escapeT = 0;
            c.vel.set(0, 0, 0);
            c.escapeFrom.copy(pos);
            onCheeseEscaped();
        }
    });
}

function animateCheeseEscape(c, dt) {
    if (c.sunk) return;
    c.escapeT += dt;
    const k = Math.min(1, c.escapeT / CHEESE_ESCAPE_TIME);
    const pos = c.group.position;
    pos.x = THREE.MathUtils.lerp(c.escapeFrom.x, MOUSE_HOLE.x, k * k);
    pos.z = THREE.MathUtils.lerp(c.escapeFrom.z, MOUSE_HOLE.z, k * k);
    pos.y = THREE.MathUtils.lerp(c.escapeFrom.y, -CHEESE_HEIGHT, k);
    const s = 1 - k;
    c.group.scale.set(s, s, s);
    if (k >= 1) {
        c.sunk = true;
        c.group.visible = false;
    }
}

function resetCheeseProps() {
    cheeseCollectibles.forEach(c => {
        c.escaping = false;
        c.sunk = false;
        c.escapeT = 0;
        c.group.visible = true;
        c.group.scale.set(1, 1, 1);
        c.group.position.set(
            c.spawnPos.x,
            getFloorY(c.spawnPos.x, c.spawnPos.z) + CHEESE_HEIGHT / 2,
            c.spawnPos.z
        );
        c.mesh.rotation.set(0, Math.PI / 4, 0);
        c.vel.set(0, 0, 0);
        c.velY = 0;
        c.grounded = true;
    });
}

const STEP_HEIGHT = 0.12;

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

// Particle dust puffs sharing geometry and material to prevent GC stuttering
function spawnDust(pos, scale = 1.0) {
    const count = Math.ceil(3 * scale);
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0.55 });
        const mesh = new THREE.Mesh(dustGeo, mat);
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