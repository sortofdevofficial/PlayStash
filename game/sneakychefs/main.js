/**
 * main.js — boot, the frame loop, and what a game over does. (Load this last.)
 *
 * The load handler builds the house from map/rooms.js and both actors, then animate()
 * drives them: player, camera, every brain that owns a room, portal check, and the ambient
 * dressing. Getting caught resets everything except what you already got home.
 */
let hintHidden = false;
const HINT_MS = 14000;
let hintDeadline = HINT_MS;
// Init Game
window.addEventListener('load', () => {
    setupSecurityRestrictions();
    initScene();
    buildHouse();

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
    spawnIngredients();
    updateStashHud();
    updateCarryHud();
    setupInputListeners();
    initMinimap();
    animate(0);
});

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (!isGameOver) {
        updateMouse(dt, time);
        // Before anything that asks which room he is in: the camera, the chef's lamps, the
        // minimap and the portals all read the area his feet are actually standing in.
        updateAreaFromPosition();
        // The key light follows the room he is standing in, and it has to travel there rather
        // than jump: a doorway crossed is 23 units of shadow frustum, and it takes about half a
        // second to slide that rather than teleporting the dark onto the room he just left.
        updateKeyLight(dt);
        updateCamera(dt);

        // Every brain ticks in every room. Each one guards itself: the chef is clamped to his
        // own kitchen and the masonry stops his sight through anything but an open doorway, so
        // he cannot follow you into the hall; the residents only move while you are home.
        updateChefAI(dt, time);
        updateBurrowMice(dt, time);

        checkPortalCrossing();

        if (!hintHidden && time > hintDeadline) {
            hintHidden = true;
            document.getElementById('hint').classList.add('hide');
        }
    }

    updatePortalGlows(time);
    updateFridge(dt);
    updateBurrowView();
    drawMinimap();
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

    document.getElementById('game-over-modal').classList.remove('show');

    keys.forward = keys.backward = keys.left = keys.right = false;

    // Each module owns its own reset; main.js only says "start over".
    resetChef();
    resetMouse();
    clearDust();
    resetIngredients();

    // What you already got home stays home
    enterArea('kitchen');
    isTraveling = false;
    document.getElementById('fade').classList.remove('on');
    hintHidden = false;
    hintDeadline = performance.now() + HINT_MS;
    document.getElementById('hint').classList.remove('hide');
}
