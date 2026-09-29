/**
 * Sneaky Chefs: Kitchen Escape - Core: shared state, audio, init, main loop, game over/restart
 * (Scene/kitchen -> environment.js, mouse -> mouse-controller.js, chef -> chef-ai.js)
 */

let scene, camera, renderer;
let mouseGroup, chefGroup, chefSpotlight;
let tailSegments = [];
let mouseHeadGroup, mouseSpine, mouseLegJoints = [];
let prevMouseFacingAngle = 0;
let footstepDust = [];
let landingSquash = 0;
let cheeseCollectibles = [];
let kitchenObstacles = [];
let cameraCollisionMeshes = [];
let chefWaypoints = [];

// No goal, no win state, no inventory; the game only ends if the chef catches you.
// Cheese wheels are just physical props you can roll around with your own momentum.
let isGameOver = false;
let chefIsChasing = false;
let currentWaypointIdx = 0;
let chefGaitPhase = 0;
let chefShoulderL, chefShoulderR, chefPinWrist, chefLegL, chefLegR;

// Mouse Physics
const mouseVel = new THREE.Vector3();
let mouseAngle = 0;
let isGrounded = true;
let jumpVelocity = 0;
const GRAVITY = 28.0;
const JUMP_FORCE = 9.5;
const MOVE_SPEED = 8.5;

// Camera Orbit Controls (Right Click Drag)
let isRightMouseDown = false;
let camYaw = 0;
let camPitch = 0.55;
const CAM_DIST_MIN = 4.0;    // max zoom in
const CAM_DIST_MAX = 24.0;   // max zoom out
const CAM_ZOOM_STEP = 1.2;   // distance change per wheel notch / +- key press
let camDist = 13.0;          // current (smoothed) distance
let camDistTarget = 13.0;    // where zoom input is steering it
const cameraRaycaster = new THREE.Raycaster();
const CAM_COLLISION_MARGIN = 0.4;

const keys = { forward: false, backward: false, left: false, right: false };

// Sound Synthesizer
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

// Disable Right-Click Menu & Developer Console Shortcuts
function setupSecurityRestrictions() {
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
        const k = e.key.toUpperCase();
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(k)) ||
            (e.ctrlKey && k === 'U')
        ) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
}

// Init Game
window.addEventListener('load', () => {
    setupSecurityRestrictions();
    initScene();
    buildKitchenEnvironment();

    const mouseData = createLowPolyMouse();
    mouseGroup = mouseData.mouseGroup;
    tailSegments = mouseData.tailSegments;
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
    chefSpotlight = new THREE.SpotLight(0xffaa55, 1.4, 9, Math.PI / 5, 0.5, 1.5);
    chefSpotlight.position.set(0, 3.2, 0);
    chefSpotlight.target.position.set(0, 0, 0.01);
    chefGroup.add(chefSpotlight, chefSpotlight.target);
    scene.add(chefGroup);

    createWarningRing();
    spawnCheeseCollectibles();
    setupInputListeners();
    setupGraphicsToggle();
    animate(0);
});

function setupGraphicsToggle() {
    const btn = document.getElementById('gfx-toggle');
    if (!btn) return;
    const render = () => {
        btn.textContent = 'LOW GRAPHICS: ' + (lowGraphics ? 'ON' : 'OFF');
        btn.classList.toggle('low', lowGraphics);
    };
    render();
    btn.addEventListener('click', () => {
        setLowGraphics(!lowGraphics);
        render();
    });
}

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (!isGameOver) {
        updateMouse(dt, time);
        updateCamera(dt);
        updateChefAI(dt, time);
    }

    renderer.render(scene, camera);
}

// The only way to lose is getting caught; there is no win condition. Getting caught
// shows a short "restarting" countdown and then restarts the run automatically.
const RESTART_DELAY_MS = 1500;
let restartCountdownTimer = null;

function triggerGameOver() {
    if (isGameOver) return; // already caught; don't stack timers
    isGameOver = true;

    const title = document.getElementById('modal-title');
    title.textContent = 'CAUGHT!';
    title.className = '';
    document.getElementById('modal-desc').textContent = 'The Chef caught you! Restarting...';
    document.getElementById('game-over-modal').classList.add('show');

    clearTimeout(restartCountdownTimer);
    restartCountdownTimer = setTimeout(restartGame, RESTART_DELAY_MS);
}

function restartGame() {
    clearTimeout(restartCountdownTimer);
    restartCountdownTimer = null;
    isGameOver = false;
    chefIsChasing = false;
    chefAttackState = 'idle';
    chefAttackTimer = 0;
    chefSmashSequence = [];
    chefSmashIndex = 0;
    hideAllWarningRings();

    document.getElementById('game-over-modal').classList.remove('show');

    mouseGroup.position.set(0, 0, 11);
    mouseGroup.scale.set(1, 1, 1);
    mouseVel.set(0, 0, 0);
    jumpVelocity = 0;
    isGrounded = true;
    keys.forward = keys.backward = keys.left = keys.right = false;
    chefLoseTimer = 0;
    chefRealertTimer = 0;
    currentWaypointIdx = 0;
    chefGroup.position.set(-8, 0, -8);
    chefGaitPhase = 0;
    landingSquash = 0;
    gaitPhase = 0;
    mouseAngle = 0;
    prevMouseFacingAngle = 0;
    mouseTurnRate = 0;
    mouseGroup.rotation.y = 0;
    chefGroup.rotation.y = 0;
    if (mouseSpine) { mouseSpine.position.y = 0; mouseSpine.rotation.set(0, 0, 0); }

    footstepDust.forEach(d => {
        scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
    });
    footstepDust = [];

    cheeseCollectibles.forEach(c => {
        c.group.position.set(c.spawnPos.x, getFloorY(c.spawnPos.x, c.spawnPos.z) + CHEESE_HEIGHT / 2, c.spawnPos.z);
        c.vel.set(0, 0, 0);
        c.velY = 0;
        c.grounded = true;
    });
}