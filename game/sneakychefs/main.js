/**
 * main.js — boot, the frame loop, and what a game over does. (Load this last.)
 *
 * The load handler builds the two rooms and both actors in a fixed order, then animate()
 * drives them: player, camera, whichever brain owns the current area, portal check, and the
 * ambient dressing. Getting caught resets everything except what you already got home.
 */
let hintHidden = false;
const HINT_MS = 14000;
let hintDeadline = HINT_MS;
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

    buildBurrow();
    createWarningRing();
    spawnIngredients();
    updateStashHud();
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

        // The base is the one place the chef can never follow
        if (currentArea === 'burrow') updateBurrowMice(dt, time);
        else updateChefAI(dt, time);

        checkHoleCrossing();

        if (!hintHidden && time > hintDeadline) {
            hintHidden = true;
            document.getElementById('hint').classList.add('hide');
        }
    }

    updateMouseHoleGlow(time);
    updateFridge(dt);
    updateBurrowView(time);
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