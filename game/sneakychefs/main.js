/**
 * main.js — boot, the frame loop, and what a game over does. (Load this last.)
 *
 * The load handler builds the house from map/rooms.js and both actors, then animate()
 * drives them: player, camera, every brain that owns a room, the walk home, and the ambient
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
    // After the house, because the street ring keeps its distance from the plan the registry
    // just built rather than from a number written down here.
    buildCity();

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
    animate(0);
});

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    if (!isGameOver) {
        updateMouse(dt, time);
        // Before anything that asks which room he is in: the camera and the chef's lamps both
        // read the area his feet are actually standing in.
        updateAreaFromPosition();
        // The key light follows the room he is standing in, and it has to travel there rather
        // than jump: a doorway crossed is 23 units of shadow frustum, and it takes about half a
        // second to slide that rather than teleporting the dark onto the room he just left.
        updateKeyLight(dt);
        updateCamera(dt);
        // After the camera has settled, because the cutaway asks where the lens ended up: a roof
        // it has climbed above and passed over is off for this frame, and the ceiling it is still
        // under is not.
        updateRoofs();

        // Every brain ticks in every room. Each one guards itself: the chef walks his own beat
        // and the masonry decides where that goes, so he is in the hall and the dining room for
        // a third of the loop and nowhere else; the residents only move while you are home.
        updateChefAI(dt, time);
        updateBurrowMice(dt, time);

        checkBaseDeposit();

        if (!hintHidden && time > hintDeadline) {
            hintHidden = true;
            document.getElementById('hint').classList.add('hide');
        }
    }

    updateFridge(dt);
    // The one thing in the scene that keeps going whether or not anyone is looking at it.
    updateCity(dt);
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

    // What you already got home stays home. This is the only repositioning left in the game:
    // every doorway upstairs is walked, so getting caught is the one thing that moves him.
    enterArea('kitchen');
    hintHidden = false;
    hintDeadline = performance.now() + HINT_MS;
    document.getElementById('hint').classList.remove('hide');
}
