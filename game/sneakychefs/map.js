/**
 * Sneaky Chefs: Kitchen Escape - Kitchen Environment & Minimap
 */

function buildKitchenEnvironment() {
    kitchenObstacles = [];
    cameraCollisionMeshes = [];

    // --- Materials Palette ---
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1d1e2b, flatShading: true, roughness: 0.8 });
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, flatShading: true, roughness: 0.6 });
    const woodTopMat = new THREE.MeshStandardMaterial({ color: 0xa06c3f, flatShading: true, roughness: 0.4 });
    const counterBaseMat = new THREE.MeshStandardMaterial({ color: 0x3b4252, flatShading: true, roughness: 0.5 });
    const metalFridgeMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, flatShading: true, roughness: 0.25, metalness: 0.6 });
    const stoveMat = new THREE.MeshStandardMaterial({ color: 0x222630, flatShading: true, roughness: 0.4, metalness: 0.5 });
    const burnerMat = new THREE.MeshStandardMaterial({ color: 0x111115, flatShading: true, roughness: 0.8 });
    const burnerGlowMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, flatShading: true, roughness: 0.3, metalness: 0.8 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8c5e38, flatShading: true, roughness: 0.7 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8899a6, flatShading: true, roughness: 0.3, metalness: 0.7 });

    // --- Single Textured Floor Plane ---
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const tileSize = 256 / 8;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#2b2e3e' : '#363a4e';
            ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
    }
    const floorTexture = new THREE.CanvasTexture(canvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(2, 2);

    const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.4, metalness: 0.1 });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // --- Boundary Walls & Baseboards ---
    const createWall = (w, h, d, x, y, z) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, y, z);
        wall.receiveShadow = true;
        scene.add(wall);
        cameraCollisionMeshes.push(wall);

        const trimMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, flatShading: true, roughness: 0.7 });
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d > w ? d + 0.05 : d + 0.05), trimMat);
        trim.position.set(x, 0.15, z);
        scene.add(trim);
    };

    createWall(32, 10, 1, 0, 5, -16);
    createWall(32, 10, 1, 0, 5, 16);
    createWall(1, 10, 32, -16, 5, 0);
    createWall(1, 10, 32, 16, 5, 0);

    // --- Mouse Hole ---
    const mouseHoleMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
    const mouseHole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 12, 1, false, 0, Math.PI), mouseHoleMat);
    mouseHole.rotation.x = Math.PI / 2;
    mouseHole.position.set(0, 0.6, 15.42);
    scene.add(mouseHole);

    const addObstacleMesh = (mesh, w, h, d, x, z) => {
        kitchenObstacles.push({ x, z, w, d, h });
        cameraCollisionMeshes.push(mesh);
    };

    // --- 1. Central Prep Island ---
    const islandW = 8, islandH = 2.3, islandD = 3.4, islandX = 0, islandZ = 0;
    const islandGroup = new THREE.Group();
    islandGroup.position.set(islandX, 0, islandZ);

    const islandBase = new THREE.Mesh(new THREE.BoxGeometry(islandW - 0.4, islandH - 0.2, islandD - 0.4), counterBaseMat);
    islandBase.position.y = (islandH - 0.2) / 2;
    islandBase.castShadow = islandBase.receiveShadow = true;
    islandGroup.add(islandBase);

    const islandTop = new THREE.Mesh(new THREE.BoxGeometry(islandW, 0.2, islandD), woodTopMat);
    islandTop.position.y = islandH - 0.1;
    islandTop.castShadow = islandTop.receiveShadow = true;
    islandGroup.add(islandTop);

    for (let side = -1; side <= 1; side += 2) {
        for (let i = -2; i <= 2; i += 2) {
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.1), handleMat);
            handle.position.set(i, 1.2, side * (islandD / 2 + 0.03));
            islandGroup.add(handle);
        }
    }

    const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.0), woodDarkMat);
    board.position.set(-1.8, islandH + 0.04, 0.2);
    board.rotation.y = 0.2;
    board.castShadow = true;
    islandGroup.add(board);

    scene.add(islandGroup);
    addObstacleMesh(islandBase, islandW, islandH, islandD, islandX, islandZ);

    // --- 2. Side Counter Wings ---
    const createCounterWing = (w, h, d, x, z) => {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const base = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, h - 0.2, d - 0.3), counterBaseMat);
        base.position.y = (h - 0.2) / 2;
        base.castShadow = base.receiveShadow = true;
        group.add(base);

        const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), woodTopMat);
        top.position.y = h - 0.1;
        top.castShadow = top.receiveShadow = true;
        group.add(top);

        scene.add(group);
        addObstacleMesh(base, w, h, d, x, z);
    };

    createCounterWing(3.2, 2.3, 7.5, -8, -2);
    createCounterWing(3.2, 2.3, 7.5, 8, -2);

    // --- 3. Stove Station ---
    const stoveW = 3.2, stoveH = 2.4, stoveD = 3.2, stoveX = -12, stoveZ = -12;
    const stoveGroup = new THREE.Group();
    stoveGroup.position.set(stoveX, 0, stoveZ);

    const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(stoveW, stoveH, stoveD), stoveMat);
    stoveBody.position.y = stoveH / 2;
    stoveBody.castShadow = stoveBody.receiveShadow = true;
    stoveGroup.add(stoveBody);

    const burnerOffsets = [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];
    burnerOffsets.forEach(([bx, bz]) => {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 10), burnerMat);
        ring.position.set(bx, stoveH + 0.02, bz);
        const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 10), burnerGlowMat);
        glow.position.set(bx, stoveH + 0.04, bz);
        stoveGroup.add(ring, glow);
    });

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.6, 10), potMat);
    pot.position.set(-0.7, stoveH + 0.32, -0.7);
    pot.castShadow = true;
    stoveGroup.add(pot);

    scene.add(stoveGroup);
    addObstacleMesh(stoveBody, stoveW, stoveH, stoveD, stoveX, stoveZ);

    // Range Hood
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xabb2bf, flatShading: true, roughness: 0.3, metalness: 0.7 });
    const hood = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 4), hoodMat);
    hood.position.set(stoveX, 6.8, stoveZ);
    hood.rotation.y = Math.PI / 4;
    scene.add(hood);

    // --- 4. Refrigerator ---
    const fridgeW = 3.4, fridgeH = 5.8, fridgeD = 3.4, fridgeX = 12, fridgeZ = -12;
    const fridgeGroup = new THREE.Group();
    fridgeGroup.position.set(fridgeX, 0, fridgeZ);

    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(fridgeW, fridgeH, fridgeD), metalFridgeMat);
    fridgeBody.position.y = fridgeH / 2;
    fridgeBody.castShadow = fridgeBody.receiveShadow = true;
    fridgeGroup.add(fridgeBody);

    const fridgeHandleA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.15), handleMat);
    fridgeHandleA.position.set(-0.8, 3.8, fridgeD / 2 + 0.1);
    const fridgeHandleB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.15), handleMat);
    fridgeHandleB.position.set(-0.8, 1.6, fridgeD / 2 + 0.1);
    fridgeGroup.add(fridgeHandleA, fridgeHandleB);

    scene.add(fridgeGroup);
    addObstacleMesh(fridgeBody, fridgeW, fridgeH, fridgeD, fridgeX, fridgeZ);

    // --- 5. Stacking Crates ---
    const addCrate = (w, h, d, x, y, z, rotY = 0) => {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat);
        crate.position.set(x, y + h / 2, z);
        crate.rotation.y = rotY;
        crate.castShadow = crate.receiveShadow = true;
        scene.add(crate);

        kitchenObstacles.push({ x, z, w, d, h: y + h });
        cameraCollisionMeshes.push(crate);
    };

    addCrate(1.6, 0.8, 1.6, -3.5, 0, 5, 0.1);
    addCrate(1.6, 1.5, 1.6, -1.8, 0, 3.5, -0.15);
    addCrate(1.6, 0.9, 1.6, 3.5, 0, 5, -0.08);
    addCrate(1.6, 1.6, 1.6, 1.8, 0, 3.5, 0.12);

    // --- 6. Patrol Waypoints ---
    chefWaypoints = [
        new THREE.Vector3(-10, 0, -10),
        new THREE.Vector3(10, 0, -10),
        new THREE.Vector3(10, 0, 8),
        new THREE.Vector3(-10, 0, 8)
    ];
}

/**
 * Creates Low-Poly Cardboard Hiding Box (Fully closed sides, open top flaps)
 */
function createLowPolyHidingBox(sceneRef) {
    const boxGroup = new THREE.Group();

    const outerMat = new THREE.MeshStandardMaterial({
        color: 0xc28d53,
        roughness: 0.85,
        metalness: 0.0,
        flatShading: true,
        side: THREE.DoubleSide
    });

    const flapMat = new THREE.MeshStandardMaterial({
        color: 0xa8743e,
        roughness: 0.9,
        flatShading: true,
        side: THREE.DoubleSide
    });

    const W = 1.6, H = 1.2, D = 1.6, T = 0.08;

    // Bottom Base
    const bottomMesh = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), outerMat);
    bottomMesh.position.y = T / 2;
    boxGroup.add(bottomMesh);

    // 4 Solid Walls (Fully Closed Sides)
    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), outerMat);
    backMesh.position.set(0, H / 2, -D / 2 + T / 2);

    const frontMesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), outerMat);
    frontMesh.position.set(0, H / 2, D / 2 - T / 2);

    const leftMesh = new THREE.Mesh(new THREE.BoxGeometry(T, H, D), outerMat);
    leftMesh.position.set(-W / 2 + T / 2, H / 2, 0);

    const rightMesh = new THREE.Mesh(new THREE.BoxGeometry(T, H, D), outerMat);
    rightMesh.position.set(W / 2 - T / 2, H / 2, 0);

    boxGroup.add(backMesh, frontMesh, leftMesh, rightMesh);

    // Flaps Open Outward at Top Opening
    const longFlapGeo = new THREE.BoxGeometry(W, 0.04, 0.45);
    const sideFlapGeo = new THREE.BoxGeometry(0.45, 0.04, D);

    const flapL = new THREE.Mesh(sideFlapGeo, flapMat);
    flapL.position.set(-W / 2 - 0.12, H, 0);
    flapL.rotation.z = 0.55;

    const flapR = new THREE.Mesh(sideFlapGeo, flapMat);
    flapR.position.set(W / 2 + 0.12, H, 0);
    flapR.rotation.z = -0.55;

    const flapB = new THREE.Mesh(longFlapGeo, flapMat);
    flapB.position.set(0, H, -D / 2 - 0.12);
    flapB.rotation.x = -0.55;

    const flapF = new THREE.Mesh(longFlapGeo, flapMat);
    flapF.position.set(0, H, D / 2 + 0.12);
    flapF.rotation.x = 0.55;

    boxGroup.add(flapL, flapR, flapB, flapF);
    boxGroup.position.copy(HIDING_BOX_POS);

    sceneRef.add(boxGroup);
    hidingBoxMesh = boxGroup;

    if (typeof kitchenObstacles !== 'undefined') {
        kitchenObstacles.push({ x: HIDING_BOX_POS.x, z: HIDING_BOX_POS.z, w: W, d: D, h: H });
    }
    if (typeof cameraCollisionMeshes !== 'undefined') {
        cameraCollisionMeshes.push(backMesh, frontMesh, leftMesh, rightMesh);
    }
}

class KitchenMap {
    constructor(canvasId = 'mapCanvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.worldBounds = { minX: -15, maxX: 15, minZ: -15, maxZ: 15 };
    }

    worldToCanvas(x, z) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const px = ((x - this.worldBounds.minX) / (this.worldBounds.maxX - this.worldBounds.minX)) * width;
        const py = ((z - this.worldBounds.minZ) / (this.worldBounds.maxZ - this.worldBounds.minZ)) * height;
        return { x: px, y: py };
    }

    render(playerPos, chefPos, hidingBoxPos, isInsideBox = false, nearBox = false) {
        if (!this.ctx || !this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.fillStyle = '#1a1a24';
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.strokeStyle = '#3a3a4c';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(2, 2, w - 4, h - 4);

        if (hidingBoxPos) {
            const boxCoords = this.worldToCanvas(hidingBoxPos.x, hidingBoxPos.z);
            const boxSize = 14;

            this.ctx.fillStyle = nearBox ? 'rgba(255, 193, 7, 0.25)' : 'rgba(255, 255, 255, 0.05)';
            this.ctx.beginPath();
            this.ctx.arc(boxCoords.x, boxCoords.y, 18, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#a67c52';
            this.ctx.fillRect(boxCoords.x - boxSize / 2, boxCoords.y - boxSize / 2, boxSize, boxSize);
            this.ctx.strokeStyle = '#6e4f30';
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeRect(boxCoords.x - boxSize / 2, boxCoords.y - boxSize / 2, boxSize, boxSize);
        }

        if (chefPos) {
            const chefCoords = this.worldToCanvas(chefPos.x, chefPos.z);
            this.ctx.beginPath();
            this.ctx.arc(chefCoords.x, chefCoords.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ff4d4d';
            this.ctx.fill();
        }

        if (playerPos) {
            const playerCoords = this.worldToCanvas(playerPos.x, playerPos.z);
            this.ctx.beginPath();
            this.ctx.arc(playerCoords.x, playerCoords.y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = isInsideBox ? '#00b4d8' : '#00f5d4';
            this.ctx.fill();
        }
    }
}

window.kitchenMap = null;

function initMap(canvasId = 'mapCanvas') {
    window.kitchenMap = new KitchenMap(canvasId);
}

function updateMap(playerPos, chefPos, hidingBoxPos, isInsideBox, nearBox) {
    if (!window.kitchenMap) initMap();
    if (window.kitchenMap) {
        window.kitchenMap.render(playerPos, chefPos, hidingBoxPos, isInsideBox, nearBox);
    }
}