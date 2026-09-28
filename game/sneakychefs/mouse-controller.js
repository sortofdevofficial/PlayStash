/**
 * Sneaky Chefs: Kitchen Escape - Mouse Controller
 */

// Camera settings - CAM_DIST_MIN reduced to 0.1 for maximum zoom-in
CAM_DIST_MIN = 0.1;
CAM_DIST_MAX = 50.0;
CAM_ZOOM_STEP = 2.0;
CAM_COLLISION_MARGIN = 0.1;

GRAVITY_UP = 28.0;
GRAVITY_DOWN = 48.0;
JUMP_FORCE = 11.5;
TERMINAL_VELOCITY = -22.0;
COYOTE_TIME = 0.12;
JUMP_BUFFER_TIME = 0.12;

if (typeof isHiding === 'undefined') window.isHiding = false;
if (typeof hidingBoxMesh === 'undefined') window.hidingBoxMesh = null;
const HIDING_BOX_POS = new THREE.Vector3(3.5, 0, -4.0);
const HIDING_INTERACT_RADIUS = 2.0;

let mouseGaitPhase = 0;
let mouseTurnAngle = 0;
let idleBehaviorTimer = 0;
let currentIdleState = 'IDLE_BREATHE';
let idleTargetHeadRotation = 0;
let coyoteTimer = 0;
let jumpBufferTimer = 0;
let nearFoodItem = null;

function setupInputListeners() {
    window.addEventListener('keydown', (e) => {
        if (typeof isGameOver !== 'undefined' && isGameOver) return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': keys.forward = true; break;
            case 'KeyS': case 'ArrowDown': keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': keys.left = true; break;
            case 'KeyD': case 'ArrowRight': keys.right = true; break;
            case 'Space':
                jumpBufferTimer = JUMP_BUFFER_TIME;
                break;
            case 'KeyE':
                handleInteraction();
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': keys.forward = false; break;
            case 'KeyS': case 'ArrowDown': keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft': keys.left = false; break;
            case 'KeyD': case 'ArrowRight': keys.right = false; break;
        }
    });

    window.addEventListener('mousedown', (e) => { if (e.button === 2) isRightMouseDown = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) isRightMouseDown = false; });
    window.addEventListener('mousemove', (e) => {
        if (isRightMouseDown) {
            camYaw -= e.movementX * 0.005;
            camPitch = Math.max(0.02, Math.min(Math.PI / 2.1, camPitch + e.movementY * 0.005));
        }
    });

    window.addEventListener('wheel', (e) => {
        camDistTarget = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, camDistTarget + Math.sign(e.deltaY) * CAM_ZOOM_STEP));
    });

    const bindTouchBtn = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
    };

    bindTouchBtn('btn-up', 'forward');
    bindTouchBtn('btn-down', 'backward');
    bindTouchBtn('btn-left', 'left');
    bindTouchBtn('btn-right', 'right');

    const btnJump = document.getElementById('btn-jump');
    if (btnJump) {
        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            jumpBufferTimer = JUMP_BUFFER_TIME;
        });
    }

    const btnInteract = document.getElementById('btn-interact');
    if (btnInteract) {
        btnInteract.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleInteraction();
        });
    }
}

function exitCardboardBox() {
    isHiding = false;
    jumpVelocity = 5.0;
    isGrounded = false;
    if (typeof playSound === 'function') playSound('jump');
}

function enterCardboardBox() {
    isHiding = true;
    mouseVel.set(0, 0, 0);
    jumpVelocity = 0;
    if (typeof playSound === 'function') playSound('collect');
}

function updateMouse(dt, time) {
    mouseGroup.visible = true;

    const moveDir = new THREE.Vector3();
    const forward = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)).negate();
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));

    if (keys.forward) moveDir.add(forward);
    if (keys.backward) moveDir.sub(forward);
    if (keys.left) moveDir.sub(right);
    if (keys.right) moveDir.add(right);

    const isMoving = moveDir.lengthSq() > 0.001;
    const currentSpeed = isHiding ? MOVE_SPEED * 0.65 : MOVE_SPEED;

    if (isMoving) {
        moveDir.normalize();
        const targetAngle = Math.atan2(moveDir.x, moveDir.z) + Math.PI;
        let diff = targetAngle - mouseAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        mouseTurnAngle = diff;
        mouseAngle += diff * dt * 14.0;
        mouseGroup.rotation.y = mouseAngle;

        mouseVel.x = moveDir.x * currentSpeed;
        mouseVel.z = moveDir.z * currentSpeed;
    } else {
        mouseVel.x = THREE.MathUtils.lerp(mouseVel.x, 0, dt * 12.0);
        mouseVel.z = THREE.MathUtils.lerp(mouseVel.z, 0, dt * 12.0);
        mouseTurnAngle = THREE.MathUtils.lerp(mouseTurnAngle, 0, dt * 10.0);
    }

    mouseGroup.position.x += mouseVel.x * dt;
    mouseGroup.position.z += mouseVel.z * dt;

    if (typeof solveObstacleCollision === 'function') {
        solveObstacleCollision(mouseGroup.position, 0.35);
    }

    if (isHiding && hidingBoxMesh) {
        hidingBoxMesh.position.set(mouseGroup.position.x, 0, mouseGroup.position.z);
    }

    if (isHiding && jumpBufferTimer > 0) {
        jumpBufferTimer = 0;
        exitCardboardBox();
    }

    const floorY = typeof getFloorY === 'function' ? getFloorY(mouseGroup.position.x, mouseGroup.position.z, mouseGroup.position.y) : 0;
    const onSolidGround = mouseGroup.position.y <= floorY + 0.01;

    if (onSolidGround) {
        coyoteTimer = COYOTE_TIME;
        isGrounded = true;
    } else {
        coyoteTimer -= dt;
        if (coyoteTimer <= 0) isGrounded = false;
    }

    if (jumpBufferTimer > 0) jumpBufferTimer -= dt;

    if (!isHiding && jumpBufferTimer > 0 && coyoteTimer > 0) {
        jumpVelocity = JUMP_FORCE;
        isGrounded = false;
        coyoteTimer = 0;
        jumpBufferTimer = 0;
        landingSquash = -0.35;
        if (typeof playSound === 'function') playSound('jump');
        if (typeof spawnDust === 'function') spawnDust(mouseGroup.position, 1.2);
    }

    if (!isGrounded || mouseGroup.position.y > floorY) {
        const currentGravity = jumpVelocity > 0 ? GRAVITY_UP : GRAVITY_DOWN;
        jumpVelocity -= currentGravity * dt;
        jumpVelocity = Math.max(TERMINAL_VELOCITY, jumpVelocity);

        mouseGroup.position.y += jumpVelocity * dt;

        if (mouseGroup.position.y <= floorY) {
            mouseGroup.position.y = floorY;
            if (jumpVelocity < -2.0) {
                landingSquash = Math.min(1.0, Math.abs(jumpVelocity) * 0.05);
                if (typeof spawnDust === 'function') spawnDust(mouseGroup.position, 0.8);
            }
            jumpVelocity = 0;
            isGrounded = true;
        }
    } else {
        mouseGroup.position.y = floorY;
        jumpVelocity = 0;
    }

    mouseGroup.position.x = Math.max(-15.2, Math.min(15.2, mouseGroup.position.x));
    mouseGroup.position.z = Math.max(-15.2, Math.min(15.2, mouseGroup.position.z));

    if (Math.abs(landingSquash) > 0.01) {
        landingSquash = THREE.MathUtils.lerp(landingSquash, 0, dt * 10.0);
        const squashX = 1 + landingSquash * 0.4;
        const squashY = 1 - landingSquash * 0.5;
        mouseGroup.scale.set(squashX, squashY, squashX);
    } else {
        mouseGroup.scale.set(1, 1, 1);
        landingSquash = 0;
    }

    if (typeof updateDust === 'function') updateDust(dt);
    animateMouseRig(dt, time, isMoving);
    checkInteractionProximity();
    updateCamera(dt);
}

function animateMouseRig(dt, time, isMoving) {
    const S = mouseGroup.userData.scaleFactor || 0.45;
    const speedFraction = new THREE.Vector2(mouseVel.x, mouseVel.z).length() / MOVE_SPEED;

    if (!isMoving && isGrounded) {
        idleBehaviorTimer -= dt;
        if (idleBehaviorTimer <= 0) {
            idleBehaviorTimer = 2.2 + Math.random() * 3.5;
            const rand = Math.random();
            if (rand < 0.4) currentIdleState = 'IDLE_STAND';
            else if (rand < 0.7) currentIdleState = 'IDLE_LOOK';
            else if (rand < 0.85) currentIdleState = 'IDLE_GROOM';
            else currentIdleState = 'IDLE_BREATHE';
            idleTargetHeadRotation = (Math.random() - 0.5) * 1.3;
        }
    } else {
        currentIdleState = 'IDLE_BREATHE';
        idleBehaviorTimer = 0;
    }

    let targetSpineRotX = 0, targetSpinePosY = 0, targetHeadRotY = 0, targetHeadRotX = 0;
    let frontHipX = 0, frontKneeX = 0, rearHipX = 0, rearKneeX = 0;

    if (!isGrounded) {
        targetSpineRotX = jumpVelocity > 0 ? 0.35 : -0.25;
        targetHeadRotX = jumpVelocity > 0 ? -0.15 : 0.2;
        frontHipX = -0.5; frontKneeX = 0.6; rearHipX = 0.5; rearKneeX = 0.3;
    } else if (isMoving) {
        mouseGaitPhase += dt * speedFraction * 22.0;
        targetSpinePosY = Math.sin(mouseGaitPhase * 2.0) * 0.035 * S;
        targetSpineRotX = Math.sin(mouseGaitPhase * 2.0) * 0.06;
    } else {
        switch (currentIdleState) {
            case 'IDLE_STAND':
                targetSpineRotX = 0.82; targetSpinePosY = 0.35 * S; targetHeadRotX = -0.2;
                targetHeadRotY = Math.sin(time * 7.0) * 0.18;
                frontHipX = -1.2; frontKneeX = 1.1; rearHipX = 0.65; rearKneeX = -0.3;
                break;
            case 'IDLE_LOOK':
                targetSpineRotX = 0.12;
                targetHeadRotY = THREE.MathUtils.lerp(mouseHeadGroup.rotation.y, idleTargetHeadRotation, dt * 6.0);
                targetHeadRotX = Math.sin(time * 6.0) * 0.06;
                frontHipX = 0.1; frontKneeX = 0.1; rearHipX = -0.1; rearKneeX = 0.1;
                break;
            case 'IDLE_GROOM':
                targetSpineRotX = 0.25; targetSpinePosY = 0.08 * S; targetHeadRotX = 0.3;
                frontHipX = -0.9 + Math.sin(time * 18.0) * 0.2; frontKneeX = 1.2 + Math.cos(time * 18.0) * 0.2;
                rearHipX = 0.2; rearKneeX = 0.1;
                break;
            default:
                targetSpinePosY = Math.sin(time * 3.5) * 0.012 * S; targetSpineRotX = Math.sin(time * 2.5) * 0.02;
                targetHeadRotX = Math.sin(time * 4.0) * 0.03;
                frontHipX = 0.0; frontKneeX = 0.0; rearHipX = 0.0; rearKneeX = 0.0;
                break;
        }
    }

    mouseSpine.position.y = THREE.MathUtils.lerp(mouseSpine.position.y, targetSpinePosY, dt * 9.0);
    mouseSpine.rotation.x = THREE.MathUtils.lerp(mouseSpine.rotation.x, targetSpineRotX, dt * 9.0);
    mouseSpine.rotation.z = THREE.MathUtils.lerp(mouseSpine.rotation.z, -mouseTurnAngle * 0.2, dt * 8.0);
    mouseHeadGroup.rotation.y = THREE.MathUtils.lerp(mouseHeadGroup.rotation.y, targetHeadRotY, dt * 8.0);
    mouseHeadGroup.rotation.x = THREE.MathUtils.lerp(mouseHeadGroup.rotation.x, targetHeadRotX, dt * 8.0);

    mouseLegJoints.forEach((joint, idx) => {
        const isFront = idx < 2;
        const isLeft = idx % 2 === 0;
        let hipAngleX = isFront ? frontHipX : rearHipX;
        let kneeAngleX = isFront ? frontKneeX : rearKneeX;

        if (isGrounded && isMoving) {
            const offset = (isFront ? (isLeft ? 0 : Math.PI) : (isLeft ? Math.PI : 0));
            const legPhase = mouseGaitPhase + offset;
            hipAngleX = Math.sin(legPhase) * 0.85 * speedFraction;
            kneeAngleX = Math.max(0, Math.cos(legPhase)) * 0.6 * speedFraction;
        }

        joint.hip.rotation.x = THREE.MathUtils.lerp(joint.hip.rotation.x, hipAngleX, dt * 14.0);
        joint.knee.rotation.x = THREE.MathUtils.lerp(joint.knee.rotation.x, kneeAngleX, dt * 14.0);
    });

    tailSegments.forEach((seg, idx) => {
        let targetTailZ = 0;
        let targetTailX = (idx === 0 ? -Math.PI / 2.2 : 0);

        if (isMoving) {
            targetTailZ = Math.sin(mouseGaitPhase - idx * 0.6) * 0.35;
            targetTailX += Math.cos(mouseGaitPhase - idx * 0.5) * 0.15;
        } else if (currentIdleState === 'IDLE_STAND') {
            targetTailX -= 0.6;
            targetTailZ = Math.sin(time * 3.0 + idx) * 0.08;
        } else {
            targetTailZ = Math.sin(time * 2.0 + idx * 0.8) * 0.18;
        }

        seg.rotation.z = THREE.MathUtils.lerp(seg.rotation.z, targetTailZ, dt * 8.0);
        seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, targetTailX, dt * 8.0);
    });
}

function updateCamera(dt) {
    camDist = THREE.MathUtils.lerp(camDist, camDistTarget, dt * 8.0);

    const targetPos = mouseGroup.position.clone().add(new THREE.Vector3(0, 0.4, 0));
    const camOffset = new THREE.Vector3(
        Math.sin(camYaw) * Math.cos(camPitch) * camDist,
        Math.sin(camPitch) * camDist,
        Math.cos(camYaw) * Math.cos(camPitch) * camDist
    );

    const desiredCamPos = targetPos.clone().add(camOffset);

    const rayDir = camOffset.clone().normalize();
    cameraRaycaster.set(targetPos, rayDir);
    const intersects = cameraRaycaster.intersectObjects(cameraCollisionMeshes, false);

    if (intersects.length > 0 && intersects[0].distance < camDist) {
        const clampedDist = Math.max(0.1, intersects[0].distance - CAM_COLLISION_MARGIN);
        camera.position.copy(targetPos).add(rayDir.multiplyScalar(clampedDist));
    } else {
        camera.position.copy(desiredCamPos);
    }

    camera.lookAt(targetPos);
}

function checkInteractionProximity() {
    nearFoodItem = null;
    const prompt = document.getElementById('interact-prompt');

    if (typeof foodItems !== 'undefined') {
        let minDistance = 1.8;
        foodItems.forEach(item => {
            if (item.collected) return;
            const d = mouseGroup.position.distanceTo(item.group.position);
            if (d < minDistance) {
                nearFoodItem = item;
                minDistance = d;
            }
        });
    }

    const boxDist = hidingBoxMesh ? mouseGroup.position.distanceTo(hidingBoxMesh.position) : Infinity;

    if (prompt) {
        if (isHiding) {
            prompt.textContent = 'Press [E] or [Space] to Exit Box';
            prompt.classList.add('show');
        } else if (boxDist < HIDING_INTERACT_RADIUS) {
            prompt.textContent = 'Press [E] to Enter Cardboard Box';
            prompt.classList.add('show');
        } else if (nearFoodItem) {
            prompt.textContent = `Press [E] or Tap to Steal ${nearFoodItem.name}`;
            prompt.classList.add('show');
        } else {
            prompt.classList.remove('show');
        }
    }
}

function handleInteraction() {
    if (isHiding) {
        exitCardboardBox();
        return;
    }

    const boxDist = hidingBoxMesh ? mouseGroup.position.distanceTo(hidingBoxMesh.position) : Infinity;
    if (boxDist < HIDING_INTERACT_RADIUS) {
        enterCardboardBox();
        return;
    }

    if (nearFoodItem && !nearFoodItem.collected) {
        if (typeof collectFoodItem === 'function') {
            collectFoodItem(nearFoodItem);
        }
    }
}