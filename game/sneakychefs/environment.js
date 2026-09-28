/**
 * Sneaky Chefs: Kitchen Escape - High Performance Renderer & Scene Setup
 */

let dustPool = [];
const DUST_POOL_SIZE = 24;
const sharedDustGeo = new THREE.IcosahedronGeometry(0.05, 0);

function initScene() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12121a);
    scene.fog = new THREE.FogExp2(0x12121a, 0.022);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.2, 80);
    camera.position.set(0, 10, 14);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xfff0e0, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaec, 1.0);
    dirLight.position.set(12, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.03;

    const d = 16;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 35;
    scene.add(dirLight);

    initDustPool();
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function spawnCheeseCollectibles() {
    cheeseCollectibles = [];
    const cheeseMat = new THREE.MeshStandardMaterial({
        color: 0xffbe00,
        emissive: 0x664400,
        flatShading: true,
        roughness: 0.3
    });

    const positions = [
        { x: 0, y: 2.5, z: 0 },
        { x: -1.8, y: 1.7, z: 3.5 },
        { x: 8, y: 2.5, z: -2 },
        { x: -8, y: 2.5, z: -2 }
    ];

    positions.forEach((pos, idx) => {
        const group = new THREE.Group();
        const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 3), cheeseMat);
        cheese.rotation.y = Math.PI / 4;
        cheese.castShadow = true;
        group.add(cheese);

        const ringGeo = new THREE.RingGeometry(0.48, 0.6, 12);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -pos.y + 0.02;
        group.add(ring);

        group.position.set(pos.x, pos.y, pos.z);
        scene.add(group);

        cheeseCollectibles.push({ group, pos, collected: false, id: idx, ring });
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

// Particle Pool (Zero Garbage Collection Pressure)
function initDustPool() {
    dustPool = [];
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0, transparent: true, opacity: 0 });
        const mesh = new THREE.Mesh(sharedDustGeo, mat);
        mesh.visible = false;
        scene.add(mesh);
        dustPool.push({ mesh, vel: new THREE.Vector3(), life: 0, active: false });
    }
}

function spawnDust(pos, scale = 1.0) {
    let spawned = 0;
    const count = Math.ceil(2 * scale);
    for (let i = 0; i < DUST_POOL_SIZE && spawned < count; i++) {
        const p = dustPool[i];
        if (!p.active) {
            p.active = true;
            p.life = 0.4;
            p.mesh.visible = true;
            p.mesh.position.set(pos.x + (Math.random() - 0.5) * 0.2, pos.y + 0.05, pos.z + (Math.random() - 0.5) * 0.2);
            p.vel.set((Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
            spawned++;
        }
    }
}

function updateDust(dt) {
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
        const p = dustPool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
            p.active = false;
            p.mesh.visible = false;
            continue;
        }
        p.vel.y -= dt * 1.2;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.material.opacity = (p.life / 0.4) * 0.5;
    }
}