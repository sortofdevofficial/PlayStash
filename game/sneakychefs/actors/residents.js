/**
 * actors/residents.js — the mice who live in the base.
 *
 * Four rig-built residents that trot between home spots, idle, and scurry about when the player
 * walks in. They are decoration, not threat: nothing here can hurt the player, and the chef's
 * beat never goes north of the kitchen, so the den is quiet unless he has followed you home.
 */
let burrowMice = [];
function spawnBurrowMice() {
    burrowMice = [];
    const den = roomById('burrow');
    const spots = [
        { x: den.ox + 4.5, z: den.oz + 4.5, hat: true },
        { x: den.ox - 4, z: den.oz + 1, hat: false },
        { x: den.ox + 0.5, z: den.oz - 4.5, hat: false },
        { x: den.ox - 6, z: den.oz - 2, hat: false }
    ];

    spots.forEach((spot, i) => {
        const rig = createLowPolyMouse();
        const g = rig.mouseGroup;
        g.position.set(spot.x, 0, spot.z);
        // The player wears the chef hat; keep it on one resident only so the base
        // reads as family, not copies.
        if (!spot.hat && rig.hatGroup) rig.hatGroup.visible = false;
        g.scale.setScalar(0.8 + i * 0.12);
        burrowGroup.add(g);

        burrowMice.push({
            rig: g,
            tail: rig.tailSegments,
            legs: rig.legJoints,
            spine: rig.spine,
            phase: Math.random() * Math.PI * 2,
            target: new THREE.Vector3(spot.x, 0, spot.z),
            restTimer: 0.5 + Math.random() * 2,
            walking: false,
            home: { x: spot.x, z: spot.z }
        });
    });
}

// Idle, pick a spot, trot over, repeat — enough life to read as a home without
// competing with the player's own rig.
function updateBurrowMice(dt, time) {
    if (currentArea !== 'burrow') return;
    const den = roomById('burrow');

    burrowMice.forEach(m => {
        const pos = m.rig.position;

        if (!m.walking) {
            m.restTimer -= dt;
            if (m.restTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 1.5 + Math.random() * 3.5;
                m.target.set(
                    THREE.MathUtils.clamp(m.home.x + Math.cos(angle) * dist, den.ox - den.hx + 1, den.ox + den.hx - 1),
                    0,
                    THREE.MathUtils.clamp(m.home.z + Math.sin(angle) * dist, den.oz - den.hz + 1, den.oz + den.hz - 1)
                );
                m.walking = true;
            }
        } else {
            const dir = m.target.clone().sub(pos);
            dir.y = 0;
            const dist = dir.length();
            if (dist < 0.25) {
                m.walking = false;
                m.restTimer = 1.2 + Math.random() * 2.8;
            } else {
                dir.normalize();
                const speed = 1.35;
                pos.x += dir.x * speed * dt;
                pos.z += dir.z * speed * dt;
                solveObstacleCollision(pos, 0.28, burrowObstacles);

                const targetAngle = Math.atan2(dir.x, dir.z) + Math.PI;
                let diff = targetAngle - m.rig.rotation.y;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                m.rig.rotation.y += diff * Math.min(1, dt * 8);

                m.phase += dt * 9;
                // Diagonal trot, matching the player's own gait
                m.legs.forEach((j, i) => {
                    const pair = (i === 0 || i === 3) ? m.phase : m.phase + Math.PI;
                    const swing = Math.sin(pair) * 0.42;
                    j.hip.rotation.x = swing;
                    j.knee.rotation.x = -Math.max(0, swing) * 0.7;
                });
                m.spine.position.y = Math.abs(Math.sin(m.phase)) * 0.012;
            }
        }

        if (!m.walking) {
            m.legs.forEach(j => {
                j.hip.rotation.x = THREE.MathUtils.lerp(j.hip.rotation.x, 0, dt * 5);
                j.knee.rotation.x = THREE.MathUtils.lerp(j.knee.rotation.x, 0, dt * 5);
            });
            m.spine.position.y = 0;
        }

        // Tail: lazy travelling wave, faster while trotting
        const n = m.tail.length;
        for (let i = 0; i < n; i++) {
            const k = i / (n - 1);
            const amp = (0.06 + (m.walking ? 0.12 : 0.04)) * (0.4 + k * 1.1);
            const sway = Math.sin(m.phase * 0.6 - i * 0.8) * amp;
            m.tail[i].rotation.z = THREE.MathUtils.lerp(m.tail[i].rotation.z, sway, Math.min(1, dt * 10));
            m.tail[i].rotation.x = THREE.MathUtils.lerp(
                m.tail[i].rotation.x,
                i === 0 ? -Math.PI / 2 - 0.08 : 0.06 * k,
                Math.min(1, dt * 8)
            );
        }
    });
}

