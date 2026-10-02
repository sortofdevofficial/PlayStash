/**
 * world/physics.js — where a thing may stand, and what stops it.
 *
 * getFloorY              the highest surface under a point, reachable within STEP_HEIGHT.
 * solveObstacleCollision min-axis push-out from { x, z, w, d, h } boxes.
 * solvePropCollision     the same push-out for a rolling prop, plus the velocity fix that
 *                        keeps it sliding along a face instead of grinding into it.
 *
 * Everything else is real geometry. The house is one connected floorplan and every room in it is
 * walled, so a mouse or a wheel stops at a wall because there is a wall there: world/rooms.js
 * merges every room's furniture and the whole house's masonry into `worldObstacles` and its
 * camera-dressing meshes into `worldCollisionMeshes`, and both are the default argument here.
 */
const STEP_HEIGHT = 0.12;

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

// Particle dust puffs sharing geometry and material to prevent GC stuttering
