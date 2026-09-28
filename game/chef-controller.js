/**
 * Sneaky Chefs: Kitchen Escape - Combined Chef Controller & AI System
 */

const chefRaycaster = new THREE.Raycaster();

if (typeof chefIsChasing === 'undefined') window.chefIsChasing = false;
if (typeof chefWaypoints === 'undefined') window.chefWaypoints = [];
if (typeof currentWaypointIndex === 'undefined') window.currentWaypointIndex = 0;

let chefState = 'PATROL'; // 'PATROL', 'ALERT', 'CHASE'
let chefSpeed = 2.2;
let chaseSpeed = 4.2;
let lostSightTimer = 0;
const MAX_LOST_SIGHT_TIME = 1.5;

/**
 * Checks direct Line of Sight (LOS) between Chef and Player.
 * Returns true ONLY if Chef can see player without obstruction or cardboard box.
 */
function canChefSeePlayer() {
    if (typeof isHiding !== 'undefined' && isHiding) {
        return false; // Cardboard box completely blocks vision
    }

    if (!chefGroup || !mouseGroup) return false;

    const chefEyePos = chefGroup.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    const playerTargetPos = mouseGroup.position.clone().add(new THREE.Vector3(0, 0.4, 0));

    const distToPlayer = chefEyePos.distanceTo(playerTargetPos);
    const SIGHT_RANGE = 14.0;
    if (distToPlayer > SIGHT_RANGE) return false;

    // Vision cone check (120 degree angle in front of Chef)
    const chefForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), chefGroup.rotation.y);
    const dirToPlayer = playerTargetPos.clone().sub(chefEyePos).normalize();

    const dot = chefForward.dot(dirToPlayer);
    if (dot < 0.25 && distToPlayer > 2.5) {
        return false;
    }

    // Raycast check against walls, counters, fridge, crates
    chefRaycaster.set(chefEyePos, dirToPlayer);
    if (typeof cameraCollisionMeshes !== 'undefined') {
        const intersects = chefRaycaster.intersectObjects(cameraCollisionMeshes, true);
        if (intersects.length > 0 && intersects[0].distance < distToPlayer - 0.2) {
            return false; // Wall or obstacle in front
        }
    }

    return true;
}

function updateChefController(dt) {
    if (typeof isGameOver !== 'undefined' && isGameOver) return;
    if (!chefGroup || !mouseGroup) return;

    const distToPlayer = chefGroup.position.distanceTo(mouseGroup.position);
    const canSee = canChefSeePlayer();

    // AI State Machine
    if (canSee) {
        chefState = 'CHASE';
        chefIsChasing = true;
        lostSightTimer = 0;
    } else if (chefIsChasing) {
        lostSightTimer += dt;
        if (lostSightTimer >= MAX_LOST_SIGHT_TIME || distToPlayer > 18.0) {
            chefState = 'PATROL';
            chefIsChasing = false;
        }
    }

    if (chefState === 'CHASE') {
        // Chase logic
        const dir = mouseGroup.position.clone().sub(chefGroup.position);
        dir.y = 0;
        dir.normalize();

        const targetAngle = Math.atan2(dir.x, dir.z);
        chefGroup.rotation.y = THREE.MathUtils.lerp(chefGroup.rotation.y, targetAngle, dt * 8.0);

        chefGroup.position.x += dir.x * chaseSpeed * dt;
        chefGroup.position.z += dir.z * chaseSpeed * dt;

        // Catch player condition
        if (distToPlayer < 1.15 && !isHiding) {
            if (typeof triggerGameOver === 'function') {
                triggerGameOver(false);
            }
        }
    } else {
        // Patrol logic along waypoints
        if (chefWaypoints && chefWaypoints.length > 0) {
            const targetWP = chefWaypoints[currentWaypointIndex];
            const dir = targetWP.clone().sub(chefGroup.position);
            dir.y = 0;
            const distToWP = dir.length();

            if (distToWP < 0.8) {
                currentWaypointIndex = (currentWaypointIndex + 1) % chefWaypoints.length;
            } else {
                dir.normalize();
                const targetAngle = Math.atan2(dir.x, dir.z);
                chefGroup.rotation.y = THREE.MathUtils.lerp(chefGroup.rotation.y, targetAngle, dt * 5.0);

                chefGroup.position.x += dir.x * chefSpeed * dt;
                chefGroup.position.z += dir.z * chefSpeed * dt;
            }
        }
    }
}