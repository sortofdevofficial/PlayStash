/**
 * actors/chef.js — the chef's brain: patrol, sight, chase, smash telegraphs.
 *
 * The geometry is models/chef.js; this file drives it. Line of sight is a real raycast
 * against cameraCollisionMeshes, so counters block his view. Capture is delegated to
 * main.js through triggerGameOver(), and the only UI this module touches is core/ui.js's
 * toast. main.js never mutates the chef's state directly — it calls resetChef().
 */
let chefWaypoints = [];      // patrol route, laid out by world/kitchen.js
let chefIsChasing = false;
let currentWaypointIdx = 0;
let chefGaitPhase = 0;
let chefShoulderL, chefShoulderR, chefPinWrist, chefLegL, chefLegR;
var warningRingMesh = null;
var chefAttackState = 'idle';
var chefAttackTimer = 0;
var chefSmashSequence = [];
var chefSmashIndex = 0;
var chefLoseTimer = 0;
var chefRealertTimer = 0;

function createWarningRing() {
    const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff2200,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
    });
    warningRingMesh = new THREE.Mesh(ringGeo, ringMat);
    warningRingMesh.rotation.x = -Math.PI / 2;
    warningRingMesh.position.y = 0.03;
    warningRingMesh.visible = false;
    scene.add(warningRingMesh);
}

function hideAllWarningRings() {
    if (warningRingMesh) {
        warningRingMesh.visible = false;
    }
}

function showWarningRing(pos, radius = 1.8) {
    if (!warningRingMesh) return;
    warningRingMesh.position.set(pos.x, 0.03, pos.z);
    warningRingMesh.scale.set(radius, radius, 1);
    warningRingMesh.visible = true;
}

/**
 * Low-Poly Chef AI Enemy Model Construction
 */

const CHEF_SIGHT_RANGE = 11.0;
const CHEF_CLOSE_RANGE = 4.0;
const CHEF_LOSE_SIGHT_SECONDS = 2.2;
const CHEF_REALERT_COOLDOWN = 1.0;
const chefSightRay = new THREE.Raycaster();

// Counters, crates, the fridge and the walls all block the chef's view, so ducking
// behind one is what actually ends a chase.
function chefHasLineOfSight(distToMouse) {
    const eye = chefGroup.position.clone().add(new THREE.Vector3(0, 2.45, 0));
    const target = mouseGroup.position.clone().add(new THREE.Vector3(0, 0.35, 0));
    const dir = target.sub(eye);
    if (dir.lengthSq() < 0.0001) return true;
    chefSightRay.set(eye, dir.normalize());
    chefSightRay.far = distToMouse - 0.25;
    return chefSightRay.intersectObjects(cameraCollisionMeshes, false).length === 0;
}

function updateChefAI(dt, time) {
    if (typeof chefGroup === 'undefined' || !chefGroup || typeof mouseGroup === 'undefined' || !mouseGroup) return;

    const distToMouse = chefGroup.position.distanceTo(mouseGroup.position);
    const playerHiding = (typeof isHiding !== 'undefined' && isHiding);

    // Perception & Chase Toggle. Nothing sets isHiding in this build, so breaking the
    // chef's line of sight is what ends a chase — without the lose-sight branch below
    // he would pursue permanently from the moment he first saw you.
    if (chefRealertTimer > 0) chefRealertTimer -= dt;

    let spotted = false;
    if (!playerHiding && chefRealertTimer <= 0 && distToMouse < CHEF_SIGHT_RANGE) {
        const dirToMouse = mouseGroup.position.clone().sub(chefGroup.position);
        dirToMouse.y = 0;
        if (dirToMouse.lengthSq() > 0.0001) dirToMouse.normalize();
        const chefForward = new THREE.Vector3(Math.sin(chefGroup.rotation.y), 0, Math.cos(chefGroup.rotation.y));

        if (distToMouse < CHEF_CLOSE_RANGE || chefForward.dot(dirToMouse) > 0.2) {
            spotted = chefHasLineOfSight(distToMouse);
        }
    }

    if (spotted) {
        chefLoseTimer = 0;
        if (!chefIsChasing) {
            chefIsChasing = true;
            playSound('alert');
            showToast('Spotted! Get a counter between you and him');
        }
    } else if (chefIsChasing) {
        chefLoseTimer += dt;
        if (chefLoseTimer > CHEF_LOSE_SIGHT_SECONDS) {
            chefIsChasing = false;
            chefLoseTimer = 0;
            chefRealertTimer = CHEF_REALERT_COOLDOWN;
            showToast('You lost him — keep rolling');
        }
    }

    // Attack State Machine
    if (chefAttackState === 'telegraph') {
        chefAttackTimer -= dt;
        showWarningRing(mouseGroup.position, 2.0);
        if (typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = -1.8;
        }
        if (chefAttackTimer <= 0) {
            chefAttackState = 'smash';
            chefAttackTimer = 0.2;
        }
    } else if (chefAttackState === 'smash') {
        chefAttackTimer -= dt;
        if (typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = 1.2;
        }
        if (distToMouse < 2.2 && !playerHiding) {
            if (typeof triggerGameOver === 'function') triggerGameOver();
        }
        if (chefAttackTimer <= 0) {
            chefAttackState = 'recover';
            chefAttackTimer = 0.4;
            hideAllWarningRings();
        }
    } else if (chefAttackState === 'recover') {
        chefAttackTimer -= dt;
        if (typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = THREE.MathUtils.lerp(chefShoulderR.rotation.x, -0.1, dt * 8.0);
        }
        if (chefAttackTimer <= 0) {
            chefAttackState = 'idle';
        }
    } else { // 'idle' state
        if (typeof chefIsChasing !== 'undefined' && chefIsChasing && distToMouse < 2.5 && !playerHiding) {
            chefAttackState = 'telegraph';
            chefAttackTimer = 0.45;
            showWarningRing(mouseGroup.position, 2.0);
            if (typeof playSound === 'function') playSound('alert');
        }
    }

    // Pathfinding & Movement
    if (chefAttackState === 'idle' || chefAttackState === 'recover') {
        let targetPos = null;
        if (typeof chefIsChasing !== 'undefined' && chefIsChasing && !playerHiding) {
            targetPos = mouseGroup.position.clone();
        } else if (typeof chefWaypoints !== 'undefined' && chefWaypoints.length > 0) {
            if (typeof currentWaypointIdx === 'undefined') currentWaypointIdx = 0;
            targetPos = chefWaypoints[currentWaypointIdx];
        }

        if (targetPos) {
            const diff = targetPos.clone().sub(chefGroup.position);
            diff.y = 0;
            const distToTarget = diff.length();

            if (typeof chefIsChasing !== 'undefined' && !chefIsChasing && distToTarget < 1.0) {
                if (typeof chefWaypoints !== 'undefined' && chefWaypoints.length > 0) {
                    currentWaypointIdx = (currentWaypointIdx + 1) % chefWaypoints.length;
                }
            }

            if (distToTarget > 0.1) {
                const targetAngle = Math.atan2(diff.x, diff.z);
                let angleDiff = targetAngle - chefGroup.rotation.y;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                chefGroup.rotation.y += angleDiff * Math.min(1.0, dt * 6.0);

                const moveSpeed = (typeof chefIsChasing !== 'undefined' && chefIsChasing) ? 5.2 : 3.0;
                chefGroup.position.x += Math.sin(chefGroup.rotation.y) * moveSpeed * dt;
                chefGroup.position.z += Math.cos(chefGroup.rotation.y) * moveSpeed * dt;

                chefGroup.position.x = Math.max(-14.5, Math.min(14.5, chefGroup.position.x));
                chefGroup.position.z = Math.max(-14.5, Math.min(14.5, chefGroup.position.z));
            }
        }
    }

    chefGroup.position.y = 0;

    if (typeof solveObstacleCollision === 'function') {
        solveObstacleCollision(chefGroup.position, 0.7);
    }

    // Animation updates
    const isMoving = (chefAttackState === 'idle' || chefAttackState === 'recover');
    if (isMoving) {
        if (typeof chefGaitPhase === 'undefined') chefGaitPhase = 0;
        chefGaitPhase += dt * ((typeof chefIsChasing !== 'undefined' && chefIsChasing) ? 11.0 : 6.5);
        const swing = Math.sin(chefGaitPhase) * 0.5;

        if (typeof chefLegL !== 'undefined' && chefLegL && chefLegL.hip) chefLegL.hip.rotation.x = swing;
        if (typeof chefLegR !== 'undefined' && chefLegR && chefLegR.hip) chefLegR.hip.rotation.x = -swing;
        if (typeof chefShoulderL !== 'undefined' && chefShoulderL) chefShoulderL.rotation.x = -swing * 0.5;
        if (chefAttackState === 'idle' && typeof chefShoulderR !== 'undefined' && chefShoulderR) {
            chefShoulderR.rotation.x = swing * 0.5;
        }
    }

    // Direct Catch Check
    if (distToMouse < 0.9 && !playerHiding) {
        if (typeof triggerGameOver === 'function') triggerGameOver();
    }

    // Spotlight position target
    if (typeof chefSpotlight !== 'undefined' && chefSpotlight && chefSpotlight.target) {
        chefSpotlight.target.position.set(
            Math.sin(chefGroup.rotation.y) * 2.5,
            0,
            Math.cos(chefGroup.rotation.y) * 2.5
        );
    }
}

// Restart hook: the chef forgets everything — chase, smash telegraphs, the
// route he was walking and where he stood. main.js calls this rather than writing the
// dozen module-local timers itself.
function resetChef() {
    chefIsChasing = false;
    chefAttackState = 'idle';
    chefAttackTimer = 0;
    chefSmashSequence = [];
    chefSmashIndex = 0;
    chefLoseTimer = 0;
    chefRealertTimer = 0;
    currentWaypointIdx = 0;
    chefGaitPhase = 0;
    hideAllWarningRings();
    chefGroup.position.set(-8, 0, -8);
    chefGroup.rotation.y = 0;
}
