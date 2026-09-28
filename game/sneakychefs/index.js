/**
 * Sneaky Chefs: Kitchen Escape - Main Game & Interaction Loop
 */

var scene, camera, renderer;
var mouseGroup, chefGroup;
var cheeseList = [];
var cheeseCollected = 0;
var totalCheese = 5;
var score = 0;
var isHiding = false;
var chefIsChasing = false;
var keys = {};

// Initialize Game
function init() {
    // 1. Scene & Camera Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 18, 14);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 3. Warning Ring & Entities Setup
    if (typeof createWarningRing === 'function') createWarningRing();
    if (typeof createLowPolyChef === 'function') {
        chefGroup = createLowPolyChef();
        scene.add(chefGroup);
    }

    // 4. Player Creation (Mouse)
    createMousePlayer();

    // 5. Spawn Cheese
    spawnCheeseItems();

    // Event Listeners
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', onWindowResize);

    animate(0);
}

// Simple Mouse Creation Placeholder
function createMousePlayer() {
    mouseGroup = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.4, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.4;
    mesh.castShadow = true;
    mouseGroup.add(mesh);
    mouseGroup.position.set(0, 0, 8);
    scene.add(mouseGroup);
}

// Spawn Cheese Wedges
function spawnCheeseItems() {
    const cheesePositions = [
        { x: -10, z: -10 },
        { x: 10, z: -10 },
        { x: -10, z: 5 },
        { x: 10, z: 5 },
        { x: 0, z: -12 }
    ];

    totalCheese = cheesePositions.length;

    cheesePositions.forEach((pos) => {
        const cheeseGeo = new THREE.CylinderGeometry(0.1, 0.5, 0.3, 3);
        const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, flatShading: true });
        const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
        
        cheese.position.set(pos.x, 0.25, pos.z);
        cheese.rotation.y = Math.random() * Math.PI;
        cheese.castShadow = true;

        scene.add(cheese);
        cheeseList.push(cheese);
    });
}

// Cheese Pickup System
function checkCheesePickup() {
    if (!mouseGroup || cheeseList.length === 0) return;

    const pickupRadius = 1.2; // Pickup range

    for (let i = cheeseList.length - 1; i >= 0; i--) {
        const cheese = cheeseList[i];
        if (!cheese) continue;

        const dist = mouseGroup.position.distanceTo(cheese.position);

        if (dist < pickupRadius) {
            // Remove from 3D scene
            scene.remove(cheese);
            cheeseList.splice(i, 1);

            // Update score and stats
            cheeseCollected++;
            score += 100;

            // UI Updates
            const scoreEl = document.getElementById('score');
            const cheeseEl = document.getElementById('cheeseCount');
            if (scoreEl) scoreEl.innerText = score;
            if (cheeseEl) cheeseEl.innerText = cheeseCollected + ' / ' + totalCheese;

            if (typeof playSound === 'function') playSound('pickup');

            // Win Trigger
            if (cheeseCollected >= totalCheese) {
                if (typeof triggerWin === 'function') triggerWin();
            }
        }
    }
}

// Player Movement Update
function updatePlayer(dt) {
    if (!mouseGroup) return;

    const moveSpeed = 6.0;
    let moveX = 0;
    let moveZ = 0;

    if (keys['w'] || keys['arrowup']) moveZ -= 1;
    if (keys['s'] || keys['arrowdown']) moveZ += 1;
    if (keys['a'] || keys['arrowleft']) moveX -= 1;
    if (keys['d'] || keys['arrowright']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
        const dir = new THREE.Vector3(moveX, 0, moveZ).normalize();
        mouseGroup.position.x += dir.x * moveSpeed * dt;
        mouseGroup.position.z += dir.z * moveSpeed * dt;

        mouseGroup.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // Camera Follow
    camera.position.x = mouseGroup.position.x;
    camera.position.z = mouseGroup.position.z + 14;
}

// Main Game Loop
var lastTime = 0;
function animate(currentTime) {
    requestAnimationFrame(animate);

    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    updatePlayer(dt);
    checkCheesePickup(); // Check for cheese pickups every frame

    if (typeof updateChefAI === 'function') {
        updateChefAI(dt, currentTime / 1000);
    }

    // Animate remaining cheese floating/rotating
    cheeseList.forEach((cheese, idx) => {
        cheese.rotation.y += dt * 2;
        cheese.position.y = 0.25 + Math.sin(currentTime * 0.003 + idx) * 0.05;
    });

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;