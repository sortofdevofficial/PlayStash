/**
 * actors/mouse.js — the player: movement, jump, pushing, and body/tail animation.
 *
 * Reads `keys` from core/input.js and the rig built by models/mice.js, then writes
 * mouseGroup.position/rotation. Pushing is contact-based: anything within MOUSE_PUSH_RADIUS
 * that is not heavier than the mouse gets shoved with PUSH_FACTOR of the player's velocity.
 * Camera framing is deliberately not here — see core/camera.js.
 */
let tailSegments = [];
let mouseHeadGroup;
let mouseSpine;
let mouseLegJoints = [];
let prevMouseFacingAngle = 0;
let landingSquash = 0;

const mouseVel = new THREE.Vector3();
let mouseAngle = 0;
let isGrounded = true;
let jumpVelocity = 0;
const GRAVITY = 28.0;
const JUMP_FORCE = 9.5;   // with GRAVITY this gives a ~1.6 apex
const MOVE_SPEED = 8.5;
function updateMouse(dt, time) {
    // Relative Camera Movement Calculation
    const rawInputDir = new THREE.Vector3(
        (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
        0,
        (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0)
    );

    if (rawInputDir.length() > 0) rawInputDir.normalize();

    // Orient movement vector relative to camera yaw angle
    const inputDir = new THREE.Vector3();
    inputDir.x = rawInputDir.x * Math.cos(camYaw) + rawInputDir.z * Math.sin(camYaw);
    inputDir.z = -rawInputDir.x * Math.sin(camYaw) + rawInputDir.z * Math.cos(camYaw);

    mouseVel.x = THREE.MathUtils.lerp(mouseVel.x, inputDir.x * MOVE_SPEED, dt * 12);
    mouseVel.z = THREE.MathUtils.lerp(mouseVel.z, inputDir.z * MOVE_SPEED, dt * 12);

    mouseGroup.position.x += mouseVel.x * dt;
    mouseGroup.position.z += mouseVel.z * dt;
    clampToArea(mouseGroup.position);

    if (inputDir.length() > 0.1) {
        // Model's forward (head) axis is -Z at rotation.y = 0, so offset by PI to align
        // the head — not the tail — with the actual direction of travel.
        const targetAngle = Math.atan2(inputDir.x, inputDir.z) + Math.PI;
        let diff = targetAngle - mouseAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        mouseAngle += diff * dt * 15;
        mouseGroup.rotation.y = mouseAngle;
    }

    // Floor under the mouse depends on its feet height: a box taller than the feet can
    // reach is a wall, not a floor, so it can never yank the mouse up mid-jump.
    const currentFloorY = getFloorY(mouseGroup.position.x, mouseGroup.position.z, mouseGroup.position.y);
    const wasAirborne = !isGrounded;
    if (!isGrounded || mouseGroup.position.y > currentFloorY) {
        jumpVelocity -= GRAVITY * dt;
        mouseGroup.position.y += jumpVelocity * dt;

        // Only land while falling. Snapping up to a surface while still rising is the
        // "teleport onto the box" you'd get by spam-jumping against its side.
        if (jumpVelocity <= 0 && mouseGroup.position.y <= currentFloorY) {
            mouseGroup.position.y = currentFloorY;
            if (wasAirborne && jumpVelocity < -4) {
                landingSquash = 1.0;
                spawnDust(mouseGroup.position);
            }
            jumpVelocity = 0;
            isGrounded = true;
        }
    }

    // Anything shorter than STEP_HEIGHT is a ledge the mouse climbs rather than a wall it
    // clips through — getFloorY will not report anything taller, so this cannot lift him
    // onto a counter. The fridge sole is the ledge that needs it.
    if (isGrounded && mouseGroup.position.y < currentFloorY) {
        mouseGroup.position.y = Math.min(currentFloorY, mouseGroup.position.y + dt * 3.0);
    }

    // collision radius follows the model size (0.30 at the original S = 0.65)
    solveObstacleCollision(mouseGroup.position, 0.46 * mouseGroup.userData.scaleFactor);

    const speedRatio = Math.min(1.0, mouseVel.length() / MOVE_SPEED);
    animateMouseBody(dt, time, speedRatio);

    // Footstep dust while grounded and moving
    if (isGrounded && speedRatio > 0.3 && Math.floor(time * 0.01) % 4 === 0 && Math.floor(time * 0.01) !== lastDustTick) {
        lastDustTick = Math.floor(time * 0.01);
        spawnDust(mouseGroup.position, 0.4);
    }
    updateDust(dt);

    updateIngredientProps(dt);
    pushIngredients();
}

// Body-weight pushing: any ingredient the mouse overlaps gets a velocity kick along the
// direction the mouse is pushing into it, scaled by how fast the mouse is actually moving
// (its "weight" behind the push) — standing still against a wheel doesn't budge it,
// running into one sends it rolling. Also shoves the mouse back out of the prop's radius
// so it can't just sit inside it.
const MOUSE_PUSH_RADIUS = 0.32;
const PUSH_FACTOR = 1.15;
function pushIngredients() {
    const mouseSpeed = mouseVel.length();
    ingredients.forEach(item => {
        // A prop already on its way down the hole is out of play
        if (item.stashing || item.sunk) return;

        const pos = item.group.position;

        // Only push things roughly at the same level (don't shove a carrot across the
        // floor because the mouse is jumping past it up near a shelf)
        if (Math.abs(mouseGroup.position.y - pos.y) > item.height + 0.3) return;

        const dx = pos.x - mouseGroup.position.x;
        const dz = pos.z - mouseGroup.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = MOUSE_PUSH_RADIUS + item.radius;
        if (dist >= minDist || dist < 0.0001) return;

        const nx = dx / dist, nz = dz / dist;

        // Push the prop along the mouse's own momentum, not just straight away from
        // the mouse's centre — a glancing run-by nudges it sideways, a head-on charge
        // sends it flying forward, exactly like body weight would.
        if (mouseSpeed > 0.15) {
            item.vel.x += (mouseVel.x / mouseSpeed) * mouseSpeed * PUSH_FACTOR * 0.6 + nx * mouseSpeed * PUSH_FACTOR * 0.4;
            item.vel.z += (mouseVel.z / mouseSpeed) * mouseSpeed * PUSH_FACTOR * 0.6 + nz * mouseSpeed * PUSH_FACTOR * 0.4;
            item.grounded = true; // a shove keeps it rolling along the ground, not launched up
        }

        // Separate the overlap so the mouse doesn't sink into the prop
        const overlap = minDist - dist;
        mouseGroup.position.x -= nx * overlap;
        mouseGroup.position.z -= nz * overlap;
    });
}

// Orbit Camera Positioning based on Right Click Yaw/Pitch, with wall/obstacle collision
// avoidance: raycast from just above the mouse toward the desired camera spot and pull
// the distance in if something is in the way, so the camera never clips through geometry.

let gaitPhase = 0; // advances only while moving, so legs don't "walk in place" when idle
let tailPhase = 0; // runs even when idle so the tail always has a lazy sway
let mouseTurnRate = 0; // smoothed yaw rate, drives the tail's turn-lag whip
const TAIL_BASE_X = -Math.PI / 2; // root segment lies horizontal, pointing back

function animateMouseBody(dt, time, speedRatio) {
    // Advance gait cycle proportional to actual movement speed
    gaitPhase += dt * (2.2 + speedRatio * 6.0) * (speedRatio > 0.02 ? 1 : 0);

    // Diagonal trot: front-left+rear-right swing together, opposite to front-right+rear-left
    if (mouseLegJoints && mouseLegJoints.length === 4) {
        const [fl, fr, rl, rr] = mouseLegJoints;
        const strideAmp = 0.5 * speedRatio;
        const kneeAmp = 0.65 * speedRatio;

        const pairAPhase = gaitPhase;
        const pairBPhase = gaitPhase + Math.PI;

        // Hip swing (forward/back)
        fl.hip.rotation.x = Math.sin(pairAPhase) * strideAmp;
        rr.hip.rotation.x = Math.sin(pairAPhase) * strideAmp;
        fr.hip.rotation.x = Math.sin(pairBPhase) * strideAmp;
        rl.hip.rotation.x = Math.sin(pairBPhase) * strideAmp;

        // Knee bend: bends most during the "lift/swing forward" half of the stride,
        // stays nearly straight during the ground-contact/push half — gives a real walking look
        // instead of a rigid pendulum leg.
        const kneeCurve = (phase) => {
            const s = Math.sin(phase);
            const liftPortion = Math.max(0, s); // only bend while leg is swinging forward/up
            return liftPortion * liftPortion * kneeAmp;
        };
        fl.knee.rotation.x = -kneeCurve(pairAPhase);
        rr.knee.rotation.x = -kneeCurve(pairAPhase);
        fr.knee.rotation.x = -kneeCurve(pairBPhase);
        rl.knee.rotation.x = -kneeCurve(pairBPhase);

        // Idle: legs relax toward neutral rather than freezing mid-stride
        if (speedRatio < 0.02) {
            [fl, fr, rl, rr].forEach(j => {
                j.hip.rotation.x = THREE.MathUtils.lerp(j.hip.rotation.x, 0, dt * 6);
                j.knee.rotation.x = THREE.MathUtils.lerp(j.knee.rotation.x, 0, dt * 6);
            });
        }
    }

    // Spine bounce: two bounces per full stride cycle (one per diagonal pair touching down),
    // plus a slight forward pitch when accelerating and lean into turns.
    if (mouseSpine) {
        const bounce = Math.abs(Math.sin(gaitPhase)) * 0.035 * speedRatio;
        mouseSpine.position.y = isGrounded ? bounce : 0;

        // Lean into turns: compare current facing to previous frame's facing
        let turnDelta = mouseAngle - prevMouseFacingAngle;
        while (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
        while (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
        const turnRate = dt > 0 ? turnDelta / dt : 0;
        mouseTurnRate = THREE.MathUtils.lerp(mouseTurnRate, turnRate, Math.min(1, dt * 10));
        const targetLean = THREE.MathUtils.clamp(-turnRate * 0.045, -0.35, 0.35);
        mouseSpine.rotation.z = THREE.MathUtils.lerp(mouseSpine.rotation.z, targetLean, dt * 8);

        // Slight forward pitch while accelerating/moving fast
        const targetPitch = speedRatio * 0.08;
        mouseSpine.rotation.x = THREE.MathUtils.lerp(mouseSpine.rotation.x, targetPitch, dt * 6);

        prevMouseFacingAngle = mouseAngle;
    }

    // Head bob synced to the same gait cycle, plus head counter-turns slightly less than body lean
    if (mouseHeadGroup) {
        // rest height of the head (0.62 * S in mice.js) plus a bob that scales with the mouse
        const S = mouseGroup.userData.scaleFactor;
        mouseHeadGroup.position.y = 0.62 * S + Math.abs(Math.sin(gaitPhase)) * 0.028 * S * speedRatio;
    }

    animateMouseTail(dt, speedRatio);

    // Squash-and-stretch: airborne stretch, landing squash decay (applied to whole mouseGroup,
    // stacking with spine-level bounce/lean which handles the walking motion)
    if (!isGrounded) {
        const stretch = THREE.MathUtils.clamp(1 + Math.abs(jumpVelocity) * 0.012, 1, 1.25);
        mouseGroup.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
    } else if (landingSquash > 0) {
        landingSquash = Math.max(0, landingSquash - dt * 4.5);
        const squash = 1 - landingSquash * 0.28;
        mouseGroup.scale.set(1 + landingSquash * 0.16, squash, 1 + landingSquash * 0.16);
    } else {
        mouseGroup.scale.set(1, 1, 1);
    }
}

// Tail: a wave that travels root→tip (small lazy sway idle, big swishing when running,
// tip swinging furthest), lag/whip opposite to turns, lifted while running and raised
// when airborne, then a droop as you land.
function animateMouseTail(dt, speedRatio) {
    tailPhase += dt * (1.6 + speedRatio * 9.0);
    const n = tailSegments.length;
    if (n === 0) return;

    const airborne = !isGrounded;
    const rootLift = airborne ? -0.4 : -0.1 * speedRatio;   // negative = up
    const landDrop = landingSquash * 0.55;                   // positive = down
    const whip = THREE.MathUtils.clamp(mouseTurnRate * 0.03, -0.9, 0.9);

    tailSegments.forEach((seg, i) => {
        const k = i / (n - 1); // 0 at root, 1 at tip

        // Side-to-side: travelling wave, growing toward the tip
        const swayAmp = (0.07 + 0.2 * speedRatio) * (0.4 + k * 1.1);
        const sway = Math.sin(tailPhase - i * 0.8) * swayAmp;
        // Turn lag: body yaws one way, tail trails the other, tip most of all
        const trail = -whip * (0.25 + k * 0.9);

        // Up/down: root lifts as a whole; later segments curl (up in the air, slight droop at rest)
        let pitch;
        if (i === 0) {
            pitch = TAIL_BASE_X + rootLift + landDrop;
        } else {
            pitch = (airborne ? -0.16 : 0.05 * k)
                  + landDrop * 0.3
                  + Math.sin(tailPhase - i * 0.8 + 1.2) * 0.05 * speedRatio;
        }

        seg.rotation.z = THREE.MathUtils.lerp(seg.rotation.z, sway + trail, Math.min(1, dt * 12));
        seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, pitch, Math.min(1, dt * 10));
    });
}

function triggerJump() {
    jumpVelocity = JUMP_FORCE;
    isGrounded = false;
    playSound('jump');
}


// Restart hook: main.js calls this instead of poking the player's animation state.
// Position and velocity are enterArea()'s job; this is what the rig carries between frames.
function resetMouse() {
    gaitPhase = 0;
    mouseAngle = 0;
    prevMouseFacingAngle = 0;
    mouseTurnRate = 0;
    landingSquash = 0;
    mouseGroup.scale.set(1, 1, 1);
    mouseGroup.rotation.y = 0;
    if (mouseSpine) {
        mouseSpine.position.y = 0;
        mouseSpine.rotation.set(0, 0, 0);
    }
}
