/**
 * world/physics.js — where a thing may stand, and what stops it.
 *
 * getFloorY              the highest surface under a point, reachable within STEP_HEIGHT.
 * solveObstacleCollision min-axis push-out from { x, z, w, d, h } boxes.
 * clampToRect/clampToArea the rect that seals whichever room the player is in.
 * activeObstacles / activeCollision / areaRect pick the kitchen's or the base's geometry
 * from `currentArea`, which is why one scene can hold two unrelated rooms.
 *
 * Walls are camera geometry, not obstacles, so the clamp — not the walls — contains the
 * player. Obstacle sets are filled by world/kitchen.js, world/fridge.js and world/burrow.js.
 */
const STEP_HEIGHT = 0.12;
const KITCHEN_BOUND = 15.35;

// Which area the player is standing in decides which set of geometry matters: the
// burrow is a second room parked at x = BURROW_ORIGIN_X in the same scene.
function activeObstacles() {
    return currentArea === 'burrow' ? burrowObstacles : kitchenObstacles;
}

function activeCollision() {
    return currentArea === 'burrow' ? burrowCollision : cameraCollisionMeshes;
}

function areaRect() {
    return currentArea === 'burrow'
        ? { originX: BURROW_ORIGIN_X, bound: BURROW_BOUND }
        : { originX: 0, bound: KITCHEN_BOUND };
}

function clampToRect(vec, originX, bound) {
    const min = originX - bound, max = originX + bound;
    if (vec.x < min) vec.x = min;
    else if (vec.x > max) vec.x = max;
    if (vec.z < -bound) vec.z = -bound;
    else if (vec.z > bound) vec.z = bound;
}

// Walls are visual/camera geometry, not obstacles, so without this the mouse would
// simply walk out of the room (and, in the burrow, out through the exit arch).
function clampToArea(vec) {
    const rect = areaRect();
    clampToRect(vec, rect.originX, rect.bound);
}


function getFloorY(px, pz, feetY = Infinity, obstacles = activeObstacles()) {
    let maxY = 0;
    for (const obs of obstacles) {
        if (Math.abs(px - obs.x) < obs.w / 2 && Math.abs(pz - obs.z) < obs.d / 2) {
            if (feetY >= obs.h - STEP_HEIGHT && obs.h > maxY) maxY = obs.h;
        }
    }
    return maxY;
}

function solveObstacleCollision(pos, radius, obstacles = activeObstacles()) {
    for (const obs of obstacles) {
        const minX = obs.x - obs.w / 2 - radius;
        const maxX = obs.x + obs.w / 2 + radius;
        const minZ = obs.z - obs.d / 2 - radius;
        const maxZ = obs.z + obs.d / 2 + radius;

        if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ && pos.y < obs.h - STEP_HEIGHT) {
            const dxMin = Math.abs(pos.x - minX);
            const dxMax = Math.abs(pos.x - maxX);
            const dzMin = Math.abs(pos.z - minZ);
            const dzMax = Math.abs(pos.z - maxZ);
            const minDist = Math.min(dxMin, dxMax, dzMin, dzMax);

            if (minDist === dxMin) pos.x = minX;
            else if (minDist === dxMax) pos.x = maxX;
            else if (minDist === dzMin) pos.z = minZ;
            else if (minDist === dzMax) pos.z = maxZ;
        }
    }
}

// Particle dust puffs sharing geometry and material to prevent GC stuttering
