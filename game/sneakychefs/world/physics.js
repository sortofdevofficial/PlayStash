/**
 * world/physics.js — where a thing may stand, and what stops it.
 *
 * getFloorY              the highest surface under a point, reachable within STEP_HEIGHT.
 * solveObstacleCollision min-axis push-out from { x, z, w, d, h } boxes.
 * solvePropCollision     the same push-out for a rolling prop, plus the velocity fix that
 *                        keeps it sliding along a face instead of grinding into it.
 * clampPropToRect        the room bounds for a prop, killing speed aimed at a wall.
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

const BODY_BOUNCE = 0.34;

// A rolling prop needs the velocity corrected along with the position. Relocating it out of
// a counter and leaving its speed pointing into the counter is what made props "stick": the
// next frame moved them straight back in, so they ground to a halt against the face instead
// of skidding along it. The normal component is reflected, the tangential one is kept.
function solvePropCollision(pos, vel, radius, obstacles = activeObstacles()) {
    for (const obs of obstacles) {
        if (pos.y >= obs.h - STEP_HEIGHT) continue;
        const hx = obs.w / 2 + radius, hz = obs.d / 2 + radius;
        const dx = pos.x - obs.x, dz = pos.z - obs.z;
        if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;

        // Leave through whichever face is crossed least deeply, the way a round body would.
        const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
        let nx = 0, nz = 0;
        if (ox < oz) {
            nx = dx > 0 ? 1 : -1;
            pos.x = obs.x + nx * hx;
        } else {
            nz = dz > 0 ? 1 : -1;
            pos.z = obs.z + nz * hz;
        }

        const into = vel.x * nx + vel.z * nz;      // negative while still aimed at the box
        if (into < 0) {
            vel.x -= nx * into * (1 + BODY_BOUNCE);
            vel.z -= nz * into * (1 + BODY_BOUNCE);
        }
    }
}

// The room's own bounds, for a prop. No rebound here: the mouse hole is set into this wall,
// so a wheel that reaches it has to stay put rather than be thrown back into the room.
function clampPropToRect(pos, vel, originX, bound) {
    const min = originX - bound, max = originX + bound;
    if (pos.x < min) { pos.x = min; if (vel.x < 0) vel.x = 0; }
    else if (pos.x > max) { pos.x = max; if (vel.x > 0) vel.x = 0; }
    if (pos.z < -bound) { pos.z = -bound; if (vel.z < 0) vel.z = 0; }
    else if (pos.z > bound) { pos.z = bound; if (vel.z > 0) vel.z = 0; }
}

// Particle dust puffs sharing geometry and material to prevent GC stuttering
