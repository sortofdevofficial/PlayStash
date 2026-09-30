/**
 * world/kitchen.js — the room the heist happens in.
 *
 * Floor tiles, the four walls, the counters and island the chef patrols between, and the
 * pedestals the mouse can hop on. It also owns the three primitive helpers every kitchen
 * prop is built from (addKitchenBlock / addKitchenSolid / addKitchenVisualBox), so
 * world/fridge.js adds itself to the same registries.
 *
 * Nothing here knows about the player: geometry only, plus the chef's patrol route.
 */

// A movement obstacle ({x,z,w,d,h}) with its mesh, registered for bodies and camera alike.
function addKitchenBlock(w, h, d, x, z, color) {
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
}

// Plain box that blocks movement, without the counter overhang addKitchenBlock draws.
function addKitchenSolid(w, h, d, x, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 }));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    kitchenObstacles.push({ x, z, w, d, h });
    cameraCollisionMeshes.push(mesh);
    return mesh;
}

// Geometry the camera must not pass through, but that the mouse walks under freely:
// anything tall enough to be a wall above the step height would otherwise seal an opening.
function addKitchenVisualBox(w, h, d, x, y, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.5 }));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    cameraCollisionMeshes.push(mesh);
    return mesh;
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
    buildFridge();

    addKitchenBlock(8, 2.2, 3, 0, 0, 0x4a5568);
    addKitchenBlock(3, 2.2, 7, -8, -2, 0x4a5568);
    addKitchenBlock(3, 2.2, 7, 8, -2, 0x4a5568);

    addKitchenBlock(1.6, 0.8, 1.6, -3.5, 5, 0x8b5a2b);
    addKitchenBlock(1.6, 1.5, 1.6, -1.8, 3.5, 0x8b5a2b);
    addKitchenBlock(1.6, 0.9, 1.6, 3.5, 5, 0x8b5a2b);
    addKitchenBlock(1.6, 1.6, 1.6, 1.8, 3.5, 0x8b5a2b);

    chefWaypoints = [
        new THREE.Vector3(-9, 0, -10),
        new THREE.Vector3(10, 0, -10),
        new THREE.Vector3(10, 0, 8),
        new THREE.Vector3(-10, 0, 8)
    ];
}
