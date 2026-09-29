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

let isGameOver = false;
let chefIsChasing = false;
let currentWaypointIdx = 0;
let chefGaitPhase = 0;
let chefShoulderL, chefShoulderR, chefPinWrist, chefLegL, chefLegR;

// Run state: deliver every cheese wheel to the mouse hole before the chef catches you.
let runElapsed = 0;
let cheesesEscaped = 0;
let totalCheeses = 0;
let timerHudSecond = -1;
let hintHidden = false;
const HINT_SECONDS = 10;

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
const CAM_DIST_MIN = 4.0;
const CAM_DIST_MAX = 24.0;
const CAM_ZOOM_STEP = 1.2;
let camDist = 13.0;
let camDistTarget = 13.0;
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
    } else if (type === 'win') {
        osc.type = 'triangle';
        [523, 659, 784, 1047].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * 0.11));
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
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

// Objective bookkeeping
const BEST_TIME_KEY = 'sneakychefs.bestTime';

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
}

// localStorage throws under private mode and sometimes on file:// — a missing best
// time must never break the run.
function readBestTime() {
    try {
        const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
        return Number.isFinite(v) && v > 0 ? v : null;
    } catch (e) { return null; }
}

function writeBestTime(seconds) {
    try { localStorage.setItem(BEST_TIME_KEY, String(seconds)); } catch (e) { /* storage unavailable */ }
}

function buildCheesePips(total) {
    const holder = document.getElementById('cheese-pips');
    holder.textContent = '';
    for (let i = 0; i < total; i++) {
        const pip = document.createElement('i');
        pip.className = 'pip';
        holder.appendChild(pip);
    }
}

function updateCheeseHud() {
    document.getElementById('cheese-count').textContent = cheesesEscaped + '/' + totalCheeses;
    const pips = document.getElementById('cheese-pips').children;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < cheesesEscaped);
}

function updateTimerHud() {
    const second = Math.floor(runElapsed);
    if (second === timerHudSecond) return;
    timerHudSecond = second;
    document.getElementById('hud-timer').textContent = formatTime(runElapsed);
}

// Called by the cheese physics the moment a wheel drops into the hole.
function onCheeseEscaped() {
    cheesesEscaped++;
    updateCheeseHud();
    playSound('collect');
    if (cheesesEscaped >= totalCheeses) {
        triggerWin();
    } else {
        const left = totalCheeses - cheesesEscaped;
        showToast('Cheese delivered — ' + left + ' more to escape');
    }
}

function triggerWin() {
    if (isGameOver) return;
    isGameOver = true;

    const title = document.getElementById('modal-title');
    title.textContent = 'ESCAPED!';
    title.className = 'win';

    const best = readBestTime();
    const isRecord = best === null || runElapsed < best;
    if (isRecord) writeBestTime(runElapsed);

    const summary = 'You rolled every cheese wheel home in ' + formatTime(runElapsed) + '.';
    document.getElementById('modal-desc').textContent = isRecord
        ? summary + ' New best time!'
        : summary + ' Best: ' + formatTime(best) + '.';
    document.getElementById('restart-btn').textContent = 'PLAY AGAIN';
    document.getElementById('game-over-modal').classList.add('show');

    playSound('win');
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
    totalCheeses = cheeseCollectibles.length;
    buildCheesePips(totalCheeses);
    updateCheeseHud();
    setupInputListeners();
    animate(0);
});

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (!isGameOver) {
        runElapsed += dt;
        updateMouse(dt, time);
        updateCamera(dt);
        updateChefAI(dt, time);
        updateTimerHud();
        if (!hintHidden && runElapsed > HINT_SECONDS) {
            hintHidden = true;
            document.getElementById('hint').classList.add('hide');
        }
    }

    updateMouseHoleGlow(time, cheesesEscaped >= totalCheeses);
    renderer.render(scene, camera);
}

const RESTART_DELAY_MS = 1500;
let restartCountdownTimer = null;

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;

    const title = document.getElementById('modal-title');
    title.textContent = 'CAUGHT!';
    title.className = '';
    document.getElementById('modal-desc').textContent = 'The Chef caught you! Restarting...';
    document.getElementById('restart-btn').textContent = 'RESTART NOW';
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
        d.mesh.material.dispose();
    });
    footstepDust = [];

    resetCheeseProps();

    runElapsed = 0;
    cheesesEscaped = 0;
    timerHudSecond = -1;
    hintHidden = false;
    document.getElementById('hint').classList.remove('hide');
    updateCheeseHud();
    updateTimerHud();
}