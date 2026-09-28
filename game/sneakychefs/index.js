/**
 * Sneaky Chefs: Kitchen Escape - Main Entry Point & Game Loop
 */

let scene, camera, renderer;
let mouseGroup, chefGroup, chefSpotlight;
let tailSegments = [];
let addCarriedCheeseWedge, clearCarriedCheeseStack;
let mouseHeadGroup, mouseSpine, mouseLegJoints = [];
let prevMouseFacingAngle = 0;
let footstepDust = [];
let landingSquash = 0;
let cheeseCollectibles = [];
let kitchenObstacles = [];
let cameraCollisionMeshes = [];
let chefWaypoints = [];

const inventory = { cheese: 0 };
const INVENTORY_SLOTS = 8;
const INVENTORY_ITEMS = { cheese: { icon: '🧀' } };
let nearCheeseItem = null;
let isGameOver = false;
let chefIsChasing = false;
let currentWaypointIdx = 0;
let chefGaitPhase = 0;
let chefShoulderL, chefShoulderR, chefPinWrist, chefLegL, chefLegR;

const mouseVel = new THREE.Vector3();
let mouseAngle = 0;
let isGrounded = true;
let jumpVelocity = 0;
const GRAVITY = 28.0;
const JUMP_FORCE = 9.5;
const MOVE_SPEED = 8.5;

let isRightMouseDown = false;
let camYaw = 0;
let camPitch = 0.55;
const CAM_DIST_MIN = 4.0;
const CAM_DIST_MAX = 24.0;
const CAM_ZOOM_STEP = 1.2;
let camDist = 13.0;
let camDistTarget = 13.0;
const cameraRaycaster = new THREE.Raycaster();
const CAM_COLLISION_MARGIN = 0.4;

const keys = { forward: false, backward: false, left: false, right: false };

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'jump') {
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'collect') {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(780, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

function setupSecurityRestrictions() {
    window.addEventListener('contextmenu', (e) => e.preventDefault());
}

window.addEventListener('load', () => {
    setupSecurityRestrictions();
    initScene();
    buildKitchenEnvironment();
    createLowPolyHidingBox(scene);

    const mouseData = createLowPolyMouse();
    mouseGroup = mouseData.mouseGroup;
    tailSegments = mouseData.tailSegments;
    addCarriedCheeseWedge = mouseData.addCarriedCheeseWedge;
    clearCarriedCheeseStack = mouseData.clearCarriedCheeseStack;
    mouseHeadGroup = mouseData.headGroup;
    mouseSpine = mouseData.spine;
    mouseLegJoints = mouseData.legJoints;
    scene.add(mouseGroup);

    chefGroup = createLowPolyChef();
    chefShoulderL = chefGroup.userData.shoulderL;
    chefShoulderR = chefGroup.userData.shoulderR;
    chefPinWrist = chefGroup.userData.pinWrist;
    chefLegL = chefGroup.userData.legL;
    chefLegR = chefGroup.userData.legR;

    chefSpotlight = new THREE.SpotLight(0xffaa55, 1.6, 11, Math.PI / 4.5, 0.5, 1.5);
    chefSpotlight.position.set(0, 3.4, 0);
    chefSpotlight.target.position.set(0, 0, 0.01);
    chefGroup.add(chefSpotlight, chefSpotlight.target);
    scene.add(chefGroup);

    createWarningRing();
    spawnCheeseCollectibles();
    initMap('mapCanvas');
    updateInventoryUI();
    setupInputListeners();
    animate(0);
});

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (!isGameOver) {
        updateMouse(dt, time);
        updateCamera(dt);
        updateChefAI(dt, time);
        updateMap(
            mouseGroup.position,
            chefGroup.position,
            HIDING_BOX_POS,
            isHiding,
            mouseGroup.position.distanceTo(HIDING_BOX_POS) < HIDING_INTERACT_RADIUS
        );
    }

    renderer.render(scene, camera);
}

function updateInventoryUI(bumpId) {
    const grid = document.getElementById('inv-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const ids = Object.keys(inventory).filter(id => inventory[id] > 0);
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        const id = ids[i];
        if (id) {
            slot.classList.add('filled');
            slot.textContent = INVENTORY_ITEMS[id].icon;
            const count = document.createElement('span');
            count.className = 'inv-count';
            count.textContent = inventory[id];
            slot.appendChild(count);
        }
        grid.appendChild(slot);
    }
}

const RESTART_DELAY_MS = 1500;
let restartCountdownTimer = null;

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;

    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.add('show');

    clearTimeout(restartCountdownTimer);
    restartCountdownTimer = setTimeout(restartGame, RESTART_DELAY_MS);
}

function restartGame() {
    clearTimeout(restartCountdownTimer);
    restartCountdownTimer = null;
    isGameOver = false;
    isHiding = false;
    inventory.cheese = 0;
    chefIsChasing = false;
    chefAttackState = 'idle';
    chefAttackTimer = 0;
    chefSmashSequence = [];
    chefSmashIndex = 0;
    hideAllWarningRings();
    clearCarriedCheeseStack();

    updateInventoryUI();
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.remove('show');

    mouseGroup.position.set(0, 0, 11);
    mouseGroup.scale.set(1, 1, 1);
    mouseVel.set(0, 0, 0);
    jumpVelocity = 0;
    isGrounded = true;
    nearCheeseItem = null;
    keys.forward = keys.backward = keys.left = keys.right = false;
    chefLoseTimer = 0;
    chefRealertTimer = 0;
    currentWaypointIdx = 0;
    chefGroup.position.set(-8, 0, -8);
    chefGaitPhase = 0;
    landingSquash = 0;
    mouseAngle = 0;
    mouseGroup.rotation.y = 0;
    chefGroup.rotation.y = 0;
    if (mouseSpine) { mouseSpine.position.y = 0; mouseSpine.rotation.set(0, 0, 0); }

    cheeseCollectibles.forEach(c => {
        c.collected = false;
        scene.add(c.group);
    });
}