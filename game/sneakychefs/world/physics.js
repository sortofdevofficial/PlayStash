/**
 * world/physics.js — where a thing may stand, and what stops it.
 *
 * getFloorY              the highest surface under a point, reachable within STEP_HEIGHT.
 * solveObstacleCollision min-axis push-out from { x, z, w, d, h } boxes.
 * solvePropCollision     the same push-out for a rolling prop, plus the velocity fix that
 *                        keeps it sliding along a face instead of grinding into it.
 * clampPropToRect/clampToRect the invisible rect that seals one room — only for rooms that
 *                        ask for it, which since the house became walkable is just the base.
 *
 * Everything else is real geometry. The house is one connected floorplan, so a mouse stops
 * at a wall because there is a wall there, not because a clamp said so: world/rooms.js
 * merges every room's furniture and the whole house's masonry into `worldObstacles` and its
 * camera-dressing meshes into `worldCollisionMeshes`, and both are the default argument here.
 */
const STEP_HEIGHT = 0.12;

// A room is the rect (ox ± hx, oz ± hz). Walls straddle the rect edge, so the clamp stops
// the mouse at the wall's inner face rather than in the middle of the masonry.
function clampToRect(vec, room) {
    if (vec.x < room.ox - room.hx) vec.x = room.ox - room.hx;
    else if (vec.x > room.ox + room.hx) vec.x = room.ox + room.hx;
    if (vec.z < room.oz - room.hz) vec.z = room.oz - room.hz;
    else if (vec.z > room.oz + room.hz) vec.z = room.oz + room.hz;
}

// Most rooms are bounded by real masonry, so there is nothing to clamp: the exception is the
// base, whose cutaway shell is drawn rather than built, and which therefore has no obstacles
// to walk into. Rooms declare `clamp: true` in map/rooms.js to opt back in.
function clampToArea(vec) {
    const room = activeRoom();
    if (room.clamp) clampToRect(vec, room);
}


function getFloorY(px, pz, feetY = Infinity, obstacles = worldObstacles) {
    let maxY = 0;
    for (const obs of obstacles) {
        if (Math.abs(px - obs.x) < obs.w / 2 && Math.abs(pz - obs.z) < obs.d / 2) {
            if (feetY >= obs.h - STEP_HEIGHT && obs.h > maxY) maxY = obs.h;
        }
    }
    return maxY;
}

function solveObstacleCollision(pos, radius, obstacles = worldObstacles) {
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
function solvePropCollision(pos, vel, radius, obstacles = worldObstacles) {
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

// The rect bounds for a prop in a clamped room. No rebound here: the base's exit arch is set
// into the shell, so a load that reaches it has to stay put rather than be thrown back inside.
function clampPropToRect(pos, vel, room) {
    const minX = room.ox - room.hx, maxX = room.ox + room.hx;
    const minZ = room.oz - room.hz, maxZ = room.oz + room.hz;
    if (pos.x < minX) { pos.x = minX; if (vel.x < 0) vel.x = 0; }
    else if (pos.x > maxX) { pos.x = maxX; if (vel.x > 0) vel.x = 0; }
    if (pos.z < minZ) { pos.z = minZ; if (vel.z < 0) vel.z = 0; }
    else if (pos.z > maxZ) { pos.z = maxZ; if (vel.z > 0) vel.z = 0; }
}

// Particle dust puffs sharing geometry and material to prevent GC stuttering
